import test from "node:test";
import assert from "node:assert/strict";

import { buildStewardCaseFile, buildStewardSuggestions, buildStewardCopilot } from "./steward-copilot.js";

const brand = { id: "brand-1", name: "Geoking", url: "https://geoking.com/", industry: "Local marketing" };
const job = { id: "job-1", status: "queued", kind: "drift_check" };
const previousBio = {
  id: "bio-1",
  version: 4,
  payload: {
    identity: { positioning: "Reputation OS for local businesses", category: "Local SEO" },
    audience: { primary: "Multi-location operators" },
  },
};
const bio = {
  id: "bio-2",
  version: 5,
  score: 69,
  certified: false,
  self_certified: true,
  payload: {
    identity: { positioning: "Reputation OS for local businesses", category: "Online reputation management" },
    audience: { primary: "Multi-location operators" },
    goals: { northStar: "Become the default growth platform" },
    confidence: {
      "identity.positioning": { conf: 92, source: "homepage hero" },
      "identity.category": { conf: 80, source: "client-stated" },
      "audience.primary": { conf: 86, source: "brand deck" },
      "goals.northStar": { conf: 62, source: "inferred from client notes" },
    },
    evidence: {
      "identity.positioning": "homepage hero",
      "audience.primary": "brand deck",
    },
    fieldStatus: {
      "identity.positioning": "source-backed",
      "identity.category": "client-stated",
      "audience.primary": "supported",
      "goals.northStar": "inferred",
    },
  },
};

test("buildStewardCaseFile groups claims and reports changes since prior BIO", () => {
  const caseFile = buildStewardCaseFile({
    job,
    bio,
    brand,
    previousBio,
    sources: [{ id: "src-1", kind: "url", bucket: "foundations", src: "https://geoking.com/", evidence_url: "https://geoking.com/" }],
  });

  assert.equal(caseFile.brand.name, "Geoking");
  assert.equal(caseFile.bio.version, 5);
  assert.ok(caseFile.changes.some((change) => change.field === "identity.category"));
  assert.ok(caseFile.claims.sourceBacked.some((claim) => claim.field === "identity.positioning"));
  assert.ok(caseFile.claims.sourceBacked.some((claim) => claim.field === "audience.primary"));
  assert.ok(caseFile.claims.clientStated.some((claim) => claim.field === "identity.category"));
  assert.ok(caseFile.claims.inferred.some((claim) => claim.field === "goals.northStar"));
  assert.equal(caseFile.sourceSummary.count, 1);
  assert.equal(caseFile.sourceSummary.diversity, 4);
});

test("buildStewardCaseFile recommends return_changes when high-impact gaps remain", () => {
  const caseFile = buildStewardCaseFile({ job, bio, brand, previousBio });

  assert.equal(caseFile.readiness.level, "usable-for-briefing");
  assert.equal(Object.hasOwn(caseFile, "certificationRecommendation"), false);
  assert.ok(caseFile.risks.some((risk) => risk.field === "voice.forbidden"));
});

test("buildStewardSuggestions creates actionable cards for missing, client-stated, inferred, and source-backed fields", () => {
  const caseFile = buildStewardCaseFile({ job, bio, brand, previousBio });
  const { suggestions } = buildStewardSuggestions({ caseFile });

  assert.ok(suggestions.some((suggestion) => suggestion.id === "ask.voice.forbidden"));
  assert.ok(suggestions.some((suggestion) => suggestion.id === "review.identity.category"));
  assert.ok(suggestions.some((suggestion) => suggestion.id === "confirm.goals.northStar"));
  assert.ok(suggestions.some((suggestion) => suggestion.id === "certify.identity.positioning"));
});

test("buildStewardCopilot returns case file and suggestions deterministically", () => {
  const a = buildStewardCopilot({ job, bio, brand, previousBio });
  const b = buildStewardCopilot({ job, bio, brand, previousBio });

  assert.deepEqual(a, b);
});

test("buildStewardSuggestions does not certify conflicted source-backed fields", () => {
  const conflictedBio = {
    ...bio,
    payload: {
      ...bio.payload,
      conflicts: [{ field_path: "identity.positioning", values: [] }],
    },
  };
  const caseFile = buildStewardCaseFile({ job, bio: conflictedBio, brand, previousBio });
  const { suggestions } = buildStewardSuggestions({ caseFile });

  assert.ok(caseFile.claims.conflicting.some((claim) => claim.field === "identity.positioning"));
  assert.equal(suggestions.some((suggestion) => suggestion.id === "certify.identity.positioning"), false);
});

test("buildStewardCaseFile downgrades expired certified BIO readiness", () => {
  const expiredBio = {
    ...bio,
    certified: true,
    self_certified: true,
    cert_valid_until: "2020-01-01T00:00:00.000Z",
  };
  const caseFile = buildStewardCaseFile({ job, bio: expiredBio, brand, previousBio });

  assert.notEqual(caseFile.readiness.level, "production-certified");
  assert.ok(caseFile.readiness.reasons.some((reason) => /expired/i.test(reason)));
});
