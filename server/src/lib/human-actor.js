import { decodeJwtClaims } from './permissions.js';
import { isWellFormedToken } from './delegation-token.js';

// Run before auth as well as after it: delegation/service credentials must
// receive the same 403 and cannot reach a certification mutation.
export function assertHumanActor(c, next) {
  const auth = c.get('auth') || {};
  const bearer = (c.req.header('authorization') || '').replace(/^Bearer /, '');
  const claims = bearer.includes('.') ? (decodeJwtClaims(bearer) || {}) : {};
  if (['agent', 'service', 'service_role', 'delegation'].includes(auth.actorType) || auth.delegationToken || auth.delegation ||
    ['service_role', 'agent'].includes(auth.role) || ['service_role', 'agent'].includes(claims.role) ||
    ['agent', 'service', 'delegation'].includes(claims.app_metadata?.actorType) || (bearer && !bearer.includes('.') && isWellFormedToken(bearer))) {
    return c.json({ error: 'Agents cannot certify', code: 'AGENT_CANNOT_CERTIFY' }, 403);
  }
  return next ? next() : null;
}
