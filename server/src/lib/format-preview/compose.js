// One optional model call to tighten the message spec. Not a roster agent.
// Brand tokens and image slots are put back from the deterministic spec so
// the model cannot invent a palette or a sample-brand photograph.
// A caller-supplied headline is applied after this and wins.

import { isRouteAvailable, streamCompletion } from "../models/router.js";
import { validateMessageSpec } from "./render.js";

const COMPOSE_ROUTE = "openrouter/google/gemini-2.5-flash";

const COMPOSE_SPEC = {
  payload: {
    name: "Format preview message spec",
    modelRouting: {
      primary: COMPOSE_ROUTE,
      reason: "one structured pass over an existing brief; same cheap route as voice QA",
    },
    cr_estimate: 2,
  },
};

const SYSTEM = `You tighten ONE BrandOS message spec. Output a single JSON object and nothing else.
Use only the audience, messages, proof, CTA, and brief text already in the draft. Never invent facts, prices, dates, stats, quotes, or places.
Respect voice.register, forbidden words, and refusals. No fake urgency.
Keep language. Respect max lengths: smp 160, email subject 60, preheader 100, headline 70, body 600, landing subhead 200, feature title 40, feature text 160, proof quote 220, cta label 28, deck titles 80, deck points 120.
Exactly 3 messages or fewer, exactly 3 landing features, exactly 3 deck slides in order title, points, closing.
Do not change brand.tokens, brand.name, or any image.src. If a required fact is missing, keep the draft's wording for that field.`;

function parseJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch { return null; }
}

function mergeSpec(base, drafted) {
  if (!drafted || typeof drafted !== "object") return null;
  const next = {
    ...base,
    ...drafted,
    message_spec_id: base.message_spec_id,
    brief_id: base.brief_id,
    bio_version: base.bio_version,
    brand: base.brand,
    language: base.language,
  };
  next.blocks = drafted.blocks && typeof drafted.blocks === "object" ? drafted.blocks : base.blocks;
  if (next.blocks?.email) next.blocks.email.image = base.blocks.email.image;
  if (next.blocks?.landing?.hero) next.blocks.landing.hero.image = base.blocks.landing.hero.image;
  const baseTitle = base.blocks.deck.slides.find((slide) => slide.layout === "title");
  const nextTitle = next.blocks?.deck?.slides?.find((slide) => slide.layout === "title");
  if (baseTitle && nextTitle) nextTitle.image = baseTitle.image;
  if (next.blocks?.deck?.slides?.length !== 3) next.blocks.deck = base.blocks.deck;
  return validateMessageSpec(next).ok ? next : null;
}

export async function composeMessageSpec({ spec, telemetry = {} } = {}) {
  if (!isRouteAvailable(COMPOSE_ROUTE)) return { spec, composed: false, reason: "provider_unavailable" };
  let text = "";
  try {
    for await (const ev of streamCompletion({
      spec: COMPOSE_SPEC,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(spec) }],
      maxTokens: 1800,
      telemetry: { operationKey: "format-preview.compose", feature: "format-preview.compose", ...telemetry },
    })) {
      if (ev.type === "token") text += ev.text;
      else if (ev.type === "error") return { spec, composed: false, reason: "provider_error" };
    }
  } catch {
    return { spec, composed: false, reason: "provider_error" };
  }
  const merged = mergeSpec(spec, parseJson(text));
  if (!merged) return { spec, composed: false, reason: "invalid_json" };
  return { spec: merged, composed: true };
}
