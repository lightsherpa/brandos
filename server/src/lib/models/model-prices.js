// Published list prices for models the router can run when the database
// rate card has not caught up. A database card still wins when one exists.
// Anthropic cache read is the published cache-hit rate; cache write is 1.25× input.
// Sources: platform.claude.com pricing, 2026-10-07 list (see brandos model upgrade plan).

import { calculateTokenCost } from "../api-usage.js";

export const MODEL_PRICE_TABLE = {
  "claude-opus-4-7": { input_per_million_usd: 5, output_per_million_usd: 25, cache_read_per_million_usd: 0.5, cache_write_per_million_usd: 6.25 },
  "claude-opus-5-5": { input_per_million_usd: 4, output_per_million_usd: 20, cache_read_per_million_usd: 0.2, cache_write_per_million_usd: 5 },
  "claude-sonnet-4-6": { input_per_million_usd: 3, output_per_million_usd: 15, cache_read_per_million_usd: 0.3, cache_write_per_million_usd: 3.75 },
  "claude-sonnet-5-5": { input_per_million_usd: 2, output_per_million_usd: 10, cache_read_per_million_usd: 0.1, cache_write_per_million_usd: 2.5 },
  "claude-haiku-4-5-20251001": { input_per_million_usd: 1, output_per_million_usd: 5, cache_read_per_million_usd: 0.1, cache_write_per_million_usd: 1.25 },
  "claude-haiku-5-5": { input_per_million_usd: 0.1, output_per_million_usd: 0.5, cache_read_per_million_usd: 0.005, cache_write_per_million_usd: 0.125 },
  "google/gemini-3.8-flash": { input_per_million_usd: 0.75, output_per_million_usd: 3.75, cache_read_per_million_usd: 0, cache_write_per_million_usd: 0 },
  "google/gemini-2.5-flash": { input_per_million_usd: 0.15, output_per_million_usd: 0.6, cache_read_per_million_usd: 0, cache_write_per_million_usd: 0 },
  "google/gemini-2.5-pro": { input_per_million_usd: 1.25, output_per_million_usd: 10, cache_read_per_million_usd: 0, cache_write_per_million_usd: 0 },
};

export function priceForModel(model) {
  if (!model) return null;
  return MODEL_PRICE_TABLE[model] || MODEL_PRICE_TABLE[String(model).split("/").pop()] || null;
}

/* Provider-reported cost wins. Otherwise price the measured tokens from the
   database rate card, then the in-code price table. */
export function resolveCompletionCost(usage = {}, rateCard, model) {
  const reported = Number(usage?.cost_usd);
  if (Number.isFinite(reported)) {
    return { cost_usd: reported, cost_source: "provider_reported", rate: rateCard || null };
  }
  const rate = rateCard || priceForModel(model);
  const cost = calculateTokenCost(usage, rate);
  return {
    cost_usd: cost,
    cost_source: cost != null ? (rateCard ? "rate_card_estimate" : "price_table") : "unpriced",
    rate,
  };
}
