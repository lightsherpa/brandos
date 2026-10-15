// A crew is a bounded production pipeline, never a collection of idle agents.
export const crewCanvasEnabled = () => ['1', 'true'].includes(String(process.env.CREW_CANVAS || '').toLowerCase());
export function crewFor(type, heroes = false) {
  if (type === 'social_post') return ['copy', 'image', 'compositor', 'qa'];
  if (type === 'email_sequence') return ['copy', 'html', ...(heroes ? ['hero'] : []), 'qa'];
  return [];
}
export function componentFields(type) {
  return type === 'social_post' ? ['caption', 'overlay_line', 'cta', 'image', 'composition'] : ['subject', 'preheader', 'headline', 'body_blocks', 'cta.label', 'cta.url', 'image', 'composition'];
}
export function validateComponent({ type, component, action, value, heroes }) {
  if (!componentFields(type).includes(component) || !['replace', 'regenerate'].includes(action)) return 'Choose a valid component and action';
  if (component === 'composition' && action !== 'regenerate') return 'Composition can only be rendered again';
  if (component === 'image' && type === 'email_sequence' && !heroes) return 'This email has no hero image';
  if (action === 'replace' && (typeof value !== 'string' || !value.trim() || value.length > 10000)) return 'A replacement value is required (maximum 10,000 characters)';
  if (component === 'image' && action === 'replace') {
    try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) return 'Use a hosted HTTPS image'; } catch { return 'Use a hosted HTTPS image'; }
  }
  return null;
}

export function crewTask(task) {
  if (!crewCanvasEnabled()) return task;
  const visual = task.type === 'social_post' || task.heroes;
  return { ...task,
    reviewerChecks: visual ? [...new Set([...task.reviewerChecks, 'image_matches_palette_refs'])] : task.reviewerChecks,
    mandatory: visual ? [...new Set([...task.mandatory, 'image_matches_palette_refs', ...(task.type === 'social_post' ? ['image_matches_brief'] : [])])] : task.mandatory,
  };
}
