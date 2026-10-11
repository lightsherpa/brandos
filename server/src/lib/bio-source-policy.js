// Which Discovery pages may be stored as bio_sources, and how evidence text
// is cut without slicing through a source URL.
//
// Brand-domain pages and user-provided links are kept. A link the user tagged
// as a competitor is kept and labeled so it never counts as brand evidence.
// Pages found by market search are not brand sources.

import { websiteHost } from "./brand-source-integrity.js";

export function sameBrandHost(brandUrl, sourceUrl) {
  const brand = websiteHost(brandUrl);
  const source = websiteHost(sourceUrl);
  if (!brand || !source) return false;
  return source === brand || source.endsWith(`.${brand}`);
}

/** Full public URL, or "" when the value is empty, invalid, or already cut off. */
export function canonicalSourceUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text || text.includes("…") || text.endsWith("...")) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname || !u.hostname.includes(".")) return "";
    u.hash = "";
    return u.href;
  } catch {
    return "";
  }
}

/**
 * @param {"crawl"|"user"|"market"} origin
 * @returns {null|{ kind:string, bucket:null, src:string, signals:object }}
 */
export function discoverySourceRow({ brandUrl, url, origin, purpose = "current", signals = {} }) {
  const src = canonicalSourceUrl(url);
  if (!src) return null;
  if (origin === "market") return null;
  const onBrand = sameBrandHost(brandUrl, src);
  if (origin === "crawl" && !onBrand) return null;
  if (origin !== "user" && origin !== "crawl") return null;
  const competitor = origin === "user" && purpose === "competitive";
  return {
    kind: "url_scrape",
    bucket: null,
    src,
    signals: {
      ...signals,
      purpose: purpose || "current",
      evidence: competitor ? "competitor" : "brand",
      counts_as_brand_evidence: !competitor,
    },
  };
}

export function isBrandEvidenceSource(row) {
  const signals = row?.signals || {};
  if (signals.counts_as_brand_evidence === false) return false;
  if (signals.evidence === "competitor" || signals.evidence === "market") return false;
  if (signals.purpose === "competitive") return false;
  return true;
}

/** Join source blocks up to `limit` without cutting a SOURCE url header. */
export function assembleSourceText(parts, limit = 48000) {
  const text = parts.filter((part) => typeof part === "string" && part.trim()).join("\n\n");
  if (text.length <= limit) return text;
  const chunks = text.split(/(?=\n## SOURCE)/);
  let used = 0;
  const kept = [];
  for (const chunk of chunks) {
    const piece = kept.length ? chunk.replace(/^\n/, "") : chunk;
    const separator = kept.length ? 1 : 0;
    const room = limit - used - separator;
    if (room <= 0) break;
    if (piece.length <= room) {
      kept.push(piece);
      used += separator + piece.length;
      continue;
    }
    const headerEnd = piece.indexOf("\n");
    const header = headerEnd === -1 ? piece : piece.slice(0, headerEnd);
    if (!header || header.length >= room) break;
    kept.push(`${header}\n${piece.slice(headerEnd + 1, headerEnd + 1 + (room - header.length - 1))}`);
    break;
  }
  return kept.join("\n");
}
