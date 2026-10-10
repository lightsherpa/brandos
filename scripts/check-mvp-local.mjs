// Real local Auth/API/DB/RLS/storage integration. No model generation or client evidence.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import {usageEvent} from '../server/src/lib/creative/usage.js';
import {seedDocument} from '../src/canvas/document.js';
const config=JSON.parse(await readFile(new URL('../.mvp-local/fixture.json',import.meta.url),'utf8'));
if(new URL(process.env.SUPABASE_URL).hostname!=='127.0.0.1')throw new Error('This test requires isolated local Supabase.');
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data:login,error}=await client.auth.signInWithPassword({email:config.email,password:config.password});if(error)throw error;
const api='http://127.0.0.1:8791';let checks=0;
async function request(path,body,method=body?'POST':'GET',expected=200){const r=await fetch(api+path,{method,headers:{Authorization:`Bearer ${login.session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,expected,`${path}: ${JSON.stringify(data)}`);checks++;return data;}
async function db(query){const {data,error}=await query;if(error)throw new Error(error.message);return data;}
const who=await request('/api/me');
const {canvas}=await request('/api/canvases',{brandId:config.brandId,creationKey:randomUUID(),context:{title:'Local integration check',rawBrief:'Synthetic local test only: clinical clarity and a nightly ritual.',specialistIds:['a01','a20']}},'POST',201);
const loaded=await request(`/api/canvases/${canvas.id}`);assert.equal(loaded.bio.certified,true);
const node=canvas.document.nodes.find(n=>n.type==='specialist'&&n.outputType==='text');assert.ok(node);
const quoted=await request(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]});assert.equal(quoted.quotes.length,1);assert.ok(quoted.total>0);
const renamed=structuredClone(canvas.document);renamed.nodes.find(n=>n.id===node.id).title='Local checked positioning';
const saved=await request(`/api/canvases/${canvas.id}`,{revision:canvas.revision,document:renamed},'PUT');assert.equal(saved.canvas.revision,canvas.revision+1);
await request(`/api/canvases/${canvas.id}`,{revision:canvas.revision,document:renamed},'PUT',409);
const {data:forbidden,error:writeErr}=await client.from('canvas_layouts').update({revision:999}).eq('id',canvas.id).select();assert.ok(writeErr||!forbidden?.length);checks++;
const {error:quoteReadErr}=await client.from('canvas_quotes').select('*');assert.ok(quoteReadErr);checks++;
const docs=await client.from('canvas_layouts').select('id').eq('id',canvas.id);assert.equal(docs.data.length,1);checks++;
const bios=await db(admin.from('bios').select('id').eq('brand_id',config.brandId).eq('certified',true));
await db(admin.from('bios').update({certified:false}).in('id',bios.map(b=>b.id)));
try{await request(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]},'POST',409);}finally{await db(admin.from('bios').update({certified:true}).in('id',bios.map(b=>b.id)));}
const refreshedQuote=await request(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]});
const before=await db(admin.from('ledger').select('credits').eq('workspace_id',config.workspaceId));
const stream=await fetch(api+'/api/runs/stream',{method:'POST',headers:{Authorization:`Bearer ${login.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({canvasId:canvas.id,nodeId:node.id,quoteId:refreshedQuote.quotes[0].id})});
assert.equal(stream.status,200);assert.match(await stream.text(),/event: error/);checks++;
const after=await db(admin.from('ledger').select('credits').eq('workspace_id',config.workspaceId));assert.equal(after.reduce((s,r)=>s+r.credits,0),before.reduce((s,r)=>s+r.credits,0));checks++;
// Synthetic output through the real atomic settlement RPC, not a provider result.
const runId=randomUUID();await db(admin.from('runs').insert({id:runId,brief_id:canvas.brief_id,specialist_id:node.specialistId,spec_version:1,bio_version:1,status:'running',started_at:new Date().toISOString(),canvas_id:canvas.id,canvas_node_id:node.id,canvas_snapshot:{settings:node.settings,credits:8}}));
const reservationKey=`local-fixture:${runId}`;
await db(admin.rpc('reserve_workspace_credits',{p_workspace_id:config.workspaceId,p_amount:8,p_idempotency_key:reservationKey,p_kind:'run_reserved',p_run_id:runId}));
const settled=await db(admin.rpc('finalize_run_atomic',{p_workspace_id:config.workspaceId,p_run_id:runId,p_reservation_key:reservationKey,p_model_used:'local-fixture/no-provider',p_prompt_tokens:0,p_completion_tokens:0,p_cached_tokens:0,p_cost_usd:null,p_latency_ms:0,p_output_kind:'copy',p_output_body:{text:'Synthetic settlement fixture. No model generated this output.'},p_asset_url:null,p_output_status:'approved',p_rationale:'Local test fixture',p_qa_passed:true,p_qa_evidence:'Synthetic QA fixture',p_ledger_kind:'run'}));
const runs=await request(`/api/canvases/${canvas.id}/runs`);assert.ok(runs.runs.some(r=>r.id===runId));assert.doesNotMatch(JSON.stringify(runs),/local-fixture\/no-provider|cost_usd|prompt_tokens/);
await request(`/api/outputs/${settled.output_id}`,{text:'Edited local fixture'},'PATCH');
const storagePath=`${config.workspaceId}/${config.brandId}/local-test/${randomUUID()}.png`;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
await db(admin.storage.from('creative-outputs').upload(storagePath,png,{contentType:'image/png'}));
try{const signed=await db(admin.storage.from('creative-outputs').createSignedUrl(storagePath,60));assert.equal((await fetch(signed.signedUrl)).status,200);const denied=await client.storage.from('creative-outputs').download(storagePath);assert.ok(denied.error);checks+=2;}finally{await admin.storage.from('creative-outputs').remove([storagePath]);}

// Real transactional media creation, using synthetic policy/model inputs and no provider dispatch.
const mediaNode=canvas.document.nodes.find(n=>n.outputType==='image'),quoteId=randomUUID();
await db(admin.from('api_budgets').upsert({scope_type:'workspace',scope_key:config.workspaceId,monthly_budget_usd:20,per_request_ceiling_usd:1,active:true},{onConflict:'scope_type,scope_key'}));
const fingerprint='synthetic-transaction-check',snapshot={canvasRevision:saved.canvas.revision,settings:mediaNode.settings,credits:6};
await db(admin.from('canvas_quotes').insert({id:quoteId,canvas_id:canvas.id,node_id:mediaNode.id,created_by:config.userId,fingerprint,credits:6,request:{route:'local/fixture',snapshot},expires_at:new Date(Date.now()+60000).toISOString()}));
const args={p_workspace_id:config.workspaceId,p_brand_id:config.brandId,p_actor_id:config.userId,p_brief_id:canvas.brief_id,p_spec_id:mediaNode.specialistId,p_spec_version:1,p_bio_version:1,p_credits:6,p_request_key:quoteId,p_request_hash:fingerprint,p_catalog_version:'synthetic',p_model:{route:'local/fixture',modality:'image'},p_routing:{requestedMode:'off'},p_input:{briefText:'Synthetic transaction fixture',canvas:{id:canvas.id,nodeId:mediaNode.id,quoteId,fingerprint,snapshot}},p_bio:{version:1},p_max_cost:.1};
const jobs=await Promise.all([db(admin.rpc('create_creative_job',args)),db(admin.rpc('create_creative_job',args))]);assert.equal(jobs[0].id,jobs[1].id);assert.equal(jobs[0].run_id,quoteId);checks+=2;
const quotedRow=await db(admin.from('canvas_quotes').select('state').eq('id',quoteId).single());assert.equal(quotedRow.state,'claimed');checks++;
const holds=await db(admin.from('ledger').select('id').eq('run_id',quoteId).eq('kind','run_reserved'));assert.equal(holds.length,1);checks++;
await db(admin.rpc('fail_run_and_release_credits',{p_workspace_id:config.workspaceId,p_run_id:quoteId,p_reservation_key:jobs[0].reservation_key,p_release_key:jobs[0].reservation_key+':refund',p_reason:'local_fixture_refund'}));
await db(admin.from('creative_jobs').update({state:'failed',error:'Synthetic transaction check; never dispatched'}).eq('id',jobs[0].id));
// Exercise human workflow through the real API using a separate local reviewer.
let reviewer;
try{reviewer=JSON.parse(await readFile(new URL('../.mvp-local/reviewer.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!reviewer){
 const email='mvp-reviewer@caastoros.local',password=randomBytes(24).toString('base64url');
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
 reviewer={id:data.user.id,email,password};
 await writeFile(new URL('../.mvp-local/reviewer.json',import.meta.url),JSON.stringify(reviewer),{mode:0o600});
}
await db(admin.from('platform_memberships').upsert({user_id:reviewer.id,role:'super_admin',active:true}));
const reviewerClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data:reviewLogin,error:reviewError}=await reviewerClient.auth.signInWithPassword({email:reviewer.email,password:reviewer.password});if(reviewError)throw reviewError;
async function reviewerRequest(path,body){const response=await fetch(api+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${reviewLogin.session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));checks++;return data;}
let submitter;
try{submitter=JSON.parse(await readFile(new URL('../.mvp-local/submitter.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!submitter){const email='mvp-submitter@caastoros.local',password=randomBytes(24).toString('base64url');const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;submitter={id:data.user.id,email,password};await writeFile(new URL('../.mvp-local/submitter.json',import.meta.url),JSON.stringify(submitter),{mode:0o600});}
await db(admin.from('platform_memberships').upsert({user_id:submitter.id,role:'super_admin',active:true}));
const submitterClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}}),{data:submitLogin,error:submitError}=await submitterClient.auth.signInWithPassword({email:submitter.email,password:submitter.password});if(submitError)throw submitError;
async function submitterRequest(path,body,method='POST',expected=200){const response=await fetch(api+path,{method,headers:{Authorization:`Bearer ${submitLogin.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));checks++;return data;}
await submitterRequest(`/api/outputs/${settled.output_id}/workflow`,{action:'submit_internal'});
await reviewerRequest(`/api/outputs/${settled.output_id}/workflow`,{action:'internal_changes',reason:'Synthetic reviewer requests clearer language'});
await submitterRequest(`/api/outputs/${settled.output_id}`,{text:'Revised synthetic fixture'},'PATCH');
await submitterRequest(`/api/outputs/${settled.output_id}/workflow`,{action:'submit_internal'});
await submitterRequest(`/api/outputs/${settled.output_id}/workflow`,{action:'internal_approve'},'POST',409);
await reviewerRequest(`/api/outputs/${settled.output_id}/workflow`,{action:'internal_approve'});
await reviewerRequest(`/api/outputs/${settled.output_id}/workflow`,{action:'send_client'});
await request(`/api/outputs/${settled.output_id}/workflow`,{action:'client_approve'});
const syntheticJob={...jobs[0],model:{gateway:'local-fixture',model:'synthetic',modality:'image'},routing:{mode:'shadow',attempted:true,chosenRoute:'synthetic/a',recommendation:'synthetic/b',confidence:.96,fallback:'shadow'}};
await db(admin.from('creative_jobs').update({routing:syntheticJob.routing,error:'Synthetic state evidence; never dispatched'}).eq('id',syntheticJob.id));
for(const [op,usage] of [['generation',{cost:.02}],['qa',{estimated_cost_usd:.01}],['jev',null]])await db(admin.from('api_usage_events').insert({...usageEvent(syntheticJob,op,usage),metadata:{synthetic_fixture:true}}));
await request(`/api/opex/measurements?workspaceId=${config.workspaceId}`,null,'GET',403);
const measured=await reviewerRequest(`/api/opex/measurements?workspaceId=${config.workspaceId}`);
const accepted=measured.records.find(r=>r.runId===runId);assert.equal(accepted.accepted,true);assert.equal(accepted.revisions,2);assert.equal(accepted.changeRequests,1);assert.ok(accepted.timeToAcceptedMs>=0);assert.equal(accepted.totalCostUsd,null);
const mediaMeasurement=measured.records.find(r=>r.runId===quoteId);assert.equal(mediaMeasurement.cohort,'shadow');assert.equal(mediaMeasurement.routing.recommendation,'synthetic/b');assert.equal(mediaMeasurement.knownCostUsd,.03);assert.equal(mediaMeasurement.totalCostUsd,null);assert.ok(mediaMeasurement.errorEvents>=1);assert.deepEqual(mediaMeasurement.costs.map(c=>c.source).sort(),['estimated','reported','unknown']);checks+=2;
const {error:eventsReadError}=await client.from('execution_measurement_events').select('*');assert.ok(eventsReadError);checks++;
// Text quote/run/credit hold transaction: concurrent callers have one winner.
const textQuote=await request(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]});
const textQuoteRow=await db(admin.from('canvas_quotes').select('*').eq('id',textQuote.quotes[0].id).single());
const textArgs={p_workspace_id:config.workspaceId,p_actor_id:config.userId,p_canvas_id:canvas.id,p_node_id:node.id,p_quote_id:textQuoteRow.id,p_fingerprint:textQuoteRow.fingerprint,p_snapshot:{...textQuoteRow.request.snapshot,credits:textQuoteRow.credits},p_spec_id:node.specialistId,p_spec_version:1,p_bio_version:1,p_credits:textQuoteRow.credits};
const textResults=await Promise.all([admin.rpc('create_canvas_text_run',textArgs),admin.rpc('create_canvas_text_run',textArgs)]);assert.equal(textResults.filter(r=>!r.error).length,1);assert.equal(textResults.filter(r=>r.error).length,1);checks++;
const textHolds=await db(admin.from('ledger').select('id').eq('run_id',textQuoteRow.id).eq('kind','run_reserved'));assert.equal(textHolds.length,1);checks++;
await db(admin.rpc('fail_run_and_release_credits',{p_workspace_id:config.workspaceId,p_run_id:textQuoteRow.id,p_reservation_key:`run:${textQuoteRow.id}:credits`,p_release_key:`run:${textQuoteRow.id}:credits:refund`,p_reason:'synthetic_text_claim_refund'}));
// Failed credit reservation rolls back both quote consumption and run creation.
const deniedQuoteId=randomUUID();await db(admin.from('canvas_quotes').insert({...textQuoteRow,id:deniedQuoteId,state:'pending',credits:2000000000}));
const rejected=await admin.rpc('create_canvas_text_run',{...textArgs,p_quote_id:deniedQuoteId,p_credits:2000000000});assert.ok(rejected.error);
assert.equal((await db(admin.from('canvas_quotes').select('state').eq('id',deniedQuoteId).single())).state,'pending');assert.equal((await db(admin.from('runs').select('id').eq('id',deniedQuoteId))).length,0);assert.equal((await db(admin.from('execution_spend_holds').select('run_id').eq('run_id',deniedQuoteId))).length,0);checks+=2;
// A second real local tenant cannot be read or mutated by the workspace client.
const foreignProfile=await db(admin.from('users').select('workspace_id').eq('id',reviewer.id).single());
const foreignBrand=await db(admin.from('brands').select('id').eq('workspace_id',foreignProfile.workspace_id).limit(1).single());
const foreignBrief=await db(admin.from('briefs').insert({brand_id:foreignBrand.id,title:'Synthetic foreign tenant',type:'one_off',payload:{request:'Synthetic tenant fixture'},mode:'auto',status:'active'}).select('id').single());
try{
 const foreignCanvas=await db(admin.from('canvas_layouts').insert({workspace_id:foreignProfile.workspace_id,brand_id:foreignBrand.id,brief_id:foreignBrief.id,document:canvas.document,created_by:reviewer.id}).select('id').single());
 await request(`/api/canvases/${foreignCanvas.id}`,null,'GET',403);
 await request(`/api/canvases/${foreignCanvas.id}`,{revision:0,document:canvas.document},'PUT',403);
 await request(`/api/canvases/${foreignCanvas.id}/quotes`,{nodeIds:[node.id]},'POST',403);
 await request('/api/canvases',{brandId:foreignBrand.id,creationKey:randomUUID()},'POST',403);
 assert.equal((await db(client.from('canvas_layouts').select('id').eq('id',foreignCanvas.id))).length,0);checks++;
}finally{await db(admin.from('briefs').delete().eq('id',foreignBrief.id));}
const overview=await reviewerRequest('/api/opex/overview');assert.ok(overview.metrics.costUnknownRequests>0);assert.equal(overview.metrics.spendIsLowerBound,true);assert.equal(overview.metrics.costPerApprovedDeliverable,null);
const report={at:new Date().toISOString(),checks,passed:true,environment:'isolated-local-supabase',providerCalls:0,reviewerId:reviewer.id,scope:'Real local auth, API, RLS, certified-BIO gate, CAS, provider-missing refund, atomic synthetic settlement, editing, private storage and concurrent atomic canvas-media/text creation, transactional reservation rollback, foreign-tenant API/RLS denial, real API review transitions, durable acceptance/revision/error evidence and reported/estimated/unknown costs plus persisted shadow decisions. All outputs and usage values are synthetic fixtures. Not live generation or human certification.',canvasId:canvas.id,briefId:canvas.brief_id,brandId:config.brandId};
await writeFile(new URL('../.mvp-local/integration-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
