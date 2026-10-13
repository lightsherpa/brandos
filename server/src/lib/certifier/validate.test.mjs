import test from 'node:test';import assert from 'node:assert/strict';
import {validateBrief, sanitizeBrief, locate, runWithRepair, checkModelSchema, unknownStatement, checkFinalSchema} from './validate.js';
import {enrich, confidenceFor} from './enrich.js';
import {fixture,context,recordedOutput} from './test-helpers.js';
const ledger=new Map([['claim',{claim_id:'claim',section:'identity'}]]);
const brief=citation=>({brand_in_60s:[],claims:[{claim_id:'claim',rationale:[{text:'A source statement.',citations:[citation]}]}],questions:[]});
const src={source_id:'s',kind:'pdf',text:'first\n  “Ｃafé” ＢＲＡＮＤ.\nsecond page',pages:['first\n  “Ｃafé” ＢＲＡＮＤ.','second page'],first_party:true};
test('normalization/fuzzy matching returns ORIGINAL source/page offsets and verbatim span',()=>{
 const out=brief({source_id:'s',span:'"café" brand.'});assert.ok(validateBrief(out,new Map([['s',src]]),ledger).valid);
 const c=out.claims[0].rationale[0].citations[0];assert.equal(c.page,1);assert.equal(src.pages[0].slice(c.char_start,c.char_end),c.span);assert.equal(c.span,'“Ｃafé” ＢＲＡＮＤ.');
 const raw='We serve carefully roasted coffee every morning with care.';const hit=locate(raw,'We serve carefully roasted coffee every morning with care');assert.equal(hit.start,0);
 assert.equal(locate('unrelated words only','brand book evidence'),null);
});
test('unknown source, circular AI support, bad pages/images, missing spans and verdicts fail closed',()=>{
 for(const [citation,code] of [[{source_id:'foreign',span:'foo'},'unknown_source'],[{source_id:'ai',span:'first'},'circular_source'],[{source_id:'s',span:'first',page:3},'bad_page'],[{source_id:'s',span:'first',image:'foreign'},'bad_image'],[{source_id:'s',span:'made up'},'span_not_found']]){
 const manifest=new Map([['s',src],['ai',{...src,derived_from_model:true}]]);const out=brief(citation);assert.ok(validateBrief(out,manifest,ledger).errors.some(e=>e.code===code));
 const safe=sanitizeBrief(out,manifest,ledger).out;assert.ok(checkModelSchema(safe));assert.equal(safe.claims[0].rationale[0].unknown,true);
 }
 const out=brief({source_id:'s',span:'first'});out.claims[0].rationale[0].text='This should be approved';assert.ok(!validateBrief(out,new Map([['s',src]]),ledger).valid);
});
test('unknown with citations, invalid claim/question IDs, output confidence and leading questions are checked',()=>{
 const out=brief({source_id:'s',span:'first'});out.claims[0].rationale[0].unknown=true;out.claims.push({claim_id:'foreign',rationale:[unknownStatement()]});
 out.questions=[{claim_ids:['foreign'],section:'identity',text:'Is this right?',why:unknownStatement()}];
 const result=validateBrief(out,new Map([['s',src]]),ledger);assert.ok(result.errors.some(e=>e.code==='unknown_with_citations'));assert.ok(result.errors.some(e=>e.code==='unknown_claim'));assert.ok(result.errors.some(e=>e.code==='leading_question'&&e.soft));
 const safe=sanitizeBrief(out,new Map([['s',src]]),ledger).out;assert.equal(safe.claims.length,1);assert.equal(safe.questions.length,0);
 const malformed={...safe,confidence:'high'};assert.ok(!checkModelSchema(malformed));
});
test('one repair maximum, then unsupported statements become unknown; malformed output becomes an empty ledger brief',async()=>{
 let calls=0;const manifest=new Map([['s',src]]);const bad=brief({source_id:'s',span:'invented'});
 const result=await runWithRepair(async()=>{calls++;return structuredClone(bad);},{messages:[],manifest,ledger,costSoFar:()=>0.1});
 assert.equal(calls,2);assert.equal(result.repairPasses,1);assert.equal(result.replaced,1);assert.ok(validateBrief(result.out,manifest,ledger).valid);
 const all=sanitizeBrief('not an object',manifest,ledger).out;assert.equal(all.claims[0].rationale[0].unknown,true);
});
test('repair never starts above $0.26 and degrades gracefully when its reservation cannot fit',async()=>{
 const ctx={messages:[],manifest:new Map([['s',src]]),ledger,costSoFar:()=>0.27};let calls=0;
 await runWithRepair(async()=>{calls++;return brief({source_id:'s',span:'bad'});},ctx);assert.equal(calls,1);
 ctx.costSoFar=()=>0.1;calls=0;const result=await runWithRepair(async()=>{if(++calls===2)throw Object.assign(new Error('cap'),{code:'CERTIFIER_COST_CAP'});return brief({source_id:'s',span:'bad'});},ctx);assert.equal(result.out.claims[0].rationale[0].unknown,true);
});
test('independence counts domains once, first-party raises one level, weak concern only lowers',()=>{
 const claim={value:'fact',provenance:'inferred'};const m=new Map([['a',{first_party:true,src_domain:'brand.test'}],['b',{first_party:true,src_domain:'brand.test'}],['c',{first_party:false,src_domain:'external.test'}]]);
 assert.equal(confidenceFor(claim,[{source_id:'a'},{source_id:'b'}],m),'medium');assert.equal(confidenceFor(claim,[{source_id:'a'},{source_id:'c'}],m),'high');
 assert.equal(confidenceFor({...claim,suggested_concern:'weak'},[{source_id:'a'}],m),'low');assert.equal(confidenceFor(claim,[],m),'guessed');
});
for(const name of ['cake-me','nomad-roasters','lumen-dental'])test(`${name}: all post-validator statements valid; weak claims ranked, questions grouped and foundation blocked`,()=>{
 const f=fixture(name);const ctx={...context(f),runId:'run'};const out=recordedOutput(ctx,name);assert.ok(validateBrief(out,ctx.manifest,ctx.ledger).valid,JSON.stringify(validateBrief(out,ctx.manifest,ctx.ledger).errors));
 const final=enrich(out,ctx);assert.ok(checkFinalSchema(final));
 const questions=final.question_groups.flatMap(g=>g.questions);assert.ok(questions.length<=8);
 for(const group of final.question_groups)for(const q of group.questions){assert.ok(q.text.length<=300);assert.ok(q.claim_ids.every(id=>ctx.ledger.get(id).section===group.section));}
 if(name==='cake-me'){
  assert.deepEqual(final.claims.slice(0,2).map(c=>c.claim_id),['visual.logo','visual.type']);
  assert.ok(final.claims.find(c=>c.claim_id==='visual.palette.primary').blocks_certification);
  assert.equal(final.claims.find(c=>c.value?.hex==='#ffffff').confidence,'guessed');assert.equal(final.claims.find(c=>c.value?.hex==='#161616').confidence,'guessed');
 }else{
  for(const id of f.weakClaims){assert.ok(final.claims.findIndex(c=>c.claim_id===id)<5,id);assert.ok(questions.some(q=>q.claim_ids.includes(id)));}
  assert.equal(final.claims.find(c=>c.claim_id==='visual.logo').confidence,'high');assert.ok(final.claims.findIndex(c=>c.claim_id==='visual.logo')>=5);
 }
 assert.doesNotMatch(JSON.stringify(out),/\b(certified|approve)\b/);
});
