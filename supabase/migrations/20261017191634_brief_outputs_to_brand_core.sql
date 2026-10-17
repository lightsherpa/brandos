-- HOLD: local/dev only until Oscar approves the prod apply.
-- Brief-only images never enter bio_sources or a certified bios payload.
create table if not exists public.brief_references (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,
 owner_id uuid not null references public.users(id),
 brief_id uuid references public.briefs(id) on delete restrict,
 storage_path text not null unique,
 name text not null,
 created_at timestamptz not null default now()
);
create index if not exists brief_references_owner_idx on public.brief_references(owner_id);
create index if not exists brief_references_brief_idx on public.brief_references(brief_id);
create index if not exists brief_references_brand_owner_idx on public.brief_references(brand_id,owner_id);
-- Discard explicitly detaches bound references. RESTRICT blocks a late upload
-- from becoming an orphan while its draft is being discarded.
alter table public.brief_references add column if not exists draft_id uuid references public.brief_drafts(id) on delete restrict;
alter table public.brief_references add column if not exists sha256 text;
alter table public.brief_references add column if not exists cleanup_pending boolean not null default false;
create unique index if not exists brief_references_draft_hash_idx on public.brief_references(draft_id,owner_id,brand_id,sha256) where brief_id is null;
create table if not exists public.brand_output_examples (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,
 brief_id uuid not null references public.briefs(id) on delete restrict,
 deliverable_key text not null,
 output_ids uuid[] not null check(cardinality(output_ids)>0),
 reference_ids uuid[] not null default '{}',
 snapshot jsonb not null,
 addition_status text not null default 'pending' check(addition_status in ('pending','approved')),
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default now(),
 unique(brand_id,brief_id,deliverable_key)
);
create index if not exists brand_output_examples_brand_idx on public.brand_output_examples(brand_id,created_at desc);
create index if not exists brand_output_examples_brief_idx on public.brand_output_examples(brief_id);
create index if not exists brand_output_examples_creator_idx on public.brand_output_examples(created_by);
alter table public.brief_references enable row level security;
alter table public.brand_output_examples enable row level security;
revoke all on public.brief_references,public.brand_output_examples from public,anon,authenticated;
grant all on public.brief_references,public.brand_output_examples to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('brief-references','brief-references',false,5242880,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do nothing;
-- Even permissive legacy bucket policies cannot expose these brief-only files.
drop policy if exists brief_references_service_only on storage.objects;
create policy brief_references_service_only on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'brief-references') with check(bucket_id<>'brief-references');
notify pgrst,'reload schema';

-- Register the example and append its reviewable Brand Core candidate atomically.
-- The existing certified row and its reference list are never mutated.
alter table public.brand_output_examples add column if not exists candidate_bio_id uuid references public.bios(id) on delete restrict;
create index if not exists brand_output_examples_candidate_idx on public.brand_output_examples(candidate_bio_id);
create or replace function public.propose_brand_output_example(p_brand_id uuid,p_brief_id uuid,p_delivery_key text,p_output_ids uuid[],p_snapshot jsonb,p_user_id uuid)
returns public.brand_output_examples language plpgsql security definer set search_path=public as $$
declare v_example public.brand_output_examples; v_bio public.bios; v_candidate public.bios; v_ids jsonb; v_refs uuid[];
begin
 perform pg_advisory_xact_lock(hashtextextended('bio:'||p_brand_id::text,0));
 if not exists(select 1 from public.briefs where id=p_brief_id and brand_id=p_brand_id) then raise exception 'BRIEF_SCOPE_MISMATCH'; end if;
 select * into v_example from public.brand_output_examples where brand_id=p_brand_id and brief_id=p_brief_id and deliverable_key=p_delivery_key;
 if found then return v_example; end if;
 if coalesce(cardinality(p_output_ids),0)=0 or exists(select 1 from unnest(p_output_ids) selected(output_id) where not exists(select 1 from public.outputs o where o.id=selected.output_id and o.brief_id=p_brief_id and o.workflow_status='client_approved' and o.client_reviewed_by is not null and o.client_reviewed_at is not null)) then raise exception 'APPROVED_OUTPUT_REQUIRED'; end if;
 select * into v_bio from public.bios where brand_id=p_brand_id order by version desc limit 1;
 if not found then raise exception 'BRAND_CORE_REQUIRED'; end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into v_refs from public.brief_references where brief_id=p_brief_id and brand_id=p_brand_id;
 insert into public.brand_output_examples(brand_id,brief_id,deliverable_key,output_ids,reference_ids,snapshot,created_by)
 values(p_brand_id,p_brief_id,p_delivery_key,p_output_ids,v_refs,p_snapshot,p_user_id) returning * into v_example;
 v_ids:=(case when jsonb_typeof(v_bio.payload->'approved_output_examples')='array' then v_bio.payload->'approved_output_examples' else '[]'::jsonb end)||jsonb_build_array(v_example.id);
 select * into v_candidate from public.append_bio_version(p_brand_id,jsonb_set(v_bio.payload,'{approved_output_examples}',v_ids),v_bio.score,p_user_id,null,v_bio.version);
 update public.brand_output_examples set candidate_bio_id=v_candidate.id where id=v_example.id returning * into v_example;
 return v_example;
end $$;
revoke all on function public.propose_brand_output_example(uuid,uuid,text,uuid[],jsonb,uuid) from public,anon,authenticated;
grant execute on function public.propose_brand_output_example(uuid,uuid,text,uuid[],jsonb,uuid) to service_role;
notify pgrst,'reload schema';
