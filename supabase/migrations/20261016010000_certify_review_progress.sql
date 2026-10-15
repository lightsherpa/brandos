-- Draft-only review state, never certification authority. Apply to local/dev;
-- production rollout requires approval and CERTIFY_SIMPLIFY remains default off.
create table if not exists public.certify_review_progress (
 job_id uuid not null references public.steward_jobs(id) on delete cascade,
 actor_user_id uuid not null references public.users(id) on delete cascade,
 bio_version integer not null check(bio_version>0),
 revision integer not null check(revision>0),
 state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<=131072),
 updated_at timestamptz not null default now(),
 primary key(job_id,actor_user_id,bio_version)
);
create table if not exists public.certify_review_progress_requests (
 job_id uuid not null references public.steward_jobs(id) on delete cascade,
 actor_user_id uuid not null references public.users(id) on delete cascade,
 bio_version integer not null check(bio_version>0),
 request_id uuid not null,
 request_hash text not null,
 response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(job_id,actor_user_id,bio_version,request_id)
);
alter table public.certify_review_progress enable row level security;
alter table public.certify_review_progress_requests enable row level security;
revoke all on public.certify_review_progress,public.certify_review_progress_requests from public,anon,authenticated,service_role;
grant select on public.certify_review_progress to service_role;

create or replace function public.save_certify_review_progress(
 p_job_id uuid,p_actor_user_id uuid,p_bio_version integer,p_expected_revision integer,
 p_request_id uuid,p_request_hash text,p_state jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j steward_jobs; t team_members; v integer; r certify_review_progress; receipt certify_review_progress_requests; response jsonb;
begin
 -- Serialize with job closure/assignment changes and all other progress writers.
 select * into j from steward_jobs where id=p_job_id for update;
 if not found then return jsonb_build_object('ok',false,'status',404,'code','JOB_NOT_FOUND','error','Review not found.');end if;
 select * into t from team_members where user_id=p_actor_user_id and active=true and roles && array['steward','lead_steward'] limit 1;
 if not found or (j.assigned_to is not null and j.assigned_to<>t.id and not ('lead_steward'=any(t.roles))) then
  return jsonb_build_object('ok',false,'status',403,'code','REVIEW_FORBIDDEN','error','Review access required.');end if;
 if j.status not in ('queued','in_review','changes_requested') and not(j.status='pending_lead_review' and 'lead_steward'=any(t.roles) and j.assigned_to is distinct from t.id) then
  return jsonb_build_object('ok',false,'status',409,'code','JOB_CLOSED','error','This review is closed.');end if;
 select version into v from bios where id=j.bio_id;
 if p_bio_version is distinct from v then return jsonb_build_object('ok',false,'status',409,'code','STALE_PROGRESS_VERSION','error','Review the current Brand Core version.');end if;
 if p_request_id is null or p_request_hash is null or p_expected_revision<0 or p_expected_revision is null or jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>131072 then
  return jsonb_build_object('ok',false,'status',400,'code','PROGRESS_INVALID','error','Invalid review progress.');end if;
 select * into receipt from certify_review_progress_requests where job_id=p_job_id and actor_user_id=p_actor_user_id and bio_version=p_bio_version and request_id=p_request_id;
 if found then
  if receipt.request_hash<>p_request_hash then return jsonb_build_object('ok',false,'status',409,'code','IDEMPOTENCY_CONFLICT','error','This save identifier was used for different progress.');end if;
  return receipt.response;
 end if;
 select * into r from certify_review_progress where job_id=p_job_id and actor_user_id=p_actor_user_id and bio_version=p_bio_version for update;
 if coalesce(r.revision,0)<>p_expected_revision then return jsonb_build_object('ok',false,'status',409,'code','PROGRESS_CONFLICT','error','Review progress changed in another session.');end if;
 insert into certify_review_progress(job_id,actor_user_id,bio_version,revision,state,updated_at)
 values(p_job_id,p_actor_user_id,p_bio_version,p_expected_revision+1,p_state,clock_timestamp())
 on conflict(job_id,actor_user_id,bio_version) do update set revision=excluded.revision,state=excluded.state,updated_at=excluded.updated_at returning * into r;
 response=jsonb_build_object('ok',true,'progress',to_jsonb(r));
 insert into certify_review_progress_requests(job_id,actor_user_id,bio_version,request_id,request_hash,response) values(p_job_id,p_actor_user_id,p_bio_version,p_request_id,p_request_hash,response);
 return response;
end $$;
revoke all on function public.save_certify_review_progress(uuid,uuid,integer,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_certify_review_progress(uuid,uuid,integer,integer,uuid,text,jsonb) to service_role;
