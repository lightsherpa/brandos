-- Exact-version acceptance and audit receipt are one transaction.
create or replace function public.accept_bio_client_changes(
  p_brand_id uuid, p_bio_id uuid, p_version int, p_user_id uuid, p_review jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_workspace uuid; v_bio public.bios; v_at timestamptz := now(); v_receipt uuid;
begin
  select workspace_id into v_workspace from brands where id=p_brand_id for update;
  if not exists(select 1 from workspace_memberships where workspace_id=v_workspace
      and user_id=p_user_id and is_owner and status='active') then
    return jsonb_build_object('ok',false,'code','OWNER_REQUIRED','error','Only the workspace Owner can accept changes');
  end if;
  select * into v_bio from bios where brand_id=p_brand_id order by version desc limit 1 for update;
  if v_bio.id is distinct from p_bio_id or v_bio.version is distinct from p_version then
    return jsonb_build_object('ok',false,'code','STALE_BIO','error','Review the current BIO version');
  end if;
  if not v_bio.certified or not v_bio.client_acceptance_required or v_bio.client_accepted_at is not null
      or (v_bio.cert_valid_until is not null and v_bio.cert_valid_until <= v_at) then
    return jsonb_build_object('ok',false,'code','NOTHING_TO_ACCEPT','error','No current certified changes awaiting acceptance');
  end if;
  insert into cert_decisions(bio_id,brand_id,actor_role,decision,narrative,auto_signals)
    values(p_bio_id,p_brand_id,'client','client_accept','Owner accepted the Creative Director changes',
      jsonb_build_object('accepted_by',p_user_id,'version',p_version,'review',p_review)) returning id into v_receipt;
  update bios set client_accepted_at=v_at,client_accepted_by=p_user_id where id=p_bio_id;
  return jsonb_build_object('ok',true,'attestedAt',v_at,'attestationId',v_receipt);
end;
$$;
revoke all on function public.accept_bio_client_changes(uuid,uuid,int,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.accept_bio_client_changes(uuid,uuid,int,uuid,jsonb) to service_role;
