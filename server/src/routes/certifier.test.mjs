import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, context, recordedOutput } from '../lib/certifier/test-helpers.js';
import { enrich } from '../lib/certifier/enrich.js';
const root=new URL('../',import.meta.url);
let auth,steward,bio,brand,jobs,writes,saved,latestVersion,modelCalls,ctx;
const db={from(table){const filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},in(){return q;},
 insert(v){writes.push([table,v]);return q;},update(v){writes.push([table,v]);return q;},delete(){writes.push([table,'delete']);return q;},
 maybeSingle(){return q;},single(){return q;},then(resolve){return Promise.resolve({error:null,data:table==='brands'?brand:table==='bios'?(filters.id?bio:{version:latestVersion}):table==='steward_jobs'?jobs:table==='team_members'?steward:null}).then(resolve);}};return q;}};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',auth);return next();},requirePermission:()=>async(c,next)=>next()}});
mock.module(new URL('lib/notify.js',root).href,{namedExports:{notify:async()=>{},brandOwnerUserId:async()=>null}});
mock.module(new URL('lib/certifier/context.js',root).href,{namedExports:{buildCertifierContext:async()=>ctx}});
mock.module(new URL('lib/certifier/run.js',root).href,{namedExports:{certifierEnabled:()=>process.env.CERTIFIER_V2_S2==='true',runCertifier:async(c,opts)=>{modelCalls++;assert.equal(c.workspaceId,'ws');return{runId:opts.runId,brief:enrich(recordedOutput(c,'nomad-roasters'),c),log:[],costUsd:0.001,model:'anthropic/claude-sonnet-5-5'};}}});
mock.module(new URL('lib/certifier-store.js',root).href,{namedExports:{latestCertifierBrief:async()=>saved,recordCertifierRun:async(c,r)=>{writes.push(['certifier_briefs',r]);},reserveCertifier:async()=> 'reservation',refundCertifier:async()=>{},confirmCertifierClaim:async args=>{writes.push(['certifier_claim_confirmations',args]);return{id:'confirmed'};}}});
const{default:stewardApp}=await import('./steward.js');const{default:biosApp}=await import('./bios.js');const{default:sessionApp}=await import('./discovery-session.js');
const request=(app,path,method='GET',body,token)=>app.request(path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body&&method!=='GET'?{body:JSON.stringify(body)}:{})});
function reset(){process.env.CERTIFIER_V2_S2='true';const f=fixture('nomad-roasters');ctx={...context(f),runId:'run'};brand=f.brand;bio=f.bio;latestVersion=1;
 auth={userId:'cd-user',scope:'platform',actorType:'human'};steward={id:'cd',active:true,roles:['steward']};jobs=[{id:'job',assigned_to:'cd'}];writes=[];modelCalls=0;
 saved={id:'run',version:1,created_at:'2026-10-13T16:00:00Z',brief:enrich(recordedOutput(ctx,'nomad-roasters'),ctx)};
}
test('S2 flag off returns 404 across all new routes with zero DB mutations/model work',async()=>{
 reset();delete process.env.CERTIFIER_V2_S2;
 for(const[path,method]of[['/certifier/bio/brief','GET'],['/certifier/bio/brief','POST'],['/certifier/bio/claims/visual.logo/redraft','POST'],['/certifier/bio/claims/visual.logo/confirm','POST']])assert.equal((await request(stewardApp,path,method,{mode:'full'})).status,404);
 assert.equal(writes.length,0);assert.equal(modelCalls,0);
});
test('agent actor receives 403 on ALL three certification paths and per-claim confirmation; no row changes',async()=>{
 reset();auth.actorType='agent';
 for(const[app,path,method]of[[biosApp,'/brand/self-certify','POST'],[biosApp,'/brand/accept-changes','POST'],[sessionApp,'/session/brand/attest','POST'],[stewardApp,'/jobs/job','PATCH'],[stewardApp,'/decertify','POST'],[stewardApp,'/certifier/bio/claims/visual.logo/confirm','POST']]){
 const res=await request(app,path,method,{});assert.equal(res.status,403,path);assert.equal((await res.json()).code,'AGENT_CANNOT_CERTIFY');}
 assert.equal(writes.length,0);assert.equal(modelCalls,0);
});
test('delegation and service bearer tokens receive the same 403 at every certify endpoint',async()=>{
 reset();const service='head.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.sig';
 for(const token of ['a'.repeat(43),service])for(const[app,path,method]of[[biosApp,'/brand/self-certify','POST'],[biosApp,'/brand/accept-changes','POST'],[sessionApp,'/session/brand/attest','POST'],[stewardApp,'/jobs/job','PATCH'],[stewardApp,'/decertify','POST'],[stewardApp,'/certifier/bio/claims/visual.logo/confirm','POST']])assert.equal((await request(app,path,method,{},token)).status,403);
 assert.equal(writes.length,0);
});
test('full brief route requires exact mode and review assignment; writes only host run record',async()=>{
 reset();assert.equal((await request(stewardApp,'/certifier/bio/brief','POST',{mode:'unexpected'})).status,400);
 jobs=[{assigned_to:'other'}];assert.equal((await request(stewardApp,'/certifier/bio/brief','POST',{mode:'full'})).status,403);assert.equal(modelCalls,0);
 jobs=[{assigned_to:'cd'}];const res=await request(stewardApp,'/certifier/bio/brief','POST',{mode:'full'});assert.equal(res.status,200);assert.equal((await res.json()).brand_core_version,'1');
 assert.deepEqual(writes.map(([t])=>t),['certifier_briefs']);assert.equal(modelCalls,1);
});
test('GET latest is pinned and marked stale when brand version changes; does not rerun',async()=>{
 reset();latestVersion=2;const res=await request(stewardApp,'/certifier/bio/brief');assert.equal(res.status,200);const body=await res.json();assert.equal(body.stale,true);assert.equal(body.brief.brand_core_version,'1');assert.equal(modelCalls,0);
 assert.equal((await request(stewardApp,'/certifier/bio/brief','POST',{mode:'full'})).status,409);assert.equal(writes.length,0);
});
test('new client evidence is marked on GET without automatic model rerun',async()=>{
 reset();ctx.manifest.set('new',{source_id:'new',kind:'client_answer',created_at:'2026-10-13T17:00:00Z'});ctx.ledger.get('identity.pillars[0]').evidence_source_ids.push('new');
 const res=await request(stewardApp,'/certifier/bio/brief');assert.equal((await res.json()).brief.claims.find(c=>c.claim_id==='identity.pillars[0]').status_label,'New evidence');assert.equal(modelCalls,0);
});
test('single-claim unknown IDs and missing/version-mismatched previous brief are rejected',async()=>{
 reset();assert.equal((await request(stewardApp,'/certifier/bio/claims/foreign/redraft','POST')).status,404);
 saved=null;assert.equal((await request(stewardApp,'/certifier/bio/claims/visual.logo/redraft','POST')).status,409);assert.equal(modelCalls,0);
});
test('human claim confirmation requires current evidence; cannot certify a missing foundation',async()=>{
 reset();assert.equal((await request(stewardApp,'/certifier/bio/claims/identity.pillars[0]/confirm','POST')).status,409);
 const res=await request(stewardApp,'/certifier/bio/claims/visual.logo/confirm','POST');assert.equal(res.status,200);assert.deepEqual(writes.map(([t])=>t),['certifier_claim_confirmations']);
 assert.equal(writes[0][1].userId,'cd-user');
});
test('non-steward and foreign workspace callers cannot read internal briefs',async()=>{
 reset();steward=null;assert.equal((await request(stewardApp,'/certifier/bio/brief')).status,403);
 reset();auth.scope='workspace';auth.workspaceId='other';assert.equal((await request(stewardApp,'/certifier/bio/brief')).status,403);
 assert.equal(modelCalls,0);
});
