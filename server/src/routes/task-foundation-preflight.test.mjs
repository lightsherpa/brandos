import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let credits=0,ledger=0,models=0,contexts=[];
process.env.TASKS_ENABLED='true';
const root=new URL('../',import.meta.url);
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',{userId:'owner',workspaceId:'ws'});return next();}}});
mock.module(new URL('lib/permissions.js',root).href,{namedExports:{hasPermission:()=>true}});
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:{from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'brand',workspace_id:'ws'}};}})}}});
mock.module(new URL('harness/task-context.js',root).href,{namedExports:{loadTaskContext:async args=>{
 contexts.push(args);
 if(args.type==='social_post'||args.heroes)throw Object.assign(Error('Missing foundation'),{code:'FOUNDATION_INCOMPLETE',status:409,missing:['visual.logo']});
 return {brand:{id:'brand'},bio:{version:1},layer1:{foundation_missing:['logo'],references:[],rules:[]},skillsPayloads:{}};
}}});
mock.module(new URL('harness/pipeline.js',root).href,{namedExports:{runTask:async()=>{models++;return {items:[],spec:{},metrics:{},status:'ready'};},rerunItem:async()=>({}),reviseComponent:async()=>({}),publicItem:it=>it,ETA_SECONDS:{email_sequence:60,social_post:150}}});
mock.module(new URL('harness/settlement.js',root).href,{namedExports:{
 preflight:async()=>{credits++;return {ok:true};},openRun:async()=>{ledger++;return {runId:'run'};},settle:async args=>args.work(),taskCredits:()=>12,MAX_RERUNS_PER_ITEM:3,
}});
const {default:app}=await import('./tasks.js');
const request=(type,heroes=false)=>app.request('/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brandId:'brand',type,heroes,brief:'A valid task brief'})});
test('task image preflight returns 409 before credit lookup, ledger or model work',async()=>{
 for(const [type,heroes] of [['social_post',false],['email_sequence',true]]){
  const response=await request(type,heroes);assert.equal(response.status,409);const body=await response.json();assert.equal(body.code,'FOUNDATION_INCOMPLETE');assert.equal(body.credits,0);
 }
 assert.equal(credits,0);assert.equal(ledger,0);assert.equal(models,0);
});
test('plain email copy task is accepted without a foundation',async()=>{
 assert.equal((await request('email_sequence')).status,202);assert.equal(contexts.at(-1).heroes,false);assert.equal(ledger,1);
});
