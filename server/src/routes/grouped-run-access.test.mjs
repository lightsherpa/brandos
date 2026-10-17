import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let actor={scope:'workspace',persona:'workspace_admin'};
mock.module('../middleware/auth.js',{namedExports:{requireAuth:async(c,next)=>{c.set('auth',actor);return next();}}});
const {default:runs}=await import('./runs.js');
const {supabaseAdmin}=await import('../lib/supabase.js');
test('typing a raw per-agent run URL is denied before any output lookup for end users',async()=>{
 for(const value of [{scope:'workspace',persona:'workspace_admin'},{scope:'workspace',persona:'user'},{scope:'workspace',persona:'creative_director'}]){
  actor=value;const response=await runs.request('/known-run-id');assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Open the grouped delivery instead'});
 }
});
test('platform designers and qualified stewards pass the existing internal gate',async t=>{
 const original=supabaseAdmin.from;let lookups=0;
 supabaseAdmin.from=()=>{lookups++;const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:null};}};return query;};
 t.after(()=>{supabaseAdmin.from=original;});
 for(const value of [{scope:'platform',persona:'designer'},{scope:'platform',persona:'designer',qualifications:['steward']},{persona:'designer',roles:['lead_steward']}]){
  actor=value;assert.equal((await runs.request('/missing-run')).status,404);
 }
 assert.equal(lookups,3);
});
