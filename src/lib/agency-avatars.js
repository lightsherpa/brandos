// Reusable identities are selected by role, never by transient crew array order.
export function agencyAvatarRole(agent) {
  if (agent?.node?.id === 'brandolph' || agent?.id === 'brandolph') return 'brandolph';
  const name = agent?.name || agent?.node?.title || '';
  if (/voice.*qa|voice.*review/i.test(name)) return 'voice-reviewer';
  if (/qa|consistency|audit|review/i.test(name) || agent?.room === 'review') return 'brand-reviewer';
  if (agent?.room === 'concept' || agent?.dept === 'Concept') return 'creative-lead';
  if (agent?.room === 'copy' || agent?.dept === 'Copy') return 'copywriter';
  if (['visual', 'web'].includes(agent?.room) || ['Visual', 'Web & UX', 'Motion & Sound'].includes(agent?.dept)) return 'designer';
  return 'strategist';
}

export function agencyAvatarSource(agent) {
  const role = agencyAvatarRole(agent);
  return `/agency-office/characters/${role}-playful-${role === 'designer' ? 'v2' : 'v1'}.png`;
}
