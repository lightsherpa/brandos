begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into workspaces(id,name,tier) values('71000000-0000-0000-0000-000000000001','Review gate test','03');
insert into brands(id,workspace_id,name) values('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','Gated brand');
insert into bios(id,brand_id,version,payload,score,certified) values
 ('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',1,'{}',79,false),
 ('73000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000001',2,'{}',100,false);
insert into discovery_runs(id,brand_id,workspace_id,bio_id,stage,status) values
 ('74000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','save','running');
select is(reconcile_bio_review('73000000-0000-0000-0000-000000000001','{"score":79,"minScore":80,"meetsFloor":false,"reasons":[{"code":"LOGO_RIGHTS_UNCONFIRMED","message":"confirm logo rights"}]}')->>'status','gated','failed gate is recorded');
select is((select score from bio_review_gates where bio_id='73000000-0000-0000-0000-000000000001'),79,'gate records capped score');
select is((select reasons->0->>'code' from bio_review_gates where bio_id='73000000-0000-0000-0000-000000000001'),'LOGO_RIGHTS_UNCONFIRMED','gate records reason');
select is((select status from discovery_runs where id='74000000-0000-0000-0000-000000000001'),'gated','run does not silently finish done');
select is((select count(*)::integer from steward_jobs where bio_id='73000000-0000-0000-0000-000000000001'),0,'gated run does not queue a job');
select is(reconcile_bio_review('73000000-0000-0000-0000-000000000001','{"score":100,"minScore":80,"meetsFloor":true,"reasons":[]}')->>'created','true','first passing trigger creates a job');
select is((select status from discovery_runs where id='74000000-0000-0000-0000-000000000001'),'completed','passing gate releases run');
select is((select score from bios where id='73000000-0000-0000-0000-000000000001'),100,'stored score follows live rights');
select is(reconcile_bio_review('73000000-0000-0000-0000-000000000001','{"score":100,"minScore":80,"meetsFloor":true,"reasons":[]}','drift_check')->>'created','false','edit/self-cert trigger reuses job');
update steward_jobs set status='completed' where bio_id='73000000-0000-0000-0000-000000000001';
select is(reconcile_bio_review('73000000-0000-0000-0000-000000000001','{"score":100,"minScore":80,"meetsFloor":true,"reasons":[]}')->>'created','false','terminal job still prevents a duplicate');
select is((select count(*)::integer from steward_jobs where bio_id='73000000-0000-0000-0000-000000000001'),1,'only one job exists after repeated triggers');
select is(reconcile_bio_review('73000000-0000-0000-0000-000000000002','{"score":100,"minScore":80,"meetsFloor":true,"reasons":[]}')->>'created','true','a different BIO version gets its own review');
select ok(not has_function_privilege('authenticated','public.reconcile_bio_review(uuid,jsonb,text)','execute'),'browser cannot forge a passing report');
select ok(not has_table_privilege('authenticated','public.bio_review_gates','UPDATE'),'browser cannot alter gates');
select * from finish();
rollback;
