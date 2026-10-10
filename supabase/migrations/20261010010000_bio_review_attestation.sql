-- Record explicit section review and declarations alongside the immutable attestation.
alter table public.bio_attestations add column if not exists review_capture jsonb;
create or replace function public.record_bio_self_certification(
 p_bio_id uuid,p_brand_id uuid,p_user_id uuid,p_payload_hash text,
 p_statement_version text,p_field_marks jsonb,p_score integer,p_review jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare target public.bios%rowtype; attestation_id uuid; recorded_at timestamptz:=now();
begin
 -- Serialize concurrent approvals of this brand and reject a replaced version.
 perform 1 from public.brands where id=p_brand_id for update;
 select * into target from public.bios where id=p_bio_id and brand_id=p_brand_id for update;
 if not found or exists(select 1 from public.bios where brand_id=p_brand_id and version>target.version) then
  return jsonb_build_object('ok',false,'code','STALE_BIO','error','The BIO changed. Review the current version.');
 end if;
 insert into public.bio_attestations(bio_id,brand_id,attested_by,payload_hash,statement_version,field_marks,self_score,review_capture,created_at)
 values(p_bio_id,p_brand_id,p_user_id,p_payload_hash,p_statement_version,p_field_marks,p_score,p_review,recorded_at)
 returning id into attestation_id;
 update public.bios set self_certified=true,self_certified_at=recorded_at where id=p_bio_id;
 return jsonb_build_object('ok',true,'attestationId',attestation_id,'attestedAt',recorded_at);
end;$$;
revoke all on function public.record_bio_self_certification(uuid,uuid,uuid,text,text,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.record_bio_self_certification(uuid,uuid,uuid,text,text,jsonb,integer,jsonb) to service_role;
