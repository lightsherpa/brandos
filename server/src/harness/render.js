// Renderers are pipeline steps, not agents (CREWS §0.10).
// Email: MJML (format-preview templater) with Brand Core tokens + logo (S5).
// Social: live HTML/CSS composite: raw image + overlay line in the brand
// display font + logo + accent bar (S4-lite; PNG export is post-freeze).
import { embedExportAssets } from "./stable-export.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mjml2html from "mjml";
import { fillTemplate } from "../lib/format-preview/render.js";
import { contrastRatio, fontStack } from "./brand-core.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_TPL = fs.readFileSync(path.join(here, "../lib/format-preview/templates/email-task.mjml"), "utf8");

export function emailTokens(layer1) {
  const p = layer1.palette;
  const ctaText = contrastRatio("#ffffff", p.primary) >= contrastRatio("#111111", p.primary) ? "#ffffff" : "#111111";
  const ink = contrastRatio(p.ink, "#ffffff") >= 4.5 ? p.ink : "#111111";
  return {
    primary: p.primary, ink, surface: p.surface, muted: p.muted || "#6b6b6b", cta_text: ctaText,
    font_display: fontStack(layer1.fonts.display), font_body: fontStack(layer1.fonts.body),
    logo_url: layer1.logo?.url || "", no_logo: layer1.logo?.url ? "" : "1",
  };
}

export async function renderEmail({ email, layer1, heroUrl = null, language = "en", embedAssets = embedExportAssets }) {
  assertCompositionBrand(layer1);
  const tokens = emailTokens(layer1);
  const ctx = {
    language, tokens, email, brand_name: layer1.brand.name,
    hero: heroUrl ? { src: heroUrl, alt: email.hero_image_brief?.subject?.slice(0, 120) || email.headline } : {},
    footer: `${layer1.brand.name}${layer1.brand.url ? ` · ${layer1.brand.url}` : ""}`,
  };
  const src = fillTemplate(EMAIL_TPL, ctx);
  let html = "", errors = [];
  try {
    const out = await mjml2html(src, { validationLevel: "soft", minify: false });
    html = out.html; errors = out.errors || [];
  } catch (e) { errors = [e.message]; }
  const transport_html = html;
  const transport = { html_bytes: Buffer.byteLength(html, "utf8"), delivery_ready: false, requires_asset_hosting: /<img[^>]+src=["\']https?:/i.test(html), font_mode: "fallback_stack", purpose: "email_transport_draft" };
  const exported = layer1.logo?.sourceId || layer1.font_assets?.length ? await embedAssets(html, { layer1, imageUrl: heroUrl }) : { html, stable: false, assets: [] };
  return { ...exported, transport_html, transport, mjmlErrors: errors, tokens };
}

const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function assertCompositionBrand(layer1) {
  if (process.env.CREW_CANVAS !== "1" && process.env.CREW_CANVAS !== "true") return;
  const systemFonts = /^(Arial|Helvetica|Georgia|Times New Roman|Verdana|Tahoma|system-ui|sans-serif|serif)$/i;
  for (const role of ["display", "body"]) {
    const family = layer1.fonts?.[role];
    if (!family || (!systemFonts.test(family) && !(layer1.font_assets || []).some(f => f.family === family && f.rights_confirmed === true))) {
      throw new Error(`Certified ${role} font unavailable for composition`);
    }
  }
  if (!layer1.logo?.url) throw new Error("Certified logo unavailable for composition");
  for (const role of ["primary", "ink", "surface"]) if (!/^#[0-9a-f]{6}$/i.test(layer1.palette?.[role])) throw new Error("Certified brand colours unavailable for composition");
}

export function renderSocialComposite({ post, imageUrl, layer1, aspect = "4:5" }) {
  assertCompositionBrand(layer1);
  const [w, h] = aspect === "1:1" ? [1080, 1080] : aspect === "9:16" ? [1080, 1920] : [1080, 1350];
  const p = layer1.palette;
  const line = String(post.overlay_line || "").trim();
  const faces = (layer1.font_assets || []).filter(f => f.family === layer1.fonts.display);
  const face = faces.find(f => !f.style || f.style === "normal") || faces[0];
  const weight = face?.weight || "400";
  const fontStyle = face?.style === "italic" ? "italic" : "normal";
  const fontWeight = /^[1-9]00$/.test(String(weight)) ? weight : "400";
  const direction = layer1.language === "ar" ? "rtl" : "ltr";
  const logo = layer1.logo?.url ? `<img class="logo" src="${escHtml(layer1.logo.url)}" alt="${escHtml(layer1.brand.name)}">` : "";
  return `<!doctype html><html lang="${escHtml(layer1.language || "en")}" dir="${direction}"><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
.post{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${p.surface};font-family:${fontStack(layer1.fonts.display)}}
.post .img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.post .bar{position:absolute;left:0;right:0;bottom:0;height:8px;background:${p.primary}}
.post .line{position:absolute;left:4%;right:30%;bottom:6%;color:${p.ink};background:${p.surface};padding:24px;font-size:${line.length > 80 ? 44 : 64}px;line-height:1.05;font-weight:${fontWeight};font-style:${fontStyle};overflow-wrap:anywhere}
.post .logo{position:absolute;right:4%;bottom:4%;width:18%;height:auto}
</style></head><body><div class="post" data-width="${w}" data-height="${h}">
<img class="img" src="${escHtml(imageUrl)}" alt="${escHtml(post.image_brief?.subject || "")}">
${line ? `<div class="line">${escHtml(line)}</div>` : ""}${logo}<div class="bar"></div></div></body></html>`;
}

export async function renderStableSocial(args) {
 const html = renderSocialComposite(args);
 return args.layer1.logo?.sourceId || args.layer1.font_assets?.length ? embedExportAssets(html, { layer1: args.layer1, imageUrl: args.imageUrl }) : { html, stable: false, assets: [] };
}
