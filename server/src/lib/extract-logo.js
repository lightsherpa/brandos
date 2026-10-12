import { assertPublicUrl } from './ingest-guards.js';

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(m => [m[1].toLowerCase(), (m[2] ?? m[3] ?? m[4]).replace(/&amp;/g, '&')]));
}
function publicLogo(raw, base, source, conf) {
  try { return { url: assertPublicUrl(new URL(raw, base).href), source, conf }; } catch { return null; }
}
// Keep inline SVG inert: it is only ever rendered through <img>, never HTML.
export function safeLogoSvg(svg = '') {
  const root=svg.trim().replace(/^<\?xml\s+[\s\S]*?\?>\s*/i,'');
  if(!/^<svg\b/i.test(root)||!/<\/svg>\s*$/i.test(root)||/<(?:script|foreignObject|iframe|image|animate|set)\b|\bon\w+\s*=|<!ENTITY|<!DOCTYPE|<\?xml-stylesheet|@import/i.test(root))return false;
  // Internal gradients, clip paths and <use href="#mark"> are ordinary logo
  // artwork. External resources, data URLs and executable links are rejected.
  for(const match of root.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/gi))if(!/^#[\w:.-]+$/.test(match[1]))return false;
  for(const match of root.matchAll(/url\s*\(\s*([^)]*)\)/gi))if(!/^#[\w:.-]+$/.test(match[1].trim().replace(/^["']|["']$/g,'')))return false;
  return true;
}
export function extractLogo(html = '', baseUrl = '') {
  if (typeof html !== 'string') return null;
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = value => {
        if (!value || typeof value !== 'object') return null;
        if ([].concat(value['@type'] || []).includes('Organization')) {
          const logo = typeof value.logo === 'string' ? value.logo : value.logo?.url || value.logo?.contentUrl;
          const found = logo && publicLogo(logo, baseUrl, 'Organization.logo', 90);
          if (found) return found;
        }
        for (const child of Object.values(value)) { const found = walk(child); if (found) return found; }
        return null;
      };
      const found = walk(JSON.parse(match[1])); if (found) return found;
    } catch { /* malformed site metadata */ }
  }
  for (const region of html.matchAll(/<(header|nav)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    for (const match of region[2].matchAll(/<img\b[^>]*>|<svg\b[^>]*>[\s\S]*?<\/svg>/gi)) {
      const a = attrs(match[0].split('>')[0]);
      if (!/logo/i.test([a.src, a.alt, a.class, a.id, a['aria-label']].join(' '))) continue;
      if (/^<svg/i.test(match[0]) && safeLogoSvg(match[0])) return { url:`data:image/svg+xml,${encodeURIComponent(match[0])}`, source:'header SVG', conf:90 };
      const found = a.src && publicLogo(a.src, baseUrl, 'header image', 90); if (found) return found;
    }
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (!/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(a.rel || '')) continue;
    const found = a.href && publicLogo(a.href, baseUrl, 'site icon', 50); if (found) return found;
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (a.property === 'og:image') { const found = publicLogo(a.content, baseUrl, 'og:image', 50); if (found) return found; }
  }
  return null;
}
export function mergeLogoFromAssets(discovered, logos = []) {
  const current = logos.filter(l => l.signals?.purpose !== 'aspiration');
  if (!current.length) return discovered || null;
  const variants = {};
  for (const item of current) {
    const variant = item.signals?.logo_variant || 'light';
    if (!variants[variant]) variants[variant] = { sourceId:item.id, source:item.name, conf:100 };
  }
  const main = variants.light || variants.dark;
  return { ...main, variants };
}
