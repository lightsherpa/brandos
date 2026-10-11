import test from "node:test";
import assert from "node:assert/strict";
import { calculateTokenCost, calculateUnitCost } from "./api-usage.js";
import { resolveCompletionCost } from "./models/model-prices.js";

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

test("a sonnet 5.5 run is priced from the model table when no rate card matches", () => {
  const priced = resolveCompletionCost({
    prompt_tokens: 1_000_000,
    completion_tokens: 500_000,
    cached_tokens: 0,
    cache_creation_tokens: 0,
  }, null, "claude-sonnet-5-5");
  assert.equal(priced.cost_usd, 7);
  assert.equal(priced.cost_source, "price_table");
});

test("cache reads on sonnet 5.5 use the published cache-hit rate", () => {
  const priced = resolveCompletionCost({
    prompt_tokens: 1_000_000,
    completion_tokens: 0,
    cached_tokens: 1_000_000,
  }, null, "claude-sonnet-5-5");
  assert.equal(priced.cost_usd, 0.1);
});

test("a database rate card still overrides the price table", () => {
  const priced = resolveCompletionCost(
    { prompt_tokens: 1_000_000, completion_tokens: 0 },
    { id: "card", input_per_million_usd: 9, output_per_million_usd: 9, cache_read_per_million_usd: 0, cache_write_per_million_usd: 0 },
    "claude-sonnet-5-5",
  );
  assert.equal(priced.cost_usd, 9);
  assert.equal(priced.cost_source, "rate_card_estimate");
});

test("unit cost uses the rate card's named billing unit", () => {
  assert.equal(calculateUnitCost({ megapixel: 2 }, { unit_name: "megapixel", unit_cost_usd: 0.04 }), 0.08);
  assert.equal(calculateUnitCost({ image: 1 }, { unit_name: "megapixel", unit_cost_usd: 0.04 }), 0);
});
