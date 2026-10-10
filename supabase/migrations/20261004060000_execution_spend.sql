begin;
-- Service-owned qualification. No shipped rate card is implied by existing credit tiers.
create table public.canvas_text_qualifications(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references workspaces(id),route text not null,version int not null check(version>0),enabled boolean not null default false,bounds jsonb not null,evidence jsonb not null,verified_at timestamptz not null,valid_until timestamptz not null,unique(workspace_id,route),check(valid_until>verified_at));
alter table canvas_text_qualifications enable row level security;
revoke all on canvas_text_qualifications from public,anon,authenticated;
grant all on canvas_text_qualifications to service_role;
create table public.execution_spend_holds(
 run_id uuid primary key references runs(id),workspace_id uuid not null references workspaces(id),kind text not null check(kind in ('text','media')),max_cost_usd numeric(18,8) check(max_cost_usd>0),state text not null default 'held' check(state in ('held','unpriced','settled','released','discrepancy')),actual_cost_usd numeric(18,8) check(actual_cost_usd>=0),known_subtotal_usd numeric(18,8) not null default 0 check(known_subtotal_usd>=0),created_at timestamptz not null default now(),settled_at timestamptz,reconciliation jsonb,breached boolean not null default false);
alter table execution_spend_holds enable row level security;
revoke all on execution_spend_holds from public,anon,authenticated;
grant all on execution_spend_holds to service_role;
create table public.execution_spend_adjustments(id uuid primary key default gen_random_uuid(),run_id uuid not null references runs(id),actor_id uuid not null,amount_usd numeric(18,8) not null,reference text not null,reason text not null,evidence_snapshot jsonb not null,created_at timestamptz not null default now());
alter table execution_spend_adjustments enable row level security;
revoke all on execution_spend_adjustments from public,anon,authenticated;
grant select,insert on execution_spend_adjustments to service_role;
alter table text_execution_evidence add column qa_usage jsonb;
create function public.assert_execution_spend(p_workspace uuid,p_max numeric) returns void language plpgsql security definer set search_path=public as $$
declare ceiling numeric;monthly numeric;used numeric;unknown_count int;
begin
 perform 1 from workspaces where id=p_workspace for update;
 select per_request_ceiling_usd,monthly_budget_usd into ceiling,monthly from api_budgets where scope_type='workspace' and scope_key=p_workspace::text and active;
 if ceiling is null or monthly is null or ceiling<=0 or monthly<=0 or ceiling::text in ('NaN','Infinity','-Infinity') or monthly::text in ('NaN','Infinity','-Infinity') or p_max is null or p_max<=0 or p_max::text in ('NaN','Infinity','-Infinity') or p_max>ceiling then raise exception 'EXECUTION_SPEND_CEILING_REQUIRED';end if;
 if exists(select 1 from execution_spend_holds where workspace_id=p_workspace and (state='discrepancy' or (state in ('held','unpriced') and max_cost_usd is null))) then raise exception 'UNRESOLVED_SPEND_REVIEW_REQUIRED';end if;
 -- Unresolved liabilities carry across calendar months; complete output != complete billing.
 select coalesce(sum(case when state in ('held','unpriced','discrepancy') then greatest(max_cost_usd,known_subtotal_usd,coalesce(actual_cost_usd,0)) else coalesce(actual_cost_usd,0) end),0) into used from execution_spend_holds where workspace_id=p_workspace and (state in ('held','unpriced','discrepancy') or settled_at>=date_trunc('month',now()));
 -- Managed run usage is already included at RUN granularity, never counted twice.
 select count(*) into unknown_count from api_usage_events u where workspace_id=p_workspace and not exists(select 1 from execution_spend_holds h where h.run_id=u.parent_run_id) and coalesce(reconciled_cost_usd,reported_cost_usd,preflight_max_cost_usd) is null;
 if unknown_count>0 then raise exception 'UNBOUNDED_LEGACY_USAGE_REQUIRED_RECONCILIATION';end if;
 select used+coalesce(sum(greatest(coalesce(reconciled_cost_usd,reported_cost_usd,preflight_max_cost_usd,0),0)),0) into used from api_usage_events u where workspace_id=p_workspace and not exists(select 1 from execution_spend_holds h where h.run_id=u.parent_run_id) and (occurred_at>=date_trunc('month',now()) or (reconciled_cost_usd is null and reported_cost_usd is null));
 if used+p_max>monthly then raise exception 'EXECUTION_MONTHLY_BUDGET';end if;
