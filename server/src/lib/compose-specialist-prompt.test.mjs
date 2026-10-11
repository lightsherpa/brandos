// server/src/lib/compose-specialist-prompt.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeSpecialistPrompt } from "./compose-specialist-prompt.js";
// Dependency contract: the BIO layer is produced by the shared tiered
// reader. This test asserts the wiring, so getBioForAgent must exist —
// the integrator lands it in bio-schema.js (M4). Until then these tests
// fail at import/run, which is the intended signal.
import { getBioForAgent } from "./bio-schema.js";

const base = {
  spec: {
    specialist_id: "a16",
    payload: {
      name: "Social Captions",
      kind: "copy",
      bioSlices: ["positioning", "voice", "forbidden"],
    },
  },
  brand: { name: "Acme" },
  bio: {
    version: 1,
    identity: { positioning: "The bank that never raises its voice" },
    voice: { register: "plainspoken", forbidden: ["synergy", "leverage"] },
  },
  refusals: [],
  brief: "Five captions",
};

// helper: concatenate every content block's text
const allText = (blocks) => blocks.map((b) => b.text).join("\n\n");

test("a Spanish run is instructed to write in Spanish", () => {
  const text = allText(composeSpecialistPrompt({ ...base, outputLocale: "es" }));
  assert.match(text, /Write the deliverable in Spanish/);
});

test("the shared tiered reader is available (integrator dependency)", () => {
  assert.equal(typeof getBioForAgent, "function");
});

test("first block is the cached PLATFORM preamble and carries the anti-invention guardrail", () => {
  const blocks = composeSpecialistPrompt(base);
  assert.equal(blocks[0].type, "text");
  assert.deepEqual(blocks[0].cache_control, { type: "ephemeral" });
  // anti-invention guardrail phrasing
  assert.match(blocks[0].text, /never invent brand attributes/i);
  assert.match(blocks[0].text, /do not fabricate/i);
});

test("BIO block(s) carry the positioning and the forbidden words from the sample bio", () => {
  const blocks = composeSpecialistPrompt(base);
  const text = allText(blocks);
  assert.match(text, /never raises its voice/); // positioning
  assert.match(text, /synergy/);                // forbidden word
  assert.match(text, /leverage/);               // forbidden word
});

test("at least one BIO block carries cache_control:ephemeral (the reader's core block)", () => {
  const blocks = composeSpecialistPrompt(base);
  // blocks[0] is PLATFORM; the BIO block(s) follow it before SPEC/TASK.
  const cached = blocks.filter((b) => b.cache_control && b.cache_control.type === "ephemeral");
  assert.ok(cached.length >= 2, "expected PLATFORM + at least one cached BIO block");
});

test("every block matches the router content-block shape {type:'text', text}", () => {
  const blocks = composeSpecialistPrompt(base);
  for (const b of blocks) {
    assert.equal(b.type, "text");
    assert.equal(typeof b.text, "string");
  }
});

test("deliverableContract appends a final block containing the contract", () => {
  const without = composeSpecialistPrompt(base);
  const withContract = composeSpecialistPrompt({ ...base, deliverableContract: "RETURN-STRICT-JSON-XYZ" });
  assert.equal(withContract.length, without.length + 1);
  const last = withContract[withContract.length - 1];
  assert.equal(last.type, "text");
  assert.match(last.text, /RETURN-STRICT-JSON-XYZ/);
  assert.match(last.text, /OUTPUT FORMAT/);
});


test("renderer specialists receive real block schemas and JSON output precedence", () => {
  for (const [id, key] of [["a25", "landing"], ["a26", "email"], ["a27", "deck"]]) {
    const blocks = composeSpecialistPrompt({ spec: { specialist_id: id, payload: {} }, bio: {}, brief: "Demo" });
    const contract = blocks.find(block => block.text.includes("RENDERER BLOCK FORMAT"));
    assert.ok(contract, id);
    assert.ok(contract.text.includes(`blocks.${key}`), id);
    assert.ok(contract.text.includes("takes precedence"), id);
    const schema = JSON.parse(contract.text.slice(contract.text.indexOf('{')));
    assert.deepEqual(schema.properties.blocks.required, [key]);
    assert.ok(schema.properties.blocks.properties[key].required.length > 0);
    assert.deepEqual(schema.$defs.image.required, ["src", "alt"]);
  }
});
test("copy specialists retain their existing output format", () => {
  const blocks = composeSpecialistPrompt({ spec: { specialist_id: "a14", payload: {} }, bio: {}, brief: "Demo" });
  assert.equal(blocks.some(block => block.text.includes("RENDERER BLOCK FORMAT")), false);
});
