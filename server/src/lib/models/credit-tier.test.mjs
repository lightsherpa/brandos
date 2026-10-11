import test from "node:test";
import assert from "node:assert/strict";
import { routeCreditMultiplier } from "./router.js";

test("every Gemini Flash / Flash-Lite route is 0.75x", () => {
  for (const r of ["openrouter/google/gemini-3.5-flash-lite", "openrouter/google/gemini-3.6-flash", "openrouter/google/gemini-3.8-flash", "openrouter/google/gemini-2.5-flash"]) {
    assert.equal(routeCreditMultiplier(r), 0.75, r);
  }
});
test("Gemini Pro is not discounted", () => {
  assert.equal(routeCreditMultiplier("openrouter/google/gemini-2.5-pro"), 2);
  assert.notEqual(routeCreditMultiplier("openrouter/google/gemini-3.6-pro"), 0.75);
});
test("other tiers unchanged", () => {
  assert.equal(routeCreditMultiplier("anthropic/claude-opus-5"), 2);
  assert.equal(routeCreditMultiplier("anthropic/claude-haiku-5-5"), 0.75);
  assert.equal(routeCreditMultiplier("anthropic/claude-sonnet-4-6"), 1);
  assert.equal(routeCreditMultiplier("vendor/fal/flux-schnell"), 0.75);
  assert.equal(routeCreditMultiplier("vendor/exa/search"), 1);
});
