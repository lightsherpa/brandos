import {test,mock} from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';
let userReads=0;
mock.module(new URL('../lib/supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:{auth:{getUser:async()=>{userReads++;return {data:{user:{id:'owner'}},error:null};}},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{workspace_id:'ws',role:'client',email:'local@test.invalid'},error:null})})}}});
mock.module(new URL('../lib/permissions.js',import.meta.url).href,{namedExports:{decodeJwtClaims:()=>({}),hasPermission:()=>true,loadAuthorizationContext:async()=>({}),roleRequiresMfa:()=>false}});
const {requireAuth}=await import('./auth.js');
test('gateway and mounted router authenticate once per request; HTTP cannot forge the verified flag',async()=>{
 const app=new Hono();app.post('/stream',requireAuth,requireAuth,c=>c.json({ok:true}));
 assert.equal((await app.request('/stream',{method:'POST',headers:{authorization:'Bearer local-unit-test'}})).status,200);assert.equal(userReads,1);
 assert.equal((await app.request('/stream',{method:'POST',headers:{authVerified:'true'}})).status,401);assert.equal(userReads,1);
});
