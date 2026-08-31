import test from "node:test";
import assert from "node:assert/strict";
import { calculateTokenCost, calculateUnitCost } from "./api-usage.js";

test("token cost separates uncached, cache-read, cache-write, and output tokens", () => {
  const rate = {
    input_per_million_usd: 3,
    output_per_million_usd: 15,
    cache_read_per_million_usd: 0.3,
    cache_write_per_million_usd: 3.75,
  };
  const cost = calculateTokenCost({
    prompt_tokens: 10_000,
    completion_tokens: 2_000,
    cached_tokens: 4_000,
    cache_creation_tokens: 1_000,
  }, rate);
  assert.equal(cost, 0.04995);
});

test("unit cost uses the rate card's named billing unit", () => {
  assert.equal(calculateUnitCost({ megapixel: 2 }, { unit_name: "megapixel", unit_cost_usd: 0.04 }), 0.08);
  assert.equal(calculateUnitCost({ image: 1 }, { unit_name: "megapixel", unit_cost_usd: 0.04 }), 0);
});
