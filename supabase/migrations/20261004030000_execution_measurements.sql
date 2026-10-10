begin;
-- Append-only server evidence; updates and their evidence commit together.
create table public.execution_measurement_events (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.workspaces(id),
 run_id uuid not null references public.runs(id) on delete cascade,
 output_id uuid references public.outputs(id) on delete cascade,
 kind text not null check(kind in ('run_status','job_state','workflow','content_revision')),
 prior_state text, state text, actor_id uuid references public.users(id),
 error text, occurred_at timestamptz not null default clock_timestamp()
);
create index execution_measurement_run on public.execution_measurement_events(run_id,occurred_at);
alter table public.execution_measurement_events enable row level security;
revoke all on public.execution_measurement_events from public,anon,authenticated;
grant select,insert on public.execution_measurement_events to service_role;
grant usage,select on sequence public.execution_measurement_events_id_seq to service_role;
create function public.capture_execution_measurement() returns trigger
language plpgsql security definer set search_path=public as $$
declare wid uuid; rid uuid; event_kind text; prior text; current_state text; actor uuid; oid uuid; err text;
begin
 if tg_table_name='creative_jobs' then
   if tg_op='UPDATE' and new.state is not distinct from old.state and new.error is not distinct from old.error then return new; end if;
   wid:=new.workspace_id;rid:=new.run_id;event_kind:='job_state';current_state:=new.state;actor:=new.actor_user_id;err:=new.error;
   if tg_op='UPDATE' then prior:=old.state;end if;
 else
   if tg_table_name='runs' then
     if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
     rid:=new.id;event_kind:='run_status';current_state:=new.status;
     if tg_op='UPDATE' then prior:=old.status;end if;
   else
     rid:=new.run_id;oid:=new.id;current_state:=new.workflow_status;
     if tg_op='UPDATE' then
       prior:=old.workflow_status;
       if new.workflow_status is distinct from old.workflow_status then event_kind:='workflow';
       elsif new.body is distinct from old.body then event_kind:='content_revision';
       else return new;end if;
     else event_kind:='workflow';end if;
     actor:=case when current_state='submitted_internal' then new.submitted_by when current_state in ('internally_approved','changes_requested_internal') then new.internal_reviewed_by when current_state in ('client_approved','changes_requested_client') then new.client_reviewed_by end;
   end if;
   select b.workspace_id into wid from runs r join briefs f on f.id=r.brief_id join brands b on b.id=f.brand_id where r.id=rid;
 end if;
 if rid is not null and wid is not null then
   insert into execution_measurement_events(workspace_id,run_id,output_id,kind,prior_state,state,actor_id,error) values(wid,rid,oid,event_kind,prior,current_state,actor,err);
 end if;
 return new;
end $$;
revoke all on function public.capture_execution_measurement() from public,anon,authenticated;
create trigger runs_measurement after insert or update on public.runs for each row execute function public.capture_execution_measurement();
create trigger outputs_measurement after insert or update on public.outputs for each row execute function public.capture_execution_measurement();
create trigger jobs_measurement after insert or update on public.creative_jobs for each row execute function public.capture_execution_measurement();
comment on table public.execution_measurement_events is 'Prospective evidence only; no inferred historical reviews or human acceptance.';
commit;
