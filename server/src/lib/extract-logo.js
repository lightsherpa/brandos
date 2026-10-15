import { assertPublicUrl } from './ingest-guards.js';

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(m => [m[1].toLowerCase(), (m[2] ?? m[3] ?? m[4]).replace(/&amp;/g, '&')]));
}
function publicLogoCandidate(raw, base, source, conf) {
  try { const url=assertPublicUrl(new URL(raw, base).href); if(/\.ico(?:[?#]|$)/i.test(url))return null; return {url,source,conf}; } catch { return null; }
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
export function extractLogo(html = '', baseUrl = '', {exclude=[]} = {}) {
  const publicLogo=(...args)=>{const found=publicLogoCandidate(...args);return found&&!exclude.includes(found.url)?found:null;};
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
      const prefix=region[2].slice(0,match.index);
      const parent=prefix.match(/<(?:a|div|span)\b[^>]*>\s*$/i)?.[0] || '';
      const anchor=[...prefix.matchAll(/<a\b[^>]*>/gi)].at(-1);
      let homeLink=false;
      if(anchor && !/<\/a>/i.test(prefix.slice(anchor.index))){
        try{const href=new URL(attrs(anchor[0]).href,baseUrl),base=new URL(baseUrl);homeLink=href.origin===base.origin && href.pathname==='/';}catch{}
      }
      a.src=a.src||a['data-src']||a['data-lazy-src'];
      if([a.width,a.height].some(v=>/^\d+$/.test(v||'')&&Number(v)<64))continue;
      if (!homeLink && !/logo/i.test([a.src, a.alt, a.class, a.id, a['aria-label'],parent].join(' '))) continue;
      if (/^<svg/i.test(match[0]) && safeLogoSvg(match[0]) && !exclude.includes(`data:image/svg+xml,${encodeURIComponent(match[0])}`)) return { url:`data:image/svg+xml,${encodeURIComponent(match[0])}`, source:'header SVG', conf:90 };
      const found = a.src && publicLogo(a.src, baseUrl, 'header image', 90); if (found) return found;
    }
  }
  // Some sites implement their header using div.topbar rather than header/nav.
  // Explicit logo naming is evidence; arbitrary page photography is not.
  for(const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const a=attrs(match[0]);const src=a.src||a['data-src']||a['data-lazy-src'];
    if(!/logo/i.test([src,a.alt,a.class,a.id].join(' ')))continue;
    if([a.width,a.height].some(v=>/^\d+$/.test(v||'')&&Number(v)<64))continue;
    const found=src&&publicLogo(src,baseUrl,'named logo image',90);if(found)return found;
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (a.property === 'og:image') { const found = publicLogo(a.content, baseUrl, 'og:image', 50); if (found) return found; }
  }
  const icons = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attrs(m[0]));
  for (const a of icons.filter(a => /(?:^|\s)apple-touch-icon(?:-precomposed)?(?:\s|$)/i.test(a.rel || ''))) {
    const found = a.href && publicLogo(a.href, baseUrl, 'apple-touch-icon', 50); if (found) return found;
  }
  for (const a of icons.filter(a => /(?:^|\s)icon(?:\s|$)/i.test(a.rel || ''))) {
    // Unknown-size favicons cannot establish a usable brand mark.
    const sizes = [...String(a.sizes || '').matchAll(/(\d+)x(\d+)/g)];
    if (!sizes.some(m => Number(m[1]) >= 64 && Number(m[2]) >= 64)) continue;
    const found = a.href && publicLogo(a.href, baseUrl, 'site icon', 50); if (found) return found;
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
