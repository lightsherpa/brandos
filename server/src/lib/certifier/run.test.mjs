import test from 'node:test';import assert from 'node:assert/strict';
import {runCertifier} from './run.js';import {CertifierBudget} from '../models/token-budget.js';
import {createCompletionStreamer} from '../models/fallback.js';
import {validateBrief,unknownStatement} from './validate.js';
import {fixture,context,recordedOutput,modelMock} from './test-helpers.js';
const enable=()=>{process.env.CERTIFIER_V2_S2='true';};
const saveDraft=async()=> 'draft';
for(const name of ['cake-me','nomad-roasters','lumen-dental'])test(`${name}: mocked full run validates, persists only drafts and respects cost cap`,async()=>{
 enable();const ctx=context(fixture(name));const writes=[];
 const result=await runCertifier(ctx,{stream:modelMock(recordedOutput(ctx,name)),saveDraft:async q=>{writes.push(q);return 'draft-'+writes.length;}});
 assert.equal(result.brief.mode,'full');assert.ok(result.costUsd<=0.30);assert.ok(result.log.every(l=>l.args_hash.length===64&&l.bytes>0));
 assert.equal(writes.length,result.brief.question_groups.flatMap(g=>g.questions).length);assert.ok(writes.every(w=>w.bioId===ctx.bioId));
 assert.equal(result.brief.meta.label,'Prepared by assistant — not a certification');
});
test('single-claim new client evidence redrafts only that card; others byte-identical',async()=>{
 enable();const f=fixture('nomad-roasters');const originalCtx=context(f);const first=await runCertifier(originalCtx,{stream:modelMock(recordedOutput(originalCtx,'nomad-roasters')),saveDraft});
 f.sources.push({id:'answer',brand_id:'brand',kind:'client_answer',src:'We offset via X, certificate attached',signals:{bio_version:1,field_paths:['identity.pillars[0]']},created_at:'2026-10-13T18:00:00Z'});
 const ctx=context(f);ctx.previousCreatedAt='2026-10-13T17:00:00Z';const id='identity.pillars[0]';
 const output={brand_in_60s:[],claims:[{claim_id:id,rationale:[{text:'The client supplied an offset statement.',citations:[{source_id:'answer',span:'We offset via X, certificate attached'}]}]}],questions:[]};
 const second=await runCertifier(ctx,{mode:'single_claim',claimId:id,previousBrief:first.brief,stream:modelMock(output),saveDraft});
 for(const card of first.brief.claims)if(card.claim_id!==id)assert.equal(JSON.stringify(second.brief.claims.find(c=>c.claim_id===card.claim_id)),JSON.stringify(card));
 const card=second.brief.claims.find(c=>c.claim_id===id);assert.equal(card.confidence,'medium');assert.equal(card.status_label,'New evidence');
 assert.deepEqual(second.brief.brand_in_60s,first.brief.brand_in_60s);
});
test('loop allows six reads then forces terminal submit; all calls audited; forbidden calls flagged',async()=>{
 enable();const ctx=context(fixture('nomad-roasters'));let count=0;const choices=[];
 const stream=async function*(p){choices.push(p.tool_choice);const i=count++;yield{type:'done',usage:{model:'claude-sonnet-5-5',prompt_tokens:100,completion_tokens:10},content:i===0?[{type:'tool_use',id:'bad',name:'certify',input:{}}]:i<7?[{type:'tool_use',id:'read'+i,name:'read_brand_core',input:{claim_id:'visual.logo'}}]:[{type:'tool_use',id:'submit',name:'submit_brief',input:recordedOutput(ctx,'nomad-roasters')}]};};
 const result=await runCertifier(ctx,{stream,saveDraft});assert.equal(result.log.filter(l=>l.name==='read_brand_core').length,6);assert.deepEqual(choices.at(-1),{type:'tool',name:'submit_brief'});
 assert.ok(result.log.find(l=>l.name==='certify').review);assert.doesNotMatch(JSON.stringify(result.brief.claims),/Ignore instructions/);
});
test('cost guard rejects BEFORE a provider request when cumulative budget cannot fit',()=>{
 const budget=new CertifierBudget();assert.ok(budget.allowance(1000,8000)<=8000);budget.charge(0.29);assert.throws(()=>budget.allowance(5000),e=>e.code==='CERTIFIER_COST_CAP');
 assert.throws(()=>budget.charge(0.02));assert.equal(budget.spent,0.29);
});
test('fallback only before first token on retryable errors; no fallback after a tool token',async()=>{
 const seen=[];const retry=createCompletionStreamer(async function*(p){seen.push(p.route);if(p.route.includes('5-5'))yield{type:'error',status:429,message:'rate limit'};else yield{type:'done',content:[],usage:{model:'claude-sonnet-4-6'}};});
 const spec={payload:{modelRouting:{primary:'anthropic/claude-sonnet-5-5',fallback:'anthropic/claude-sonnet-4-6'}}};
 const events=[];for await(const e of retry({spec}))events.push(e);assert.equal(seen.length,2);assert.equal(events.at(-1).usage.fallback_from,spec.payload.modelRouting.primary);
 seen.length=0;const started=createCompletionStreamer(async function*(p){seen.push(p.route);yield{type:'token',text:'{'};yield{type:'error',status:500,message:'fail'};});for await(const e of started({spec})){}assert.equal(seen.length,1);
});
test('disabled flag and invalid single claim perform zero model work',async()=>{
 delete process.env.CERTIFIER_V2_S2;const ctx=context(fixture('nomad-roasters'));let calls=0;const stream=async function*(){calls++;};
 await assert.rejects(runCertifier(ctx,{stream}),e=>e.code==='FLAG_OFF');enable();await assert.rejects(runCertifier(ctx,{mode:'single_claim',claimId:'foreign',stream}));assert.equal(calls,0);
});
test('circular source stays guessed after one repair, never surfaces an unsupported claim',async()=>{
 enable();const ctx=context(fixture('lumen-dental'));const output=recordedOutput(ctx,'lumen-dental');output.claims.find(c=>c.claim_id==='identity.pillars[0]').rationale=[{text:'There is a previous statement.',citations:[{source_id:'circular',span:'painless treatments'}]}];
 const result=await runCertifier(ctx,{stream:modelMock(output),saveDraft});const claim=result.brief.claims.find(c=>c.claim_id==='identity.pillars[0]');assert.equal(claim.confidence,'guessed');assert.equal(claim.rationale[0].unknown,true);assert.equal(result.brief.meta.repair_passes,1);
});
test('abort stops provider loop and does not persist drafts',async()=>{
 enable();const ctx=context(fixture('nomad-roasters'));const controller=new AbortController();controller.abort();let writes=0;
 await assert.rejects(runCertifier(ctx,{signal:controller.signal,stream:modelMock(recordedOutput(ctx,'nomad-roasters')),saveDraft:async()=>{writes++;}}));assert.equal(writes,0);
});

