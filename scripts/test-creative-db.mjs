// Run with PGLITE_MODULE pointing to an isolated @electric-sql/pglite module.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table workspaces(id uuid primary key,tier text);
create table users(id uuid primary key);
create table brands(id uuid primary key,workspace_id uuid,name text);
create table bios(id uuid primary key default gen_random_uuid(),brand_id uuid,version int,certified boolean,cert_valid_until timestamptz);
create table briefs(id uuid primary key default gen_random_uuid(),brand_id uuid,title text,type text,payload jsonb,mode text,status text);
create table runs(id uuid primary key default gen_random_uuid(),brief_id uuid,specialist_id text,spec_version int,bio_version int,status text,started_at timestamptz,ended_at timestamptz,model_used text,prompt_tokens int,completion_tokens int,cached_tokens int,cost_usd numeric,latency_ms int);
create table outputs(id uuid primary key default gen_random_uuid(),run_id uuid,brief_id uuid,kind text,body jsonb,asset_url text,status text,rationale text,created_at timestamptz default now());
create table qa_results(id uuid primary key default gen_random_uuid(),output_id uuid,refusal_id text,passed boolean,evidence text);
create table ledger(id uuid primary key default gen_random_uuid(),workspace_id uuid,run_id uuid,credits int,kind text,balance_after int,idempotency_key text unique,created_at timestamptz default now());
create table api_budgets(scope_type text,scope_key text,active boolean,per_request_ceiling_usd numeric,monthly_budget_usd numeric);
create table api_usage_events(workspace_id uuid,occurred_at timestamptz,reported_cost_usd numeric,reconciled_cost_usd numeric,estimated_cost_usd numeric,preflight_max_cost_usd numeric);
`);
const old=await read('supabase/migrations/20260815001000_platform_integrity.sql');
for(const name of ['reserve_workspace_credits','release_workspace_credits','fail_run_and_release_credits','finalize_run_atomic']){
 const start=old.indexOf(`create or replace function ${name}(`);const end=old.indexOf('$$;',start)+3;assert.ok(start>=0);await db.exec(old.slice(start,end));
}
await db.exec(await read('supabase/migrations/20260922000000_creative_production.sql'));
const w='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',u='33333333-3333-4333-8333-333333333333';
await db.query('insert into workspaces values($1,\'00\')',[w]);await db.query('insert into users values($1)',[u]);await db.query('insert into brands values($1,$2,\'Acme\')',[b,w]);await db.query('insert into bios(brand_id,version,certified) values($1,1,true)',[b]);await db.query('insert into ledger(workspace_id,credits,kind) values($1,-100,\'grant\')',[w]);
await db.query("insert into api_budgets values('workspace',$1,true,1,10)",[w]);
const args=[w,b,u,null,'a20',1,1,8,'test-request','hash','v1',{route:'test',modality:'image'},{},{briefText:'Test'}, {},.2];
const create=async(a=args)=>(await db.query('select * from create_creative_job($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',a)).rows[0];
const first=await create();const second=await create();assert.equal(first.id,second.id);
assert.equal((await db.query("select count(*)::int n from ledger where credits>0")).rows[0].n,1);
await assert.rejects(create(args.map((v,i)=>i===9?'different':v)),/IDEMPOTENCY_CONFLICT/);
await assert.rejects(create(args.map((v,i)=>i===8?'expensive':i===15?2:v)),/CREATIVE_SPEND_CEILING_REQUIRED/);
await assert.rejects(create(args.map((v,i)=>i===8?'other':i===1?'44444444-4444-4444-8444-444444444444':v)),/BRAND_NOT_FOUND/);
const settle=[w,first.run_id,first.reservation_key,'test',0,0,0,null,50,'image',{kind:'image'},null,'flagged','review',false,'review','run_flagged'];
const finish=async()=>(await db.query('select finalize_run_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) result',settle)).rows[0].result;
assert.equal((await finish()).output_id,(await finish()).output_id);
assert.equal((await db.query('select count(*)::int n from outputs')).rows[0].n,1);
const failed=await create(args.map((v,i)=>i===8?'failure':v));
for(let i=0;i<2;i++)await db.query('select fail_run_and_release_credits($1,$2,$3,$4,$5)',[w,failed.run_id,failed.reservation_key,`${failed.reservation_key}:refund`,'run_refund']);
assert.equal((await db.query("select count(*)::int n from ledger where kind='run_refund'")).rows[0].n,1);
await db.query('update bios set cert_valid_until=now()-interval \'1 day\'');
await assert.rejects(create(args.map((v,i)=>i===8?'expired':v)),/BIO_NOT_CERTIFIED/);
console.log('PASS: migration compiled; create/reserve deduplication, isolation, spend ceiling, certification TTL, exactly-once finalize/refund');await db.close();
