import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBioVerification,
  buildVerificationClaims,
  normalizeBioEvidence,
  prepareClientBioEditPayload,
  prepareStewardBioPatchPayload,
} from "./bio-evidence.js";

test("normalizeBioEvidence marks empty high-impact fields as missing", () => {
  const payload = normalizeBioEvidence({
    identity: { positioning: "" },
    audience: { primary: "Busy founders" },
    confidence: { "audience.primary": { conf: 60, source: "homepage" } },
  });

  assert.equal(payload.fieldStatus["identity.positioning"], "missing");
  assert.equal(payload.fieldStatus["audience.primary"], "inferred");
  assert.ok(payload.missing.some((item) => item.field === "identity.positioning"));
});

test("applyBioVerification clears unsupported high-impact claims", () => {
  const payload = applyBioVerification({
    identity: { positioning: "The cheapest agency in Europe" },
    confidence: { "identity.positioning": { conf: 80, source: "homepage" } },
  }, {
    verdicts: [{
      field: "identity.positioning",
      status: "unsupported",
      confidence: 20,
      reason: "No pricing claim appears in the source material.",
    }],
  });

  assert.equal(payload.identity.positioning, null);
  assert.equal(payload.fieldStatus["identity.positioning"], "unsupported");
  assert.equal(payload.confidence["identity.positioning"].conf, 20);
  assert.ok(payload.missing.some((item) => item.field === "identity.positioning"));
});

test("buildVerificationClaims only includes populated high-impact fields", () => {
  const claims = buildVerificationClaims({
    identity: { positioning: "A membership coffee brand", category: "" },
    audience: { primary: "Urban subscribers" },
  });

  assert.deepEqual(claims.map((claim) => claim.field), ["identity.positioning", "audience.primary"]);
});

test("prepareClientBioEditPayload preserves provenance for unchanged fields", () => {
  const previous = {
    identity: { positioning: "Reputation OS for local businesses", category: "Local SEO" },
    audience: { primary: "Multi-location operators" },
    confidence: {
      "identity.positioning": { conf: 92, source: "homepage hero" },
      "identity.category": { conf: 88, source: "pricing page" },
      "audience.primary": { conf: 85, source: "brand deck" },
    },
    evidence: {
      "identity.positioning": "homepage hero",
    },
    fieldStatus: {
      "identity.positioning": "supported",
      "identity.category": "supported",
      "audience.primary": "supported",
    },
  };
  const edited = {
    ...previous,
    identity: { ...previous.identity, category: "Reputation management" },
    confidence: {
      "identity.positioning": { conf: 100, source: "forged source" },
      "identity.category": { conf: 100, source: "forged source" },
      "audience.primary": { conf: 100, source: "forged source" },
    },
  };

  const payload = prepareClientBioEditPayload(edited, previous);

  assert.deepEqual(payload.confidence["identity.positioning"], { conf: 92, source: "homepage hero" });
  assert.equal(payload.evidence["identity.positioning"], "homepage hero");
  assert.equal(payload.fieldStatus["identity.positioning"], "supported");
  assert.deepEqual(payload.confidence["audience.primary"], { conf: 85, source: "brand deck" });
  assert.deepEqual(payload.confidence["identity.category"], { conf: 80, source: "client-stated" });
  assert.equal(payload.fieldStatus["identity.category"], "client-stated");
});

test("prepareClientBioEditPayload does not trust forged confidence on new fields", () => {
  const payload = prepareClientBioEditPayload({
    identity: { positioning: "The category leader" },
    confidence: {
      "identity.positioning": { conf: 100, source: "homepage|deck|sales call|survey|analyst" },
    },
  }, {});

  assert.deepEqual(payload.confidence["identity.positioning"], { conf: 80, source: "client-stated" });
  assert.equal(payload.fieldStatus["identity.positioning"], "client-stated");
});

test("normalizeBioEvidence caps non-source-backed high-impact status confidence", () => {
  const payload = normalizeBioEvidence({
    identity: { positioning: "The category leader", category: "Local SEO" },
    confidence: {
      "identity.positioning": { conf: 98, source: "homepage" },
      "identity.category": { conf: 99, source: "client edit" },
    },
    fieldStatus: {
      "identity.positioning": "aspirational",
      "identity.category": "client-stated",
    },
  });

  assert.equal(payload.confidence["identity.positioning"].conf, 70);
  assert.equal(payload.confidence["identity.category"].conf, 80);
});

test("prepareStewardBioPatchPayload preserves unchanged provenance but downgrades edited claims", () => {
  const previous = {
    identity: { positioning: "Reputation OS for clinics", category: "Healthcare reputation" },
    confidence: {
      "identity.positioning": { conf: 92, source: "homepage" },
      "identity.category": { conf: 89, source: "services page" },
    },
    evidence: {
      "identity.positioning": "homepage",
      "identity.category": "services page",
    },
    fieldStatus: {
      "identity.positioning": "supported",
      "identity.category": "supported",
    },
  };

  const payload = prepareStewardBioPatchPayload(previous, {
    identity: { positioning: "The category leader for clinics" },
    confidence: {
      "identity.positioning": { conf: 100, source: "forged" },
    },
    fieldStatus: {
      "identity.category": "steward-certified",
      "identity.positioning": "steward-certified",
    },
  });

  assert.deepEqual(payload.confidence["identity.category"], { conf: 89, source: "services page" });
  assert.equal(payload.fieldStatus["identity.category"], "steward-certified");
  assert.deepEqual(payload.confidence["identity.positioning"], { conf: 70, source: "steward edit" });
  assert.equal(payload.evidence["identity.positioning"], "Steward edit");
  assert.equal(payload.fieldStatus["identity.positioning"], "inferred");
});
