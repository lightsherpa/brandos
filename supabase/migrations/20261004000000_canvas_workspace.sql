-- Canvas v2 is opt-in. Writes go through the validated API; RLS permits scoped reads only.
alter table public.workspaces add column if not exists canvas_v2_enabled boolean not null default false;
create table public.canvas_layouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brief_id uuid not null unique references public.briefs(id) on delete cascade,
  creation_key uuid unique,
  schema_version integer not null default 1 check (schema_version = 1),
  revision integer not null default 0 check (revision >= 0),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.canvas_quotes (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvas_layouts(id) on delete cascade,
  node_id uuid not null,
  created_by uuid not null references auth.users(id),
  fingerprint text not null,
  request jsonb not null,
  credits integer not null check (credits > 0),
  state text not null default 'pending' check (state in ('pending','claimed','failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.runs add column if not exists canvas_id uuid references public.canvas_layouts(id) on delete set null;
alter table public.runs add column if not exists canvas_node_id uuid;
alter table public.runs add column if not exists canvas_snapshot jsonb;
create unique index runs_one_active_canvas_node on public.runs(canvas_id,canvas_node_id) where canvas_id is not null and status in ('queued','running');
create index runs_canvas_node_idx on public.runs(canvas_id,canvas_node_id,started_at);
-- The quote ID becomes the run's primary key: one approved request can produce at most one run.
create table public.canvas_proposals (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvas_layouts(id) on delete cascade,
  base_revision integer not null,
  document jsonb not null,
  summary text not null,
  created_by uuid not null references auth.users(id),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.canvas_layouts enable row level security;
alter table public.canvas_quotes enable row level security;
alter table public.canvas_proposals enable row level security;
create policy canvas_layout_read on public.canvas_layouts for select to authenticated
  using (public.current_user_has_permission('brief.read',workspace_id));
-- Quotes contain internal routing and prompts. Only the server reads them.
revoke all on public.canvas_quotes, public.canvas_proposals from anon, authenticated;
revoke all on public.canvas_layouts from anon, authenticated;
grant select on public.canvas_layouts to authenticated;
grant all on public.canvas_layouts,public.canvas_quotes,public.canvas_proposals to service_role;

-- CAS and proposal consumption share one transaction, preventing proposal replay.
create function public.apply_canvas_proposal(p_canvas uuid, p_proposal uuid, p_user uuid)
returns setof public.canvas_layouts language plpgsql security definer set search_path = public as $$
declare proposal public.canvas_proposals; current_layout public.canvas_layouts;
begin
  select * into proposal from public.canvas_proposals where id=p_proposal and canvas_id=p_canvas and created_by=p_user for update;
  if not found then raise exception 'Proposal not found'; end if;
  select * into current_layout from public.canvas_layouts where id=p_canvas for update;
  if proposal.applied_at is not null then return next current_layout; return; end if;
  if current_layout.revision <> proposal.base_revision then raise exception 'Canvas changed; request a new proposal'; end if;
  update public.canvas_layouts set document=proposal.document, revision=revision+1, updated_at=now() where id=p_canvas returning * into current_layout;
  update public.canvas_proposals set applied_at=now() where id=p_proposal;
  return next current_layout;
end $$;
revoke all on function public.apply_canvas_proposal(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_canvas_proposal(uuid,uuid,uuid) to service_role;
