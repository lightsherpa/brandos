begin;
-- Claim, run identity and hold commit together. A replay never launches another SSE execution.
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
 update canvas_quotes set state='claimed' where id=q.id;
 insert into runs(id,brief_id,specialist_id,spec_version,bio_version,status,started_at,canvas_id,canvas_node_id,canvas_snapshot)
 values(q.id,c.brief_id,p_spec_id,p_spec_version,p_bio_version,'running',now(),c.id,p_node_id,p_snapshot);
 perform reserve_workspace_credits(p_workspace_id,p_credits,'run:'||q.id::text||':credits','run_reserved',q.id);
 return q.id;
end $$;
revoke all on function public.create_canvas_text_run(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,int,int,int) from public,anon,authenticated;
grant execute on function public.create_canvas_text_run(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,int,int,int) to service_role;
commit;
