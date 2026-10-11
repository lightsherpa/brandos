import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeAnthropicUsage } from "./anthropic.js";
import { calculateTokenCost } from "../api-usage.js";
import { TEXT_TOKEN_FLOOR } from "./token-budget.js";
test("Anthropic input and cache counters normalize to total prompt tokens for cost accounting", () => {
  const usage = normalizeAnthropicUsage({ input_tokens: 200, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 100 }, "claude-sonnet-5-5");
  assert.equal(usage.prompt_tokens, 1300);
  assert.equal(usage.cached_tokens, 1000);
  assert.equal(usage.cache_creation_tokens, 100);
  assert.equal(calculateTokenCost(usage, { input_per_million_usd:2, output_per_million_usd:10, cache_read_per_million_usd:0.1, cache_write_per_million_usd:2.5 }), 0.00125);
});
test("the Anthropic adapter default is the text token floor", () => {
  const src = fs.readFileSync(new URL("./anthropic.js", import.meta.url), "utf8");
  assert.match(src, /maxTokens = TEXT_TOKEN_FLOOR/);
  assert.doesNotMatch(src, /maxTokens = 800/);
  assert.equal(TEXT_TOKEN_FLOOR, 2000);
});
test("missing Anthropic counters normalize to zero", () => {
  const usage = normalizeAnthropicUsage({}, "test");
  assert.equal(usage.prompt_tokens,0); assert.equal(usage.completion_tokens,0);
});
