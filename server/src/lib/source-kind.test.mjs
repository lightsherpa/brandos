import test from "node:test";
import assert from "node:assert/strict";
import {
  certaintyBand, cleanQuote, normalizeConfidenceEntry, normalizeMissingList, normalizeSourceKind, normalizeSourceKinds, sanitizeCompiledProvenance,
} from "./source-kind.js";
import { fieldLabelEn } from "./field-labels.js";

test("legacy provenance maps onto the closed kind list and unknown becomes guess", () => {
  assert.equal(normalizeSourceKind("website"), "website");
  assert.equal(normalizeSourceKind("manual entry"), "your_answers");
  assert.equal(normalizeSourceKind("client-stated"), "your_answers");
  assert.equal(normalizeSourceKind("steward edit"), "cd_edit");
  assert.equal(normalizeSourceKind("uploaded brand-deck.pdf"), "brand_deck");
  assert.equal(normalizeSourceKind("homepage hero + about"), "website");
  assert.equal(normalizeSourceKind("instagram bio"), "social");
  assert.equal(normalizeSourceKind("inferred — not stated"), "guess");
  assert.equal(normalizeSourceKind("LLM inferred https://brand.test/about"), "guess");
  assert.equal(normalizeSourceKind("something else entirely"), "guess");
});

test("a guess mixed with another kind stays a guess, and kinds cap at two", () => {
  assert.deepEqual(normalizeSourceKinds(["website", "guess"]), ["guess"]);
  assert.deepEqual(normalizeSourceKinds(["website", "brand_deck", "social"]), ["website", "brand_deck"]);
});

test("confidence entries drop filenames, urls and provenance prose from the quote", () => {
  const entry = normalizeConfidenceEntry({
    conf: 88,
    source: "homepage hero",
    source_ref: "brand-deck.pdf",
    quote: "inferred — not stated",
  });
  assert.equal(entry.source, "website");
  assert.deepEqual(entry.source_kind, ["website"]);
  assert.equal(entry.source_ref, null);
  assert.equal(entry.quote, null);
  assert.equal(cleanQuote("A line the site actually says."), "A line the site actually says.");
});

test("missing rows keep only the 31 known paths and a reason code", () => {
  const { kept, dropped } = normalizeMissingList([
    { field: "goals.q3", why: "no roadmap surfaced" },
    { field: "target_audience", why: "model name" },
    { field: "voice.rhythm", reason: "conflicting" },
  ]);
  assert.deepEqual(kept, [
    { field: "goals.q3", reason: "not_found" },
    { field: "voice.rhythm", reason: "conflicting" },
  ]);
  assert.deepEqual(dropped, ["target_audience"]);
});

test("certainty band keeps the numeric score internal", () => {
  assert.equal(certaintyBand({ conf: 90, sourceKinds: ["website"] }), "confirmed");
  assert.equal(certaintyBand({ conf: 99, sourceKinds: ["guess"] }), "needs_input");
  assert.equal(certaintyBand({ conf: 40, sourceKinds: ["brand_deck"] }), "likely");
  assert.equal(certaintyBand({ conf: 10, sourceKinds: ["website"] }), "needs_input");
  assert.equal(certaintyBand({ conf: 20, sourceKinds: ["guess"], confirmedByCd: true }), "confirmed");
  assert.equal(certaintyBand({ missing: true, conf: 100, sourceKinds: ["website"] }), "needs_input");
});

test("sanitize stores kinds only and field labels never fall back to a raw path", () => {
  const next = sanitizeCompiledProvenance({
    confidence: {
      "identity.positioning": { conf: 91, source: "about page" },
      "not.a.field": { conf: 10, source: "inferred" },
    },
    missing: [{ field: "goals.q3", why: "unclear priority" }],
  });
  assert.deepEqual(next.confidence["identity.positioning"].source_kind, ["website"]);
  assert.equal(next.confidence["not.a.field"], undefined);
  assert.equal(next.missing[0].reason, "unclear");
  assert.equal(fieldLabelEn("identity.positioning"), "What makes you different");
  assert.equal(fieldLabelEn("tone_attributes"), "How you sound");
  assert.equal(fieldLabelEn("target_audience"), "Main customers");
  const dropped = [];
  assert.equal(fieldLabelEn("made_up_field", (name) => dropped.push(name)), null);
  assert.deepEqual(dropped, ["made_up_field"]);
});
