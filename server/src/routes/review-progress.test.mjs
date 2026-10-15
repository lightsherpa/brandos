import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createReviewProgressRoutes} from './review-progress.js';import {buildClaimLedger} from '../lib/claim-ledger.js';
let actor,job,sources,rows,requests,rpcCalls,failRead;
const reset=()=>{actor={userId:'human',id:'reviewer',roles:['steward']};job={id:'job',brand_id:'brand',bio_id:'bio',status:'in_review',assigned_to:'reviewer',bio:{id:'bio',version:3,payload:{visual:{logo:{sourceId:'logo-source'}}}},brand:{url:'https://brand.test'}};sources=[{id:'logo-source',kind:'file_upload',src:'logo.png',signals:{rights_confirmed:true}}];rows=new Map();requests=new Map();rpcCalls=0;failRead=false;};
const db={from(table){const filters={};const query={select(){return this;},eq(k,v){filters[k]=v;return this;},async maybeSingle(){return {data:table==='steward_jobs'?job:rows.get(`${filters.job_id}:${filters.actor_user_id}:${filters.bio_version}`)||null,error:failRead?{message:'offline'}:null};},then(resolve,reject){return Promise.resolve({data:table==='bio_sources'?sources:[],error:failRead?{message:'offline'}:null}).then(resolve,reject);}};return query;},async rpc(_name,p){rpcCalls++;const key=`${p.p_job_id}:${p.p_actor_user_id}:${p.p_bio_version}`,request=`${key}:${p.p_request_id}`;if(requests.has(request)){const old=requests.get(request);return {data:old.hash===p.p_request_hash?old.result:{ok:false,status:409,code:'IDEMPOTENCY_CONFLICT'}};}const old=rows.get(key);if((old?.revision||0)!==p.p_expected_revision)return {data:{ok:false,status:409,code:'PROGRESS_CONFLICT'}};const row={state:p.p_state,revision:p.p_expected_revision+1,updated_at:'2026-10-15T15:00:00Z'};rows.set(key,row);const result={ok:true,progress:row};requests.set(request,{hash:p.p_request_hash,result});return {data:result};}};
const auth=async(c,next)=>{if(!actor)return c.json({error:'Unauthorized'},401);c.set('auth',{userId:actor.userId});return next();};
const steward=async(c,next)=>{if(!actor.roles.some(r=>['steward','lead_steward'].includes(r)))return c.json({error:'Steward role required'},403);c.set('steward',actor);return next();};
const human=async(c,next)=>actor.machine?c.json({error:'Human required'},403):next();
const app=createReviewProgressRoutes(steward,{db,auth,human,enabled:()=>true});
const currentLedger=()=>buildClaimLedger({brandId:'brand',bioVersion:3,payload:job.bio.payload,sources,brandUrl:job.brand.url});
const save=(body)=>app.request('/jobs/job/progress',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const write=()=>{const c=currentLedger().claims[0];return {bio_version:3,expected_revision:0,request_id:randomUUID(),decisions:{[c.claim_id]:{state:'confirmed',evidence_token:c.evidence_token}},active_id:c.claim_id,scores:{C3:{score:3,confidence:2}},notes:'Keep this',question:'Please clarify',mode:'ask'};};
test.beforeEach(reset);
test('flag defaults off before auth and enabled route denies unauthenticated/brand users',async()=>{
 const off=createReviewProgressRoutes(steward,{db,auth,human,enabled:()=>false});assert.equal((await off.request('/jobs/job/progress')).status,404);
 actor=null;assert.equal((await app.request('/jobs/job/progress')).status,401);actor={userId:'owner',roles:['owner']};assert.equal((await app.request('/jobs/job/progress')).status,403);
});
test('assigned job/Lead read rules, per-user scope and human-only writes',async()=>{
 actor.id='other';assert.equal((await app.request('/jobs/job/progress')).status,403);actor.roles=['lead_steward'];assert.equal((await app.request('/jobs/job/progress')).status,200);
 actor.machine=true;assert.equal((await save(write())).status,403);assert.equal(rpcCalls,0);
});
test('progress round-trip restores fresh instance state; replay is idempotent; concurrent revision conflicts',async()=>{
 const body=write(),first=await save(body);assert.equal(first.status,200);assert.equal((await first.json()).progress.revision,1);
 assert.equal((await (await save(body)).json()).progress.revision,1);assert.equal(rows.size,1);
 const restored=await (await app.request('/jobs/job/progress')).json();assert.deepEqual(restored.progress.decisions,body.decisions);assert.equal(restored.progress.notes,'Keep this');
 assert.equal((await save({...body,request_id:randomUUID()})).status,409);assert.equal((await save({...body,notes:'Changed'})).status,409);
 actor={userId:'second',id:'lead',roles:['lead_steward']};assert.equal((await (await app.request('/jobs/job/progress')).json()).progress.revision,0);
});
test('current evidence invalidates only the changed claim and stale PUT cannot reconfirm it',async()=>{
 const body=write();const ledger=currentLedger();const logo=ledger.claims.find(c=>c.field_path==='visual.logo'),voice=ledger.claims.find(c=>c.field_path==='voice.register');
 body.decisions={[logo.claim_id]:{state:'confirmed',evidence_token:logo.evidence_token},[voice.claim_id]:{state:'confirmed',evidence_token:voice.evidence_token}};
 assert.equal((await save(body)).status,200);sources[0].signals.rights_confirmed=false;
 const out=await (await app.request('/jobs/job/progress')).json();assert.deepEqual(out.invalidated_claim_ids,[logo.claim_id]);assert.ok(out.progress.decisions[voice.claim_id]);
 const saved=await (await save({...body,expected_revision:1,request_id:randomUUID()})).json();assert.deepEqual(saved.invalidated_claim_ids,[logo.claim_id]);assert.equal(saved.progress.decisions[logo.claim_id],undefined);assert.equal(saved.progress.notes,'Keep this');
});
test('version/evidence failures fail closed and finished refresh never reopens review',async()=>{
 assert.equal((await save({...write(),bio_version:2})).status,409);assert.equal(rpcCalls,0);
 job.status='completed';const out=await(await app.request('/jobs/job/progress')).json();assert.equal(out.closed,true);assert.equal(out.progress.mode,'done');assert.equal((await save(write())).status,409);
 job.status='rejected';assert.equal((await(await app.request('/jobs/job/progress')).json()).progress.mode,'rejected');
 job.status='in_review';failRead=true;assert.equal((await app.request('/jobs/job/progress')).status,503);assert.equal(rpcCalls,0);
});
test('pending second review is closed for submitter but editable for a different Lead',async()=>{
 job.status='pending_lead_review';assert.equal((await save(write())).status,409);assert.equal((await(await app.request('/jobs/job/progress')).json()).progress.mode,'submitted');
 actor={userId:'lead-user',id:'lead',roles:['lead_steward']};assert.equal((await save(write())).status,200);
});
