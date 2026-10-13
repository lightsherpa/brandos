import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoverLogo,verifyDiscoveredLogo} from './discovered-logo.js';
import {MAX_UPLOAD_BYTES} from './ingest-guards.js';
const candidate={url:'https://brand.test/logo.svg',conf:90};
test('discovered logo requires successful image HEAD response of at most 15MB',async()=>{
 for(const result of [
  {status:404,headers:{'content-type':'image/png','content-length':'100'}},
  {status:200,headers:{'content-type':'text/html','content-length':'100'}},
  {status:200,headers:{'content-type':'image/png','content-length':String(MAX_UPLOAD_BYTES+1)}},
  {status:200,headers:{'content-type':'image/png'}},
  {status:200,headers:{'content-type':'image/png','content-length':'0'}},
 ])assert.equal(await verifyDiscoveredLogo(candidate,{head:async()=>result}),null);
 assert.equal(await verifyDiscoveredLogo(candidate,{head:async()=>{throw Error('timeout');}}),null);
 assert.equal(await verifyDiscoveredLogo(candidate,{head:async()=>({status:200,headers:{'content-type':'image/svg+xml','content-length':String(MAX_UPLOAD_BYTES)}})}),candidate);
});
test('HTML discovery rejects bad logo URL without HEAD and rejects nonimage URL responses',async()=>{
 let calls=0;const head=async()=>{calls++;return {status:200,headers:{'content-type':'text/html','content-length':'100'}};};
 assert.equal(await discoverLogo('<header><img alt="logo" src="http://127.0.0.1/logo.png"></header>','https://brand.test',{head}),null);assert.equal(calls,0);
 assert.equal(await discoverLogo('<header><img alt="logo" src="/logo.svg"></header>','https://brand.test',{head}),null);assert.equal(calls,1);
});
