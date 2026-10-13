// Deterministic checks (HARNESS §4). Each returns { id, pass, severity, reason }.
import { contrastRatio } from "../brand-core.js";

export const result = (id, pass, reason, severity = "hard", target = "copy") => ({ id, pass: !!pass, severity, reason, target });

export const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* Light es/en stemmer (Snowball-style single suffix strip). Longest suffix
   first; a suffix is only stripped if the stem left is ≥5 chars, so short
   words (lujo, cafe) are only matched exactly or with a plural -s/-es. */
const SUFFIXES = ["amientos", "amiento", "aciones", "amente", "idades", "ciones", "acion", "mente", "idad", "cion", "ismos", "istas", "ismo", "ista", "elas", "ela", "ness", "ings", "ing", "ers", "er", "ed", "ly", "es", "as", "os", "s", "a", "o", "e"];
export const MIN_STEM = 5;
export function stem(word) {
  const w = fold(word);
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= MIN_STEM) return w.slice(0, -suf.length);
  }
  return w;
}
const tokenize = (text) => fold(text).match(/[\p{L}\p{N}]+/gu) || [];
function tokenMatches(token, bannedWord) {
  const b = fold(bannedWord);
  if (b.length < MIN_STEM) {
    // short word: exact, or plural -s/-es
    return token === b || token === `${b}s` || token === `${b}es`;
  }
  return token === b || stem(token) === stem(b);
}

/** Unicode-normalised, accent-folded, whole-word banned-word scan with
    gender/number/derivation variants (exclusivo/a/os/as, cliente/s/clientela).
    Multi-word phrases match as consecutive tokens. */
export function findBanned(text, banned = []) {
  const tokens = tokenize(text);
  return [...new Set(banned.map(String).filter(Boolean))].filter((phrase) => {
    const words = tokenize(phrase);
    if (!words.length) return false;
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (words.every((w, j) => tokenMatches(tokens[i + j], w))) return true;
    }
    return false;
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
