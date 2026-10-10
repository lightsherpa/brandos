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
rollback;
