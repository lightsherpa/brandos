// Assemble one message spec into the three demo formats plus brand-check
// badges. Deterministic. The optional compose step lives in the route and
// is limited to a single model call; this module never calls one.

import { applySharedHeadline, deriveMessageSpec } from "./derive.js";
import { renderFormats } from "./render.js";
import { brandCheckFormats } from "./brand-check.js";

export function shapeCertificationTrail({ bio, decisions = [], attestations = [] } = {}) {
  const events = [];
  for (const row of decisions) {
    if (!row) continue;
    events.push({
      id: row.id,
      at: row.created_at,
      kind: "steward",
      decision: row.decision,
      score: row.composite_score ?? null,
      band: row.band || null,
      actorRole: row.actor_role || null,
      narrative: row.narrative || row.reject_reason_code || "",
    });
  }
  for (const row of attestations) {
    if (!row) continue;
    events.push({
      id: row.id,
      at: row.created_at,
      kind: "self",
      decision: "self_certified",
      score: row.self_score ?? null,
      band: null,
      actorRole: "client",
      narrative: row.statement_version || "",
    });
  }
  events.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return {
    bio: {
      version: bio?.version ?? null,
      score: bio?.score ?? null,
      certified: !!bio?.certified,
      certifiedAt: bio?.certified_at || null,
      selfCertified: !!bio?.self_certified,
      selfCertifiedAt: bio?.self_certified_at || null,
    },
    events,
  };
}

export async function buildFormatPreview({ brief, brand, bio, bioVersion, outputs, headline } = {}) {
  const derived = deriveMessageSpec({ brief, brand, bio, bioVersion, outputs });
  const spec = headline ? applySharedHeadline(derived, headline) : derived;
  const rendered = await renderFormats(spec);
  const checks = brandCheckFormats(rendered, bio, spec.refusals);
  return {
    spec,
    emailHtml: rendered.emailHtml,
    landingHtml: rendered.landingHtml,
    deckHtml: rendered.deckHtml,
    checks,
    slides: spec.blocks.deck.slides.length,
    composed: false,
  };
}
