import test from 'node:test';import assert from 'node:assert/strict';
import {assertHumanActor} from './human-actor.js';import {mintDelegationToken} from './delegation-token.js';
function ctx(auth={},jwt=''){return{get:()=>auth,req:{header:()=>jwt?`Bearer ${jwt}`:null},json:(body,status)=>({body,status})};}
test('verified agent, service and delegation actors receive 403 AGENT_CANNOT_CERTIFY',()=>{
 for(const auth of [{actorType:'agent'},{actorType:'service'},{actorType:'service_role'},{actorType:'delegation'},{role:'service_role'},{delegationToken:'token'},{delegation:{}}]){
 const res=assertHumanActor(ctx(auth));assert.equal(res.status,403);assert.equal(res.body.code,'AGENT_CANNOT_CERTIFY');}
});
test('delegation bearer and service JWT are rejected before requireAuth; human actor proceeds',()=>{
 const token=mintDelegationToken().token;assert.equal(assertHumanActor(ctx({},token)).status,403);
 const jwt='head.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.sig';assert.equal(assertHumanActor(ctx({},jwt)).status,403);
 let next=0;assertHumanActor(ctx({actorType:'human'}),()=>{next++;});assert.equal(next,1);assert.equal(assertHumanActor(ctx({actorType:'human'})),null);
});
