import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {BIO_FIELDS,normalizeBio} from '../lib/bio-schema.js';
import {buildClaimLedger} from '../lib/claim-ledger.js';
const root=new URL('../',import.meta.url);
let auth,job,bio,sources,messages,writes,owner;
function query(table) {
  let op='select',body;const f={};
  const run=()=>{
    if(op==='insert'||op==='update'){writes.push({table,op,body});return [{id:'written',...body}];}
    if(table==='team_members')return [{id:'cd',roles:auth.roles || ['steward'],active:true,name:'Reviewer'}];
    if(table==='steward_jobs')return [job];
    if(table==='bios')return [bio];
    if(table==='bio_sources')return sources;
    if(table==='cert_messages')return messages;
    return [];
  };
  const q={select(){return q;},eq(k,v){f[k]=v;return q;},lt(){return q;},in(){return q;},order(){return q;},limit(){return q;},
    update(v){op='update';body=v;return q;},insert(v){op='insert';body=v;return q;},
    async maybeSingle(){return {data:run()[0] || null,error:null};},async single(){return {data:run()[0] || null,error:null};},
    then(resolve,reject){return Promise.resolve({data:run(),error:null}).then(resolve,reject);}};
  return q;
}
const db={from:query,rpc:async(name,p)=>{writes.push({table:name,body:p});return {data:{id:'new-bio',version:3},error:null};},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://files.test/logo.png'}})})}};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',auth);await next();}}});
mock.module(new URL('lib/notify.js',root).href,{namedExports:{brandOwnerUserId:async()=>owner,notify:async()=>{},notifyTeamRole:async()=>{},teamMemberUserId:async()=>null}});
const {default:app}=await import('./steward.js');
function reset(){
  process.env.CERTIFIER_V2_S1='true';process.env.CERTIFIER_V2_S3='true';process.env.STEWARD_CALIBRATION_REQUIRED='true';
  auth={userId:'reviewer',roles:['steward'],scope:'platform'};writes=[];messages=[];owner='client';
  const p={confidence:{}};
  for(const f of BIO_FIELDS){(p[f.path[0]]||={})[f.path[1]]=f.kind==='scalar'?'Verified':f.kind==='list'?['Verified']:f.kind==='object'?null:[];p.confidence[f.path.join('.')]={conf:95,source:'https://brand.test/about'};}
  p.visual={logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Instrument Sans',provider:'google'}]};
  bio={id:'bio',brand_id:'brand',version:2,payload:normalizeBio(p),certified:false};
  job={id:'job',brand_id:'brand',bio_id:'bio',assigned_to:'cd',status:'in_review',kind:'onboarding',bio,brand:{name:'Brand',url:'https://brand.test'}};
  sources=[{id:'logo',kind:'file_upload',src:'logo.png',raw_ref:'workspace/brand/logo.png',signals:{asset_role:'logo',ext:'png',rights_confirmed:true}},
    {id:'site',kind:'url_scrape',src:'https://brand.test/about',signals:{snippet:'Verified'}}];
}
const req=(body)=>app.request('/jobs/job',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const read=()=>app.request('/jobs/job');
const review=()=>{const l=buildClaimLedger({brandId:'brand',bioVersion:2,payload:bio.payload,sources,messages});return {bio_version:2,decisions:Object.fromEntries(l.claims.map(c=>[c.claim_id,{state:'confirmed',evidence_token:c.evidence_token}]))};};
const scores={C3:{score:4,confidence:3},C4:{score:4,confidence:3},C5:{score:4,confidence:3},C6:{score:4,confidence:3},C7:{score:4,confidence:3}};

test('S1 read is runtime flagged; off keeps existing job contract',async()=>{
  reset();let json=await(await read()).json();assert.equal(json.certify.enabled,true);assert.equal(json.certify.bio_version,2);assert.ok(json.certify.claims.length>20);
  assert.deepEqual(json.certify.logoRights,['logo']);
  process.env.CERTIFIER_V2_S1='false';json=await(await read()).json();assert.equal(json.certify,undefined);assert.equal(json.job.id,'job');
});
test('certification rejects missing or partial claim decisions without writes',async()=>{
  reset();const res=await req({reviewerScores:scores});assert.equal(res.status,409);assert.equal((await res.json()).code,'STALE_CLAIM_REVIEW');assert.equal(writes.length,0);
  const res2=await req({reviewerScores:scores,claimReview:{bio_version:2,decisions:{}}});assert.equal(res2.status,409);assert.equal((await res2.json()).code,'CLAIMS_UNRESOLVED');assert.equal(writes.length,0);
});
test('new client evidence and open questions block an earlier resolution',async()=>{
  reset();const r=review();const id=Object.keys(r.decisions)[0];messages=[{id:'a',bio_version:2,claim_ids:[id],author_role:'client',sent_at:'now',body:'Changed evidence'}];
  const stale=await req({reviewerScores:scores,claimReview:r});assert.equal(stale.status,409);assert.equal((await stale.json()).code,'STALE_CLAIM_REVIEW');
  messages=[{id:'q',bio_version:2,claim_ids:[id],author_role:'cd',sent_at:'now'}];const open=await req({reviewerScores:scores,claimReview:review()});assert.equal(open.status,409);assert.equal((await open.json()).code,'CLAIMS_UNRESOLVED');
});
test('non-Lead review keeps calibration and saves versioned decisions in audit narrative',async()=>{
  reset();const res=await req({reviewerScores:scores,claimReview:review(),notes:'Checked sources'});
  assert.equal(res.status,200,JSON.stringify(await res.clone().json()));assert.equal((await res.json()).status,'pending_lead_review');
  assert.equal(writes.find(w=>w.table==='bios').body.certified,false);
  const audit=writes.find(w=>w.table==='cert_decisions');const narrative=JSON.parse(audit.body.narrative);
  assert.equal(narrative.claimReview.bio_version,2);assert.equal(narrative.notes,'Checked sources');assert.ok(audit.body.criterion_scores);
});
test('Lead certification, fix patch and SoD retain the existing submission path',async()=>{
  reset();auth.roles=['lead_steward'];const r=review();const c=buildClaimLedger({brandId:'brand',bioVersion:2,payload:bio.payload,sources}).claims.find(c=>c.field_path==='identity.positioning');
  r.decisions[c.claim_id]={state:'fixed',value:'A better positioning',evidence_token:c.evidence_token};
  const res=await req({reviewerScores:scores,claimReview:r,bioPatch:{identity:{positioning:'A better positioning'}}});
  assert.equal(res.status,200,JSON.stringify(await res.clone().json()));assert.equal((await res.json()).status,'completed');
  assert.ok(writes.some(w=>w.table==='append_bio_version'));assert.equal(writes.find(w=>w.table==='bios').body.certified,true);
  reset();owner='reviewer';const blocked=await req({reviewerScores:scores,claimReview:review()});assert.equal(blocked.status,403);assert.equal((await blocked.json()).code,'SOD_OWN_BRAND');assert.equal(writes.length,0);
});
test('agents cannot certify or lead-approve even with a steward role and human body label',async()=>{
  reset();auth.actor={type:'agent'};
  for(const body of [{reviewerScores:scores,claimReview:review(),actor:'human'},{leadApprove:true}]){const res=await req(body);assert.equal(res.status,403);assert.equal((await res.json()).code,'AGENT_CANNOT_CERTIFY');}
  assert.equal(writes.length,0);
});
test('flag off allows the legacy human review path',async()=>{
  reset();delete process.env.CERTIFIER_V2_S1;const res=await req({reviewerScores:scores});assert.equal(res.status,200);assert.equal((await res.json()).status,'pending_lead_review');
});

test('even a complete human claim review cannot seal a foundation without a display font',async()=>{
  reset();bio.payload.visual.type=[{kind:'Body',family:'Instrument Sans',provider:'google'}];
  const res=await req({reviewerScores:scores,claimReview:review()});
  assert.equal(res.status,409);assert.equal((await res.json()).code,'FOUNDATION_INCOMPLETE');
  assert.ok(!writes.some(w=>w.table==='bios'));
});

test('unauthorized roles cannot open the Certify job API; a creative director and a certifying designer can',async()=>{
  for (const persona of ['user','workspace_admin','client']) {
    reset();auth={userId:'member',persona,scope:'workspace',roles:persona==='workspace_admin'?['steward']:[]};
    const denied=await read();assert.equal(denied.status,403);assert.equal((await denied.json()).code,'CERTIFY_FORBIDDEN');
  }
  reset();auth={userId:'designer',persona:'designer',scope:'platform',roles:['designer']};
  const plain=await read();assert.equal(plain.status,403);assert.equal((await plain.json()).code,'CERTIFY_FORBIDDEN');
  reset();auth={userId:'cd',persona:'creative_director',scope:'platform',roles:[]};
  const director=await read();assert.equal(director.status,200,JSON.stringify(await director.clone().json()));
  reset();auth={userId:'designer',persona:'designer',scope:'platform',roles:['steward']};
  const reviewer=await read();assert.equal(reviewer.status,200);
});

test('Lead approval also requires a complete current claim review and preserves four-eyes',async()=>{
  reset();auth.roles=['lead_steward'];job.status='pending_lead_review';job.assigned_to='first-reviewer';job.decision='approve';
  const missing=await req({leadApprove:true});assert.equal(missing.status,409);assert.equal((await missing.json()).code,'STALE_CLAIM_REVIEW');
  const good=await req({leadApprove:true,claimReview:review()});assert.equal(good.status,200);assert.equal((await good.json()).status,'completed');
  reset();auth.roles=['lead_steward'];job.status='pending_lead_review';job.assigned_to='cd';
  const own=await req({leadApprove:true,claimReview:review()});assert.equal(own.status,409);assert.match((await own.json()).error,/different Lead/);
});

test('simplified approval defaults off and cannot silently accept without a human decision',async()=>{
 reset();delete process.env.CERTIFY_SIMPLIFY;
 assert.equal((await req({reviewMode:'simplified',decision:'approve',claimReview:review()})).status,404);
 process.env.CERTIFY_SIMPLIFY='1';assert.equal((await req({reviewMode:'simplified',claimReview:review()})).status,400);delete process.env.CERTIFY_SIMPLIFY;
});
test('simplified human approval records only measured criteria and preserves calibration without five ratings',async()=>{
 reset();process.env.CERTIFY_SIMPLIFY='1';
 const response=await req({reviewMode:'simplified',decision:'approve',claimReview:review(),notes:'Checked visually'});assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal((await response.json()).status,'pending_lead_review');
 const audit=writes.find(w=>w.table==='cert_decisions').body;assert.equal(audit.composite_score,null);assert.deepEqual(audit.criterion_scores.map(c=>c.id),['C1','C2']);assert.ok(audit.criterion_scores.every(c=>c.source==='auto'));assert.equal(JSON.parse(audit.narrative).humanApproval,true);delete process.env.CERTIFY_SIMPLIFY;
});
test('simplified review retains stale evidence, unresolved questions, rights, owner and agent gates',async()=>{
 reset();process.env.CERTIFY_SIMPLIFY='1';
 assert.equal((await req({reviewMode:'simplified',decision:'approve'})).status,409);
 const r=review();sources[1].signals.snippet='New evidence';assert.equal((await req({reviewMode:'simplified',decision:'approve',claimReview:r})).status,409);
 sources[0].signals.rights_confirmed=false;assert.equal((await req({reviewMode:'simplified',decision:'approve',claimReview:review()})).status,409);
 reset();owner='reviewer';assert.equal((await req({reviewMode:'simplified',decision:'approve',claimReview:review()})).status,403);
 reset();auth.actor={type:'agent'};assert.equal((await req({reviewMode:'simplified',decision:'approve',claimReview:review()})).status,403);
 assert.ok(!writes.some(w=>w.table==='cert_decisions'));delete process.env.CERTIFY_SIMPLIFY;
});
test('simplified final human approval certifies without rating placeholders',async()=>{
 reset();process.env.CERTIFY_SIMPLIFY='1';auth.roles=['lead_steward'];
 const res=await req({reviewMode:'simplified',decision:'approve',claimReview:review()});assert.equal(res.status,200,JSON.stringify(await res.clone().json()));assert.equal((await res.json()).status,'completed');assert.equal(writes.find(w=>w.table==='bios').body.certified,true);delete process.env.CERTIFY_SIMPLIFY;
});
