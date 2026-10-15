import { certaintyBand, normalizeSourceKind, normalizeSourceKinds } from "../../server/src/lib/source-kind.js";
import { FIELD_LABELS_EN, canonicalFieldPath } from "../../server/src/lib/field-labels.js";

function translated(t, key, vars) {
  if (!t || !key) return "";
  const value = t(key, vars);
  return value && value !== key ? value : "";
}

/** One provenance line. Two kinds join. Three or more use the single “several sources” line. */
export function sourceLine(kinds, t) {
  const raw = Array.isArray(kinds) ? kinds.filter(Boolean) : kinds ? [kinds] : [];
  const list = normalizeSourceKinds(raw.length ? raw : ["guess"]);
  if (list.includes("cd_edit")) return translated(t, "provenance.cd_edit");
  if (list.includes("guess") || !list.length) return translated(t, "provenance.guessCheck") || translated(t, "provenance.guess");
  const distinct = [...new Set(raw.map((item) => normalizeSourceKind(item)))].filter((kind) => kind && kind !== "guess" && kind !== "cd_edit");
  if (distinct.length >= 3) return translated(t, "provenance.joinMany");
  if (list.length === 1) return translated(t, `provenance.${list[0]}`);
  const noun = (kind) => translated(t, `provenance.noun.${kind}`);
  const a = noun(list[0]);
  const b = noun(list[1]);
  if (!a || !b) return translated(t, `provenance.${list[0]}`);
  return translated(t, "provenance.joinTwo", { a, b }) || translated(t, `provenance.${list[0]}`);
}

export function certaintyWord(input, t) {
  const band = typeof input === "string" ? input : certaintyBand(input);
  const key = band === "confirmed" ? "provenance.confirmed" : band === "likely" ? "provenance.likely" : "provenance.needsInput";
  return translated(t, key);
}

/** Human label, or null so the caller can hide an unlabeled path. */
export function humanFieldLabel(path, t) {
  const canonical = canonicalFieldPath(path);
  if (!canonical) return null;
  return translated(t, `discovery.field.${canonical}`) || FIELD_LABELS_EN[canonical] || null;
}

export function missingReasonLine(reason, t) {
  const key = reason === "unclear" ? "provenance.missingUnclear" : reason === "conflicting" ? "provenance.missingConflict" : "provenance.missingNotFound";
  return translated(t, key);
}

/** Show a quote only when it is a real excerpt and not the provenance line. */
export function distinctQuote(quote, label) {
  if (typeof quote !== "string") return "";
  const text = quote.trim();
  if (!text || text === label) return "";
  return text;
}
