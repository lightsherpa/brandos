import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchAsset, bridgeReferences, isAllowedAssetUrl } from './reference-bridge.js';
import { buildLayer1 } from '../harness/brand-core.js';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
test('only configured loopback storage HTTP survives Layer 1', () => {
 const old=process.env.SUPABASE_URL; process.env.SUPABASE_URL='http://127.0.0.1:54321';
 try {const l=buildLayer1({references:[{url:'http://127.0.0.1:54321/storage/v1/object/sign/bio-sources/a'},{url:'http://169.254.169.254/latest'},{url:'https://example.com/a'}]}); assert.equal(l.references.length,2);} finally {if(old===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=old;}
});
test('blocks private/public HTTP and credential-bearing URLs', () => {for(const u of ['http://example.com/a','https://127.0.0.1/a','https://user:pass@example.com/a','https://[::1]/a']) assert.equal(isAllowedAssetUrl(u), false);});
test('bridge validates bytes and never hands a provider a local URL', async () => {
 const server=http.createServer((req,res)=> {if(req.url.includes('redirect')) {res.writeHead(302,{location:'http://169.254.169.254/latest'});res.end();}else if(req.url.includes('fake')){res.writeHead(200,{'content-type':'image/png'});res.end('HTML');}else{res.writeHead(200,{'content-type':'image/png'});res.end(png);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const origin=`http://127.0.0.1:${server.address().port}`;const options={storageOrigin:origin};
 try {const [data]=await bridgeReferences([`${origin}/storage/v1/object/sign/bio-sources/a`], options);assert.ok(data.startsWith('data:image/png;base64,'));assert.deepEqual(Buffer.from(data.split(',')[1],'base64'),png);
 await assert.rejects(fetchAsset(`${origin}/storage/v1/object/sign/bio-sources/redirect`,options), /redirect/i);
 await assert.rejects(fetchAsset(`${origin}/storage/v1/object/sign/bio-sources/fake`,options), /type/i);
 await assert.rejects(fetchAsset(`${origin}/storage/v1/object/sign/bio-sources/a`,{...options,maxBytes:5}), /size/i);
 await assert.rejects(fetchAsset(`${origin}/admin`,options),/URL/i);
 }finally{server.close();}
});
test('public hostname resolution to internal addresses fails closed',async()=> {await assert.rejects(fetchAsset('https://cdn.example/a',{lookup:async()=>[{address:'10.0.0.2',family:4}]}),/private/i);});
test('provider adapter refuses invalid refs without a queue call or echoing secrets',async()=>{
 const {generate}=await import('./models/fal-image.js');const old=process.env.FAL_API_KEY;process.env.FAL_API_KEY='test';let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('unexpected queue');};
 try {const events=[];for await(const e of generate({route:'vendor/fal/gpt-image-2.5',prompt:'subject',referenceImageUrls:['http://169.254.169.254/token=secret']}))events.push(e);assert.equal(calls,0);assert.equal(events.at(-1).type,'error');assert.ok(!JSON.stringify(events).includes('secret'));}finally{globalThis.fetch=original;if(old===undefined)delete process.env.FAL_API_KEY;else process.env.FAL_API_KEY=old;}
});

test('brief-only signed photos use the configured Storage origin, not arbitrary loopback buckets',()=>{
 const storageOrigin='http://127.0.0.1:54321';
 assert.equal(isAllowedAssetUrl(`${storageOrigin}/storage/v1/object/sign/brief-references/a.png`,{storageOrigin}),true);
 assert.equal(isAllowedAssetUrl(`${storageOrigin}/storage/v1/object/sign/other/a.png`,{storageOrigin}),false);
 assert.equal(isAllowedAssetUrl('http://127.0.0.1:9999/storage/v1/object/sign/brief-references/a.png',{storageOrigin}),false);
});
