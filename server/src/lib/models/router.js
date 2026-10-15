// ─────────────────────────────────────────────────────────────────────
// Model router — single entry point for every text completion.
//
// Reads spec.payload.modelRouting.primary (a vendor-prefixed model id)
// and dispatches to the right adapter. Spec-driven routing means
// flipping a specialist from Sonnet → GPT-5 is a single SQL update
// to specs.payload — no code change anywhere downstream.
//
// Routing convention (matches scripts/seed-specs.mjs MODEL_MAP):
//   anthropic/<model>    → direct Anthropic SDK, preserves cache_control
//   openrouter/<model>   → OpenRouter HTTP, normalized SSE
//   vendor/<short_key>   → non-text vendors (image/web/deck/search/audio);
//                           text router rejects, image/web routers handle in later phases.
//
// All adapters yield the same normalized event shape so SSE forwarding
// in routes/ doesn't need vendor-aware code:
//   { type: "token", text }
//   { type: "done",  stopReason, usage:{prompt_tokens, completion_tokens, cached_tokens, cache_creation_tokens, provider, model, cost_usd?} }
//   { type: "error", message }
// ─────────────────────────────────────────────────────────────────────

import * as anthropic from "./anthropic.js";
import * as openrouter from "./openrouter.js";
import { createCompletionStreamer } from "./fallback.js";
export { FIRST_TOKEN_TIMEOUT_MS, isRetryableError } from "./fallback.js";
import {
  calculateTokenCost,
  completionTelemetryEvent,
  findEffectiveRateCard,
  preflightApiUsage,
  recordApiUsage,
} from "../api-usage.js";
import { resolveTextTokenBudget } from "./token-budget.js";
import { resolveCompletionCost } from "./model-prices.js";

/* Browser-requested overrides are deliberately finite. Specs may still use
   other routes as their server-authored primary, but clients cannot turn the
   platform key into an arbitrary OpenRouter proxy. */
export const ALLOWED_MODEL_OVERRIDES = new Set([
  "anthropic/claude-opus-4-7",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5-20251001",
  // Hero crew upgrade (2026-10-11)
  "anthropic/claude-sonnet-5-5",
  "anthropic/claude-haiku-5-5",
  "openrouter/google/gemini-3.8-flash",
  "openrouter/google/gemini-2.5-pro",
  "openrouter/google/gemini-2.5-flash",
]);

export function isAllowedModelOverride(route) {
  return typeof route === "string" && ALLOWED_MODEL_OVERRIDES.has(route);
}

/* Credit multipliers reflect relative provider cost classes. They are kept
   server-side and applied to the specialist's base credit estimate. */
export function routeCreditMultiplier(route) {
  if (/opus|gemini-2\.5-pro|flux-1\.1-pro|recraft-v3/i.test(route || "")) return 2;
  if (/haiku|gemini-[\d.]+-flash|flux-schnell/i.test(route || "")) return 0.75;   // all Gemini Flash / Flash-Lite (approved by Oscar 2026-10-11)
  return 1;
}

/**
 * Stream a text completion through the right vendor.
 *
 * @param {object} params
 * @param {object} params.spec           - DB row from `specs` table; reads spec.payload.modelRouting.primary
 *                                          (e.g. "anthropic/claude-sonnet-4-6", "openrouter/openai/gpt-5").
 *                                          For the L1 Brandolph caller (no DB spec), pass a synthetic
 *                                          object: { payload: { modelRouting: { primary: "anthropic/claude-sonnet-4-6" } } }.
 * @param {Array|string} params.system   - System prompt (array form preserves cache_control for Anthropic).
 * @param {Array} params.messages        - [{ role, content }, ...]
 * @param {number} [params.maxTokens]    - explicit output budget. Omit it for specialist
 *                                          text so resolveTextTokenBudget can apply the
 *                                          ~2000 floor, the spec's max_output_tokens, and
 *                                          the cap. The 16-token provider floor always holds.
 * @yields {object} normalized event
 */
export const streamCompletion = createCompletionStreamer(streamRoute);

