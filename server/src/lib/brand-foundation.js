// Shared foundation contract for server gates and the Brand Core screen.
export const COLOUR_ROLES = Object.freeze(['primary','ink','surface','accent']);
export const GOOGLE_FONTS = Object.freeze(['Instrument Sans','Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Playfair Display','DM Sans','DM Serif Display','Manrope','Space Grotesk','Work Sans','Nunito Sans','Source Sans 3','Noto Sans','Noto Sans Arabic','Noto Serif','Lora','Merriweather','Oswald','Bebas Neue','Outfit','Plus Jakarta Sans','Cormorant Garamond']);
export const TYPE_SCALE_KEYS = Object.freeze(['h1','h2','h3','h4','h5','h6','body']);
export const DEFAULT_TYPE_SCALE = Object.freeze({h1:64,h2:48,h3:36,h4:28,h5:22,h6:18,body:16});
export function googleFontCssUrl(family) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,'+')}&display=swap`;
}
export function usableDisplayFont(font) {
  return !!font && /^(display|both)$/i.test(font.kind || '') && typeof font.family === 'string' && !!font.family.trim() &&
    (!!font.sourceId || (font.provider === 'google' && GOOGLE_FONTS.includes(font.family)));
}
// Stored logo source ids referenced by a payload (main logo + variants).
export function logoSourceIds(payload = {}) {
  const logo = payload?.visual?.logo;
  return [...new Set([logo?.sourceId, ...Object.values(logo?.variants || {}).map(v => v?.sourceId)].filter(Boolean))];
}
/* logoRights: ids of logo sources whose bio_sources row has rights_confirmed === true
   (server: loadLogoRights; UI: bio.logoRights from GET /api/bios/:brandId).
   Without it, no logo is counted: rights are never assumed. */
export function foundationStatus(payload = {}, { logoRights } = {}) {
  const visual = payload?.visual || {};
  const logo = visual.logo;
  const confirmed = new Set(logoRights || []);
  // Only stored PNG logos count (a bio_sources sourceId); remote URLs and inline SVG never do.
  const ids = logo && Number(logo.conf) >= 60 ? logoSourceIds(payload) : [];
  const validLogo = ids.some(id => confirmed.has(id));
  const needsRights = validLogo ? [] : ids;
  const logoStatus = validLogo ? 'ok' : needsRights.length ? 'needs_rights' : 'missing';
  const primary = (Array.isArray(visual.palette) ? visual.palette : []).find(c => c?.role === 'primary' && /^#[\da-f]{6}$/i.test(c.hex || ''));
  const display = (Array.isArray(visual.type) ? visual.type : []).find(usableDisplayFont);
  const missing = [!validLogo && 'visual.logo',!primary && 'visual.palette.primary',!display && 'visual.type.display'].filter(Boolean);
  return {certifiable:missing.length === 0,missing,logo:validLogo,logoStatus,needsRights,primary:!!primary,display:!!display};
}
export function foundationError(payload, options) {
  const status = foundationStatus(payload, options);
  if (status.certifiable) return null;
  const rightsOnly = status.logoStatus === 'needs_rights' && status.missing.length === 1;
  return {ok:false,code:'FOUNDATION_INCOMPLETE',state:'foundation_incomplete',
    error: rightsOnly ? 'Confirm the brand has rights to use its logo before certification or image production.' : 'Add a logo, primary colour and display font before certification or image production.',
    missing:status.missing,logoStatus:status.logoStatus,needsRights:status.needsRights,credits:0};
}
export function inferColourRoles(palette = []) {
  const result = palette.map(c=>({...c}));
  if (!result.length) return result;
  const rgb = c => c.hex.slice(1).match(/../g).map(x=>parseInt(x,16));
  const saturation = c => { const channels=rgb(c);return Math.max(...channels)-Math.min(...channels); };
  const brightness = c => rgb(c).reduce((a,b)=>a+b,0);
  const primary = [...result].sort((a,b)=>saturation(b)-saturation(a))[0];
  const ink = [...result].sort((a,b)=>brightness(a)-brightness(b))[0];
  const surface = [...result].sort((a,b)=>brightness(b)-brightness(a))[0];
  for (const c of result) {
    if (c === primary && saturation(c)>24) c.role='primary';
    else if (c === ink && c !== surface) c.role='ink';
    else if (c === surface) c.role='surface';
    else c.role='accent';
    c.roleStatus='inferred';
  }
  return result;
}
export function validateFoundationVisual(visual = {}) {
  if (visual.palette != null && !Array.isArray(visual.palette)) return 'Palette must be a list';
  const roles = new Set();
  for (const colour of visual.palette || []) {
    if (!colour || !/^#[\da-f]{6}$/i.test(colour.hex || '')) return 'Use six-digit colour hex values';
    if (colour.role && !COLOUR_ROLES.includes(colour.role) && !['secondary','tertiary','background','neutral','unclassified'].includes(colour.role)) return 'Unknown colour role';
    if (colour.group && !['primary','secondary','tertiary','neutral','accent'].includes(colour.group)) return 'Unknown colour group';
    if (['primary','ink','surface'].includes(colour.role) && !colour.group) { if(roles.has(colour.role)) return `Choose one ${colour.role} colour`;roles.add(colour.role); }
  }
  if (visual.type != null && !Array.isArray(visual.type)) return 'Typography must be a list';
  for (const font of visual.type || []) {
    if (!font || typeof font.family !== 'string' || !font.family.trim()) return 'Font family is required';
    if (font.provider === 'google' && !GOOGLE_FONTS.includes(font.family)) return 'Choose a supported Google Font';
  }
  if (visual.typeScale != null) {
    if (typeof visual.typeScale !== 'object' || Array.isArray(visual.typeScale)) return 'Type scale must contain pixel sizes';
    for (const [key,value] of Object.entries(visual.typeScale)) if (!TYPE_SCALE_KEYS.includes(key) || !Number.isFinite(value) || value < 8 || value > 200) return 'Type scale sizes must be 8–200 px';
  }
  return null;
}

// Proposals for a legacy palette when the designer opens the editor.
// Existing assigned roles win; framework defaults stay unassigned.
export function suggestColourRoles(palette = []) {
  if(palette.some(colour=>COLOUR_ROLES.includes(colour.role)))return palette.map(colour=>({...colour}));
  const candidates=palette.filter(colour=>/^#[\da-f]{6}$/i.test(colour?.hex||'')&&!['#000000','#ffffff','#161616'].includes(colour.hex.toLowerCase()));
  const suggested=new Map(inferColourRoles(candidates).map(colour=>[colour.hex.toLowerCase(),colour]));
  return palette.map(colour=>suggested.get(colour.hex?.toLowerCase()) || {...colour});
}
