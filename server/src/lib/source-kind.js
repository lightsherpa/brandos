// Closed provenance for Brand Core. The compiler may only emit these kinds.
// Legacy free-text `source` values are mapped here at read time. Unknown → guess.
import { BIO_FIELDS } from "./bio-schema.js";

export const SOURCE_KINDS = ["website", "brand_deck", "your_answers", "social", "guess"];
export const APP_SOURCE_KINDS = [...SOURCE_KINDS, "cd_edit"];
export const SOURCE_PAGES = ["home", "about", "shop", "menu", "contact", "blog", "other"];
export const MISSING_REASONS = ["not_found", "unclear", "conflicting"];
export const KNOWN_FIELD_PATHS = BIO_FIELDS.map((field) => field.path.join("."));
const KNOWN = new Set(KNOWN_FIELD_PATHS);

const FILENAME = /\.(pdf|png|jpe?g|webp|gif|docx?|pptx?|key|pages|txt|csv|svg)\b/i;
const URLISH = /https?:\/\/|www\./i;
const PROVENANCE_META = /^(inferred|recorded|first[- ]party|source evidence|not stated|evidence)\b/i;

function textOf(raw) {
  return String(raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

/** One kind. Exact enums pass through. Anything else follows the legacy map, else guess. */
export function normalizeSourceKind(raw) {
  if (APP_SOURCE_KINDS.includes(raw)) return raw;
  const text = textOf(raw);
  if (!text) return "guess";
  const underscored = text.replace(/ /g, "_");
  if (APP_SOURCE_KINDS.includes(underscored)) return underscored;
  if (/steward\s*edit|\bcd edit\b|creative director/.test(text)) return "cd_edit";
  if (/manual|client stated|your answers|user answers/.test(text)) return "your_answers";
  if (/\binfer|\bguess\b|not stated|\bllm\b|\bmodel\b|\bframework\b/.test(text)) return "guess";
  if (FILENAME.test(text) || /\bpdf\b|\bdeck\b|\bupload\b|brand deck/.test(text)) return "brand_deck";
  if (/instagram|tiktok|\bsocial\b/.test(text)) return "social";
  if (URLISH.test(text) || /homepage|\bpage\b|\bwebsite\b/.test(text)) return "website";
  return "guess";
}

/** At most two kinds. A guess mixed with a real kind collapses to guess. */
export function normalizeSourceKinds(input) {
  const list = Array.isArray(input) ? input : input == null || input === "" ? [] : [input];
  const out = [];
  for (const item of list) {
    const kind = normalizeSourceKind(item);
    if (!out.includes(kind)) out.push(kind);
    if (out.length === 2) break;
  }
  if (!out.length) return ["guess"];
  if (out.includes("guess") && out.length > 1) return ["guess"];
  return out;
}

export function normalizeSourcePage(raw) {
  const text = textOf(raw);
  if (!text) return null;
  if (SOURCE_PAGES.includes(text)) return text;
  if (/^home/.test(text)) return "home";
  if (/about/.test(text)) return "about";
  if (/shop|store/.test(text)) return "shop";
  if (/menu/.test(text)) return "menu";
  if (/contact/.test(text)) return "contact";
  if (/blog|journal|news/.test(text)) return "blog";
  return "other";
}

export function normalizeMissingReason(raw) {
  const text = textOf(raw);
  if (MISSING_REASONS.includes(text)) return text;
  if (/conflict|disagree|contradict/.test(text)) return "conflicting";
  if (/unclear|ambiguous|vague/.test(text)) return "unclear";
  return "not_found";
}

function cleanRef(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || FILENAME.test(text) || URLISH.test(text) || text.includes(" ")) return null;
  if (text.length > 40) return null;
  return text;
}

/** Verbatim excerpt only. Provenance prose and filenames are not quotes. */
export function cleanQuote(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length > 160) return text.length > 160 ? text.slice(0, 160).trim() : null;
  if (PROVENANCE_META.test(text) || FILENAME.test(text) || URLISH.test(text)) return null;
  if (/inferred|first-party|recorded \/ inferred|source evidence/i.test(text)) return null;
  return text;
}

export function normalizeConfidenceEntry(entry) {
  if (entry == null || entry === "") return null;
  if (typeof entry === "string" || Array.isArray(entry)) {
    return { conf: null, source_kind: normalizeSourceKinds(entry), source_page: null, source_ref: null, quote: null, source: normalizeSourceKinds(entry)[0] };
  }
  const kinds = normalizeSourceKinds(entry.source_kind || entry.source || entry.kind);
  const conf = Number(entry.conf);
  const quote = cleanQuote(entry.quote);
  return {
    conf: Number.isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : null,
    source_kind: kinds,
    source_page: normalizeSourcePage(entry.source_page),
    source_ref: cleanRef(entry.source_ref),
    quote,
    source: kinds[0],
  };
}

/**
 * Confirmed: owner/CD confirmed, or conf ≥ 85 and not a guess.
 * Likely: 30–84 and not a guess.
 * Needs your input: missing, guess, or below 30.
 * `conf` stays on the record for gates. This band is display-only.
 */
export function certaintyBand({ conf, sourceKinds, missing, confirmedByOwner, confirmedByCd } = {}) {
  if (confirmedByOwner || confirmedByCd) return "confirmed";
  const kinds = sourceKinds?.length ? sourceKinds : [];
  if (missing || kinds.includes("guess")) return "needs_input";
  const score = Number(conf);
  if (!Number.isFinite(score) || score < 30) return "needs_input";
  if (score >= 85) return "confirmed";
  return "likely";
}

/** Drop unknown paths. Returns the kept rows and the paths that were rejected. */
export function normalizeMissingList(missing) {
  const rows = Array.isArray(missing) ? missing : [];
  const kept = [];
  const dropped = [];
  const seen = new Set();
  for (const row of rows) {
    const field = typeof row === "string" ? row : row?.field;
    if (!field || typeof field !== "string") continue;
    if (!KNOWN.has(field)) {
      dropped.push(field);
      continue;
    }
    if (seen.has(field)) continue;
    seen.add(field);
    kept.push({ field, reason: normalizeMissingReason(typeof row === "string" ? null : row.reason || row.why) });
  }
  return { kept, dropped };
}

/** Rewrite compiler provenance into the closed shape before it is stored. */
export function sanitizeCompiledProvenance(payload = {}) {
  const confidence = {};
  for (const [path, entry] of Object.entries(payload.confidence || {})) {
    if (!KNOWN.has(path)) continue;
    const next = normalizeConfidenceEntry(entry);
    if (next) confidence[path] = next;
  }
  const { kept, dropped } = normalizeMissingList(payload.missing);
  return {
    ...payload,
    confidence,
    missing: kept,
    droppedUnknownFields: dropped,
  };
}
