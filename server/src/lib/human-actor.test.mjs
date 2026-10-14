import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHumanActor } from './human-actor.js';
import { requireHumanActor } from '../middleware/human-actor.js';
import { mintDelegationToken } from './delegation-token.js';
function ctx(auth, token = '') { return { get: () => auth, req: { header: () => token ? `Bearer ${token}` : null }, json: (body,status) => ({body,status}) }; }
test('the shared assertion throws 403 for every non-human actor and missing caller', () => {
  for (const auth of [undefined, {}, ...['agent','service','service_role','delegation'].map(actorType => ({userId:'u',actorType})), {userId:'u',actor:{type:'agent'}}, {userId:'u',role:'service_role'}, {userId:'u',delegation:{}}])
    assert.throws(() => assertHumanActor(auth), e => e.status === 403 && e.code === 'AGENT_CANNOT_CERTIFY');
  assert.doesNotThrow(() => assertHumanActor({userId:'u',actorType:'human'}));
});
test('middleware delegates early credential rejection and authenticated caller checks', () => {
  const service = 'head.' + Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url') + '.sig';
  for (const token of [mintDelegationToken().token, service]) assert.equal(requireHumanActor(ctx(undefined,token),()=>{}).status,403);
  assert.equal(requireHumanActor(ctx({userId:'u',actorType:'agent'}),()=>{}).body.code,'AGENT_CANNOT_CERTIFY');
  let calls=0; requireHumanActor(ctx({userId:'u'}),()=>calls++); assert.equal(calls,1);
});
