-- Durable workflow status; only server workers may mutate it.
create table public.discovery_runs (
 id uuid primary key,
 brand_id uuid not null references public.brands(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 stage text not null default 'queued' check(stage in ('queued','scrape','visual','read','research','synthesize','save','done')),
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 error_code text,
 bio_id uuid references public.bios(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index discovery_runs_brand_idx on public.discovery_runs(brand_id,created_at desc);
alter table public.discovery_runs enable row level security;
revoke all on public.discovery_runs from public,anon,authenticated;
grant select on public.discovery_runs to authenticated;
grant all on public.discovery_runs to service_role;
create policy discovery_runs_workspace_read on public.discovery_runs for select to authenticated
 using(private.current_user_can_access_workspace(workspace_id));
