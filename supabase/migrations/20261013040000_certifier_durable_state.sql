-- S2 durable state. 20261013030000 is reserved by PR #18's discovery gate.
-- File only: never apply to shared databases as part of this handoff.
create table public.certifier_budgets (
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_version integer not null check (bio_version > 0),
  workspace_id uuid not null references public.workspaces(id),
  bio_id uuid not null references public.bios(id) on delete cascade,
  spent numeric(12,9) not null default 0 check (spent between 0 and 0.30),
  cap numeric(12,9) not null default 0.30 check (cap = 0.30),
  active_run_id uuid,
  active_until timestamptz,
  primary key (brand_id, bio_version),
  check ((active_run_id is null) = (active_until is null))
);
create table public.certifier_budget_reservations (
  call_id uuid primary key,
  brand_id uuid not null,
  bio_version integer not null,
  run_id uuid not null,
  estimated_usd numeric(12,9) not null check (estimated_usd > 0 and estimated_usd <= 0.30),
  actual_usd numeric(12,9) check (actual_usd >= 0 and actual_usd <= estimated_usd),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  foreign key (brand_id, bio_version) references public.certifier_budgets on delete cascade
);
create table public.certifier_briefs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_id uuid not null references public.bios(id) on delete cascade,
  version integer not null check (version > 0),
  brief jsonb,
  cost_usd numeric(12,9) not null check (cost_usd between 0 and 0.30),
  model text not null,
  run_log jsonb not null default '[]',
  status text not null check (status in ('completed', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or brief is not null)
);
create index certifier_briefs_latest on public.certifier_briefs(brand_id, version, created_at desc) where status = 'completed';
create table public.certifier_claim_confirmations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_id uuid not null references public.bios(id) on delete cascade,
  bio_version integer not null check (bio_version > 0),
  claim_id text not null check (char_length(claim_id) > 0),
  actor_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (brand_id, bio_version, claim_id)
);
create table public.certifier_question_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id) on delete cascade,
  bio_id uuid not null references public.bios(id) on delete cascade,
  run_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status = 'draft'),
  section text not null check (section in ('identity','visual','voice','audience','goals','strategic')),
  claim_ids text[] not null check (cardinality(claim_ids) > 0),
  text text not null check (char_length(text) between 1 and 300),
  why jsonb not null,
  answer_type text not null check (answer_type in ('free_text','choice','upload')),
  created_at timestamptz not null default now()
);
alter table public.certifier_budgets enable row level security;
alter table public.certifier_budget_reservations enable row level security;
alter table public.certifier_briefs enable row level security;
alter table public.certifier_claim_confirmations enable row level security;
alter table public.certifier_question_drafts enable row level security;
revoke all on public.certifier_budgets, public.certifier_budget_reservations, public.certifier_briefs,
  public.certifier_claim_confirmations, public.certifier_question_drafts from public, anon, authenticated;
grant select on public.certifier_budgets, public.certifier_budget_reservations, public.certifier_briefs to service_role;
-- Human confirmations are append-only audit events; no updates/deletes granted.
grant select, insert on public.certifier_claim_confirmations, public.certifier_question_drafts to service_role;

