import { isAllowedAssetUrl } from "../lib/reference-bridge.js";
// Brand Core Layer 1 pack (CREWS §0.1): logo, palette roles, typography,
// voice do/don't + examples, refusals and reference images. Loaded first by
// every task. Pure: callers pass the normalized bio + resolved references.

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Number(((l1 + 0.05) / (l2 + 0.05)).toFixed(2));
}
function saturation(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Palette roles. Explicit roles win; otherwise S7 default guess:
    most saturated → primary, darkest → ink, lightest → surface. */
export function paletteRoles(palette = []) {
  const swatches = (Array.isArray(palette) ? palette : []).filter((p) => HEX.test(p?.hex || ""));
  const byRole = (...roles) => swatches.find((p) => roles.includes(String(p.role || "").toLowerCase()))?.hex;
  const sortedLum = [...swatches].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  const sortedSat = [...swatches].sort((a, b) => saturation(b.hex) - saturation(a.hex));
  const ink = byRole("ink", "text") || sortedLum[0]?.hex || "#111111";
  const surface = byRole("surface", "background", "bg") || sortedLum[sortedLum.length - 1]?.hex || "#ffffff";
  let primary = byRole("primary", "brand") || byRole("accent") || sortedSat[0]?.hex || ink;
  if (primary === surface) primary = ink;
  const accent = byRole("accent", "secondary") || primary;
  const muted = byRole("neutral", "muted") || "#6b6b6b";
  return { primary, accent, ink, surface, muted, guessed: !byRole("primary", "brand") };
}

function cleanFamily(f) { return String(f || "").replace(/!important/gi, "").replace(/["']/g, "").trim(); }
export function fontRoles(type = []) {
  const list = (Array.isArray(type) ? type : []).filter((t) => t?.family);
  const display = cleanFamily(list.find((t) => /display|head/i.test(t.kind || ""))?.family || list[0]?.family || "");
  const body = cleanFamily(list.find((t) => /body|text/i.test(t.kind || ""))?.family || display);
  return { display, body };
}
export function fontStack(family) {
  return family ? `'${family}', Helvetica, Arial, sans-serif` : "Helvetica, Arial, sans-serif";
}

export function buildLayer1({ brand = {}, bio = {}, refusals = [], references = [] } = {}) {
  const v = bio.visual || {};
  const voice = bio.voice || {};
  const roles = paletteRoles(v.palette);
  const fonts = fontRoles(v.type);
  const logo = v.logo?.url ? { url: v.logo.url, dark_url: v.logo.dark_url || null, sourceId: v.logo.sourceId || null, source: v.logo.source || null, conf: v.logo.conf ?? null } : null;
  const refs = (references || []).filter((r) => isAllowedAssetUrl(r?.url || "")).slice(0, 3).map((r, i) => ({ id: r.id || `ref${i + 1}`, url: r.url, role: r.role || "inspiration", source: r.source || "brand_core" }));
  return {
    brand: { id: brand.id || null, name: brand.name || "Brand", url: brand.url || null },
    logo,
    palette: roles,
    swatches: (v.palette || []).filter((p) => HEX.test(p?.hex || "")).map((p) => ({ hex: p.hex, name: p.name || "", role: p.role || "" })),
    fonts,
    font_assets: (v.type || []).filter(t => t.url && t.sourceId && t.license && t.suggest).map(t => ({ family: cleanFamily(t.family), url: t.url, sourceId: t.sourceId, license: t.license, license_reference: t.suggest, rights_confirmed: t.rights_confirmed === true, weight: t.weight || "400", style: t.style || "normal" })),
    imagery: Array.isArray(v.imagery) ? v.imagery.slice(0, 6) : [],
    avoid: Array.isArray(v.avoid) ? v.avoid.slice(0, 6) : [],
    voice: {
      register: voice.register || "",
      rhythm: voice.rhythm || "",
      forbidden: [...new Set([...(voice.forbidden || []), ...(voice.forbidden_words || [])].map(String).filter(Boolean))],
      signatures: Array.isArray(voice.signatures) ? voice.signatures.slice(0, 5) : [],
      examples: Array.isArray(voice.examples) ? voice.examples.slice(0, 4) : [],
    },
    refusals: (refusals || []).map((r) => (typeof r === "string" ? r : r?.text || r?.rule || "")).filter(Boolean).slice(0, 10),
    positioning: bio.identity?.positioning || "",
    language: brand.default_locale || bio.language || "en",
    references: refs,
    foundation_missing: [!logo && "logo", roles.guessed && "primary_colour_role", !fonts.display && "display_font", !refs.length && "reference_images"].filter(Boolean),
  };
}
