-- Composer recovery records only. Production briefs and their sharing remain unchanged.
create table public.brief_drafts (
  id uuid primary key,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null check (revision > 0),
  mutation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brief_drafts_resume_idx on public.brief_drafts (owner_user_id, brand_id, updated_at desc);
alter table public.brief_drafts enable row level security;
-- Only authenticated, scoped API handlers using service_role may access these records.
revoke all on public.brief_drafts from anon, authenticated;
grant select, insert, update, delete on public.brief_drafts to service_role;
