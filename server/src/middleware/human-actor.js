import { assertHumanActor } from '../lib/human-actor.js';
import { decodeJwtClaims } from '../lib/permissions.js';
import { isWellFormedToken } from '../lib/delegation-token.js';

// Early rejection recognizes non-human credentials; verified auth remains
// authoritative after requireAuth. Both checks use the same assertion.
export function requireHumanActor(c, next) {
  let auth = c.get('auth');
  if (!auth) {
    const bearer = (c.req.header('authorization') || '').replace(/^Bearer /, '');
    const claims = bearer.includes('.') ? decodeJwtClaims(bearer) || {} : {};
    auth = { userId: 'pending-auth', role: claims.role,
      actorType: claims.app_metadata?.actorType,
      delegationToken: bearer && !bearer.includes('.') && isWellFormedToken(bearer) ? bearer : undefined };
  }
  try { assertHumanActor(auth); }
  catch (error) { return c.json({ error: error.message, code: error.code }, error.status); }
  return next();
}
