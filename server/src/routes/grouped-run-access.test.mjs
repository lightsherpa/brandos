import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let actor={scope:'workspace',persona:'workspace_admin'};
mock.module('../middleware/auth.js',{namedExports:{requireAuth:async(c,next)=>{c.set('auth',actor);return next();}}});
const {default:runs}=await import('./runs.js');
test('typing a raw per-agent run URL is denied before any output lookup for end users and designers',async()=>{
 for(const value of [{scope:'workspace',persona:'workspace_admin'},{scope:'workspace',persona:'user'},{scope:'workspace',persona:'creative_director'},{scope:'platform',persona:'designer'}]){
  actor=value;const response=await runs.request('/known-run-id');assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Open the grouped delivery instead'});
 }
});
