import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review } from './reviewer.js';
const task = {type:'social_post',reviewerChecks:['cta_present'],mandatory:['cta_present'],minReviewerPass:1};
const layer1 = {voice:{},palette:{},imagery:[],avoid:[],refusals:[]};
const good = {items:[{index:0,checks:[{id:'cta_present',pass:false,reason:'No CTA',target:'copy'}]}]};
async function run(responses) {
 const calls=[];
 const complete=async function*(args){calls.push(args);yield {type:'token',text:JSON.stringify(responses[Math.min(calls.length-1,responses.length-1)])};yield {type:'done',usage:{}};};
 const result=await review({task,brief:'Test brief',layer1,items:[{copy:{caption:'Hello'}}],complete});
 return {result,calls};
}
test('schema repair is bounded and preserves negative reviewer judgment',async()=>{const {result,calls}=await run([{checks:[]},good]);assert.equal(calls.length,2);assert.equal(result[0][0].pass,false);assert.equal(result[0][0].reason,'No CTA');assert.match(calls[1].system,/repair/i);});
test('second invalid verdict fails closed, no third attempt',async()=>{const {result,calls}=await run([{items:[] }]);assert.equal(calls.length,2);assert.equal(result[0][0].pass,false);assert.equal(result[0][0].target,'none');});
test('duplicate items/checks and unknown checks are rejected rather than accepted',async()=>{for(const json of [{items:[good.items[0],good.items[0]]},{items:[{index:0,checks:[...good.items[0].checks,...good.items[0].checks]}]},{items:[{index:0,checks:[{id:'other',pass:true,reason:'x'}]}]}]){assert.equal((await run([json])).calls.length,2);}});
test('valid verdict needs only one call',async()=>assert.equal((await run([good])).calls.length,1));
test('provider failure fails closed without a schema-repair retry',async()=>{let calls=0;const complete=async function*(){calls++;yield {type:'error',message:'Unavailable'};};const result=await review({task,brief:'Test',layer1,items:[{}],complete});assert.equal(calls,1);assert.equal(result[0][0].pass,false);});
test('repair obeys the existing call budget and cannot synthesize a pass',async()=>{let reservations=0;const budget={reserve(){if(++reservations===2)throw Error('Budget exhausted');},record(){}};const complete=async function*(){yield {type:'token',text:'{}'};};const result=await review({task,brief:'Test',layer1,items:[{}],complete,budget});assert.equal(reservations,2);assert.equal(result[0][0].pass,false);assert.match(result[0][0].reason,/Budget exhausted/);});