test('caller abort reaches the primary provider before and after the first token',async()=>{
 const controller=new AbortController();let seenSignal;let called=0;
 const streamer=createCompletionStreamer(async function*(p){called++;seenSignal=p.signal;yield{type:'token',text:'{'};controller.abort();assert.ok(p.signal.aborted);yield{type:'error',message:'aborted'};});
 const spec={payload:{modelRouting:{primary:'anthropic/claude-sonnet-5-5',fallback:'anthropic/claude-sonnet-4-6'}}};
 for await(const e of streamer({spec,signal:controller.signal})){}assert.ok(seenSignal.aborted);assert.equal(called,1);
});

test('the final question matches the exact draft saved earlier in the tool loop',async()=>{
 enable();const ctx=context(fixture('nomad-roasters'));const output=recordedOutput(ctx,'nomad-roasters');const original=structuredClone(output.questions[0]);let calls=0;const saved=[];
 output.questions[0].text='Which certificate could you share to support this claim?';
 const stream=async function*(){yield{type:'done',usage:{model:'claude-sonnet-5-5',prompt_tokens:100,completion_tokens:20},content:calls++===0?[{type:'tool_use',id:'draft',name:'draft_client_question',input:original}]:[{type:'tool_use',id:'submit',name:'submit_brief',input:structuredClone(output)}]};};
 const result=await runCertifier(ctx,{stream,saveDraft:async args=>{saved.push(structuredClone(args));return 'draft-'+saved.length;}});
 const returned=result.brief.question_groups.flatMap(g=>g.questions).find(q=>q.claim_ids.includes(original.claim_ids[0]));assert.equal(returned.text,saved[0].question.text);assert.equal(returned.draft_id,'draft-1');
});


