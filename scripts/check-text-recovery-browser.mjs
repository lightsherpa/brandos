// Genuine local MFA/API/DB recovery through the operator UI; synthetic generation only.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {localOperatorSession} from './mvp-local-auth.mjs';
import {textExecutionLease} from '../server/src/lib/text-execution.js';
if(new URL(process.env.SUPABASE_URL).hostname!=='127.0.0.1')throw new Error('Isolated local target required');
const fixture=JSON.parse(await readFile(new URL('../.mvp-local/fixture.json',import.meta.url))),db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data:login,error}=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});if(error)throw error;
const {session}=await localOperatorSession();const require=createRequire(process.env.CAASTOR_BROWSER_MODULE_ROOT+'/package.json'),{chromium,webkit}=require('playwright');let checks=0,results=[];
async function query(q){const {data,error}=await q;if(error)throw error;return data;}
async function api(path,body){const response=await fetch('http://127.0.0.1:8791'+path,{method:'POST',headers:{Authorization:'Bearer '+login.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;}
async function seed(complete){
 const {canvas}=await api('/api/canvases',{brandId:fixture.brandId,creationKey:randomUUID(),context:{title:'Browser recovery fixture',rawBrief:'Synthetic UI recovery fixture; no outbound provider.',specialistIds:['a01']}}),node=canvas.document.nodes.find(n=>n.type==='specialist');
 const quoted=await api(`/api/canvases/${canvas.id}/quotes`,{nodeIds:[node.id]}),q=await query(db.from('canvas_quotes').select('*').eq('id',quoted.quotes[0].id).single());
 await query(db.rpc('create_canvas_text_run',{p_workspace_id:fixture.workspaceId,p_actor_id:fixture.userId,p_canvas_id:canvas.id,p_node_id:node.id,p_quote_id:q.id,p_fingerprint:q.fingerprint,p_snapshot:{...q.request.snapshot,credits:q.credits},p_spec_id:node.specialistId,p_spec_version:1,p_bio_version:1,p_credits:q.credits}));
 if(complete){const lease=await textExecutionLease(q.id,db);try{await lease.step('submitting',{provider_possible:true});await lease.step('generating',{provider_receipt_id:'synthetic-ui-receipt'});await lease.step('generation_complete',{generation_complete:true,raw_output:'Synthetic persisted UI output. No provider call was made.',usage:{model:'synthetic',cost_usd:null}});await lease.step('qa_running');}finally{lease.stop();}}
 await query(db.from('text_execution_evidence').update({heartbeat_at:new Date(Date.now()-360000).toISOString()}).eq('run_id',q.id));await query(db.rpc('quarantine_stale_text_runs'));return q.id;
}
for(const [engineName,engine] of Object.entries({chromium,webkit})){
 const complete=await seed(true),unsubmitted=await seed(false),browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(session=>{localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('locale','en');},session);
  await page.goto('http://127.0.0.1:5184/#/admin-opex');await page.getByRole('tab',{name:'Execution outcomes'}).click();await page.getByLabel('Workspace ID').fill(fixture.workspaceId);await page.getByRole('button',{name:'Load outcomes'}).click();
  const table=page.getByRole('table',{name:'Text execution reconciliation'}),completedRow=table.getByRole('row').filter({hasText:complete}),refundRow=table.getByRole('row').filter({hasText:unsubmitted});await completedRow.waitFor();
  assert.equal(await refundRow.getByRole('button',{name:'Recover stored output'}).isDisabled(),true);checks++;
  const recover=completedRow.getByRole('button',{name:'Recover stored output'});await recover.click();const dialog=page.getByRole('dialog',{name:'Reconcile text execution'});await dialog.waitFor();assert.equal(await page.locator('#app').evaluate(e=>e.inert),true);assert.equal(await dialog.getByRole('button',{name:'Recover output',exact:true}).isDisabled(),true);checks++;
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await recover.evaluate(e=>e===document.activeElement),true);checks++;
  await recover.click();await dialog.getByLabel('Operator reason').fill('Recover the complete synthetic generation after simulated interrupted QA. Review still required.');await dialog.getByRole('button',{name:'Recover output',exact:true}).click();await completedRow.waitFor({state:'hidden'});
  const outputs=await query(db.from('outputs').select('*').eq('run_id',complete));assert.equal(outputs.length,1);assert.equal(outputs[0].status,'flagged');assert.equal(outputs[0].workflow_status,'draft');assert.equal(outputs[0].body.recovered,true);assert.equal((await query(db.from('runs').select('cost_usd').eq('id',complete).single())).cost_usd,null);checks++;
  await refundRow.getByRole('button',{name:'Confirm no provider charge'}).click();await dialog.getByLabel('Operator reason').fill('Synthetic fixture had no outbound provider boundary; test operator verifies no charge.');const confirm=dialog.getByRole('button',{name:'Confirm and release credits'});assert.equal(await confirm.isDisabled(),true);await dialog.getByLabel('Provider evidence reference').fill('synthetic-ui-no-outbound');assert.equal(await confirm.isDisabled(),true);await dialog.getByRole('checkbox').check();await confirm.click();await refundRow.waitFor({state:'hidden'});checks++;
  assert.equal((await query(db.from('ledger').select('id').eq('run_id',unsubmitted).lt('credits',0))).length,1);assert.equal((await query(db.from('text_execution_evidence').select('phase').eq('run_id',unsubmitted).single())).phase,'failed');checks++;
  assert.deepEqual(errors,[]);await page.screenshot({path:new URL(`../.mvp-local/browser/${engineName}-text-recovery.png`,import.meta.url).pathname});results.push({engine:engineName,complete,unsubmitted});
 }finally{await browser.close();}
}
await writeFile(new URL('../.mvp-local/browser/text-recovery.json',import.meta.url),JSON.stringify({checks,results,providerCalls:0},null,2));console.log(`PASS: ${checks} operator recovery UI checks; genuine local AAL2, Chromium/WebKit, synthetic provider-free evidence.`);
