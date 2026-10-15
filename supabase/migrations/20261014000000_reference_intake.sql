-- Atomic owner rights intake; source history and old BIOs are retained.
create table if not exists public.bio_reference_intakes (
 request_id uuid primary key,
 brand_id uuid not null references public.brands(id),
 bio_id uuid not null references public.bios(id),
 user_id uuid not null references auth.users(id),
 expected_version integer not null,
 source_ids uuid[] not null,
 rights jsonb not null,
 confirmed_at timestamptz not null default now()
);
alter table public.bio_reference_intakes enable row level security;
revoke all on public.bio_reference_intakes from public,anon,authenticated,service_role;
grant select,insert on public.bio_reference_intakes to service_role;

create or replace function public.confirm_brand_references(p_brand_id uuid,p_user_id uuid,p_expected_version integer,p_request_id uuid,p_source_ids uuid[],p_rights jsonb)
returns public.bios language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_prev public.bios%rowtype; v_new public.bios%rowtype; v_prior public.bio_reference_intakes%rowtype;
 v_payload jsonb; v_refs jsonb; v_old jsonb; v_source public.bio_sources%rowtype; v_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('bio:'||p_brand_id::text,0));
 if not exists(select 1 from workspace_memberships m join brands b on b.workspace_id=m.workspace_id where b.id=p_brand_id and m.user_id=p_user_id and m.is_owner and m.status='active') then raise exception 'REFERENCE_OWNER_REQUIRED' using errcode='42501'; end if;
 if p_request_id is null or p_expected_version is null or p_expected_version<1 or cardinality(p_source_ids) not between 1 and 12 or p_source_ids is null or exists(select 1 from unnest(p_source_ids) x where x is null) or cardinality(p_source_ids)<>(select count(distinct x) from unnest(p_source_ids) x) then raise exception 'REFERENCE_REQUEST_INVALID' using errcode='22023'; end if;
 if not (p_rights @> '{"authority":true,"ownsOrLicensed":true,"generationAllowed":true}'::jsonb) or p_rights is null then raise exception 'REFERENCE_RIGHTS_REQUIRED' using errcode='22023'; end if;
 select * into v_prior from bio_reference_intakes where request_id=p_request_id;
 if found then
  if v_prior.brand_id<>p_brand_id or v_prior.user_id<>p_user_id or v_prior.expected_version<>p_expected_version or v_prior.source_ids<>p_source_ids or v_prior.rights<>p_rights then raise exception 'REFERENCE_REQUEST_REUSED' using errcode='22023'; end if;
  select * into strict v_new from bios where id=v_prior.bio_id; return v_new;
 end if;
 select * into v_prev from bios where brand_id=p_brand_id order by version desc limit 1;
 if not found or v_prev.version<>p_expected_version then raise exception 'STALE_BIO_VERSION' using errcode='40001'; end if;
 v_old=coalesce(v_prev.payload#>'{visual,references}','[]'::jsonb);
 v_refs='[]'::jsonb;
 foreach v_id in array p_source_ids loop
  select * into v_source from bio_sources where id=v_id and brand_id=p_brand_id for update;
  if not found or v_source.kind is distinct from 'file_upload' or v_source.bucket is distinct from 'visual' or v_source.raw_ref is null or v_source.raw_ref not like (select workspace_id::text||'/'||p_brand_id::text||'/%' from brands where id=p_brand_id) or coalesce(v_source.signals->>'ext','') not in ('png','jpg','jpeg','webp') or coalesce(v_source.signals->>'asset_role','') not in ('canonical','inspiration') or coalesce(v_source.signals->>'purpose','current')<>'current' then raise exception 'REFERENCE_SOURCE_INVALID' using errcode='22023'; end if;
  if exists(select 1 from bios b cross join lateral jsonb_array_elements(coalesce(b.payload#>'{visual,references}','[]')) r where b.brand_id=p_brand_id and r->>'sourceId'=v_id::text) then raise exception 'REFERENCE_NOT_NEW' using errcode='22023'; end if;
  update bio_sources set signals=coalesce(signals,'{}')||jsonb_build_object('asset_role','canonical','rights_confirmed',true,'rights_confirmed_by',p_user_id,'rights_confirmed_at',now(),'reference_request_id',p_request_id) where id=v_id;
  v_refs=v_refs||jsonb_build_array(jsonb_build_object('sourceId',v_id,'name',v_source.src,'role','canonical','status','active','rightsRequestId',p_request_id,'confirmedBy',p_user_id));
 end loop;
 select coalesce(jsonb_agg(r||jsonb_build_object('status','superseded','supersededAtVersion',v_prev.version+1)),'[]') into v_old from jsonb_array_elements(v_old) r;
 v_payload=jsonb_set(v_prev.payload,'{visual}',coalesce(v_prev.payload->'visual','{}')||jsonb_build_object('references',v_refs||v_old));
 v_payload=v_payload||jsonb_build_object('reference_intake',jsonb_build_object('requestId',p_request_id,'confirmedBy',p_user_id,'sourceIds',to_jsonb(p_source_ids),'requiresOwnerAttestation',true));
 select * into v_new from append_bio_version(p_brand_id,v_payload,v_prev.score,p_user_id,null,p_expected_version);
 insert into bio_reference_intakes(request_id,brand_id,bio_id,user_id,expected_version,source_ids,rights) values(p_request_id,p_brand_id,v_new.id,p_user_id,p_expected_version,p_source_ids,p_rights);
 return v_new;
end;
$$;
revoke all on function public.confirm_brand_references(uuid,uuid,integer,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.confirm_brand_references(uuid,uuid,integer,uuid,uuid[],jsonb) to service_role;

-- Keep exact-once review semantics; reference updates require the existing
-- immutable owner attestation before any automatic review can be released.
create or replace function public.reconcile_bio_review(p_bio_id uuid, p_report jsonb, p_kind text default 'onboarding')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_bio public.bios%rowtype;
 v_job uuid;
 v_created boolean := false;
 v_gate public.bio_review_gates%rowtype;
begin
 select * into strict v_bio from public.bios where id=p_bio_id for update;
 if v_bio.payload ? 'reference_intake' and v_bio.self_certified is not true then
  p_report=p_report||jsonb_build_object('meetsFloor',false,'reasons',coalesce(p_report->'reasons','[]')||jsonb_build_array(jsonb_build_object('code','OWNER_ATTESTATION_REQUIRED','message','Review and attest this exact Brand Core version')));
 end if;
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

-- Cover explicit requests as well as automatic reconcilers, under the same row lock.
create or replace function public.guard_reference_review() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_bio public.bios%rowtype;
begin
 select * into strict v_bio from bios where id=new.bio_id for update;
 if v_bio.payload ? 'reference_intake' then
  if new.brand_id<>v_bio.brand_id or v_bio.self_certified is not true then raise exception 'OWNER_ATTESTATION_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from steward_jobs where bio_id=new.bio_id) then raise exception 'REFERENCE_REVIEW_ALREADY_EXISTS' using errcode='23505'; end if;
 end if;
 return new;
end;
$$;
drop trigger if exists reference_review_gate on public.steward_jobs;
create trigger reference_review_gate before insert on public.steward_jobs for each row execute function public.guard_reference_review();
