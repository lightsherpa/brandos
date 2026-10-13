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
insert into cert_messages (brand_id, job_id, bio_version, claim_ids, field_paths, author_role, body, sent_at) values
 ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba',1,'{logo-stable-id}','{visual.logo}','cd','A sent',now()),
 ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba',1,'{type-stable-id}','{visual.type}','cd','A draft',null),
 ('00000000-0000-0000-0000-0000000000bb','00000000-0000-0000-0000-0000000002bb',1,'{logo-stable-id}','{visual.logo}','cd','B sent',now());
do $$ begin
  insert into cert_messages (brand_id, job_id, bio_version, claim_ids, field_paths, author_role, body) values ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba',1,'{logo-stable-id}','{visual.logo}','agent','x');
  raise exception 'agent insert should fail';
exception when check_violation then raise notice 'OK agent author_role rejected by check';
end $$;
-- RPC retries return the same message and source, and never alter bios.
do $$
declare q uuid; first jsonb; retry jsonb; n integer;
begin
  select id into q from cert_messages where body = 'A sent';
  first := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'retry-key-1', 'Use the PNG');
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'retry-key-1', 'Use the PNG');
  if first->>'ok' <> 'true' or first <> retry then raise exception 'retry must return identical answer: %, %', first, retry; end if;
  if first->'message' ? 'author_user_id' then raise exception 'RPC leaked author'; end if;
  select count(*) into n from bio_sources where brand_id = '00000000-0000-0000-0000-0000000000ba' and kind = 'client_answer';
  if n <> 1 then raise exception 'duplicate evidence: %', n; end if;
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'retry-key-1', 'Different');
  if retry->>'status' <> '409' then raise exception 'key reuse must conflict'; end if;
  if (select count(*) from bios where brand_id = '00000000-0000-0000-0000-0000000000ba') <> 1 then raise exception 'BIO version changed'; end if;
  if first->'message'->>'bio_version' <> '1' or first->'message'->'claim_ids' <> '["logo-stable-id"]'::jsonb then raise exception 'claim reference lost'; end if;
  begin
    insert into cert_messages (brand_id, job_id, bio_version, claim_ids, field_paths, author_role,
      author_user_id, reply_to, body, source_id, sent_at, idempotency_key, request_hash)
    select brand_id, job_id, bio_version, claim_ids, field_paths, author_role,
      author_user_id, reply_to, body, source_id, sent_at, idempotency_key, request_hash
      from cert_messages where id = (first->'message'->>'id')::uuid;
    raise exception 'unique answer key must reject direct duplicate';
  exception when unique_violation then raise notice 'OK unique answer key rejects duplicate';
  end;
  -- Failed uploads and foreign questions cannot create evidence.
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'bad-file-key', null, gen_random_uuid());
  if retry->>'status' <> '400' then raise exception 'foreign upload must reject'; end if;
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000b1', q, 'foreign-q-key', 'x');
  if retry->>'status' <> '404' then raise exception 'foreign question must reject'; end if;
  insert into bio_sources (id, brand_id, kind, src)
    values ('00000000-0000-0000-0000-0000000003ba', '00000000-0000-0000-0000-0000000000ba', 'file_upload', 'font.otf');
  first := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'font-retry-key', null, '00000000-0000-0000-0000-0000000003ba');
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'font-retry-key', null, '00000000-0000-0000-0000-0000000003ba');
  if first <> retry or first->'message'->>'source_id' <> '00000000-0000-0000-0000-0000000003ba' then raise exception 'file retry must reuse source'; end if;
  update steward_jobs set status = 'completed' where id = '00000000-0000-0000-0000-0000000002ba';
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'closed-key-1', 'late');
  if retry->>'status' <> '409' then raise exception 'closed job must reject'; end if;
  update steward_jobs set status = 'queued' where id = '00000000-0000-0000-0000-0000000002ba';
  update bios set certified = true where id = '00000000-0000-0000-0000-0000000001ba';
  retry := answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', q, 'certified-key-1', 'late');
  if retry->>'status' <> '409' then raise exception 'certified BIO must reject'; end if;
  update bios set certified = false where id = '00000000-0000-0000-0000-0000000001ba';
  raise notice 'OK atomic text evidence, retry, conflict, version binding, closed/certified job';
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
do $$ begin
  if (select coalesce(string_agg(body, ','), '') from cert_messages where author_role = 'cd') <> 'A sent' then
    raise exception 'client A must see only its own sent question';
  end if;
  raise notice 'OK client sees only own brand, sent only';
end $$;
do $$ begin
  insert into cert_messages (brand_id, job_id, bio_version, claim_ids, field_paths, author_role, body) values ('00000000-0000-0000-0000-0000000000ba','00000000-0000-0000-0000-0000000002ba',1,'{logo-stable-id}','{visual.logo}','cd','x');
  raise exception 'client insert should fail';
exception when insufficient_privilege then raise notice 'OK client insert denied';
end $$;
do $$ begin
  perform author_user_id from cert_messages;
  raise exception 'author_user_id must be hidden';
exception when insufficient_privilege then raise notice 'OK author_user_id column denied';
end $$;
do $$ begin
  perform * from cert_messages;
  raise exception 'select * must be denied';
exception when insufficient_privilege then raise notice 'OK full-table SELECT denied';
end $$;
do $$ begin
  perform answer_cert_question('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 'forbidden-key', 'x');
  raise exception 'client RPC must be denied';
exception when insufficient_privilege then raise notice 'OK service-only answer RPC';
end $$;
rollback;
