-- Disposable local fixtures; all writes are rolled back, including successful attestations.
begin;
do $$
declare b uuid:=gen_random_uuid(); old_bio uuid:=gen_random_uuid(); new_bio uuid:=gen_random_uuid(); ws uuid; actor uuid; r jsonb;
begin
 select id into ws from public.workspaces limit 1;
 select id into actor from public.users limit 1;
 insert into public.brands(id,workspace_id,name) values(b,ws,'Certification transaction fixture');
 insert into public.bios(id,brand_id,version,payload) values(old_bio,b,1,'{}');
 r:=public.record_bio_self_certification(old_bio,b,actor,'fixture-hash','2','{}',78,'{"reviewedSections":["identity"],"statements":{"authority":true}}');
 if not (r->>'ok')::boolean then raise exception 'Expected success';end if;
 if not exists(select 1 from public.bios where id=old_bio and self_certified=true and self_certified_at is not null) then raise exception 'Unlock missing';end if;
 if not exists(select 1 from public.bio_attestations where bio_id=old_bio and review_capture->'statements'->>'authority'='true' and created_at is not null) then raise exception 'Review receipt missing';end if;
 insert into public.bios(id,brand_id,version,payload) values(new_bio,b,2,'{}');
 r:=public.record_bio_self_certification(old_bio,b,actor,'fixture-hash','2','{}',78,'{}');
 if r->>'code'<>'STALE_BIO' then raise exception 'Stale version accepted';end if;
 begin
  perform public.record_bio_self_certification(new_bio,b,'00000000-0000-0000-0000-000000000000','fixture-hash','2','{}',78,'{}');
  raise exception 'Expected invalid actor rejection';
 exception when foreign_key_violation then null;
 end;
 if exists(select 1 from public.bios where id=new_bio and self_certified=true) then raise exception 'Failed record unlocked BIO';end if;
 if exists(select 1 from public.bio_attestations where bio_id=new_bio) then raise exception 'Failed record left receipt';end if;
 if has_function_privilege('authenticated','public.record_bio_self_certification(uuid,uuid,uuid,text,text,jsonb,integer,jsonb)','execute') then raise exception 'Client role can bypass server gates';end if;
 raise notice 'PASS: receipt, unlock, stale rejection, failure rollback, service-only access';
end;$$;
-- Acceptance: immutable receipt and unlock roll back together on write failure.
create function pg_temp.reject_fixture_acceptance() returns trigger language plpgsql as $$
begin if new.decision='client_accept' then raise check_violation using message='fixture receipt failure';end if;return new;end;$$;
create trigger fixture_acceptance_failure before insert on public.cert_decisions for each row execute function pg_temp.reject_fixture_acceptance();
do $$
declare b uuid:=gen_random_uuid(); bio uuid:=gen_random_uuid(); ws uuid; actor uuid; r jsonb;
begin
 select workspace_id,user_id into ws,actor from public.workspace_memberships where is_owner and status='active' limit 1;
 if actor is null then raise exception 'Owner fixture required';end if;
 insert into public.brands(id,workspace_id,name) values(b,ws,'Disposable acceptance transaction fixture');
 insert into public.bios(id,brand_id,version,payload,certified,client_acceptance_required) values(bio,b,1,'{}',true,true);
 r:=public.accept_bio_client_changes(b,bio,0,actor,'{}');
 if r->>'code'<>'STALE_BIO' then raise exception 'Stale acceptance allowed';end if;
 r:=public.accept_bio_client_changes(b,bio,1,'00000000-0000-0000-0000-000000000000','{}');
 if r->>'code'<>'OWNER_REQUIRED' then raise exception 'Non-Owner acceptance allowed';end if;
 begin
  perform public.accept_bio_client_changes(b,bio,1,actor,'{}');
  raise exception 'Receipt failure did not abort acceptance';
 exception when check_violation then null;
 end;
 if exists(select 1 from public.bios where id=bio and client_accepted_at is not null) then raise exception 'Failed receipt unlocked production';end if;
 if exists(select 1 from public.cert_decisions where bio_id=bio and decision='client_accept') then raise exception 'Failed receipt persisted';end if;
 if has_function_privilege('authenticated','public.accept_bio_client_changes(uuid,uuid,integer,uuid,jsonb)','execute') then raise exception 'Client can bypass acceptance route';end if;
 raise notice 'PASS: Owner gate, stale rejection, acceptance receipt rollback, service-only access';
end;$$;
rollback;
