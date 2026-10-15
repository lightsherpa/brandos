// bio-focus.js — Increment 5 (Steward focus list).
//
// Pure, no I/O. Turns a BIO payload into a ranked "focus first" list for the
// human Steward: gaps (missing fields) first, then present-but-low-confidence
// fields ranked by importance × (1 − conf/100). High-confidence fields
// (conf ≥ DROP_CONF) are dropped — the Steward shouldn't spend attention there.
//
// FROZEN CONTRACT: export function computeFocus(payload = {}) -> FocusItem[]
//
// Reads the sibling-map confidence shape:
//   payload.confidence["<section>.<key>"] = { conf: 0..100, source }
//   values on  payload.<section>.<key>
//   gaps on    payload.missing = [{ field: "<dotted.path>", why }]
//
// FocusItem = { field, label, labelKey, status, importance, priority, conf, value, sourceKinds, whyKey, actionKey }

import { FIELD_LABELS_EN, canonicalFieldPath, fieldLabelEn } from "./field-labels.js";
import { normalizeSourceKinds } from "./source-kind.js";

// Importance keyed to downstream blast radius — how many specialists inherit
// the field. Anything not listed defaults to 0.3 (low impact).
const IMPORTANCE = {
  "identity.positioning": 1.0, "voice.forbidden": 1.0, "audience.primary": 1.0,
  "identity.category": 0.6, "identity.pillars": 0.6, "voice.register": 0.6,
  "audience.jtbd": 0.6, "goals.northStar": 0.6,
  "voice.signatures": 0.3, "audience.secondary": 0.3, "goals.q2": 0.3, "goals.q3": 0.3, "identity.founded": 0.3,
};

const LABELS = FIELD_LABELS_EN;

const DROP_CONF = 92;

const imp = (f) => IMPORTANCE[f] ?? 0.3;
const get = (p, path) => path.split(".").reduce((o, k) => o?.[k], p);

function whyKey(f) {
  return imp(f) >= 1.0 ? "provenance.whyHigh" : imp(f) >= 0.6 ? "provenance.whyMid" : "provenance.whyLow";
}

function actionKey(status, sourceKinds) {
  if (status === "missing") return "provenance.missingNotFound";
  if (sourceKinds.includes("guess")) return "provenance.guessCheck";
  return null;
}

export function computeFocus(payload = {}) {
  const conf = payload.confidence || {};
  const gaps = (Array.isArray(payload.missing) ? payload.missing : [])
    .map((g) => (typeof g === "string" ? g : g.field))
    .filter(Boolean);
  const items = [];
  const gapFields = [];

  // 1) Gaps bucket — missing fields always come first. Unknown paths are dropped.
  for (const raw of gaps) {
    const field = canonicalFieldPath(raw);
    const label = fieldLabelEn(raw, (name) => console.warn("Dropped unlabeled Brand Core field", name));
    if (!field || !label || gapFields.includes(field)) continue;
    gapFields.push(field);
    const key = actionKey("missing", []);
    items.push({
      field,
      label,
      labelKey: `discovery.field.${field}`,
      status: "missing",
      importance: imp(field),
      priority: imp(field),
      conf: null,
      value: null,
      source: null,
      sourceKinds: [],
      whyKey: whyKey(field),
      actionKey: key,
      why: key,
      action: key,
    });
  }

  // 2) Present-but-low-confidence fields, ranked by importance × (1 − conf/100).
  const gapSet = new Set(gapFields);
  for (const field of Object.keys(IMPORTANCE)) {
    if (gapSet.has(field)) continue;
    const c = conf[field]?.conf;
    if (typeof c !== "number" || c >= DROP_CONF) continue;
    const priority = imp(field) * (1 - c / 100);
    const sourceKinds = normalizeSourceKinds(conf[field]?.source_kind || conf[field]?.source);
    const key = actionKey("low_conf", sourceKinds);
    items.push({
      field,
      label: LABELS[field] || fieldLabelEn(field),
      labelKey: `discovery.field.${field}`,
      status: "low_conf",
      importance: imp(field),
      priority,
      conf: c,
      value: get(payload, field) ?? null,
      source: null,
      sourceKinds,
      whyKey: whyKey(field),
      actionKey: key,
      why: key,
      action: key,
    });
  }

  return items.sort((a, b) =>
    (a.status === "missing") !== (b.status === "missing")
      ? (a.status === "missing" ? -1 : 1)
      : b.priority - a.priority || b.importance - a.importance || a.field.localeCompare(b.field));
}
