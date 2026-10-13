import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
let failTable=null,downstreamCalls=0,imageLoads=0;
const root=new URL('../',import.meta.url);
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',{userId:'owner',workspaceId:'ws'});return next();}}});
mock.module(new URL('lib/permissions.js',root).href,{namedExports:{hasPermission:()=>true}});
const rows={briefs:{brand_id:'brand',brand:{workspace_id:'ws'}},brands:{id:'brand',workspace_id:'ws'},specs:{payload:{modelRouting:{primary:'vendor/fal/gpt-image-2.5'}}}};
const db={from:table=>({select(){return this;},eq(){return this;},async maybeSingle(){return table===failTable?{data:null,error:{message:'connection reset'}}:{data:rows[table],error:null};}})};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('lib/load-brand-bio.js',root).href,{namedExports:{loadBioForImage:async()=>{imageLoads++;return {bio:{visual:{}},brand:{id:'brand'}};}}});
mock.module(new URL('lib/models/fal-image.js',root).href,{namedExports:{isImageRoute:r=>r.startsWith('vendor/fal/')}});
mock.module(new URL('lib/brand-foundation.js',root).href,{namedExports:{foundationError:()=>null}});
mock.module(new URL('lib/foundation-assets.js',root).href,{namedExports:{validateFoundationAssets:async()=>null}});
const downstream=new Hono();downstream.post('/stream',c=>{downstreamCalls++;return c.json({ok:true});});
mock.module(new URL('routes/runs.js',root).href,{defaultExport:downstream});
const {default:app}=await import('./foundation-run-gateway.js');
const post=(body)=>app.request('/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({specialistId:'a41',briefText:'Cake Me post',...body})});
const errors=[];const origError=console.error;
for(const [table,body] of [['briefs',{briefId:'b1'}],['brands',{brandId:'brand'}],['specs',{brandId:'brand'}]]){
  test(`${table} lookup error → 503 before the run router (fail closed)`,async()=>{
    failTable=table;const before=downstreamCalls;console.error=(m)=>errors.push(String(m));
    try{
      const r=await post(body);assert.equal(r.status,503);
      const j=await r.json();assert.equal(j.code,'FOUNDATION_CHECK_UNAVAILABLE');assert.equal(j.credits,0);
      assert.equal(downstreamCalls,before,'run router never reached');
      assert.ok(errors.some((m)=>m.includes(`${table==='briefs'?'brief':table==='brands'?'brand':'spec'} lookup failed`)));
    }finally{console.error=origError;failTable=null;}
  });
}
test('no lookup error → passes through to the run router as before',async()=>{
  const before=downstreamCalls;const r=await post({brandId:'brand'});
  assert.equal(r.status,200);assert.equal(downstreamCalls,before+1);
});
test('brand not found (no error) still defers to runs.js for its 4xx contract',async()=>{
  const saved=rows.brands;rows.brands=null;const before=downstreamCalls;
  try{assert.equal((await post({brandId:'nope'})).status,200);assert.equal(downstreamCalls,before+1);}finally{rows.brands=saved;}
});
