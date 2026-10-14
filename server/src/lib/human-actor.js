// Certification authority comes only from the authenticated caller context.
export function assertHumanActor(auth) {
  const type = auth?.actor?.type || auth?.actorType || auth?.actor_type || 'human';
  if (!auth?.userId || type !== 'human' || ['agent', 'service', 'service_role', 'delegation'].includes(auth?.role) || auth?.delegationToken || auth?.delegation) {
    throw Object.assign(new Error('Agents cannot certify'), { status: 403, code: 'AGENT_CANNOT_CERTIFY' });
  }
}