async function* streamRoute({ route, spec, system, messages, maxTokens, telemetry = {}, signal }) {
  if (typeof route !== "string" || !route.includes("/")) {
    yield { type: "error", message: `Invalid model route: ${JSON.stringify(route)}. Expected "anthropic/<model>" or "openrouter/<model>".` };
    return;
  }

  signal?.throwIfAborted();
  const budget = resolveTextTokenBudget({ maxTokens, spec });

  let provider;
  let model;
  let adapter;
  if (route.startsWith("anthropic/")) {
    provider = "anthropic";
    model = route.slice("anthropic/".length);
    adapter = anthropic.streamCompletion;
  } else if (route.startsWith("openrouter/")) {
    provider = "openrouter";
    model = route.slice("openrouter/".length);
    adapter = openrouter.streamCompletion;
  }

  if (adapter) {
    const rate = await findEffectiveRateCard({ provider, service: "messages", model, operation: "completion" });
    const promptChars = JSON.stringify({ system, messages }).length;
    const estimatedPromptTokens = Math.ceil(promptChars / 4);
    const preflightMaxCostUsd = calculateTokenCost({
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: budget,
      cached_tokens: 0,
      cache_creation_tokens: 0,
    }, rate);
    const operationKey = telemetry.operationKey || "specialist.text";
    const preflight = await preflightApiUsage({
      operationKey,
      estimatedMaxCostUsd: preflightMaxCostUsd,
      override: !!telemetry.breakerOverride,
    });
    const started = Date.now();
    const usageTelemetry = {
      ...telemetry, operationKey, preflightMaxCostUsd,
      metadata: { ...telemetry.metadata, ...(telemetry.fallbackFrom ? { fallback_from: telemetry.fallbackFrom } : {}) },
    };
    if (!preflight.allowed) {
      await recordApiUsage(completionTelemetryEvent({
        telemetry: usageTelemetry,
        usage: {}, provider, model, status: "blocked", latencyMs: 0, rate, preflight,
        errorCode: preflight.code,
      }));
      yield { type: "error", message: "API request blocked by cost guardrail", code: preflight.code };
      return;
    }

    signal?.throwIfAborted();
    let recorded = false;
    for await (const event of adapter({ model, system, messages, maxTokens: budget, signal })) {
      if (event.type === "done") {
        const priced = resolveCompletionCost(event.usage || {}, rate, event.usage?.model || model);
        event.usage = {
          ...(event.usage || {}),
          ...(telemetry.fallbackFrom ? { fallback_from: telemetry.fallbackFrom } : {}),
          cost_usd: priced.cost_usd,
          cost_source: priced.cost_source,
          rate_card_id: rate?.id || null,
        };
        await recordApiUsage(completionTelemetryEvent({
          telemetry: usageTelemetry,
          usage: event.usage,
          provider,
          model,
          status: "succeeded",
          latencyMs: Date.now() - started,
          rate,
          preflight,
        }));
        recorded = true;
      } else if (event.type === "error") {
        await recordApiUsage(completionTelemetryEvent({
          telemetry: usageTelemetry,
          usage: {}, provider, model, status: "failed", latencyMs: Date.now() - started,
          rate, preflight, errorCode: "PROVIDER_ERROR",
        }));
        recorded = true;
      }
      yield event;
    }
    if (!recorded) {
      await recordApiUsage(completionTelemetryEvent({
        telemetry: usageTelemetry,
        usage: {}, provider, model, status: "failed", latencyMs: Date.now() - started,
        rate, preflight, errorCode: "STREAM_INCOMPLETE",
      }));
    }
    return;
  }

  if (route.startsWith("vendor/")) {
    yield { type: "error", message: `Non-text vendor route "${route}" — use image/web/search modules, not the text router.` };
    return;
  }

  yield { type: "error", message: `Unknown route prefix: ${route}` };
}

/**
 * Synthetic spec for the L1 Brandolph caller (no DB row yet).
 * Brandolph routes on Sonnet per apis-and-agents-plan.md §4.1.
 * Used by routes/brandolph.js until P1 wires real spec loading.
 */
export const BRANDOLPH_SYNTHETIC_SPEC = {
  payload: {
    name: "Brandolph",
    modelRouting: { primary: "anthropic/claude-sonnet-4-6", fallback: null, reason: "L1 orchestrator (synthetic spec)" },
    cr_estimate: 8,
  },
};

/**
 * Inspect whether a route is currently available (key present).
 * Useful for /health checks and pre-flight validation in routes/.
 */
export function isRouteAvailable(route) {
  if (typeof route !== "string") return false;
  if (route.startsWith("anthropic/")) return anthropic.hasKey();
  if (route.startsWith("openrouter/")) return openrouter.hasKey();
  return false;
}
