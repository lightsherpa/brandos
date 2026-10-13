-- Certifier v2 S3: Creative Director ↔ client questions, one thread per brand + job.
-- ponytail: the thread is (brand_id, job_id) — no separate cert_threads table.
-- A CD question starts as a draft (sent_at null) and is batch-sent per section.
-- A client answer replies to a sent question; its evidence is a bio_sources row
-- (kind 'client_answer' for text, or the existing file_upload row). Answers never
-- touch bios. Additive and idempotent.
create table if not exists public.cert_messages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  job_id uuid not null references public.steward_jobs(id) on delete cascade,
  bio_version integer not null check (bio_version > 0),
  -- claim_ids are SHA-256([brand_id, bio_version, field_path]); field_paths
  -- remain separate for display and schema validation at the API boundary.
  claim_ids text[] not null check (cardinality(claim_ids) between 1 and 20),
  field_paths text[] not null check (cardinality(field_paths) = cardinality(claim_ids)),
  idempotency_key text,
  request_hash text,
  -- No 'agent' value on purpose: the certifier agent can never post.
  author_role text not null check (author_role in ('cd', 'client')),
  author_user_id uuid,
  reply_to uuid references public.cert_messages(id) on delete cascade,
  body text check (body is null or char_length(body) between 1 and 4000),
  source_id uuid references public.bio_sources(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cert_messages_has_content check (body is not null or source_id is not null),
  constraint cert_messages_client_reply check (author_role = 'cd' or (reply_to is not null and sent_at is not null and author_user_id is not null and idempotency_key is not null and request_hash is not null)),
  constraint cert_messages_answer_key unique (brand_id, author_user_id, idempotency_key)
);
create index if not exists cert_messages_job_idx on public.cert_messages (job_id, created_at);
create index if not exists cert_messages_brand_idx on public.cert_messages (brand_id, sent_at);

alter table public.cert_messages enable row level security;
revoke all on table public.cert_messages from anon, authenticated;
grant select (id, brand_id, job_id, bio_version, claim_ids, field_paths,
  author_role, reply_to, body, source_id, sent_at, created_at)
  on public.cert_messages to authenticated;
grant all on table public.cert_messages to service_role;
-- Clients read their own brand's sent messages only (brands RLS scopes to the
-- caller's workspace). Drafts stay server-side. Writes go through the API
-- (service role); there are no insert/update/delete policies.
drop policy if exists cert_messages_brand_read on public.cert_messages;
create policy cert_messages_brand_read on public.cert_messages for select to authenticated
  using (sent_at is not null and brand_id in (select id from public.brands));

-- Service-only transaction: key lock covers simultaneous requests, including
-- retries with a different question. No orphan text evidence on failed writes.
create or replace function public.answer_cert_question(
  p_brand_id uuid, p_user_id uuid, p_question_id uuid, p_key text,
  p_body text default null, p_source_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q cert_messages;
  answer cert_messages;
  job steward_jobs;
  fingerprint text;
  evidence_id uuid;
begin
  if p_key is null or p_key !~ '^[a-zA-Z0-9_-]{8,128}$'
    or (p_body is null and p_source_id is null)
    or (p_body is not null and char_length(p_body) not between 1 and 4000) then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Invalid answer');
  end if;
  fingerprint := md5(jsonb_build_array(p_question_id, p_body, p_source_id)::text);
  perform pg_advisory_xact_lock(hashtextextended(p_brand_id::text || ':' || p_user_id::text || ':' || p_key, 0));
  select * into answer from cert_messages where brand_id = p_brand_id
    and author_user_id = p_user_id and idempotency_key = p_key;
  if found then
    if answer.request_hash <> fingerprint then
      return jsonb_build_object('ok', false, 'status', 409, 'code', 'IDEMPOTENCY_CONFLICT', 'error', 'Key already used for a different answer');
    end if;
    return jsonb_build_object('ok', true, 'message', to_jsonb(answer) - array['author_user_id','idempotency_key','request_hash']);
  end if;
  select * into q from cert_messages where id = p_question_id and brand_id = p_brand_id
    and author_role = 'cd' and sent_at is not null;
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'error', 'Question not found');
  end if;
  select * into job from steward_jobs where id = q.job_id for update;
  if job.status in ('completed','cancelled','rejected','decertified')
    or exists (select 1 from bios where id = job.bio_id and certified) then
    return jsonb_build_object('ok', false, 'status', 409, 'code', 'JOB_CLOSED', 'error', 'Job is closed or certified');
  end if;
  evidence_id := p_source_id;
  if p_source_id is not null then
    if not exists (select 1 from bio_sources where id = p_source_id and brand_id = p_brand_id and kind = 'file_upload') then
      return jsonb_build_object('ok', false, 'status', 400, 'code', 'SOURCE', 'error', 'Upload not found for this brand');
    end if;
  else
    insert into bio_sources (brand_id, kind, bucket, src, signals)
      values (p_brand_id, 'client_answer', null, p_body,
        jsonb_build_object('claim_ids', q.claim_ids, 'field_paths', q.field_paths,
          'bio_version', q.bio_version, 'question_id', q.id, 'question', q.body))
      returning id into evidence_id;
  end if;
  insert into cert_messages (brand_id, job_id, bio_version, claim_ids, field_paths,
    author_role, author_user_id, reply_to, body, source_id, sent_at, idempotency_key, request_hash)
    values (p_brand_id, q.job_id, q.bio_version, q.claim_ids, q.field_paths,
      'client', p_user_id, q.id, p_body, evidence_id, now(), p_key, fingerprint)
    returning * into answer;
  return jsonb_build_object('ok', true, 'message', to_jsonb(answer) - array['author_user_id','idempotency_key','request_hash']);
end;
$$;
revoke all on function public.answer_cert_question(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.answer_cert_question(uuid, uuid, uuid, text, text, uuid) to service_role;
