// Client-portal users only ever see credits: never internal API cost, model
// routes, vendor names or token counts. Platform-scope users (team / admin /
// super_admin) keep the full payload.
//
// Vendor *text* scrubbing for task items (error strings, attempt rows) lives in
// client-payload.js. This list is the superset dropped for any client payload
// that still carries cost, tokens or provider fields — including outputs.body
// JSON strings the browser can read. The SQL scrub in the client-safe runs
// migration must name the same keys.
export const INTERNAL_KEYS = new Set([
  "model", "models", "model_used", "fallback_from", "attempts", "route", "ledger", "cost",
  "provider", "provider_endpoint", "prompt_tokens", "completion_tokens", "cached_tokens", "cache_creation_tokens",
]);

export const isInternalViewer = (auth) => auth?.scope === "platform";

function dropInternal(value) {
  if (Array.isArray(value)) return value.map(dropInternal);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (INTERNAL_KEYS.has(k) || k.endsWith("_usd")) continue;
    // Task rows persist the body as a JSON string. Parse only that field so
    // ordinary copy is left untouched.
    if (k === "body" && typeof v === "string") {
      out[k] = redactBodyString(v);
      continue;
    }
    out[k] = dropInternal(v);
  }
  return out;
}

function redactBodyString(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return raw;
    return JSON.stringify(dropInternal(parsed));
  } catch {
    return raw;
  }
}

/** Deep copy without any internal cost / model / vendor keys (and any `*_usd`). */
export function redactForClient(value) {
  return dropInternal(value);
}

export const forViewer = (auth, value) => (isInternalViewer(auth) ? value : redactForClient(value));

// ponytail: regex table mirrors the client re-run tiers; add a row when a new route family ships.
const ROUTE_TIERS = [
  [/schnell/i, "imageDraft"], [/recraft/i, "illustration"], [/flux|gpt-image/i, "imagePremium"],
  [/opus/i, "premium"], [/haiku/i, "fast"], [/sonnet|gpt-5/i, "standard"],
  [/gemini.*pro/i, "longContext"], [/gemini.*flash/i, "economy"],
];
/** Opaque, user-facing tier for a model route (same names the re-run menu shows). */
export const routeTier = (route) => ROUTE_TIERS.find(([re]) => re.test(route || ""))?.[1] || null;