end $$;
create function public.reserve_execution_spend() returns trigger language plpgsql security definer set search_path=public as $$
declare w uuid;amount numeric;kind text;runid uuid;computed numeric:=0;termcost numeric;calls int;operation text;plan jsonb;term jsonb;qualification canvas_text_qualifications;
begin
 if tg_table_name='creative_jobs' then w:=new.workspace_id;amount:=new.max_cost_usd;kind:='media';runid:=new.run_id;
 else
  if new.canvas_id is null or new.canvas_snapshot->>'execution' is distinct from 'text' then return new;end if;
  select workspace_id into w from canvas_layouts where id=new.canvas_id;
  runid:=new.id;plan:=new.canvas_snapshot->'textSpend';amount:=(plan->>'maxCostUsd')::numeric;kind:='text';
  if plan is null or plan->'routing'->>'mode' is distinct from 'off' or (plan->'routing'->>'maxCostUsd')::numeric is distinct from 0 then raise exception 'TEXT_SPEND_PLAN_REQUIRED';end if;
  calls:=(plan->>'qaCalls')::int;if calls is null or calls<0 or calls>30 or plan->'generation' is null then raise exception 'TEXT_SPEND_PLAN_REQUIRED';end if;
  for operation,term in select key,value from jsonb_each(jsonb_build_object('generation',plan->'generation','qa',plan->'qa')) where value<>'null'::jsonb loop
   select * into qualification from canvas_text_qualifications where id=(term->>'qualificationId')::uuid and workspace_id=w and route=term->>'route' and enabled for share;
   if not found or qualification.version is distinct from (term->>'qualificationVersion')::int or qualification.bounds is distinct from term->'bounds' or qualification.valid_until<=now() or qualification.verified_at>now() or qualification.valid_until<=qualification.verified_at then raise exception 'TEXT_QUALIFICATION_CHANGED';end if;
   if qualification.bounds->>'hardOutputCap' is distinct from 'true' or qualification.bounds->>'allFeesIncluded' is distinct from 'true' or qualification.bounds->>'fullContextBillingBound' is distinct from 'true' or (term->>'maxTokens')::int<16 or (term->>'maxTokens')::int>(qualification.bounds->>'maxOutputTokens')::int or (term->>'maxTokens')::int>(qualification.bounds->>'contextTokens')::int then raise exception 'TEXT_SPEND_BOUND_INVALID';end if;
   termcost:=ceil(((qualification.bounds->>'contextTokens')::numeric*(qualification.bounds->>'inputUsdPerMillionMax')::numeric/1000000+(term->>'maxTokens')::numeric*(qualification.bounds->>'outputUsdPerMillionMax')::numeric/1000000+(qualification.bounds->>'requestFeeUsdMax')::numeric)*100000000)/100000000;
   if termcost is null or termcost<=0 or termcost::text in ('NaN','Infinity','-Infinity') or (term->>'maxCostUsd')::numeric is null or (term->>'maxCostUsd')::numeric<termcost or (term->>'maxCostUsd')::numeric::text in ('NaN','Infinity','-Infinity') then raise exception 'TEXT_SPEND_BOUND_INVALID';end if;
   computed:=computed+termcost*case when operation='generation' then 1 else calls end;
  end loop;
  if computed>amount or (calls>0 and plan->'qa'='null'::jsonb) then raise exception 'TEXT_SPEND_BOUND_INVALID';end if;
 end if;
 perform assert_execution_spend(w,amount);
 insert into execution_spend_holds(run_id,workspace_id,kind,max_cost_usd) values(runid,w,kind,amount);
 return new;
