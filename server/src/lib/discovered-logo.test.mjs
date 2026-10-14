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
 assert.equal(await verifyDiscoveredLogo(candidate,{head:async()=>({status:200,headers:{'content-type':'image/svg+xml','content-length':String(MAX_UPLOAD_BYTES)}}),inspect:async()=>({width:100,height:100})}),candidate);
});
test('HTML discovery rejects bad logo URL without HEAD and rejects nonimage URL responses',async()=>{
 let calls=0;const head=async()=>{calls++;return {status:200,headers:{'content-type':'text/html','content-length':'100'}};};
 assert.equal(await discoverLogo('<header><img alt="logo" src="http://127.0.0.1/logo.png"></header>','https://brand.test',{head}),null);assert.equal(calls,0);
 assert.equal(await discoverLogo('<header><img alt="logo" src="/logo.svg"></header>','https://brand.test',{head}),null);assert.equal(calls,1);
});
test('raster logos require real dimensions, reject ico MIME/URLs, and fail closed on unreadable bytes',async()=>{
 const raster={url:'https://brand.test/logo.png',conf:90};
 const head=async()=>({status:200,headers:{'content-type':'image/png','content-length':'100'}});
 for(const dimensions of [{width:32,height:32},null])assert.equal(await verifyDiscoveredLogo(raster,{head,inspect:async()=>dimensions}),null);
 assert.equal(await verifyDiscoveredLogo(raster,{head,inspect:async()=>({width:75,height:95})}),raster);
 assert.equal(await verifyDiscoveredLogo({...raster,url:'https://brand.test/favicon.ico'},{head,inspect:async()=>({width:100,height:100})}),null);
 assert.equal(await verifyDiscoveredLogo(raster,{head:async()=>({status:200,headers:{'content-type':'image/x-icon','content-length':'100'}})}),null);
});
test('failed first candidate falls back to a usable header image in bounded order',async()=>{
 const html='<script type="application/ld+json">{"@type":"Organization","logo":"/missing.png"}</script><header><img alt="logo" src="/actual.png"></header>';
 const calls=[];
 const found=await discoverLogo(html,'https://brand.test',{head:async url=>{calls.push(url);return {status:url.endsWith('/missing.png')?404:200,headers:{'content-type':'image/png','content-length':'100'}};},inspect:async()=>({width:75,height:95})});
 assert.equal(found.url,'https://brand.test/actual.png');assert.equal(calls.length,2);
});
