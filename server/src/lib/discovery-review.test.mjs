import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {BIO_FIELDS,SCORED_PATHS} from './bio-schema.js';
let source,bio,jobs,gates,assignments,rpcError;
const auth={userId:'owner',workspaceId:'ws',memberships:[{workspace_id:'ws',status:'active',is_owner:true}],permissions:new Set(['bio.read','bio.propose']),assignedWorkspaceIds:new Set(['ws'])};
const db={
 from(table){
  const filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},in(){return q;},not(){return q;},order(){return q;},limit(){return q;},
   update(value){if(table==='bio_sources')source={...source,...value};return q;},
   insert(){assert.fail('Automatic reviews must go through the atomic RPC');},
   async maybeSingle(){return {data:table==='brands'?{id:'brand',workspace_id:'ws'}:table==='bios'?bio:table==='bio_sources'?source:table==='bio_review_gates'?gates.get(bio.id):table==='steward_jobs'?jobs.find(job=>job.bio_id===filters.bio_id)||null:null,error:null};},
   then(resolve,reject){return Promise.resolve({data:table==='bio_sources'?[source]:[],error:null}).then(resolve,reject);}
  };return q;
 },
 async rpc(name,args){
  if(rpcError)return {error:{message:'database unavailable'}};
  if(name==='append_bio_version'){bio={...bio,id:`bio-${bio.version+1}`,version:bio.version+1,payload:args.p_payload};return {data:bio,error:null};}
  if(name==='record_bio_self_certification')return {data:{ok:true},error:null};
  assert.equal(name,'reconcile_bio_review');
  const report=args.p_report;let job=jobs.find(job=>job.bio_id===args.p_bio_id),created=false;
  // Simulates the serialised RPC boundary; SQL integration tests exercise its implementation.
  if(!job && report.meetsFloor){job={id:`job-${jobs.length+1}`,bio_id:args.p_bio_id,status:'queued'};jobs.push(job);created=true;}
  const gate={bio_id:args.p_bio_id,status:job?'queued':'gated',score:report.score,min_score:report.minScore,reasons:job?[]:report.reasons,job_id:job?.id||null};
  gates.set(args.p_bio_id,gate);return {data:{...gate,created},error:null};
 }
};
mock.module(new URL('./supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('./assign-steward.js',import.meta.url).href,{namedExports:{assignSteward:async id=>assignments.push(id)}});
mock.module(new URL('../middleware/auth.js',import.meta.url).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',auth);await next();}}});
mock.module(new URL('./audit.js',import.meta.url).href,{namedExports:{writeAuthorizationAudit:async()=>{}}});
const {reconcileDiscoveryReview,discoveryReviewReport}=await import('./discovery-review.js');
const {selfCertifyBio}=await import('./self-certify.js');
const {default:app}=await import('../routes/bios.js');
function reset(){
 source={id:'logo',kind:'file_upload',bucket:'visual',raw_ref:'ws/brand/logo.png',signals:{asset_role:'logo',ext:'png',rights_confirmed:false}};
 const payload={confidence:{}};
 for(const [section,key] of SCORED_PATHS){payload[section]??={};payload[section][key]=BIO_FIELDS.find(f=>f.path[0]===section&&f.path[1]===key).kind==='scalar'?'recorded':['recorded'];payload.confidence[`${section}.${key}`]={conf:100,source:`source-${section}-${key}`};}
 payload.visual={logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#4ba5aa'}],type:[{kind:'Display',family:'Inter',provider:'google'}]};
 bio={id:'bio-1',brand_id:'brand',version:1,payload};jobs=[];gates=new Map();assignments=[];rpcError=false;
}
const confirm=()=>app.request('/brand/sources/logo/confirm-rights',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rightsConfirmed:true})});
const reconcile=()=>reconcileDiscoveryReview({brandId:'brand',bioId:bio.id,payload:bio.payload});
test('gated Discovery persists reason and score; confirm-rights queues exactly one review and GET exposes both states',async()=>{
 reset();await reconcile();
 assert.equal(jobs.length,0);
 const gated=(await (await app.request('/brand')).json()).bio.reviewGate;
 assert.equal(gated.status,'gated');assert.equal(gated.score,79);assert.equal(gated.min_score,80);
 assert.deepEqual(gated.reasons,[{code:'LOGO_RIGHTS_UNCONFIRMED',message:'confirm logo rights'}]);
 const res=await confirm();assert.equal(res.status,200);assert.equal((await res.json()).reviewGate.status,'queued');
 assert.equal(jobs.length,1);assert.deepEqual(assignments,['job-1']);
 assert.equal((await (await app.request('/brand')).json()).bio.reviewGate.job_id,'job-1');
});
test('repeated and concurrent rights, reconciliation and self-certify triggers never add a second job for the version',async()=>{
 reset();await reconcile();
 for(const response of await Promise.all([confirm(),confirm(),confirm()]))assert.equal(response.status,200);
 await Promise.all([reconcile(),reconcile()]);
 const result=await selfCertifyBio({brandId:'brand',bioId:bio.id,payload:bio.payload,userId:'owner',statements:{authority:true,reflects:true,aspirationalMarked:true},statementVersion:'2',review:{reviewed:true}});
 assert.equal(result.ok,true);assert.equal(result.reviewQueued,true);assert.equal(jobs.length,1);assert.equal(assignments.length,1);
 jobs[0].status='completed';await confirm();await reconcile();assert.equal(jobs.length,1,'terminal jobs also count as the version’s first review');
});
test('saving edits records their gate and queues once when the edited version passes',async()=>{
 reset();
 const save=()=>app.request('/brand',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({payload:bio.payload})});
 let res=await save();assert.equal(res.status,200);assert.equal((await res.json()).bio.reviewGate.status,'gated');assert.equal(jobs.length,0);
 await confirm();assert.equal(jobs.length,1);const firstVersion=jobs[0].bio_id;
 res=await save();assert.equal(res.status,200);assert.equal((await res.json()).bio.reviewGate.status,'queued');assert.equal(jobs.length,2);assert.notEqual(jobs[1].bio_id,firstVersion);
 await reconcile();await confirm();assert.equal(jobs.length,2);
});
test('low confidence and missing foundation produce actionable durable reasons',()=>{
 reset();const report=discoveryReviewReport({},[]);
 assert.equal(report.meetsFloor,false);assert.equal(report.score,0);
 assert.deepEqual(report.reasons.map(r=>r.code),['LOGO_REQUIRED','PRIMARY_COLOUR_REQUIRED','DISPLAY_FONT_REQUIRED','BELOW_MIN_SCORE']);
});
test('a failed gate write is surfaced so an already confirmed source can retry reconciliation',async()=>{
 reset();rpcError=true;assert.equal((await confirm()).status,500);assert.equal(source.signals.rights_confirmed,true);assert.equal(jobs.length,0);
 rpcError=false;assert.equal((await confirm()).status,200);assert.equal(jobs.length,1);
});
