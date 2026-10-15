// Isolated, zero-paid-call hero regression. Provider outputs are synthetic fixtures.
// Real local Auth, API review routes, compiler, progress, Postgres and gates run.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const local=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(local.API_URL,'http://127.0.0.1:57421');
Object.assign(process.env,{SUPABASE_URL:local.API_URL,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:local.ANON_KEY,OPENROUTER_API_KEY:'synthetic-test-only',FIRECRAWL_API_KEY:'synthetic-test-only',DISCOVERY_PAID_TEST:'0',INNGEST_DEV:'1'});
const sb=createClient(local.API_URL,local.SERVICE_ROLE_KEY),owner=JSON.parse(await readFile('.bio-local/owner.json','utf8'));
const must=async query=>{const {data,error}=await query;if(error)throw error;return data;};
const login=async(email,password)=>{const result=await createClient(local.API_URL,local.ANON_KEY).auth.signInWithPassword({email,password});if(result.error)throw result.error;return result.data.session.access_token;};
const ownerToken=await login(owner.email,'Bio-release-test-2026!');
const cdEmail='bio-demo-director@example.test',password='Demo-only-release-2026!';
let cd=(await must(sb.from('users').select('id').eq('email',cdEmail).maybeSingle()));
if(!cd){const created=await sb.auth.admin.createUser({email:cdEmail,password,email_confirm:true});if(created.error)throw created.error;cd=created.data.user;}
let member=await must(sb.from('team_members').select('id').eq('user_id',cd.id).maybeSingle());
if(!member)member=await must(sb.from('team_members').insert({user_id:cd.id,name:'Demo Creative Director (synthetic fixture)',first_name:'Demo Creative Director',roles:['lead_steward'],active:true}).select('id').single());
const cdToken=await login(cdEmail,password);
const api=async(token,path,body,method='POST')=>{const response=await fetch('http://127.0.0.1:8792'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
const payload={
 identity:{positioning:'An independent neighborhood bakery serving weekday regulars.',category:'Neighborhood bakery',founded:'2019',pillars:['Daily','Local','Honest']},
 audience:{primary:'Local residents who walk to the bakery each morning.',secondary:'Office workers buying breakfast.',tertiary:'Weekend families.',jtbd:['Find a reliable morning stop','Share fresh bread at home']},
 voice:{register:'Plain and friendly',rhythm:'Short and warm.',forbidden:['gourmet','synergy'],signatures:['Made this morning']},
 goals:{northStar:'Be the neighborhood’s regular morning stop.',q2:'Introduce filter coffee.',q3:'Supply two nearby cafés.'},
 strategic:{watchouts:['Keep the weekday menu dependable'],notList:['A destination patisserie']},
 visual:{palette:[],type:[],imagery:[],avoid:[]},
 positioning:{frameOfReference:'Local breakfast and bread',competitors:[],pointsOfDifference:[],pointsOfParity:['Fresh bread'],researchGaps:['Synthetic demo has no external competitive research.']},
 aspirations:{direction:'Become the preferred neighborhood morning stop.',notYetTrue:['Wholesale service'],references:[]},
 confidence:{},missing:[],refusals:['Never claim wholesale service already exists.']
};
for(const [section,fields] of Object.entries(payload))if(['identity','audience','voice','goals','strategic','visual'].includes(section))for(const field of Object.keys(fields))payload.confidence[section+'.'+field]={conf:90,source:'Synthetic '+section+' source fixture'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=String(input);
 if(url.startsWith('https://api.firecrawl.dev/')){
  const body=JSON.parse(options.body);
  const data=url.endsWith('/map')?{links:[]}:url.endsWith('/search')?{web:[]}:{markdown:'Synthetic bakery brand evidence: founded 2019, local breakfast, warm voice. This is a test fixture.',rawHtml:'<style>h1{font-family:"IBM Plex Serif";color:#234567}body{font-family:"IBM Plex Sans";background:#f4f4f1}</style>',metadata:{title:'Demo bakery',statusCode:200},screenshot:'https://example.test/synthetic-demo.png'};
  return new Response(JSON.stringify({success:true,data}),{headers:{'content-type':'application/json'}});
 }
 if(url==='https://openrouter.ai/api/v1/chat/completions'){
  const body=JSON.parse(options.body);
  const value=body.model.includes('haiku')?{identity:{category:'Neighborhood bakery'},audience:{primary:'Local residents'},observations:[],gaps:[]}:body.model.includes('gemini')?{imagery:['Synthetic warm morning bakery photography'],avoid:['Unrelated stock imagery']}:structuredClone(payload);
  const event={choices:[{delta:{content:JSON.stringify(value)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:100,cost:0}};
  return new Response('data: '+JSON.stringify(event)+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 }
 if(/^http:\/\/(?:localhost|127\.0\.0\.1):(?:8288|8292)\/e\//.test(url))return new Response(JSON.stringify({status:200,ids:[randomUUID()]}),{headers:{'content-type':'application/json'}});
 if(!url.startsWith(local.API_URL)&&!url.startsWith('http://127.0.0.1:8792'))throw Error('External request prohibited in the synthetic demo: '+new URL(url).hostname);
 return originalFetch(input,options);
};
const {compileBio}=await import('../server/src/inngest/functions/compile-bio.js');
const {CERTIFICATION_SECTIONS}=await import('../server/src/lib/certification-review.js');
const {loadBioForRun,loadBioForBriefing}=await import('../server/src/lib/load-brand-bio.js');
const results=[];
await mkdir('output/bio-discovery',{recursive:true});await mkdir('public/demo/bio',{recursive:true});
for(let n=1;n<=3;n++){
 const started=Date.now(),discoveryId=randomUUID();
 const brand=await must(sb.from('brands').insert({workspace_id:owner.workspaceId,name:`Demo bakery · synthetic hero ${n}`,url:'https://demo-brand.test'}).select('id').single());
 const stages=[];
 const step={run:async(name,fn)=>{stages.push(name);return fn();}};
 const output=await compileBio.fn({event:{data:{brandId:brand.id,workspaceId:owner.workspaceId,url:'https://demo-brand.test',discoveryId,actorUserId:owner.userId,references:[]}},step,logger:{info(){},warn(){}}});
 let bio=await must(sb.from('bios').select('*').eq('id',output.bioId).single());
 const review={bioId:bio.id,version:bio.version,statementVersion:'2',reviewedSections:CERTIFICATION_SECTIONS,statements:{authority:true,reflects:true,aspirationalMarked:true}};
 const forbidden=await api(cdToken,`/api/bios/${brand.id}/self-certify`,review);assert.equal(forbidden.status,403);
 const stale=await api(ownerToken,`/api/bios/${brand.id}/self-certify`,{...review,version:0});assert.equal(stale.status,409);
 const certified=await api(ownerToken,`/api/bios/${brand.id}/self-certify`,review);assert.equal(certified.status,200,JSON.stringify(certified.data));
 await loadBioForBriefing({workspaceId:owner.workspaceId,brandId:brand.id});
 await assert.rejects(loadBioForRun({workspaceId:owner.workspaceId,brandId:brand.id}),e=>e.code==='BIO_NOT_CERTIFIED');
 await must(sb.from('steward_jobs').update({assigned_to:member.id}).eq('id',output.stewardJobId));
 const scores=Object.fromEntries(['C3','C4','C5','C6','C7'].map(k=>[k,{score:4,confidence:2}]));
 const reviewed=await api(cdToken,`/api/steward/jobs/${output.stewardJobId}`,{reviewerScores:scores,notes:'Synthetic regression fixture; not a human certification of a real brand.',bioPatch:{voice:{rhythm:'Short sentences. Warm invitations.'}}},'PATCH');assert.equal(reviewed.status,200,JSON.stringify(reviewed.data));
 bio=await must(sb.from('bios').select('*').eq('brand_id',brand.id).order('version',{ascending:false}).limit(1).single());
 assert.equal(bio.certified,true);assert.equal(bio.client_acceptance_required,true);
 await assert.rejects(loadBioForRun({workspaceId:owner.workspaceId,brandId:brand.id}),e=>e.code==='BIO_AWAITING_ACCEPTANCE');
 const accept={...review,bioId:bio.id,version:bio.version};
 assert.equal((await api(cdToken,`/api/bios/${brand.id}/accept-changes`,accept)).status,403);
 assert.equal((await api(ownerToken,`/api/bios/${brand.id}/accept-changes`,review)).status,409);
 const accepted=await api(ownerToken,`/api/bios/${brand.id}/accept-changes`,accept);assert.equal(accepted.status,200,JSON.stringify(accepted.data));
 await loadBioForRun({workspaceId:owner.workspaceId,brandId:brand.id});
 bio=await must(sb.from('bios').select('*').eq('id',bio.id).single());
 assert.ok(bio.client_accepted_at);
 const receipts=await must(sb.from('cert_decisions').select('id').eq('bio_id',bio.id).eq('decision','client_accept'));assert.equal(receipts.length,1);
 const progress=await must(sb.from('discovery_runs').select('status,bio_id').eq('id',discoveryId).single());assert.equal(progress.status,'completed');assert.equal(progress.bio_id,output.bioId);
 const seconds=(Date.now()-started)/1000;assert.ok(seconds<180);
 results.push({run:n,seconds,brandId:brand.id,discoveryId,bioId:bio.id,mode:'synthetic-provider/local-real-api-and-database',paidCostUsd:0,stages});
 if(n===3){
  const safe={id:'demo-bio',version:bio.version,payload:bio.payload,certified:true,cert_valid_until:bio.cert_valid_until,client_acceptance_required:false,self_certified:true};
  await writeFile('public/demo/bio/demo.json',JSON.stringify({brandName:'Neighborhood bakery · demo fixture',certifier:'Demo Creative Director',bio:safe},null,2)+'\n');
  await writeFile('.bio-local/demo-brand.json',JSON.stringify({brandId:brand.id,bioId:bio.id}));
 }
 console.log(`PASS synthetic hero ${n}: ${seconds.toFixed(2)}s; Owner/CD/acceptance gates and receipts verified`);
}
// Real live results remain unreviewed. Do not synthesize a Geoking BIO.
const cake=JSON.parse(await readFile('output/bio-discovery/cake-me-live.json','utf8'));
const publicCakePayload=structuredClone(cake.bio.payload);for(const source of publicCakePayload.visualEvidence?.sources||[])delete source.screenshotUrl;
await writeFile('public/demo/bio/cake-me.json',JSON.stringify({brandName:'Cake-me · saved live test',bio:{id:'cake-me-live-test',version:cake.bio.version,payload:publicCakePayload,certified:false,self_certified:false}},null,2)+'\n');
await writeFile('public/demo/bio/geoking.json',JSON.stringify({brandName:'Geoking',unavailable:true,message:'Source retrieval failed. No BIO was generated.'},null,2)+'\n');
await writeFile('output/bio-discovery/demo-results.json',JSON.stringify(results,null,2));
globalThis.fetch=originalFetch;
