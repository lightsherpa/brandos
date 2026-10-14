import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {scrape} from './firecrawl.js';
import {readDiscoveryInstagram} from './discovery-source-context.js';

test('Instagram requests reserve paid-test spend, including blocked scrapes; budget exhaustion is surfaced',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'instagram-budget-')),cwd=process.cwd(),previousFetch=globalThis.fetch;
 const keys=['DISCOVERY_PAID_TEST','DISCOVERY_PAID_TEST_LIMIT_USD','FIRECRAWL_API_KEY'],previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 t.after(()=>{process.chdir(cwd);globalThis.fetch=previousFetch;for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}rmSync(dir,{recursive:true,force:true});});
 process.chdir(dir);process.env.DISCOVERY_PAID_TEST='1';process.env.DISCOVERY_PAID_TEST_LIMIT_USD='.2';process.env.FIRECRAWL_API_KEY='test-only';
 let requests=0;
 globalThis.fetch=async url=>{if(!String(url).startsWith('https://api.firecrawl.dev/'))return new Response('[]',{headers:{'content-type':'application/json'}});requests++;return {ok:false,status:403,text:async()=> 'Blocked'};};
 for(let i=0;i<2;i++)assert.equal((await readDiscoveryInstagram({instagram:'@brand',scrape})).sources[0].status,'unreadable');
 const ledger=JSON.parse(readFileSync(path.join(dir,'.bio-local/paid-budget.json'),'utf8'));
 assert.deepEqual(ledger.entries.map(e=>[e.label,e.amountUsd]),[['firecrawl:instagram',.1],['firecrawl:instagram',.1]]);
 await assert.rejects(readDiscoveryInstagram({instagram:'@brand',scrape}),{code:'TEST_BUDGET_EXHAUSTED'});assert.equal(requests,2);
});
