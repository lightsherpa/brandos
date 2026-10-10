// Presentation preference only. It never enables execution or changes workspace policy.
export function readWorkspaceSurface(storage) {
  try { return storage?.getItem('ci_workspace_surface') === 'canvas' ? 'canvas' : 'office'; }
  catch { return 'office'; }
}
export function writeWorkspaceSurface(storage, surface) {
  if (!['office', 'canvas'].includes(surface)) return;
  try { storage?.setItem('ci_workspace_surface', surface); } catch {}
}
