// Run with CERTIFIER_TEST_CONTAINER pointing ONLY to a disposable test Postgres.
// No project DB URL, production credentials or application database is used.
import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {createCertifierState,recordCertifierRun,latestCertifierBrief,confirmCertifierClaim} from '../server/src/lib/certifier-store.js';
import {runCertifier} from '../server/src/lib/certifier/run.js';
import {fixture,context,recordedOutput,modelMock} from '../server/src/lib/certifier/test-helpers.js';
const container=process.env.CERTIFIER_TEST_CONTAINER;
if(!container||!/^certifier-durable-pg-test(?:-[\w-]+)?$/.test(container))throw new Error('Set CERTIFIER_TEST_CONTAINER to a disposable certifier-durable-pg-test container.');
const literal=value=>value==null?'NULL':typeof value==='number'?String(value):`'${(typeof value==='object'?JSON.stringify(value):String(value)).replaceAll("'","''")}'`;
async function sql(text){return new Promise((resolve,reject)=>{
 const child=spawn('docker',['exec','-i',container,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);
 child.on('close',code=>code?reject(new Error(err.trim())):resolve(out.trim()));child.stdin.end(text);
});}
function database(){return{async rpc(name,params){try{return{data:JSON.parse(await sql(`select to_jsonb(public.${name}(${Object.entries(params).map(([k,v])=>`${k} => ${literal(v)}`).join(',')}))::text;`)),error:null};}catch(e){return{data:null,error:{message:e.message}};}},from(table){
 let columns='*',insert,filters=[],order='';const q={select(c){columns=c;return q;},eq(k,v){filters.push(`${k} = ${literal(v)}`);return q;},order(k){order=` order by ${k} desc`;return q;},limit(){return q;},insert(r){insert=r;return q;},
 async maybeSingle(){const rows=JSON.parse(await sql(`select coalesce(jsonb_agg(row_to_json(t)), '[]')::text from (select ${columns} from public.${table} where ${filters.join(' and ')}${order} limit 1)t;`));return{data:rows[0]||null,error:null};},
 async single(){try{const row=JSON.parse(await sql(`with t as (insert into public.${table}(${Object.keys(insert).join(',')}) values(${Object.values(insert).map(literal).join(',')}) returning ${columns}) select row_to_json(t)::text from t;`));return{data:row,error:null};}catch(e){return{error:{message:e.message,code:/duplicate key/.test(e.message)?'23505':'P0001'}};}}};return q;}};}
const ws=randomUUID(),human=randomUUID();
test.before(async()=>{
 await sql(`create role service_role nologin bypassrls; create role anon nologin; create role authenticated nologin;
 create table public.workspaces(id uuid primary key);create table public.users(id uuid primary key);
 create table public.brands(id uuid primary key, workspace_id uuid references workspaces(id));
 create table public.bios(id uuid primary key, brand_id uuid references brands(id), version integer);
 insert into workspaces values('${ws}');insert into users values('${human}');`);
 await sql(readFileSync(new URL('../supabase/migrations/20261013040000_certifier_durable_state.sql',import.meta.url),'utf8'));
});
async function scope(){const brand=randomUUID(),bio=randomUUID();await sql(`insert into brands values('${brand}','${ws}');insert into bios values('${bio}','${brand}',1);`);return{workspaceId:ws,brandId:brand,bioId:bio,version:'1'};}
test('Postgres restart client keeps spent dollars and rejects spending past $0.30',async()=>{
 const ctx=await scope();const first=await createCertifierState(database()).acquire(ctx,randomUUID());await first.reserve(randomUUID(),0.29);await first.release();
 const next=await createCertifierState(database()).acquire(ctx,randomUUID());assert.equal(next.spent,0.29);await assert.rejects(next.reserve(randomUUID(),0.02),e=>e.code==='CERTIFIER_COST_CAP');await next.release();
});
test('two simultaneous Postgres connections cannot exceed the cap',async()=>{
 const ctx=await scope();const s=await createCertifierState(database()).acquire(ctx,randomUUID());
 const attempts=await Promise.allSettled([s.reserve(randomUUID(),0.2),s.reserve(randomUUID(),0.2)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.find(x=>x.status==='rejected').reason.code,'CERTIFIER_COST_CAP');
 assert.equal(Number(await sql(`select spent from certifier_budgets where brand_id='${ctx.brandId}';`)),0.2);await s.release();
});
test('different instances get a single DB-owned lease and 409 CERTIFIER_BUSY',async()=>{
 const ctx=await scope();const attempts=await Promise.allSettled([createCertifierState(database()).acquire(ctx,randomUUID()),createCertifierState(database()).acquire(ctx,randomUUID())]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);const rejected=attempts.find(x=>x.status==='rejected').reason;assert.equal(rejected.code,'CERTIFIER_BUSY');assert.equal(rejected.status,409);await attempts.find(x=>x.status==='fulfilled').value.release();
});
test('worker crash lease expires without resetting its outstanding reserve and fences the old worker',async()=>{
 const ctx=await scope();const a=await createCertifierState(database()).acquire(ctx,randomUUID());const call=randomUUID();await a.reserve(call,0.25);
 await sql(`update certifier_budgets set active_until=clock_timestamp()-interval '1 second' where brand_id='${ctx.brandId}';`);
 const b=await createCertifierState(database()).acquire(ctx,randomUUID());assert.equal(b.spent,0.25);await assert.rejects(a.settle(call,0.01),e=>e.code==='CERTIFIER_BUSY');assert.equal(await a.release(),false);
 await assert.rejects(b.reserve(randomUUID(),0.1),e=>e.code==='CERTIFIER_COST_CAP');await b.release();
});
test('RPC retries are idempotent, known usage refunds only its unused reservation',async()=>{
 const ctx=await scope();const s=await createCertifierState(database()).acquire(ctx,randomUUID());const call=randomUUID();await s.reserve(call,0.2);assert.equal(Number((await s.reserve(call,0.2)).spent),0.2);
 assert.equal(Number((await s.settle(call,0.05)).spent),0.05);assert.equal(Number((await s.settle(call,0.05)).spent),0.05);await s.release();
});
test('full brief and single-claim redraft work across fresh runner modules and DB clients',async()=>{
 process.env.CERTIFIER_V2_S2='true';const sc=await scope();const f=fixture('nomad-roasters');Object.assign(f.brand,{id:sc.brandId,workspace_id:sc.workspaceId});Object.assign(f.bio,{id:sc.bioId,brand_id:sc.brandId});f.sources.forEach(s=>s.brand_id=sc.brandId);
 const ctx=context(f);const db=database();
 const first=await runCertifier(ctx,{state:createCertifierState(db),stream:modelMock(recordedOutput(ctx,'nomad-roasters')),saveDraft:async()=> 'draft',persistRun:r=>recordCertifierRun(ctx,r,null,db)});
 const restarted=await import('../server/src/lib/certifier/run.js?db-restart');const nextDb=database();const old=await latestCertifierBrief(ctx,nextDb);assert.deepEqual(old.brief,first.brief);
 const id='visual.logo';const out=recordedOutput(ctx,'nomad-roasters');out.claims=out.claims.filter(c=>c.claim_id===id);out.questions=[];
 const result=await restarted.runCertifier(ctx,{state:createCertifierState(nextDb),mode:'single_claim',claimId:id,previousBrief:old.brief,stream:modelMock(out),saveDraft:async()=> 'draft',persistRun:r=>recordCertifierRun(ctx,r,null,nextDb)});
 assert.equal(result.brief.mode,'single_claim');assert.ok(Number(await sql(`select spent from certifier_budgets where brand_id='${sc.brandId}';`))>first.costUsd);
 assert.equal((await latestCertifierBrief(ctx,database())).brief.mode,'single_claim');
 for(const c of first.brief.claims)if(c.claim_id!==id)assert.deepEqual(result.brief.claims.find(x=>x.claim_id===c.claim_id),c);
});
test('human confirmations persist with actor, claim, version, timestamp and unique audit identity',async()=>{
 const ctx=await scope();const row=await confirmCertifierClaim({ctx,claimId:'visual.logo',userId:human},database());
 const saved=JSON.parse(await sql(`select row_to_json(t)::text from certifier_claim_confirmations t where id='${row.id}';`));
 assert.equal(saved.actor_user_id,human);assert.equal(saved.claim_id,'visual.logo');assert.equal(saved.bio_version,1);assert.ok(Date.parse(saved.created_at));
 await assert.rejects(confirmCertifierClaim({ctx,claimId:'visual.logo',userId:human},database()),e=>e.status===409);
});
test('RLS/client grants and function execution enforce service-only access; audit rows cannot be rewritten',async()=>{
 const protectedTables=['certifier_budgets','certifier_budget_reservations','certifier_briefs','certifier_claim_confirmations','certifier_question_drafts'];
 for(const table of protectedTables){assert.equal(await sql(`select relrowsecurity from pg_class where oid='public.${table}'::regclass;`),'t');for(const role of ['anon','authenticated'])assert.equal(await sql(`select has_table_privilege('${role}','public.${table}','select');`),'f');}
 for(const role of ['anon','authenticated'])assert.equal(await sql(`select has_function_privilege('${role}','public.certifier_acquire_run(uuid,uuid,uuid,integer,uuid)','execute');`),'f');
 assert.equal(await sql(`select has_table_privilege('service_role','public.certifier_claim_confirmations','update');`),'f');
 assert.equal(await sql(`select has_table_privilege('service_role','public.certifier_claim_confirmations','delete');`),'f');
 const ctx=await scope();await sql(`set role service_role;select public.certifier_acquire_run('${ctx.workspaceId}','${ctx.brandId}','${ctx.bioId}',1,'${randomUUID()}');`);
 await assert.rejects(sql('set role authenticated;select * from public.certifier_briefs;'),/permission denied/);
});
