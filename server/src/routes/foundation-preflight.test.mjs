import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let calls=0,creditReads=0,writes=0,latest={},active={};
const root=new URL('../',import.meta.url);
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',{userId:'owner',workspaceId:'ws',role:'client'});await next();}}});
mock.module(new URL('lib/permissions.js',root).href,{namedExports:{hasPermission:()=>true}});
const db={from:table=>{const query={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},insert(){writes++;throw Error('unexpected write');},async maybeSingle(){return {data:table==='brands'?{id:'brand',workspace_id:'ws'}:{id:'spec',payload:{modelRouting:{primary:'vendor/fal/flux-schnell'}}}};}};return query;}};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('lib/load-brand-bio.js',root).href,{namedExports:{loadBrandBio:async()=>({bio:latest}),loadBioForRun:async()=>({bio:active,brand:{id:'brand'}})}});
mock.module(new URL('lib/models/fal-image.js',root).href,{namedExports:{isImageRoute:r=>r.startsWith('vendor/fal/'),generateWithFallback:async()=>{calls++;throw Error('model called');},resolveImageRequest:()=>{calls++;throw Error('model called');}}});
mock.module(new URL('lib/models/router.js',root).href,{namedExports:{streamCompletion:async()=>{calls++;},isAllowedModelOverride:()=>true,routeCreditMultiplier:()=>1}});
mock.module(new URL('lib/credits.js',root).href,{namedExports:{assertCreditsAvailable:async()=>{creditReads++;throw Error('credits accessed');},creditErrorResponse:()=>{},estimateRunCredits:()=>{creditReads++;throw Error('credits estimated');},reserveCredits:async()=>{writes++;},failRunAndReleaseCredits:async()=>{writes++;}}});
const {default:app}=await import('./runs.js');
const request=()=>app.request('/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brandId:'brand',specialistId:'a41',briefText:'Cake Me post'})});
test('legacy certified foundation blocks before any model, ledger or credit action',async()=>{
 latest={visual:{palette:[{hex:'#ffd115'}],type:[]}};active=latest;
 const response=await request();assert.equal(response.status,409);
 const body=await response.json();assert.equal(body.state,'foundation_incomplete');assert.equal(body.credits,0);assert.equal(body.missing.length,3);
 assert.equal(calls,0);assert.equal(writes,0);assert.equal(creditReads,0);
});
test('a complete new draft cannot bypass incomplete pinned certification',async()=>{
 latest={visual:{logo:{sourceId:'logo',conf:100},palette:[{hex:'#ffd115',role:'primary'}],type:[{family:'Inter',kind:'Display',provider:'google'}]}};active={};
 const response=await request();assert.equal(response.status,409);assert.equal((await response.json()).state,'foundation_incomplete');
 assert.equal(calls,0);assert.equal(writes,0);assert.equal(creditReads,0);
});