-- A committed row lease spans provider HTTP calls (transaction/advisory locks
-- alone do not survive separate pooled PostgREST RPC requests). Every mutation
-- is fenced by run_id. On worker death a 3-minute lease expires, while all
-- unmeasured reservations REMAIN spent. No budget is reset on acquisition.
create function public.certifier_acquire_run(p_workspace_id uuid, p_brand_id uuid, p_bio_id uuid, p_bio_version integer, p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b certifier_budgets;
begin
  if p_run_id is null or not exists (select 1 from bios x join brands y on y.id = x.brand_id
    where x.id = p_bio_id and x.brand_id = p_brand_id and x.version = p_bio_version and y.workspace_id = p_workspace_id) then
    raise exception 'CERTIFIER_SCOPE';
  end if;
  insert into certifier_budgets(brand_id,bio_version,workspace_id,bio_id)
    values(p_brand_id,p_bio_version,p_workspace_id,p_bio_id) on conflict do nothing;
  update certifier_budgets set active_run_id = p_run_id, active_until = clock_timestamp() + interval '3 minutes'
    where brand_id = p_brand_id and bio_version = p_bio_version
      and workspace_id = p_workspace_id and bio_id = p_bio_id
      and (active_run_id is null or active_until <= clock_timestamp()) returning * into b;
  if not found then raise exception 'CERTIFIER_BUSY'; end if;
  return jsonb_build_object('spent', b.spent, 'cap', b.cap);
end $$;

create function public.certifier_reserve_budget(p_brand_id uuid, p_bio_version integer, p_run_id uuid, p_call_id uuid, p_est numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b certifier_budgets; existing certifier_budget_reservations;
begin
  if p_est is null or p_est <= 0 or p_est > 0.30 or p_call_id is null then raise exception 'CERTIFIER_COST_CAP'; end if;
  select * into b from certifier_budgets where brand_id = p_brand_id and bio_version = p_bio_version for update;
  if not found or b.active_run_id is distinct from p_run_id or b.active_until <= clock_timestamp() then raise exception 'CERTIFIER_BUSY'; end if;
  select * into existing from certifier_budget_reservations where call_id = p_call_id;
  if found then
    if existing.brand_id <> p_brand_id or existing.bio_version <> p_bio_version or existing.run_id <> p_run_id or existing.estimated_usd <> p_est then raise exception 'CERTIFIER_RESERVATION_CONFLICT'; end if;
    return jsonb_build_object('spent',b.spent);
  end if;
  -- This single conditional UPDATE is the budget authority across instances.
  update certifier_budgets set spent = spent + p_est, active_until = clock_timestamp() + interval '3 minutes'
    where brand_id = p_brand_id and bio_version = p_bio_version and active_run_id = p_run_id
      and spent + p_est <= cap returning * into b;
  if not found then raise exception 'CERTIFIER_COST_CAP'; end if;
  insert into certifier_budget_reservations(call_id,brand_id,bio_version,run_id,estimated_usd)
    values(p_call_id,p_brand_id,p_bio_version,p_run_id,p_est);
  return jsonb_build_object('spent',b.spent);
end $$;

create function public.certifier_settle_budget(p_brand_id uuid, p_bio_version integer, p_run_id uuid, p_call_id uuid, p_actual numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b certifier_budgets; r certifier_budget_reservations;
begin
  select * into b from certifier_budgets where brand_id = p_brand_id and bio_version = p_bio_version for update;
  if not found or b.active_run_id is distinct from p_run_id or b.active_until <= clock_timestamp() then raise exception 'CERTIFIER_BUSY'; end if;
  select * into r from certifier_budget_reservations where call_id = p_call_id
    and brand_id = p_brand_id and bio_version = p_bio_version and run_id = p_run_id for update;
  if not found then raise exception 'CERTIFIER_RESERVATION_MISSING'; end if;
  if p_actual is null or p_actual < 0 or p_actual > r.estimated_usd then raise exception 'CERTIFIER_COST_CAP'; end if;
  if r.settled_at is not null then
    if r.actual_usd <> p_actual then raise exception 'CERTIFIER_RESERVATION_CONFLICT'; end if;
    return jsonb_build_object('spent',b.spent);
  end if;
  update certifier_budgets set spent = spent - r.estimated_usd + p_actual, active_until = clock_timestamp() + interval '3 minutes'
    where brand_id = p_brand_id and bio_version = p_bio_version returning * into b;
  update certifier_budget_reservations set actual_usd = p_actual, settled_at = now() where call_id = p_call_id;
  return jsonb_build_object('spent',b.spent);
end $$;

create function public.certifier_release_run(p_brand_id uuid, p_bio_version integer, p_run_id uuid)
returns boolean language sql security definer set search_path = public as $$
  with released as (update certifier_budgets set active_run_id = null, active_until = null
    where brand_id = p_brand_id and bio_version = p_bio_version and active_run_id = p_run_id returning 1)
  select exists(select 1 from released);
$$;

create function public.certifier_record_run(p_workspace_id uuid, p_brand_id uuid, p_bio_id uuid, p_bio_version integer, p_run_id uuid,
  p_brief jsonb, p_cost numeric, p_model text, p_log jsonb, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from bios x join brands y on y.id = x.brand_id
    where x.id = p_bio_id and x.brand_id = p_brand_id and x.version = p_bio_version and y.workspace_id = p_workspace_id) then raise exception 'CERTIFIER_SCOPE'; end if;
  if p_error is null then
    -- Commit the brief while still owning the row lease; a later run cannot
    -- overtake it with a stale re-draft or write after a lease takeover.
    perform 1 from certifier_budgets where brand_id = p_brand_id and bio_version = p_bio_version
      and active_run_id = p_run_id and active_until > clock_timestamp() for update;
    if not found then raise exception 'CERTIFIER_BUSY'; end if;
  end if;
  insert into certifier_briefs(id,workspace_id,brand_id,bio_id,version,brief,cost_usd,model,run_log,status,error_code)
    values(p_run_id,p_workspace_id,p_brand_id,p_bio_id,p_bio_version,p_brief,p_cost,p_model,p_log,
      case when p_error is null then 'completed' else 'failed' end,p_error) on conflict(id) do nothing;
end $$;

revoke all on function public.certifier_acquire_run(uuid,uuid,uuid,integer,uuid),
  public.certifier_reserve_budget(uuid,integer,uuid,uuid,numeric), public.certifier_settle_budget(uuid,integer,uuid,uuid,numeric),
  public.certifier_release_run(uuid,integer,uuid), public.certifier_record_run(uuid,uuid,uuid,integer,uuid,jsonb,numeric,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.certifier_acquire_run(uuid,uuid,uuid,integer,uuid),
  public.certifier_reserve_budget(uuid,integer,uuid,uuid,numeric), public.certifier_settle_budget(uuid,integer,uuid,uuid,numeric),
  public.certifier_release_run(uuid,integer,uuid), public.certifier_record_run(uuid,uuid,uuid,integer,uuid,jsonb,numeric,text,jsonb,text)
  to service_role;
