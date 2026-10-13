import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {foundationError} from '../lib/brand-foundation.js';
let modelCalls=0,writes=0,creditReads=0,active={},route='vendor/fal/flux-schnell',imageLoads=0;
const root=new URL('../',import.meta.url);
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',{userId:'owner',workspaceId:'ws',role:'client'});return next();}}});
mock.module(new URL('lib/permissions.js',root).href,{namedExports:{hasPermission:()=>true}});
const db={from:table=>({select(){return this;},eq(){return this;},insert(){writes++;throw Error('unexpected write');},async maybeSingle(){return {data:table==='brands'?{id:'brand',workspace_id:'ws'}:{payload:{modelRouting:{primary:route}}}};}})};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('lib/load-brand-bio.js',root).href,{namedExports:{loadBioForImage:async()=>{imageLoads++;const error=foundationError(active,{logoRights:active.logoRights});if(error)throw Object.assign(Error(error.error),error,{status:409});return {bio:active,brand:{id:'brand'}};}}});
mock.module(new URL('lib/models/fal-image.js',root).href,{namedExports:{isImageRoute:r=>r.startsWith('vendor/fal/')}});
mock.module(new URL('lib/foundation-assets.js',root).href,{namedExports:{validateFoundationAssets:async()=>null}});
const downstream=new Hono();downstream.post('/stream',c=>{creditReads++;writes++;modelCalls++;return c.json({ok:true});});
mock.module(new URL('routes/runs.js',root).href,{defaultExport:downstream});
const {default:app}=await import('./foundation-run-gateway.js');
const request=()=>app.request('/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brandId:'brand',specialistId:'a41',briefText:'Cake Me post'})});
test('image returns 409 FOUNDATION_INCOMPLETE before model, ledger or credit actions',async()=>{
 active={};route='vendor/fal/flux-schnell';
 const response=await request();assert.equal(response.status,409);
 const body=await response.json();assert.equal(body.code,'FOUNDATION_INCOMPLETE');assert.equal(body.credits,0);assert.equal(body.missing.length,3);
 assert.equal(modelCalls,0);assert.equal(writes,0);assert.equal(creditReads,0);
});
test('text run with no foundation passes without image preflight',async()=>{
 route='anthropic/claude-sonnet';active={};const before=imageLoads;
 const response=await request();assert.equal(response.status,200);assert.equal(imageLoads,before);assert.equal(modelCalls,1);
});
test('image preflight uses eligible certified foundation even with an incomplete latest draft',async()=>{
 route='vendor/fal/flux-schnell';active={logoRights:['logo-src'],visual:{logo:{sourceId:'logo-src',conf:90},palette:[{hex:'#ffd115',role:'primary'}],type:[{family:'Inter',kind:'Display',provider:'google'}]}};
 assert.equal((await request()).status,200);
});