end $$;
-- Backfill old liabilities conservatively. Missing text bounds stay unresolved, never zero.
insert into execution_spend_holds(run_id,workspace_id,kind,max_cost_usd,state,created_at)
 select run_id,workspace_id,'media',max_cost_usd,'unpriced',created_at from creative_jobs on conflict do nothing;
insert into execution_spend_holds(run_id,workspace_id,kind,max_cost_usd,state,created_at)
 select run_id,workspace_id,'text',null,'unpriced',created_at from text_execution_evidence on conflict do nothing;
create trigger a_canvas_text_spend after insert on runs for each row execute function reserve_execution_spend();
create trigger creative_spend_reservation after insert on creative_jobs for each row execute function reserve_execution_spend();
create function public.sync_execution_spend(p_run uuid) returns void language plpgsql security definer set search_path=public as $$
declare h execution_spend_holds;status text;known numeric;missing int;ops text[];r runs;job creative_jobs;snapshot jsonb;late numeric;
begin
 select workspace_id into h.workspace_id from execution_spend_holds where run_id=p_run;if not found then return;end if;
 perform 1 from workspaces where id=h.workspace_id for update;
 select * into h from execution_spend_holds where run_id=p_run for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'reported',reported_cost_usd,'reconciled',reconciled_cost_usd,'estimated',estimated_cost_usd) order by id),'[]'::jsonb) into snapshot from api_usage_events where parent_run_id=p_run;
 if h.reconciliation is not null then
  if h.reconciliation->'usageSnapshot' is distinct from snapshot then
   select coalesce(sum(greatest(coalesce(reconciled_cost_usd,reported_cost_usd,0),0)),0) into late from api_usage_events u where parent_run_id=p_run and not exists(select 1 from jsonb_array_elements(coalesce(h.reconciliation->'usageSnapshot','[]'::jsonb)) prior where prior->>'id'=u.id::text);
   update execution_spend_holds set state='discrepancy',known_subtotal_usd=greatest(known_subtotal_usd,coalesce(actual_cost_usd,0)+late),breached=breached or coalesce(coalesce(actual_cost_usd,0)+late>max_cost_usd,false) where run_id=p_run;
  end if;return;
 end if;
 select * into r from runs where id=p_run;
 if h.kind='text' then ops:=array['generation'];if (r.canvas_snapshot->'textSpend'->>'qaCalls')::int>0 then ops:=array_append(ops,'qa');end if;
 else select * into job from creative_jobs where run_id=p_run;ops:=array['generation'];if job.model->>'modality'='image' then ops:=array_append(ops,'qa');end if;if (job.routing->>'attempted')::boolean then ops:=array_append(ops,'jev');end if;end if;
 select coalesce(sum(greatest(coalesce(reconciled_cost_usd,reported_cost_usd,(metadata->>'known_subtotal_usd')::numeric,0),0)),0) into known from api_usage_events where parent_run_id=p_run;
 select count(*) into missing from unnest(ops) op where not exists(select 1 from api_usage_events u where u.parent_run_id=p_run and u.operation=op and coalesce(u.reconciled_cost_usd,u.reported_cost_usd) is not null and coalesce(u.reconciled_cost_usd,u.reported_cost_usd)>=0);
 select missing+count(*) into missing from api_usage_events where parent_run_id=p_run and (coalesce(reconciled_cost_usd,reported_cost_usd) is null or coalesce(reconciled_cost_usd,reported_cost_usd)<0 or coalesce(reconciled_cost_usd,reported_cost_usd)::text in ('NaN','Infinity','-Infinity'));
 if h.kind='text' and r.canvas_snapshot->'textSpend' is null then missing:=missing+1;end if;
 status:=case when known>h.max_cost_usd then 'discrepancy' when missing>0 or r.status not in ('completed','failed') then 'unpriced' else 'settled' end;
 update execution_spend_holds set state=status,known_subtotal_usd=known,actual_cost_usd=case when missing=0 then known else null end,settled_at=case when status='settled' then now() else null end,breached=breached or status='discrepancy' where run_id=p_run;
