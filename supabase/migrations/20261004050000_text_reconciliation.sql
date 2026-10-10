begin;
create table public.text_execution_evidence (
 run_id uuid primary key references public.runs(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id),
 actor_id uuid references public.users(id),
 phase text not null default 'claimed' check(phase in ('claimed','submitting','generating','generation_complete','qa_running','settling','reconcile','resolving','completed','failed')),
 interrupted_phase text,
 route text not null,
 provider_possible boolean not null default false,
 provider_receipt_id text,
 raw_output text,
 generation_complete boolean not null default false,
 usage jsonb,
 finalization jsonb,
 error text,
 heartbeat_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 resolution_action text,
 resolution_evidence jsonb,
 resolved_by uuid references public.users(id),
 resolved_at timestamptz
);
alter table public.text_execution_evidence enable row level security;
revoke all on public.text_execution_evidence from public,anon,authenticated;
grant all on public.text_execution_evidence to service_role;
create index text_execution_stale on public.text_execution_evidence(phase,heartbeat_at);
alter table public.execution_measurement_events drop constraint execution_measurement_events_kind_check;
alter table public.execution_measurement_events add constraint execution_measurement_events_kind_check check(kind in ('run_status','job_state','workflow','content_revision','text_phase'));
create function public.capture_text_execution() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='runs' then
  if tg_op='INSERT' and new.canvas_id is not null and new.canvas_snapshot->>'execution'='text' then
   insert into text_execution_evidence(run_id,workspace_id,actor_id,route)
   select new.id,c.workspace_id,q.created_by,q.request->>'route' from canvas_layouts c join canvas_quotes q on q.id=new.id where c.id=new.canvas_id;
  elsif tg_op='UPDATE' and new.status in ('completed','failed') and new.status is distinct from old.status then
   update text_execution_evidence set phase=new.status,heartbeat_at=now() where run_id=new.id;
  end if;
 else
  if tg_op='INSERT' or new.phase is distinct from old.phase or new.error is distinct from old.error then
   insert into execution_measurement_events(workspace_id,run_id,kind,prior_state,state,actor_id,error)
   values(new.workspace_id,new.run_id,'text_phase',case when tg_op='UPDATE' then old.phase else null end,new.phase,new.actor_id,new.error);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.capture_text_execution() from public,anon,authenticated;
create trigger text_execution_from_runs after insert or update on public.runs for each row execute function public.capture_text_execution();
create trigger text_execution_history after insert or update on public.text_execution_evidence for each row execute function public.capture_text_execution();
-- Preexisting running executions are uncertain; never backfill them as unsubmitted.
insert into text_execution_evidence(run_id,workspace_id,actor_id,route,phase,provider_possible,error)
select r.id,c.workspace_id,q.created_by,q.request->>'route','reconcile',true,'Execution predates durable phase evidence'
from runs r join canvas_layouts c on c.id=r.canvas_id join canvas_quotes q on q.id=r.id
where r.status='running' and r.canvas_snapshot->>'execution'='text';
create function public.quarantine_stale_text_runs() returns int language plpgsql security definer set search_path=public as $$
declare affected int;
begin
 update text_execution_evidence set interrupted_phase=phase,phase='reconcile',error='Execution heartbeat expired; provider billing requires reconciliation'
 where phase not in ('completed','failed','reconcile','resolving') and heartbeat_at<now()-interval '5 minutes';
 get diagnostics affected=row_count;return affected;
end $$;
revoke all on function public.quarantine_stale_text_runs() from public,anon,authenticated;
grant execute on function public.quarantine_stale_text_runs() to service_role;

