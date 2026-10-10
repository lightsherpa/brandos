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