end $$;
create function public.capture_execution_spend() returns trigger language plpgsql security definer set search_path=public as $$
begin if tg_table_name='runs' then perform sync_execution_spend(new.id);else perform sync_execution_spend(new.parent_run_id);end if;return new;end $$;
create trigger execution_spend_usage after insert or update on api_usage_events for each row execute function capture_execution_spend();
create trigger execution_spend_run after update of status on runs for each row execute function capture_execution_spend();
create function public.reconcile_execution_spend(p_run uuid,p_actor uuid,p_amount numeric,p_reference text,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare h execution_spend_holds;r runs;snapshot jsonb;
begin
 select workspace_id into h.workspace_id from execution_spend_holds where run_id=p_run;if not found then raise exception 'SPEND_HOLD_NOT_FOUND';end if;
 perform 1 from workspaces where id=h.workspace_id for update;
 select * into r from runs where id=p_run for update;
 select * into h from execution_spend_holds where run_id=p_run for update;
 if p_actor is null or p_amount is null or p_amount<0 or p_amount::text in ('NaN','Infinity','-Infinity') or length(trim(coalesce(p_reference,'')))<8 or length(trim(coalesce(p_reason,'')))<20 then raise exception 'BILLING_EVIDENCE_REQUIRED';end if;
 if r.status not in ('completed','failed') then raise exception 'EXECUTION_STILL_UNRESOLVED';end if;
 if h.reconciliation is not null then if h.actual_cost_usd=p_amount and h.reconciliation->>'reference'=p_reference then return jsonb_build_object('reused',true);elsif h.state<>'discrepancy' then raise exception 'BILLING_RECONCILIATION_CONFLICT';end if;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'reported',reported_cost_usd,'reconciled',reconciled_cost_usd,'estimated',estimated_cost_usd) order by id),'[]'::jsonb) into snapshot from api_usage_events where parent_run_id=p_run;
 insert into execution_spend_adjustments(run_id,actor_id,amount_usd,reference,reason,evidence_snapshot) values(p_run,p_actor,p_amount,p_reference,p_reason,snapshot);
 update execution_spend_holds set state=case when p_amount=0 then 'released' else 'settled' end,actual_cost_usd=p_amount,known_subtotal_usd=p_amount,settled_at=now(),breached=breached or coalesce(p_amount>max_cost_usd,false),reconciliation=jsonb_build_object('usageSnapshot',snapshot,'actorId',p_actor,'reference',p_reference,'reason',p_reason,'occurredAt',now()) where run_id=p_run;
 return jsonb_build_object('state','settled','breached',coalesce(p_amount>h.max_cost_usd,false),'reused',false);
