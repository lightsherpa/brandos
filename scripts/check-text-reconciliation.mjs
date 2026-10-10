import {readFile,writeFile} from 'node:fs/promises';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {textExecutionLease} from '../server/src/lib/text-execution.js';
import {localOperatorSession} from './mvp-local-auth.mjs';
if(new URL(process.env.SUPABASE_URL).hostname!=='127.0.0.1')throw new Error('Isolated local Supabase required');
const fixture=JSON.parse(await readFile(new URL('../.mvp-local/fixture.json',import.meta.url),'utf8')),db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data:login,error}=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});if(error)throw error;
const {session:operator,reviewer}=await localOperatorSession();let checks=0;
async function query(q){const {data,error}=await q;if(error)throw error;return data;}
async function request(path,body,session=login.session,expected=200){const response=await fetch('http://127.0.0.1:8791'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));checks++;return data;}
const {canvas}=await request('/api/canvases',{brandId:fixture.brandId,creationKey:randomUUID(),context:{title:'Text recovery fixture',rawBrief:'Synthetic text recovery evidence; no provider call.',specialistIds:['a01']}},login.session,201),node=canvas.document.nodes.find(n=>n.type==='specialist');
async function claimAndCrash(complete){
 const quoted=await request(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]}),q=await query(db.from('canvas_quotes').select('*').eq('id',quoted.quotes[0].id).single());
 const args={p_workspace_id:fixture.workspaceId,p_actor_id:fixture.userId,p_canvas_id:canvas.id,p_node_id:node.id,p_quote_id:q.id,p_fingerprint:q.fingerprint,p_snapshot:{...q.request.snapshot,credits:q.credits},p_spec_id:node.specialistId,p_spec_version:1,p_bio_version:1,p_credits:q.credits};
 const child=fork(new URL('./mvp-text-crash-child.mjs',import.meta.url),[],{env:{...process.env,MVP_TEXT_CLAIM:JSON.stringify(args),MVP_TEXT_COMPLETE:complete?'1':'0'},stdio:['ignore','pipe','pipe','ipc']});
 let stderr='';child.stderr.on('data',bytes=>stderr+=bytes);
 const ready=await Promise.race([once(child,'message').then(([m])=>m),once(child,'exit').then(()=>{throw new Error('Crash harness failed before commitment: '+stderr.slice(0,600));})]);assert.equal(ready.runId,q.id);
 const exited=once(child,'exit');child.kill('SIGKILL');const [,signal]=await exited;assert.equal(signal,'SIGKILL');checks++;
 await query(db.from('text_execution_evidence').update({heartbeat_at:new Date(Date.now()-360000).toISOString()}).eq('run_id',q.id));
 await query(db.rpc('quarantine_stale_text_runs'));const evidence=await query(db.from('text_execution_evidence').select('*').eq('run_id',q.id).single());assert.equal(evidence.phase,'reconcile');assert.equal((await query(db.from('runs').select('status').eq('id',q.id).single())).status,'running');
 assert.equal((await query(db.from('ledger').select('id').eq('run_id',q.id).lt('credits',0))).length,0);checks++;
 return q.id;
}
const unsubmitted=await claimAndCrash(false);
await request(`/api/text-reconciliation/${unsubmitted}`,{action:'confirm_not_billed',reason:'Synthetic test reason confirming no provider submission'},login.session,403);
const weakClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}}),{data:weakLogin,error:weakError}=await weakClient.auth.signInWithPassword({email:reviewer.email,password:reviewer.password});if(weakError)throw weakError;await request(`/api/text-reconciliation/${unsubmitted}`,{action:'recover_output',reason:'AAL1 must never authorize monetary reconciliation.'},weakLogin.session,403);await request(`/api/text-reconciliation/${unsubmitted}`,{action:'recover_output',reason:'Synthetic incomplete generation cannot be recovered'},operator,409);
await request(`/api/text-reconciliation/${unsubmitted}`,{action:'confirm_not_billed',reason:'Synthetic evidence lacks provider confirmation'},operator,409);
const confirmed={action:'confirm_not_billed',reason:'Synthetic crash harness died before any provider submission; test-only confirmation.',evidence:{status:'not_billed_confirmed',reference:'synthetic-harness-no-outbound'}};
await request(`/api/text-reconciliation/${unsubmitted}`,confirmed,operator);await request(`/api/text-reconciliation/${unsubmitted}`,confirmed,operator);
assert.equal((await query(db.from('ledger').select('id').eq('run_id',unsubmitted).lt('credits',0))).length,1);checks++;
const completed=await claimAndCrash(true);
const staleSettle=await db.rpc('settle_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_run_id:completed,p_finalization:{}});assert.match(staleSettle.error.message,/TEXT_RECONCILIATION_REQUIRED/);checks++;
const recovery={action:'recover_output',reason:'Recover synthetic durable generation after killed QA worker; human review remains required.'};
await Promise.all([request(`/api/text-reconciliation/${completed}`,recovery,operator),request(`/api/text-reconciliation/${completed}`,recovery,operator)]);
const outputs=await query(db.from('outputs').select('*').eq('run_id',completed));assert.equal(outputs.length,1);assert.equal(outputs[0].status,'flagged');assert.equal(outputs[0].body.recovered,true);assert.equal(outputs[0].workflow_status,'draft');checks++;
assert.equal((await query(db.from('ledger').select('id').eq('run_id',completed).eq('kind','run_flagged'))).length,1);assert.equal((await query(db.from('text_execution_evidence').select('phase').eq('run_id',completed).single())).phase,'completed');checks++;
const {error:readError}=await client.from('text_execution_evidence').select('*');assert.ok(readError);checks++;
// Ordinary settlement uses exactly the persisted finalization and has one winner.
const quoted=await request(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]}),q=await query(db.from('canvas_quotes').select('*').eq('id',quoted.quotes[0].id).single());
await query(db.rpc('create_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_actor_id:fixture.userId,p_canvas_id:canvas.id,p_node_id:node.id,p_quote_id:q.id,p_fingerprint:q.fingerprint,p_snapshot:{...q.request.snapshot,credits:q.credits},p_spec_id:node.specialistId,p_spec_version:1,p_bio_version:1,p_credits:q.credits}));
const finalization={p_model_used:'synthetic',p_prompt_tokens:0,p_completion_tokens:0,p_cached_tokens:0,p_cost_usd:null,p_latency_ms:1,p_output_kind:'copy',p_output_body:{text:'Synthetic settled output; no provider call.'},p_output_status:'flagged',p_rationale:'Synthetic review required',p_qa_passed:false,p_qa_evidence:'Synthetic QA fixture',p_ledger_kind:'run_flagged'};
const lease=await textExecutionLease(q.id,db);
try{await lease.step('submitting',{provider_possible:true});await lease.step('generating');await lease.step('generation_complete',{generation_complete:true,raw_output:finalization.p_output_body.text});await lease.step('qa_running');await lease.step('settling',{finalization});}finally{lease.stop();}
const forged=await db.rpc('settle_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_run_id:q.id,p_finalization:{...finalization,p_cost_usd:0}});assert.match(forged.error.message,/TEXT_RECONCILIATION_REQUIRED/);checks++;
await Promise.all([query(db.rpc('settle_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_run_id:q.id,p_finalization:finalization})),query(db.rpc('settle_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_run_id:q.id,p_finalization:finalization}))]);
assert.equal((await query(db.from('outputs').select('id').eq('run_id',q.id))).length,1);assert.equal((await query(db.from('ledger').select('id').eq('run_id',q.id).eq('kind','run_flagged'))).length,1);checks++;
const afterResolution=await db.rpc('settle_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_run_id:completed,p_finalization:{}});assert.match(afterResolution.error.message,/TEXT_RECONCILIATION_REQUIRED/);checks++;
const publicRuns=await request(`/api/canvases/${canvas.id}/runs`);assert.equal(publicRuns.runs.find(r=>r.id===completed).textState,'completed');assert.ok(!JSON.stringify(publicRuns).includes('synthetic-no-provider-receipt'));checks++;
const report={passed:true,checks,providerCalls:0,scope:'Actual local process SIGKILL after atomic claim and after durable synthetic generation. Stale quarantine holds credits; incomplete output/evidence denied; MFA operator confirmation/refund replay and concurrent recovered-output settlement happen exactly once.',unsubmitted,completed};await writeFile(new URL('../.mvp-local/text-recovery-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
