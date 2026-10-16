begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='public.brand_book_shares'::regclass),'guideline capabilities have RLS enabled');
select ok(not has_table_privilege('anon','public.brand_book_shares','SELECT'),'anonymous role cannot read share token hashes or snapshots');
select ok(not has_table_privilege('authenticated','public.brand_book_shares','SELECT') and not has_table_privilege('authenticated','public.brand_book_shares','INSERT'),'browser roles cannot create or inspect capability rows');
select ok(has_column_privilege('service_role','public.brand_book_shares','revoked_at','UPDATE'),'server may revoke a capability');
select ok(not has_column_privilege('service_role','public.brand_book_shares','snapshot','UPDATE'),'server cannot rewrite a shared snapshot');
-- Transactional rollback fixtures, never seeded into a brand workspace.
create temp table book_fixture as select gen_random_uuid() ws,gen_random_uuid() owner_uid,gen_random_uuid() reader_uid,gen_random_uuid() brand,gen_random_uuid() bio,gen_random_uuid() draft,gen_random_uuid() share;
insert into workspaces(id,name) select ws,'Brand Book SQL rollback fixture' from book_fixture;
insert into auth.users(id,email) select owner_uid,'book-owner@example.test' from book_fixture union all select reader_uid,'book-reader@example.test' from book_fixture;
insert into public.users(id,workspace_id,email) select owner_uid,ws,'book-owner@example.test' from book_fixture union all select reader_uid,ws,'book-reader@example.test' from book_fixture on conflict(id) do update set workspace_id=excluded.workspace_id;
insert into workspace_memberships(workspace_id,user_id,role,status,is_owner) select ws,owner_uid,'workspace_admin','active',true from book_fixture union all select ws,reader_uid,'user','active',false from book_fixture;
insert into brands(id,workspace_id,name) select brand,ws,'Original approved brand' from book_fixture;
insert into bios(id,brand_id,version,payload,certified) select bio,brand,3,'{"identity":{"positioning":"Approved snapshot"}}'::jsonb,true from book_fixture union all select draft,brand,4,'{}'::jsonb,false from book_fixture;
create function pg_temp.new_book_share(actor text default 'owner',is_draft boolean default false,ver integer default 3) returns void language sql as $$
 insert into brand_book_shares(id,brand_id,bio_id,bio_version,created_by,token_hash,locale,items,expires_at,snapshot)
 select case when actor='owner' and not is_draft and ver=3 then f.share else gen_random_uuid() end,f.brand,case when is_draft then f.draft else f.bio end,ver,case when actor='owner' then f.owner_uid else f.reader_uid end,encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),'en',array['logos','strategy'],now()+interval '7 days',jsonb_build_object('brand',jsonb_build_object('name','Original approved brand'),'bio',jsonb_build_object('id',case when is_draft then f.draft else f.bio end,'version',ver),'assets','[]'::jsonb) from book_fixture f;
$$;
select lives_ok('select pg_temp.new_book_share()','owner can create a certified version-bound capability');
select is((select bio_version from brand_book_shares where id=(select share from book_fixture)),3,'share stores exact certified version');
select throws_ok('select pg_temp.new_book_share(''reader'')','P0001','BRAND_BOOK_SHARE_OWNER_REQUIRED','workspace reader cannot create a share');
select throws_ok('select pg_temp.new_book_share(''owner'',true,4)','P0001','BRAND_BOOK_SHARE_CERTIFIED_VERSION_REQUIRED','drafts cannot be publicly shared');
select throws_ok('select pg_temp.new_book_share(''owner'',false,99)','P0001','BRAND_BOOK_SHARE_CERTIFIED_VERSION_REQUIRED','version and certified record must match');
select throws_ok($$update brand_book_shares set snapshot='{}'::jsonb where id=(select share from book_fixture)$$,'P0001','BRAND_BOOK_SHARE_IMMUTABLE','snapshot contents cannot be changed after sharing');
select throws_ok($$update brand_book_shares set bio_version=4 where id=(select share from book_fixture)$$,'P0001','BRAND_BOOK_SHARE_IMMUTABLE','shared version cannot change');
update brands set name='Later brand name' where id=(select brand from book_fixture);
select is((select snapshot#>>'{brand,name}' from brand_book_shares where id=(select share from book_fixture)),'Original approved brand','later brand edits do not change the shared snapshot');
select lives_ok($$update brand_book_shares set revoked_at=now() where id=(select share from book_fixture)$$,'owner-authorized server action can revoke a share');
select throws_ok($$update brand_book_shares set revoked_at=null where id=(select share from book_fixture)$$,'P0001','BRAND_BOOK_SHARE_IMMUTABLE','revoked capabilities cannot be reactivated');
select * from finish();
rollback;