end $$;
-- Canvas media claims, run creation, credit holds and job outbox share one transaction.
create or replace function public.create_creative_job(p_workspace_id uuid,p_brand_id uuid,p_actor_id uuid,p_brief_id uuid,p_spec_id text,p_spec_version int,p_bio_version int,p_credits int,p_request_key text,p_request_hash text,p_catalog_version text,p_model jsonb,p_routing jsonb,p_input jsonb,p_bio jsonb,p_max_cost numeric)
returns public.creative_jobs language plpgsql security definer set search_path=public as $$
declare j creative_jobs; r uuid; b uuid; ceiling numeric; monthly numeric; used numeric; held numeric; canvas_record canvas_layouts; quote_record canvas_quotes;
begin
  perform 1 from workspaces where id=p_workspace_id for update;
  select * into j from creative_jobs where workspace_id=p_workspace_id and request_key=p_request_key;
  if found then
    if j.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return j;
  end if;
  if not exists(select 1 from brands where id=p_brand_id and workspace_id=p_workspace_id) then raise exception 'BRAND_NOT_FOUND'; end if;
  if not exists(select 1 from bios where brand_id=p_brand_id and version=p_bio_version and certified=true and (cert_valid_until is null or cert_valid_until>now())) then raise exception 'BIO_NOT_CERTIFIED'; end if;
  perform assert_execution_spend(p_workspace_id,p_max_cost);
  if p_brief_id is not null then
    select id into b from briefs where id=p_brief_id and brand_id=p_brand_id;
    if b is null then raise exception 'BRIEF_NOT_FOUND'; end if;
  else
    insert into briefs(brand_id,title,type,payload,mode,status) values(p_brand_id,left(p_input->>'briefText',60),'one_off',jsonb_build_object('request',p_input->>'briefText'),'auto','active') returning id into b;
  end if;
  if p_input ? 'canvas' then
    select * into canvas_record from canvas_layouts where id=(p_input->'canvas'->>'id')::uuid for update;
    if not found or canvas_record.workspace_id<>p_workspace_id or canvas_record.brand_id<>p_brand_id or canvas_record.brief_id<>b then raise exception 'CANVAS_SCOPE_MISMATCH'; end if;
    if canvas_record.revision <> (p_input->'canvas'->'snapshot'->>'canvasRevision')::int then raise exception 'CANVAS_CHANGED'; end if;
    select * into quote_record from canvas_quotes where id=(p_input->'canvas'->>'quoteId')::uuid for update;
    if not found or quote_record.canvas_id<>canvas_record.id or quote_record.node_id<>(p_input->'canvas'->>'nodeId')::uuid or quote_record.created_by<>p_actor_id then raise exception 'QUOTE_SCOPE_MISMATCH'; end if;
    if quote_record.state<>'pending' or quote_record.expires_at<=now() or quote_record.fingerprint<>p_input->'canvas'->>'fingerprint' or quote_record.credits<>p_credits then raise exception 'QUOTE_CHANGED'; end if;
    if not exists(select 1 from jsonb_array_elements(canvas_record.document->'nodes') n where n->>'id'=p_input->'canvas'->>'nodeId' and n->>'specialistId'=p_spec_id) then raise exception 'CANVAS_NODE_MISSING'; end if;
    update canvas_quotes set state='claimed' where id=quote_record.id;
    insert into runs(id,brief_id,specialist_id,spec_version,bio_version,status,started_at,canvas_id,canvas_node_id,canvas_snapshot)
    values(quote_record.id,b,p_spec_id,p_spec_version,p_bio_version,'running',now(),canvas_record.id,quote_record.node_id,p_input->'canvas'->'snapshot') returning id into r;
  else
    insert into runs(brief_id,specialist_id,spec_version,bio_version,status,started_at) values(b,p_spec_id,p_spec_version,p_bio_version,'running',now()) returning id into r;
  end if;
  perform reserve_workspace_credits(p_workspace_id,p_credits,'creative:'||r::text,'run_reserved',r);
  insert into creative_jobs(workspace_id,brand_id,actor_user_id,run_id,specialist_id,request_key,request_hash,catalog_version,model,routing,input,bio,max_cost_usd,reservation_key)
  values(p_workspace_id,p_brand_id,p_actor_id,r,p_spec_id,p_request_key,p_request_hash,p_catalog_version,p_model,p_routing,p_input,p_bio,p_max_cost,'creative:'||r::text) returning * into j;
  return j;
end $$;

