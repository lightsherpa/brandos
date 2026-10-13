-- Certifier S2. FILE ONLY: do not apply to shared databases or seed records.
create table if not exists public.certifier_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_id uuid not null references public.bios(id) on delete cascade,
  version integer not null check (version > 0),
  brief jsonb,
  cost_usd numeric not null check (cost_usd between 0 and 0.30),
  model text not null,
  run_log jsonb not null default '[]',
  status text not null check (status in ('completed', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or brief is not null)
);
create index if not exists certifier_briefs_latest on public.certifier_briefs(bio_id, created_at desc);
create table if not exists public.certifier_question_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_id uuid not null references public.bios(id) on delete cascade,
  -- Drafts can be saved before the host persists its completed/failed run.
  run_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  section text not null check (section in ('identity','visual','voice','audience','goals','strategic')),
  claim_ids text[] not null check (cardinality(claim_ids) > 0),
  text text not null check (char_length(text) between 1 and 300),
  why jsonb not null,
  answer_type text not null check (answer_type in ('free_text','choice','upload')),
  created_at timestamptz not null default now()
);
create table if not exists public.certifier_claim_confirmations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_id uuid not null references public.bios(id) on delete cascade,
  version integer not null check (version > 0),
  claim_id text not null,
  actor_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (bio_id, version, claim_id)
);
alter table public.certifier_briefs enable row level security;
alter table public.certifier_question_drafts enable row level security;
alter table public.certifier_claim_confirmations enable row level security;
-- Internal agent briefs and drafts are never accessible to clients directly.
revoke all on public.certifier_briefs, public.certifier_question_drafts, public.certifier_claim_confirmations from anon, authenticated;
grant all on public.certifier_briefs, public.certifier_question_drafts, public.certifier_claim_confirmations to service_role;

-- A dedicated, non-login role; its scope is set by the trusted run host. Never
-- grant this role to authenticated or service_role, nor give a run a user JWT.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'certifier_agent') then create role certifier_agent nologin; end if;
end $$;
grant usage on schema public to certifier_agent;
revoke all on public.bios, public.bio_sources from certifier_agent;
grant select on public.bios, public.bio_sources to certifier_agent;
drop policy if exists certifier_agent_bios_read on public.bios;
create policy certifier_agent_bios_read on public.bios for select to certifier_agent using (
  brand_id::text = current_setting('certifier.brand_id', true)
  and id::text = current_setting('certifier.bio_id', true)
  and exists (select 1 from public.brands b where b.id = brand_id and b.workspace_id::text = current_setting('certifier.workspace_id', true))
);
-- brands SELECT limited to the public brand header for the scope check.
grant select (id, workspace_id, name, url, industry, default_locale) on public.brands to certifier_agent;
drop policy if exists certifier_agent_brand_read on public.brands;
create policy certifier_agent_brand_read on public.brands for select to certifier_agent using (
  id::text = current_setting('certifier.brand_id', true)
  and workspace_id::text = current_setting('certifier.workspace_id', true)
);
drop policy if exists certifier_agent_sources_read on public.bio_sources;
create policy certifier_agent_sources_read on public.bio_sources for select to certifier_agent using (
  brand_id::text = current_setting('certifier.brand_id', true)
  and exists (select 1 from public.brands b where b.id = brand_id and b.workspace_id::text = current_setting('certifier.workspace_id', true))
);
