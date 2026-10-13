// Only the authentication middleware's verified caller context is authoritative.
// Request bodies never supply the actor for a certification decision.
export function assertHumanActor(auth) {
  const type = auth?.actor?.type || auth?.actorType || auth?.actor_type || 'human';
  if (!auth?.userId || type !== 'human' || ['agent', 'service_role'].includes(auth?.role)) {
    throw Object.assign(new Error('Only a human Creative Director can certify.'), { status: 403, code: 'HUMAN_ACTOR_REQUIRED' });
  }
}
