import test from 'node:test';
import assert from 'node:assert/strict';
import {DISCOVERY_ROUTES,completeDiscoveryStep} from './discovery-models.js';
test('production BIO routes use the approved current model family and bounded caps',()=>{
 assert.match(DISCOVERY_ROUTES.reader.primary,/haiku-5\.5$/);
 assert.match(DISCOVERY_ROUTES.synthesis.primary,/sonnet-5\.5$/);
 assert.match(DISCOVERY_ROUTES.vision.primary,/gemini-3\.8-flash$/);
 assert.equal(DISCOVERY_ROUTES.synthesis.maxTokens,12000);
 assert.doesNotMatch(JSON.stringify(DISCOVERY_ROUTES),/2\.5/);
});
test('a failed primary stream is discarded before one capped fallback',async()=>{
 const attempts=[];
 async function* complete(args){attempts.push(args);if(attempts.length===1){yield {type:'token',text:'broken'};yield {type:'error',message:'unavailable'};}else{yield {type:'token',text:'{"ok":true}'};yield {type:'done',stopReason:'stop',usage:{cost_usd:0.01}};}}
 const result=await completeDiscoveryStep({step:'synthesis',messages:[],complete,parse:JSON.parse});
 assert.deepEqual(result.value,{ok:true});assert.equal(attempts.length,2);
 assert.equal(attempts[1].maxTokens,12000);assert.match(result.route,/opus-5\.5$/);
});
test('invalid or truncated JSON gets one fallback, never unbounded retries',async()=>{
 let calls=0;async function* complete(){calls++;yield {type:'token',text:'{}'};yield {type:'done',stopReason:'length'};}
 await assert.rejects(completeDiscoveryStep({step:'reader',messages:[],complete,parse:JSON.parse}),/bounded fallback/);assert.equal(calls,2);
});
