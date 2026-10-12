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
export function foundationStatus(payload = {}) {
  const visual = payload?.visual || {};
  const logo = visual.logo;
  const validLogo = !!logo && (Number(logo.conf) >= 60) &&
    (!!logo.sourceId || Object.values(logo.variants || {}).some(v => v?.sourceId) || /^(https?:\/\/|data:image\/svg\+xml,)/i.test(logo.url || ''));
  const primary = (Array.isArray(visual.palette) ? visual.palette : []).find(c => c?.role === 'primary' && /^#[\da-f]{6}$/i.test(c.hex || ''));
  const display = (Array.isArray(visual.type) ? visual.type : []).find(usableDisplayFont);
  const missing = [!validLogo && 'visual.logo',!primary && 'visual.palette.primary',!display && 'visual.type.display'].filter(Boolean);
  return {certifiable:missing.length === 0,missing,logo:validLogo,primary:!!primary,display:!!display};
}
export function foundationError(payload) {
  const status = foundationStatus(payload);
  return status.certifiable ? null : {ok:false,code:'FOUNDATION_INCOMPLETE',state:'foundation_incomplete',error:'Add a logo, primary colour and display font before certification or image production.',missing:status.missing,credits:0};
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
    if (colour.role && !COLOUR_ROLES.includes(colour.role) && !['secondary','background','neutral','unclassified'].includes(colour.role)) return 'Unknown colour role';
    if (['primary','ink','surface'].includes(colour.role)) { if(roles.has(colour.role)) return `Choose one ${colour.role} colour`;roles.add(colour.role); }
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
