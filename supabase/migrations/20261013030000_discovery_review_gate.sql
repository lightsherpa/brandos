-- A failed confidence gate is a resumable state, bound to an exact BIO version.
create table if not exists public.bio_review_gates (
 bio_id uuid primary key references public.bios(id) on delete cascade,
 brand_id uuid not null references public.brands(id) on delete cascade,
 status text not null check (status in ('gated','queued')),
 score integer not null check (score between 0 and 100),
 min_score integer not null,
 reasons jsonb not null default '[]'::jsonb,
 job_id uuid references public.steward_jobs(id),
 updated_at timestamptz not null default now()
);
alter table public.bio_review_gates enable row level security;
revoke all on public.bio_review_gates from public,anon,authenticated;
grant all on public.bio_review_gates to service_role;

alter table public.discovery_runs drop constraint if exists discovery_runs_status_check;
alter table public.discovery_runs add constraint discovery_runs_status_check
 check (status in ('queued','running','completed','failed','gated'));
alter table public.discovery_runs drop constraint if exists discovery_runs_stage_check;
alter table public.discovery_runs add constraint discovery_runs_stage_check
 check (stage in ('queued','scrape','visual','read','research','synthesize','save','done','review_gate'));

-- Serialise every automatic trigger on the BIO row. Checking ALL prior jobs,
-- including terminal jobs, makes this once per version rather than once per open job.
create or replace function public.reconcile_bio_review(p_bio_id uuid, p_report jsonb, p_kind text default 'onboarding')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_bio public.bios%rowtype;
 v_job uuid;
 v_created boolean := false;
 v_gate public.bio_review_gates%rowtype;
begin
 select * into strict v_bio from public.bios where id=p_bio_id for update;
 select id into v_job from public.steward_jobs where bio_id=p_bio_id order by queued_at,id limit 1;
 if v_job is null and (p_report->>'meetsFloor')::boolean is true then
  if p_kind not in ('onboarding','drift_check','re_extract') then raise exception 'Invalid review kind'; end if;
  begin
   insert into public.steward_jobs(bio_id,brand_id,kind,status)
    values(p_bio_id,v_bio.brand_id,p_kind,'queued') returning id into v_job;
   v_created := true;
  exception when unique_violation then
   -- A concurrent explicit review request may hold the existing open-job key.
   select id into strict v_job from public.steward_jobs where bio_id=p_bio_id order by queued_at,id limit 1;
  end;
 end if;
 insert into public.bio_review_gates(bio_id,brand_id,status,score,min_score,reasons,job_id)
 values(p_bio_id,v_bio.brand_id,case when v_job is null then 'gated' else 'queued' end,
  (p_report->>'score')::integer,(p_report->>'minScore')::integer,
  case when v_job is null then p_report->'reasons' else '[]'::jsonb end,v_job)
 on conflict(bio_id) do update set status=excluded.status,score=excluded.score,min_score=excluded.min_score,
  reasons=excluded.reasons,job_id=excluded.job_id,updated_at=now()
 returning * into v_gate;
 update public.bios set score=v_gate.score where id=p_bio_id;
 update public.discovery_runs set status=case when v_job is null then 'gated' else 'completed' end,
  stage=case when v_job is null then 'review_gate' else 'done' end,error_code=null,updated_at=now()
  where bio_id=p_bio_id;
 return to_jsonb(v_gate) || jsonb_build_object('created',v_created);
end;
$$;
revoke all on function public.reconcile_bio_review(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.reconcile_bio_review(uuid,jsonb,text) to service_role;