create function public.resolve_canvas_text_run(p_workspace_id uuid,p_run_id uuid,p_actor_id uuid,p_action text,p_evidence jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e text_execution_evidence; r runs; f jsonb; result jsonb; outid uuid; b uuid; reported numeric; estimated numeric;
begin
 perform 1 from workspaces where id=p_workspace_id for update;
 select x.* into r from runs x join briefs br on br.id=x.brief_id join brands brand on brand.id=br.brand_id where x.id=p_run_id and brand.workspace_id=p_workspace_id for update of x;
 if not found then raise exception 'RUN_NOT_FOUND';end if;
 select * into e from text_execution_evidence where run_id=r.id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'TEXT_EVIDENCE_REQUIRED';end if;
 if e.resolution_action=p_action and e.phase in ('completed','failed') then return jsonb_build_object('state',e.phase,'reused',true);end if;
 if e.phase<>'reconcile' then raise exception 'RECONCILIATION_NOT_READY';end if;
 if length(trim(coalesce(p_reason,'')))<20 or p_actor_id is null then raise exception 'CLEAR_OPERATOR_REASON_REQUIRED';end if;
 if p_action='confirm_not_billed' then
  if p_evidence->>'status' is distinct from 'not_billed_confirmed' or length(trim(coalesce(p_evidence->>'reference','')))<8 then raise exception 'PROVIDER_NO_CHARGE_EVIDENCE_REQUIRED';end if;
 elsif p_action='recover_output' then
  if not e.generation_complete or length(coalesce(e.raw_output,''))=0 then raise exception 'COMPLETE_DURABLE_OUTPUT_REQUIRED';end if;
 else raise exception 'UNSUPPORTED_RECONCILIATION_ACTION';end if;
 update text_execution_evidence set phase='resolving',resolution_action=p_action,resolution_evidence=jsonb_build_object('provider',p_evidence,'reason',trim(p_reason)),resolved_by=p_actor_id,resolved_at=now() where run_id=r.id;
 if p_action='confirm_not_billed' then
  perform fail_run_and_release_credits(p_workspace_id,r.id,'run:'||r.id::text||':credits','run:'||r.id::text||':credits:refund','operator_confirmed_not_billed');
  return jsonb_build_object('state','failed','reused',false);
 end if;
 -- Preserve completed generation. Interrupted/missing QA is explicitly flagged.
 f:=e.finalization;
 if f is null then
  f:=jsonb_build_object('p_model_used',e.route,'p_prompt_tokens',coalesce((e.usage->>'prompt_tokens')::int,0),'p_completion_tokens',coalesce((e.usage->>'completion_tokens')::int,0),'p_cached_tokens',coalesce((e.usage->>'cached_tokens')::int,0),'p_cost_usd',null,'p_latency_ms',greatest(0,extract(epoch from(now()-r.started_at))*1000)::int,'p_output_kind','copy','p_output_body',jsonb_build_object('text',e.raw_output,'recovered',true,'review_required',true),'p_output_status','flagged','p_rationale','Recovered completed generation; QA interrupted. Human review required.','p_qa_passed',false,'p_qa_evidence','Operator recovery; no additional generation or QA call','p_ledger_kind','run_flagged');
 end if;
 select brand_id into b from briefs where id=r.brief_id;
 reported:=coalesce((e.usage->>'cost')::numeric,(e.usage->>'cost_usd')::numeric);
 estimated:=(e.usage->>'estimated_cost_usd')::numeric;
 insert into api_usage_events(request_id,idempotency_key,parent_run_id,workspace_id,brand_id,actor_user_id,specialist_id,feature,provider,service,operation,status,resolved_model,reported_cost_usd,estimated_cost_usd,cost_source,metadata)
 values(r.id::text||':generation','creative:'||r.id::text||':generation',r.id,p_workspace_id,b,e.actor_id,r.specialist_id,'creative.generation',split_part(e.route,'/',1),'text','generation','succeeded',e.usage->>'model',reported,estimated,case when reported is not null then 'provider_reported' when estimated is not null then 'rate_card_estimate' else 'unpriced' end,jsonb_build_object('operator_recovery',true))
 on conflict do nothing;
 result:=finalize_run_atomic(p_workspace_id,r.id,'run:'||r.id::text||':credits',f->>'p_model_used',coalesce((f->>'p_prompt_tokens')::int,0),coalesce((f->>'p_completion_tokens')::int,0),coalesce((f->>'p_cached_tokens')::int,0),(f->>'p_cost_usd')::numeric,(f->>'p_latency_ms')::int,f->>'p_output_kind',f->'p_output_body',null,f->>'p_output_status',f->>'p_rationale',(f->>'p_qa_passed')::boolean,f->>'p_qa_evidence',f->>'p_ledger_kind');
 return jsonb_build_object('state','completed','outputId',result->>'output_id','reused',false);
end $$;
revoke all on function public.resolve_canvas_text_run(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.resolve_canvas_text_run(uuid,uuid,uuid,text,jsonb,text) to service_role;
create function public.fail_unsubmitted_text_run(p_workspace_id uuid,p_run_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare e text_execution_evidence;
begin
 perform 1 from workspaces where id=p_workspace_id for update;
 perform 1 from runs where id=p_run_id for update;
 select * into e from text_execution_evidence where run_id=p_run_id and workspace_id=p_workspace_id for update;
 if not found or e.phase<>'claimed' or e.provider_possible then raise exception 'TEXT_RECONCILIATION_REQUIRED';end if;
 return fail_run_and_release_credits(p_workspace_id,p_run_id,'run:'||p_run_id::text||':credits','run:'||p_run_id::text||':credits:refund','provider_not_configured_no_submission');
end $$;
revoke all on function public.fail_unsubmitted_text_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fail_unsubmitted_text_run(uuid,uuid) to service_role;
create function public.settle_canvas_text_run(p_workspace_id uuid,p_run_id uuid,p_finalization jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare e text_execution_evidence; f jsonb;
begin
 perform 1 from workspaces where id=p_workspace_id for update;
 perform 1 from runs where id=p_run_id for update;
 select * into e from text_execution_evidence where run_id=p_run_id and workspace_id=p_workspace_id for update;
 if not found or e.resolution_action is not null or e.phase not in ('settling','completed') or e.finalization is distinct from p_finalization then raise exception 'TEXT_RECONCILIATION_REQUIRED';end if;
 f:=e.finalization;
 return finalize_run_atomic(p_workspace_id,p_run_id,'run:'||p_run_id::text||':credits',f->>'p_model_used',coalesce((f->>'p_prompt_tokens')::int,0),coalesce((f->>'p_completion_tokens')::int,0),coalesce((f->>'p_cached_tokens')::int,0),(f->>'p_cost_usd')::numeric,(f->>'p_latency_ms')::int,f->>'p_output_kind',f->'p_output_body',null,f->>'p_output_status',f->>'p_rationale',(f->>'p_qa_passed')::boolean,f->>'p_qa_evidence',f->>'p_ledger_kind');
end $$;
revoke all on function public.settle_canvas_text_run(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.settle_canvas_text_run(uuid,uuid,jsonb) to service_role;
commit;
