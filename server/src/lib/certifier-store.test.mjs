import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {createCertifierState,recordCertifierRun,latestCertifierBrief,confirmCertifierClaim} from './certifier-store.js';
import {testDatabase} from './certifier-test-db.mjs';
const ctx={workspaceId:'ws',brandId:'brand',bioId:'bio',version:'1'};
test('recreating the application and reimporting the store cannot reset committed spending',async()=>{
 const db=testDatabase();const first=await createCertifierState(db).acquire(ctx,randomUUID());await first.reserve(randomUUID(),0.29);await first.release();
 const restarted=await import('./certifier-store.js?restart');const next=await restarted.createCertifierState(db).acquire(ctx,randomUUID());assert.equal(next.spent,0.29);
 await assert.rejects(next.reserve(randomUUID(),0.02),e=>e.code==='CERTIFIER_COST_CAP');
});
test('independent instances share the DB busy lease and a conditional budget reservation',async()=>{
 const db=testDatabase();const a=createCertifierState(db),b=createCertifierState(db);const run=await a.acquire(ctx,randomUUID());
 await assert.rejects(b.acquire(ctx,randomUUID()),e=>e.status===409&&e.code==='CERTIFIER_BUSY');
 const attempts=await Promise.allSettled([run.reserve(randomUUID(),0.2),run.reserve(randomUUID(),0.2)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.budgets.values().next().value.spent,0.2);
});
test('expired leases recover after worker death but keep in-flight reservation spend and fence the old worker',async()=>{
 const db=testDatabase();const first=await createCertifierState(db).acquire(ctx,randomUUID());const call=randomUUID();await first.reserve(call,0.25);
 db.budgets.values().next().value.until=0;const next=await createCertifierState(db).acquire(ctx,randomUUID());assert.equal(next.spent,0.25);
 await assert.rejects(first.settle(call,0.01),e=>e.code==='CERTIFIER_BUSY');await first.release();
 await assert.rejects(createCertifierState(db).acquire(ctx,randomUUID()),e=>e.code==='CERTIFIER_BUSY');
 await assert.rejects(next.reserve(randomUUID(),0.1),e=>e.code==='CERTIFIER_COST_CAP');
});
test('successful settlement is idempotent; failed/unmeasured calls retain the full reservation',async()=>{
 const db=testDatabase();const run=await createCertifierState(db).acquire(ctx,randomUUID());const call=randomUUID();
 await run.reserve(call,0.2);await run.settle(call,0.05);assert.equal((await run.settle(call,0.05)).spent,0.05);
 await run.reserve(randomUUID(),0.2);await run.release();assert.equal((await createCertifierState(db).acquire(ctx,randomUUID())).spent,0.25);
});
test('brief lookup and redraft parent remain available after a store/application restart',async()=>{
 const db=testDatabase();const runId=randomUUID();const session=await createCertifierState(db).acquire(ctx,runId);
 const brief={brand_core_version:'1',claims:[{claim_id:'visual.logo'}]};await recordCertifierRun(ctx,{runId,brief,costUsd:0.01,model:'sonnet',log:[]},null,db);await session.release();
 const restarted=await import('./certifier-store.js?brief-restart');assert.deepEqual((await restarted.latestCertifierBrief(ctx,db)).brief,brief);
 assert.equal(await latestCertifierBrief({...ctx,workspaceId:'other'},db),null);
 assert.equal(await latestCertifierBrief({...ctx,version:'2'},db),null);
});
test('confirmation audit survives restart with actor, claim, version and database timestamp; duplicates get 409',async()=>{
 const db=testDatabase();const row=await confirmCertifierClaim({ctx,claimId:'visual.logo',userId:'human'},db);
 const restarted=await import('./certifier-store.js?confirmation-restart');assert.equal(db.confirmations[0].actor_user_id,'human');assert.equal(db.confirmations[0].bio_version,1);assert.equal(db.confirmations[0].claim_id,'visual.logo');assert.ok(Date.parse(row.created_at));
 await assert.rejects(restarted.confirmCertifierClaim({ctx,claimId:'visual.logo',userId:'human'},db),e=>e.status===409);
});
test('migration protects tables/RPCs, has no client grants, atomic conditional update and fixed $0.30 cap',()=>{
 const sql=readFileSync(new URL('../../../supabase/migrations/20261013040000_certifier_durable_state.sql',import.meta.url),'utf8');
 for(const table of ['certifier_budgets','certifier_budget_reservations','certifier_briefs','certifier_claim_confirmations','certifier_question_drafts'])assert.ok(sql.includes(`alter table public.${table} enable row level security;`));
 assert.match(sql,/spent = spent \+ p_est[\s\S]*spent \+ p_est <= cap/);assert.match(sql,/cap = 0\.30/);assert.doesNotMatch(sql,/grant[^;]+to (authenticated|anon)/);
 assert.match(sql,/from public, anon, authenticated/);assert.match(sql,/active_run_id is distinct from p_run_id/);
 for(const file of ['certifier-store.js','certifier/drafts.js'])assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),'utf8'),/new Map\(/,file);
 assert.doesNotMatch(readFileSync(new URL('certifier/run.js',import.meta.url),'utf8'),/const (budgets|active) = new Map/);
});
