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
  claim_ids text[] not null default '{}' check (cardinality(claim_ids) <= 20),
  -- No 'agent' value on purpose: the certifier agent can never post.
  author_role text not null check (author_role in ('cd', 'client')),
  author_user_id uuid,
  reply_to uuid references public.cert_messages(id) on delete cascade,
  body text check (body is null or char_length(body) between 1 and 4000),
  source_id uuid references public.bio_sources(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cert_messages_has_content check (body is not null or source_id is not null),
  constraint cert_messages_client_reply check (author_role = 'cd' or (reply_to is not null and sent_at is not null))
);
create index if not exists cert_messages_job_idx on public.cert_messages (job_id, created_at);
create index if not exists cert_messages_brand_idx on public.cert_messages (brand_id, sent_at);

alter table public.cert_messages enable row level security;
revoke all on table public.cert_messages from anon, authenticated;
grant select on table public.cert_messages to authenticated;
-- Clients read their own brand's sent messages only (brands RLS scopes to the
-- caller's workspace). Drafts stay server-side. Writes go through the API
-- (service role); there are no insert/update/delete policies.
drop policy if exists cert_messages_brand_read on public.cert_messages;
create policy cert_messages_brand_read on public.cert_messages for select to authenticated
  using (sent_at is not null and brand_id in (select id from public.brands));
