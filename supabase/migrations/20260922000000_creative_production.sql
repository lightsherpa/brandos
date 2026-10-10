-- Prepared locally only. No production migration is performed by this change.
begin;
create table public.creative_workspace_policy (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  policy jsonb not null default '{"jevMode":"shadow","providers":{}}',
  updated_at timestamptz not null default now()
);
create table public.creative_model_qualifications (
  route text primary key,
  qualification jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  brand_id uuid not null references public.brands(id),
  actor_user_id uuid references public.users(id),
  run_id uuid not null unique references public.runs(id),
  specialist_id text not null,
  request_key text not null,
  request_hash text not null,
  catalog_version text not null,
  model jsonb not null,
  routing jsonb not null,
  input jsonb not null,
  bio jsonb not null,
  max_cost_usd numeric not null check (max_cost_usd > 0),
  reservation_key text not null,
  state text not null default 'queued' check(state in ('queued','submitting','polling','generated','stored','qa_running','settling','completed','failed','reconcile','retrieval_failed','persistence_failed','cancel_requested')),
  task jsonb, result jsonb, asset jsonb, qa jsonb,
  output_id uuid references public.outputs(id),
  progress integer not null default 0,
  error text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,request_key)
);
create index creative_jobs_recovery on public.creative_jobs(state,updated_at);
create table public.creative_asset_publications (
  output_id uuid primary key references public.outputs(id),
  workspace_id uuid not null references public.workspaces(id),
  public_url text not null,
  approved_by uuid not null references public.users(id),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- No client writes to policy, qualifications, jobs, or publication attestations.
alter table public.creative_workspace_policy enable row level security;
alter table public.creative_model_qualifications enable row level security;
alter table public.creative_jobs enable row level security;
alter table public.creative_asset_publications enable row level security;
revoke all on public.creative_workspace_policy,public.creative_model_qualifications,public.creative_jobs,public.creative_asset_publications from public,anon,authenticated;
grant all on public.creative_workspace_policy,public.creative_model_qualifications,public.creative_jobs,public.creative_asset_publications to service_role;

create function public.create_creative_job(p_workspace_id uuid,p_brand_id uuid,p_actor_id uuid,p_brief_id uuid,p_spec_id text,p_spec_version int,p_bio_version int,p_credits int,p_request_key text,p_request_hash text,p_catalog_version text,p_model jsonb,p_routing jsonb,p_input jsonb,p_bio jsonb,p_max_cost numeric)
returns public.creative_jobs language plpgsql security definer set search_path=public as $$
declare j creative_jobs; r uuid; b uuid; ceiling numeric; monthly numeric; used numeric; held numeric;
begin
  perform 1 from workspaces where id=p_workspace_id for update;
  select * into j from creative_jobs where workspace_id=p_workspace_id and request_key=p_request_key;
  if found then
    if j.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return j;
  end if;
  if not exists(select 1 from brands where id=p_brand_id and workspace_id=p_workspace_id) then raise exception 'BRAND_NOT_FOUND'; end if;
  if not exists(select 1 from bios where brand_id=p_brand_id and version=p_bio_version and certified=true and (cert_valid_until is null or cert_valid_until>now())) then raise exception 'BIO_NOT_CERTIFIED'; end if;
  select per_request_ceiling_usd,monthly_budget_usd into ceiling,monthly from api_budgets where active and scope_type='workspace' and scope_key=p_workspace_id::text;
  if ceiling is null or monthly is null or p_max_cost is null or p_max_cost<=0 or p_max_cost>ceiling then raise exception 'CREATIVE_SPEND_CEILING_REQUIRED'; end if;
  select coalesce(sum(coalesce(reconciled_cost_usd,reported_cost_usd,estimated_cost_usd,preflight_max_cost_usd,0)),0) into used from api_usage_events where workspace_id=p_workspace_id and occurred_at>=date_trunc('month',now());
  select coalesce(sum(max_cost_usd),0) into held from creative_jobs where workspace_id=p_workspace_id and state not in ('completed','failed');
  if used+held+p_max_cost>monthly then raise exception 'CREATIVE_MONTHLY_BUDGET'; end if;
  if p_brief_id is not null then
    select id into b from briefs where id=p_brief_id and brand_id=p_brand_id;
    if b is null then raise exception 'BRIEF_NOT_FOUND'; end if;
  else
    insert into briefs(brand_id,title,type,payload,mode,status) values(p_brand_id,left(p_input->>'briefText',60),'one_off',jsonb_build_object('request',p_input->>'briefText'),'auto','active') returning id into b;
  end if;
  insert into runs(brief_id,specialist_id,spec_version,bio_version,status,started_at) values(b,p_spec_id,p_spec_version,p_bio_version,'running',now()) returning id into r;
  perform reserve_workspace_credits(p_workspace_id,p_credits,'creative:'||r::text,'run_reserved',r);
  insert into creative_jobs(workspace_id,brand_id,actor_user_id,run_id,specialist_id,request_key,request_hash,catalog_version,model,routing,input,bio,max_cost_usd,reservation_key)
  values(p_workspace_id,p_brand_id,p_actor_id,r,p_spec_id,p_request_key,p_request_hash,p_catalog_version,p_model,p_routing,p_input,p_bio,p_max_cost,'creative:'||r::text) returning * into j;
  return j;
end $$;
revoke all on function public.create_creative_job(uuid,uuid,uuid,uuid,text,int,int,int,text,text,text,jsonb,jsonb,jsonb,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.create_creative_job(uuid,uuid,uuid,uuid,text,int,int,int,text,text,text,jsonb,jsonb,jsonb,jsonb,numeric) to service_role;
commit;
