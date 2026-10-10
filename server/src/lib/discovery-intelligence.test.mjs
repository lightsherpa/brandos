import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDiscoveryReferences,sourceBlock,generateDiscoveryBrain} from './discovery-intelligence.js';
test('references preserve intent and reject internal targets before any reading',()=>{
 const refs=normalizeDiscoveryReferences([{url:'example.test',purpose:'aspiration',note:'Desired tone'}]);assert.equal(refs[0].purpose,'aspiration');assert.equal(refs[0].url,'https://example.test/');assert.match(sourceBlock({...refs[0],markdown:'Reference brand has 20 years of experience'}),/INSPIRATION ONLY/);assert.throws(()=>normalizeDiscoveryReferences([{url:'http://127.0.0.1/admin'}]));assert.throws(()=>normalizeDiscoveryReferences(Array.from({length:7},()=>({url:'example.test'}))));
});
test('engine interprets evidence, researches the derived market, then generates the landscape',async()=>{
 const calls=[];const evidence=sourceBlock({url:'https://brand.test',markdown:'Urban bicycle repairs'})+'\n'+sourceBlock({url:'https://reference.test',purpose:'aspiration',markdown:'Desired editorial tone'});
 const payload=await generateDiscoveryBrain({evidence,synthesize:async content=>{calls.push(['synthesize',content]);return calls.length===1?{identity:{category:'Bicycle repairs'},audience:{primary:'Urban commuters'}}:{positioning:{competitors:[{name:'Alternative',source:'https://alternative.test'}],researchGaps:[]},aspirations:{direction:'Editorial tone'}};},research:async query=>{calls.push(['research',query]);return [{url:'https://alternative.test',title:'Alternative',markdown:'Same-day bicycle repairs'}];}});
 assert.equal(calls.length,3);assert.match(calls[1][1],/Bicycle repairs/);assert.match(calls[2][1],/Same-day bicycle repairs/);assert.match(calls[2][1],/INSPIRATION ONLY/);assert.equal(payload.positioning.competitors[0].name,'Alternative');assert.equal(payload.research.status,'evidence_gathered');assert.ok(payload.research.sources[0].checkedAt);
});
test('missing market and failed research remain explicit; no empty evidence can build a BIO',async()=>{
 const missing=await generateDiscoveryBrain({evidence:'Brand document',synthesize:async()=>({identity:{},positioning:{}}),research:async()=>{throw new Error('Should not search without market');}});assert.equal(missing.research.status,'incomplete');assert.match(missing.positioning.researchGaps.join(' '),/Market category/);
 const failed=await generateDiscoveryBrain({evidence:'Brand document',synthesize:async()=>({identity:{category:'Repairs'},positioning:{}}),research:async()=>{throw new Error('Provider unavailable');}});assert.match(failed.positioning.researchGaps.join(' '),/unavailable/);assert.equal(failed.research.sources.length,0);
 await assert.rejects(generateDiscoveryBrain({evidence:' ',synthesize:async()=>{throw new Error('Must not call model');}}),/No readable/);
});
import {getBioForAgent,normalizeBio} from './bio-schema.js';
test('agent context includes desired direction with explicit limits on factual claims',()=>{
 const bio=normalizeBio({aspirations:{direction:'Become an editorial cycling brand',notYetTrue:['Nationwide service'],references:['https://reference.test']}});
 const text=getBioForAgent({bio,slices:['positioning']}).blocks.map(b=>b.text).join('\n');assert.match(text,/Become an editorial cycling brand/);assert.match(text,/not existing brand facts/);assert.match(text,/Nationwide service/);
});
import {searchCompetitiveSources} from './firecrawl.js';
test('competitive search requests bounded readable sources and ignores snippets without page evidence',async t=>{
 const originalFetch=globalThis.fetch, originalKey=process.env.FIRECRAWL_API_KEY;process.env.FIRECRAWL_API_KEY='test-only';
 t.after(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=originalKey;});
 let request;
 globalThis.fetch=async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({success:true,data:{web:[{url:'https://alternative.test',markdown:'Service terms'},{url:'https://snippet.test',description:'Unverified snippet'}]}})}};
 const results=await searchCompetitiveSources('Bicycle repairs alternatives',{limit:20});assert.equal(request.url,'https://api.firecrawl.dev/v2/search');assert.equal(request.body.limit,4);assert.deepEqual(request.body.scrapeOptions.formats,['markdown']);assert.equal(results.length,1);
});

test('split reader and analyst route still synthesizes original evidence when research fails',async()=>{
 let received;
 const result=await generateDiscoveryBrain({evidence:'Original source text',interpret:async()=>({identity:{category:'Repairs'},audience:{primary:'Commuters'}}),research:async()=>{throw Error('Unavailable');},synthesize:async content=>{received=content;return {positioning:{researchGaps:[]}};}});
 assert.match(received,/Original source text/);assert.match(received,/Repairs/);assert.equal(result.research.status,'incomplete');
});
