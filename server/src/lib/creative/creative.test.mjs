import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eligibleModels,qualityFirst,MODEL_CATALOG} from '../models/catalog.js';
import {selectRoute,classifyRoute,activeGate} from '../models/jev.js';
import {mediaAdapter,SubmissionError} from './providers.js';
import {tickJob} from './engine.js';
import {renderEmail,validateEmail,durablePublicUrl} from './email-html.js';
import {usageEvent} from './usage.js';
import {evaluateJevLabels,requireBenchmarkBudget,summarizeBenchmark} from './benchmark.js';
const candidates=[{route:'a',features:[],evaluation:{qualified:true,quality:95,costUsd:.1,latencyMs:100}},{route:'b',features:[],evaluation:{qualified:true,quality:90,costUsd:.01,latencyMs:10}}];
test('quality wins over cost, explicit override persists, shadow does not execute recommendation',async()=>{
 assert.equal(qualityFirst(candidates,'b').route,'a');
 let called=0;const classify=async()=>{called++;return{route:'b',confidence:.99};};
 assert.equal((await selectRoute({candidates,fallback:'a',classify})).chosenRoute,'a');
 assert.equal((await selectRoute({candidates,fallback:'a',override:'b',classify})).chosenRoute,'b');assert.equal(called,1);
});
test('JEV active gates, confidence threshold and invalid responses',async()=>{
 const policy={jevMode:'active',jevEvidence:{labeledCases:100,measuredCases:100,hardConstraintViolations:0,agreement:.95,humanAccepted:true,artifact:'reviewed.json'}};
 assert.ok(activeGate(policy.jevEvidence));
 for(const [route,confidence,expected] of [['b',.90,'b'],['b',.89,'a'],['invented',1,'a'],['b',NaN,'a']])assert.equal((await selectRoute({candidates,fallback:'a',policy,classify:async()=>({route,confidence})})).chosenRoute,expected);
 let called=false;await selectRoute({candidates:[candidates[0]],fallback:'a',classify:()=>{called=true;}});assert.equal(called,false);
});
test('JEV contract and timeout use one request',async()=>{
 let calls=0;
 const result=await classifyRoute({key:'test',requirements:{brief:'x'},candidates,fetchImpl:async(url,init)=>{calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(JSON.parse(init.body).questions.route.type,'choice');assert.ok(init.signal);return{ok:true,json:async()=>({answers:{route:{type:'choice',choice:'a',confidence:.95}},usage:{input_tokens:10}})};}});
 assert.equal(result.route,'a');assert.equal(calls,1);
 await assert.rejects(classifyRoute({key:'test',candidates,fetchImpl:async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});}}));
});
test('eligibility enforces features, provider flags, permissions, settings and ceilings',()=>{
 const m={rateCard:{sourceUrl:'https://primary.test',verifiedAt:'2026-09-22'},endpoint:'provider',qualifiedSettings:{duration:4},route:'x',gateway:'openrouter',modality:'video',features:['image_to_video'],parameters:{duration:{values:[4]}},availability:'configured',maxCostUsd:.2,evaluation:{qualified:true}};
 const args={catalog:[m],modality:'video',features:['image_to_video'],settings:{duration:4},budgetUsd:.3,policy:{providers:{openrouter:true}}};
 assert.equal(eligibleModels(args).length,1);
 for(const change of [{budgetUsd:.1},{features:['edit']},{settings:{duration:5}},{available:()=>false},{policy:{deniedRoutes:['x']}}])assert.equal(eligibleModels({...args,...change}).length,0);
 assert.equal(eligibleModels({...args,catalog:[{...m,experimental:true}]}).length,0);
 assert.ok(MODEL_CATALOG.find(m=>m.route==='vendor/fal/gpt-image-2'));
});
function harness(overrides={}) {
 let job={id:'job',state:'queued',model:{modality:'image'},input:{prompt:'x'},result:null};let submits=0,settles=0,refunds=0;
 const store={get:async()=>structuredClone(job),patch:async(_,p)=>{Object.assign(job,p);return structuredClone(job);},cas:async(_,state,p)=>{if(job.state!==state)return false;Object.assign(job,p);return true;}};
 const deps={store,adapterFor:()=>({submit:async()=>{submits++;return{taskId:'provider-1'};},status:async()=>({state:'generated',assetUrl:'https://fal.media/a',usage:{}})}),persist:async()=>({path:'workspace/asset.png'}),qa:async()=>({passed:false,violations:['Review']}),settle:async()=>{settles++;return'output';},fail:async()=>{refunds++;},meter:async()=>{},...overrides};
 return{deps,get:()=>job,counts:()=>({submits,settles,refunds}),set:p=>Object.assign(job,p)};
}
test('disconnect/reconnect/restart and duplicate event never regenerate settled jobs',async()=>{
 const h=harness();await tickJob('job',h.deps);await tickJob('job',h.deps);assert.deepEqual(h.counts(),{submits:1,settles:1,refunds:0});assert.equal(h.get().state,'completed');assert.equal(h.get().qa.passed,false);
});
test('concurrent duplicate submission claims once',async()=>{
 const h=harness();await Promise.all([tickJob('job',h.deps),tickJob('job',h.deps)]);assert.equal(h.counts().submits,1);
});
test('interrupted and uncertain billable submissions are held for reconciliation',async()=>{
 const h=harness({adapterFor:()=>({submit:async()=>{throw new SubmissionError('network');}})});await tickJob('job',h.deps);assert.equal(h.get().state,'reconcile');assert.equal(h.counts().refunds,0);
 const restarted=harness();restarted.set({state:'submitting'});await tickJob('job',restarted.deps);assert.equal(restarted.get().state,'reconcile');assert.equal(restarted.counts().submits,0);
});
test('definite rejection refunds; persisted provider task resumes without POST',async()=>{
 const h=harness({adapterFor:()=>({submit:async()=>{throw new SubmissionError('invalid',true);}})});await tickJob('job',h.deps);assert.equal(h.counts().refunds,1);
 const r=harness();r.set({state:'polling',task:{taskId:'existing'}});await tickJob('job',r.deps);assert.equal(r.counts().submits,0);
});
test('asset persistence and terminal settlement failures retry without generation or QA',async()=>{
 let writes=0;const h=harness({persist:async()=>{if(++writes===1)throw new Error('storage down');return{path:'x'};}});
 await tickJob('job',h.deps);assert.equal(h.get().state,'persistence_failed');assert.equal(h.counts().refunds,0);await tickJob('job',h.deps);assert.equal(h.counts().submits,1);
 let tries=0;const r=harness({settle:async()=>{if(++tries===1)throw new Error('database');return'o';}});await assert.rejects(tickJob('job',r.deps));assert.equal(r.get().state,'settling');await tickJob('job',r.deps);assert.equal(r.counts().submits,1);
});
test('provider contracts normalize OpenRouter async, image, fal and APImart',async()=>{
 process.env.OPENROUTER_API_KEY='test';process.env.FAL_API_KEY='test';process.env.APIMART_API_KEY='test';
 const requests=[];let responses=[{id:'v1'},{status:'completed',usage:{cost:.2}}];
 const fetchImpl=async(url,init)=>{requests.push({url,init});return{ok:true,json:async()=>responses.shift()};};
 const v=mediaAdapter({gateway:'openrouter',modality:'video',model:'google/veo-3.1'},{fetchImpl});const task=await v.submit({prompt:'x',reference:{url:'https://a.test/a.png'},settings:{duration:4}});const result=await v.status(task);
 assert.equal(task.taskId,'v1');assert.equal(result.usage.cost,.2);assert.equal(JSON.parse(requests[0].init.body).frame_images[0].frame_type,'first_frame');assert.equal((await v.cancel(task)).supported,false);
 responses=[{data:[{b64_json:'aGVsbG8=',media_type:'image/png'}]}];const image=await mediaAdapter({gateway:'openrouter',modality:'image',model:'openai/gpt-image-1'},{fetchImpl}).submit({prompt:'x'});assert.equal(image.result.base64,'aGVsbG8=');
 responses=[{data:[{task_id:'a1'}]},{data:{status:'completed',result:{videos:[{url:['https://upload.apimart.ai/v.mp4']}]}}}];const api=mediaAdapter({gateway:'apimart',modality:'video',model:'pixverse-v6'},{fetchImpl});assert.equal((await api.status(await api.submit({prompt:'x'}))).state,'generated');
 responses=[{request_id:'f',status_url:'https://queue.fal.run/status',response_url:'https://queue.fal.run/result'},{status:'COMPLETED'},{images:[{url:'https://fal.media/a.png'}]}];const fal=mediaAdapter({gateway:'fal',route:'vendor/fal/flux-schnell'},{fetchImpl});const f=await fal.submit({prompt:'x'});assert.equal((await fal.status(f)).state,'ready');assert.equal((await fal.result(f)).usage.cost,null);
});
const email={subject:'A note from Acme',preheader:'The new collection',blocks:[{type:'heading',text:'Hello <script>'},{type:'text',text:'A thoughtful update.'},{type:'button',text:'Explore',url:'https://example.com/collection'},{type:'footer',text:'Acme, Madrid'}]};
test('email components escape content, validate URLs/brand/placeholders and durable exports',()=>{
 const r=renderEmail(email,{requiredContent:['Acme'],forExport:true});assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(r.html.includes('role="presentation"'));assert.ok(r.plainText.includes('https://example.com'));
 assert.equal(validateEmail({...email,subject:'{{brand}}'}).passed,false);assert.equal(validateEmail(email,{requiredContent:['Missing brand']}).passed,false);
 assert.equal(durablePublicUrl('https://x.test/object/sign/a?token=abc'),false);
 assert.throws(()=>renderEmail({...email,blocks:[...email.blocks,{type:'image',assetId:'a',alt:'Product'}]},{assets:[{id:'a',url:'https://x.test/a.png',publishable:false}],forExport:true}));
 assert.equal(validateEmail({...email,blocks:[{type:'button',text:'x',url:'javascript:alert(1)'}]}).passed,false);
});
test('cost ledger never promotes estimates or unknown fees to reported',()=>{
 const event=usageEvent({id:'j',model:{gateway:'fal',modality:'image'},input:{}},'generation',{estimated_cost_usd:.03});assert.equal(event.reported_cost_usd,null);assert.equal(event.cost_source,'rate_card_estimate');assert.equal(event.units.gateway_fee_usd,null);
 assert.equal(usageEvent({id:'j',model:{gateway:'fal'},input:{}},'generation',null).cost_source,'unpriced');
});
test('30 briefs, 120 labeled fixtures; no fabricated benchmark results',async()=>{
 const briefs=JSON.parse(await readFile(new URL('../../../../scripts/fixtures/creative-briefs.json',import.meta.url)));
 const cases=JSON.parse(await readFile(new URL('../../../../scripts/fixtures/jev-labeled-cases.json',import.meta.url)));
 assert.equal(briefs.length,30);assert.ok(cases.length>=100);assert.equal(evaluateJevLabels(cases,[]).eligibleForHumanReview,false);
 assert.throws(()=>requireBenchmarkBudget({budgetUsd:0,committedUsd:0,maxCostUsd:1,credentials:true}));
 assert.equal(summarizeBenchmark([{model:'a',version:'1',settings:{},gateway:'x',accepted:true,totalCostUsd:null}])[0].totalCostUsd,null);
});
test('provider task persistence failure does not cause a second billable submission',async()=>{
 const h=harness();const patch=h.deps.store.patch;let once=true;
 h.deps.store.patch=async(id,p)=>{if(p.task&&once){once=false;throw new Error('database unavailable');}return patch(id,p);};
 await assert.rejects(tickJob('job',h.deps));assert.equal(h.get().state,'submitting');
 await tickJob('job',h.deps);assert.equal(h.get().state,'reconcile');assert.equal(h.counts().submits,1);
});
test('result retrieval failure retries GET rather than submit and video is always human review',async()=>{
 const h=harness();let reads=0;h.deps.adapterFor=()=>({status:async()=>{if(++reads===1)throw new Error('temporary');return{state:'generated',usage:{cost:.1}};}});
 h.set({state:'polling',task:{taskId:'existing'},model:{modality:'video'}});
 await tickJob('job',h.deps);assert.equal(h.get().state,'retrieval_failed');
 await tickJob('job',h.deps);assert.equal(h.get().qa.passed,false);assert.match(h.get().qa.violations[0],/Human video/);assert.equal(h.counts().submits,0);
});
test('untrusted provider URLs are rejected before credentials are forwarded',async()=>{
 process.env.FAL_API_KEY='test';
 const fal=mediaAdapter({gateway:'fal',route:'vendor/fal/flux-schnell'},{fetchImpl:async()=>({ok:true,json:async()=>({request_id:'f',status_url:'https://attacker.test/status',response_url:'https://queue.fal.run/result'})})});
 await assert.rejects(fal.submit({prompt:'x'}),/Invalid fal queue URL/);
});