create or replace function public.create_canvas_text_run(p_workspace_id uuid,p_actor_id uuid,p_canvas_id uuid,p_node_id uuid,p_quote_id uuid,p_fingerprint text,p_snapshot jsonb,p_spec_id text,p_spec_version int,p_bio_version int,p_credits int)
returns uuid language plpgsql security definer set search_path=public as $$
declare c canvas_layouts; q canvas_quotes;
begin
 if p_workspace_id is null or p_actor_id is null or p_canvas_id is null or p_node_id is null or p_quote_id is null or p_fingerprint is null or p_snapshot is null or p_spec_id is null or p_spec_version is null or p_bio_version is null or p_credits is null or p_credits<=0 then raise exception 'INVALID_TEXT_CLAIM';end if;
 perform 1 from workspaces where id=p_workspace_id for update;
 select * into c from canvas_layouts where id=p_canvas_id for update;
 if not found or c.workspace_id<>p_workspace_id then raise exception 'CANVAS_SCOPE_MISMATCH';end if;
 if c.revision is distinct from (p_snapshot->>'canvasRevision')::int then raise exception 'CANVAS_CHANGED';end if;
 select * into q from canvas_quotes where id=p_quote_id for update;
 if not found or q.canvas_id<>c.id or q.node_id<>p_node_id or q.created_by<>p_actor_id then raise exception 'QUOTE_SCOPE_MISMATCH';end if;
 if q.state<>'pending' or q.expires_at<=now() or q.fingerprint<>p_fingerprint or q.credits<>p_credits then raise exception 'QUOTE_CHANGED';end if;
 if (q.request->'snapshot'->>'execution') is distinct from 'text' or (p_snapshot->>'execution') is distinct from 'text' then raise exception 'TEXT_QUOTE_REQUIRED';end if;
 if not exists(select 1 from jsonb_array_elements(c.document->'nodes') n where n->>'id'=p_node_id::text and n->>'specialistId'=p_spec_id and n->>'outputType'='text') then raise exception 'CANVAS_NODE_MISSING';end if;
 if not exists(select 1 from bios where brand_id=c.brand_id and version=p_bio_version and certified and (cert_valid_until is null or cert_valid_until>now())) then raise exception 'BIO_NOT_CERTIFIED';end if;
 if (p_snapshot-'credits') is distinct from q.request->'snapshot' then raise exception 'TEXT_SNAPSHOT_CHANGED';end if;
 update canvas_quotes set state='claimed' where id=q.id;
 insert into runs(id,brief_id,specialist_id,spec_version,bio_version,status,started_at,canvas_id,canvas_node_id,canvas_snapshot)
 values(q.id,c.brief_id,p_spec_id,p_spec_version,p_bio_version,'running',now(),c.id,p_node_id,p_snapshot);
 perform reserve_workspace_credits(p_workspace_id,p_credits,'run:'||q.id::text||':credits','run_reserved',q.id);
 return q.id;
end $$;
revoke all on function public.create_canvas_text_run(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,int,int,int) from public,anon,authenticated;
grant execute on function public.create_canvas_text_run(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,int,int,int) to service_role;

create function public.release_known_text_spend() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.phase='failed' and (new.resolution_action='confirm_not_billed' or (old.phase='claimed' and not new.provider_possible)) then
  update execution_spend_holds set state='released',actual_cost_usd=0,known_subtotal_usd=0,settled_at=now(),reconciliation=jsonb_build_object('reference',coalesce(new.resolution_evidence,'{}'::jsonb),'reason','Confirmed no billable submission') where run_id=new.run_id;
 end if;return new;
end $$;
create trigger text_known_no_charge after update of phase on text_execution_evidence for each row execute function release_known_text_spend();
revoke all on function public.assert_execution_spend(uuid,numeric) from public,anon,authenticated;
grant execute on function public.assert_execution_spend(uuid,numeric) to service_role;
revoke all on function public.reserve_execution_spend() from public,anon,authenticated;
grant execute on function public.reserve_execution_spend() to service_role;
revoke all on function public.sync_execution_spend(uuid) from public,anon,authenticated;
grant execute on function public.sync_execution_spend(uuid) to service_role;
revoke all on function public.capture_execution_spend() from public,anon,authenticated;
grant execute on function public.capture_execution_spend() to service_role;
revoke all on function public.reconcile_execution_spend(uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.reconcile_execution_spend(uuid,uuid,numeric,text,text) to service_role;
revoke all on function public.release_known_text_spend() from public,anon,authenticated;
grant execute on function public.release_known_text_spend() to service_role;
commit;
