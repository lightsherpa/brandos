// Deterministic checks (HARNESS §4). Each returns { id, pass, severity, reason }.
import { contrastRatio } from "../brand-core.js";

export const result = (id, pass, reason, severity = "hard", target = "copy") => ({ id, pass: !!pass, severity, reason, target });

export const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Unicode-normalised, accent-folded, word-boundary banned-word scan.
    Plural -s/-es is caught (cliente → clientes); multi-word phrases work. */
export function findBanned(text, banned = []) {
  const hay = fold(text);
  return [...new Set(banned.map(String).filter(Boolean))].filter((word) => {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(fold(word))}(?:s|es)?($|[^\\p{L}\\p{N}])`, "u");
    return re.test(hay);
  });
}
export function bannedCheck(id, text, banned) {
  const hits = findBanned(text, banned);
  return result(id, hits.length === 0, hits.length ? `Banned word(s): ${hits.join(", ")}` : "No banned words");
}

export function isHttpsUrl(u) {
  try { const url = new URL(u); return url.protocol === "https:" && !!url.hostname; } catch { return false; }
}

export function htmlLinks(html) {
  return [...String(html || "").matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map((m) => m[1]);
}
export function htmlImages(html) {
  return [...String(html || "").matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const tag = m[0];
    return { src: (tag.match(/\bsrc="([^"]*)"/i) || [])[1] || "", alt: (tag.match(/\balt="([^"]*)"/i) || [null, null])[1] };
  });
}
export function linksCheck(html) {
  const bad = htmlLinks(html).filter((h) => !/^mailto:/i.test(h) && !isHttpsUrl(h));
  return result("LINKS", bad.length === 0, bad.length ? `Non-https/relative links: ${bad.slice(0, 3).join(", ")}` : "All links absolute https", "hard", "copy");
}
export function altCheck(html) {
  const bad = htmlImages(html).filter((i) => !i.alt || !i.alt.trim() || i.alt.length > 125);
  return result("ALT", bad.length === 0, bad.length ? `${bad.length} image(s) missing alt (or alt >125)` : "All images have alt", "hard", "none");
}
export function htmlSizeCheck(html, maxBytes = 80 * 1024) {
  const bytes = Buffer.byteLength(String(html || ""), "utf8");
  return { ...result("HTML_SIZE", bytes < maxBytes, `${(bytes / 1024).toFixed(1)} KB (limit ${maxBytes / 1024} KB)`, "hard", "none"), bytes };
}
export function contrastCheck(pairs = [], min = 4.5) {
  const fails = pairs.map(([fg, bg, label]) => ({ label, ratio: contrastRatio(fg, bg) })).filter((p) => p.ratio < min);
  return result("CONTRAST", fails.length === 0, fails.length ? fails.map((f) => `${f.label} ${f.ratio}:1`).join("; ") + ` (<${min}:1)` : `All text pairs ≥${min}:1`, "hard", "none");
}
export function aspectCheck(width, height, aspect, tolerance = 0.01) {
  if (!width || !height) return result("ASPECT", true, "Dimensions not reported; skipped", "soft", "image");
  const [w, h] = aspect.split(":").map(Number);
  const diff = Math.abs(width / height - w / h) / (w / h);
  return result("ASPECT", diff <= tolerance, `${width}×${height} vs ${aspect} (${(diff * 100).toFixed(1)}% off)`, "hard", "image");
}
export const wordCount = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