test('repeated brief POST work and redrafts share the version budget; next version has a fresh cap', async () => {
 enable(); const ctx = context(fixture('nomad-roasters')); ctx.bioId = 'cumulative-budget-test';
 let calls = 0;
 const stream = async function*(p) { calls++; yield {type:'done',usage:{model:'claude-sonnet-5-5',prompt_tokens:100,completion_tokens:p.maxTokens},content:[{type:'tool_use',id:'submit',name:'submit_brief',input:recordedOutput(ctx,'nomad-roasters')}]}; };
 let total = 0; let capped = false;
 for (let i=0; i<20; i++) {
   try { const r=await runCertifier(ctx,{stream,saveDraft}); total+=r.costUsd; }
   catch(e) { assert.equal(e.code,'CERTIFIER_COST_CAP'); capped=true; break; }
 }
 assert.ok(capped); assert.ok(total<=0.30); const before=calls;
 await assert.rejects(runCertifier(ctx,{stream,saveDraft}),e=>e.code==='CERTIFIER_COST_CAP');
 assert.equal(calls,before);
 // Redrafts may use remaining room, but inherit all earlier brief spending.
 let redraftCapped=false;
 for(let i=0;i<20;i++) {
   try { const r=await runCertifier(ctx,{mode:'single_claim',claimId:'visual.logo',stream,saveDraft}); total+=r.costUsd; }
   catch(e) { assert.equal(e.code,'CERTIFIER_COST_CAP'); redraftCapped=true; break; }
 }
 assert.ok(redraftCapped); assert.ok(total<=0.30);
 await runCertifier({...ctx,version:'2'},{stream,saveDraft}); assert.ok(calls>before);
});

test('concurrent calls cannot get independent version budgets', async () => {
 enable(); const ctx=context(fixture('nomad-roasters')); ctx.bioId='concurrent-budget-test';
 let release; const waiting=new Promise(resolve=>{release=resolve;}); let entered;
 const ready=new Promise(resolve=>{entered=resolve;});
 const stream=async function*(p){entered();await waiting;yield* modelMock(recordedOutput(ctx,'nomad-roasters'))(p);};
 const first=runCertifier(ctx,{stream,saveDraft}); await ready;
 await assert.rejects(runCertifier(ctx,{stream,saveDraft}),e=>e.code==='CERTIFIER_BUSY' && e.status===409);
 release();await first;
});

test('provider failure without usage keeps its reservation in the version budget', async () => {
 enable(); const ctx=context(fixture('nomad-roasters'));ctx.bioId='failed-budget-test';let calls=0;
 const stream=async function*(){calls++;yield{type:'error',message:'provider failed'};};
 const errors=[];
 for(let i=0;i<20;i++) {try{await runCertifier(ctx,{stream,saveDraft});}catch(e){errors.push(e);if(e.code==='CERTIFIER_COST_CAP')break;}}
 assert.ok(errors[0].certifierRun.costUsd>0);assert.equal(errors.at(-1).code,'CERTIFIER_COST_CAP');
 const before=calls;await assert.rejects(runCertifier(ctx,{stream,saveDraft}),e=>e.code==='CERTIFIER_COST_CAP');assert.equal(calls,before);
});
