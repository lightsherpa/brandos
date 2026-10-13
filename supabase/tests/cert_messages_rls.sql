-- Certifier v2 S3: cert_messages RLS. Self-asserting; runs in a rolled-back transaction.
-- docker exec -i supabase_db_CaastorOS psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/cert_messages_rls.sql
begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','a@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b1','b@test.local','authenticated','authenticated');
insert into workspaces (id, name, tier) values
 ('00000000-0000-0000-0000-00000000aaaa','A','00'),('00000000-0000-0000-0000-00000000bbbb','B','00');
update users set workspace_id='00000000-0000-0000-0000-00000000aaaa' where id='00000000-0000-0000-0000-0000000000a1';
update users set workspace_id='00000000-0000-0000-0000-00000000bbbb' where id='00000000-0000-0000-0000-0000000000b1';
insert into workspace_memberships (user_id, workspace_id, role, is_owner, status) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000aaaa','workspace_admin',true,'active'),
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000bbbb','workspace_admin',true,'active');
insert into brands (id, workspace_id, name) values
 ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-00000000aaaa','Brand A'),
 ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-00000000bbbb','Brand B');
insert into bios (id, brand_id, version, payload, score, certified) values
 ('00000000-0000-0000-0000-0000000001ba','00000000-0000-0000-0000-0000000000ba',1,'{}',0,false),
 ('00000000-0000-0000-0000-0000000001bb','00000000-0000-0000-0000-0000000000bb',1,'{}',0,false);
insert into steward_jobs (id, bio_id, brand_id, kind, status) values
 ('00000000-0000-0000-0000-0000000002ba','00000000-0000-0000-0000-0000000001ba','00000000-0000-0000-0000-0000000000ba','onboarding','queued'),
 ('00000000-0000-0000-0000-0000000002bb','00000000-0000-0000-0000-0000000001bb','00000000-0000-0000-0000-0000000000bb','onboarding','queued');
insert into cert_messages (brand_id, job_id, claim_ids, author_role, body, sent_at) values
 ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba','{visual.logo}','cd','A sent',now()),
 ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba','{visual.type}','cd','A draft',null),
 ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-0000000002bb','{visual.logo}','cd','B sent',now());
do $$ begin
  insert into cert_messages (brand_id, job_id, author_role, body) values ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba','agent','x');
  raise exception 'agent insert should fail';
exception when check_violation then raise notice 'OK agent author_role rejected by check';
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
do $$ begin
  if (select coalesce(string_agg(body, ','), '') from cert_messages) <> 'A sent' then
    raise exception 'client A must see only its own sent question';
  end if;
  raise notice 'OK client sees only own brand, sent only';
end $$;
do $$ begin
  insert into cert_messages (brand_id, job_id, author_role, body) values ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba','cd','x');
  raise exception 'client insert should fail';
exception when insufficient_privilege then raise notice 'OK client insert denied';
end $$;
rollback;
