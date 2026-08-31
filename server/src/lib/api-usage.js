import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase.js";

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value) => Math.round(n(value) * 100_000_000) / 100_000_000;

export function calculateTokenCost(usage, rate) {
  if (!rate) return null;
  const input = n(usage.prompt_tokens ?? usage.input_tokens);
  const output = n(usage.completion_tokens ?? usage.output_tokens);
  const cacheRead = n(usage.cached_tokens ?? usage.cache_read_tokens);
  const cacheWrite = n(usage.cache_creation_tokens ?? usage.cache_write_tokens);
  const uncachedInput = Math.max(0, input - cacheRead - cacheWrite);
  const result = (
    uncachedInput * n(rate.input_per_million_usd)
    + output * n(rate.output_per_million_usd)
    + cacheRead * n(rate.cache_read_per_million_usd)
    + cacheWrite * n(rate.cache_write_per_million_usd)
  ) / 1_000_000;
  return money(result);
}

export function calculateUnitCost(units, rate) {
  if (!rate?.unit_name || rate.unit_cost_usd == null) return null;
  return money(n(units?.[rate.unit_name]) * n(rate.unit_cost_usd));
}

export async function findEffectiveRateCard({ provider, service, model, operation, at = new Date() }) {
  try {
    let query = supabaseAdmin.from("api_rate_cards")
      .select("*")
      .eq("provider", provider)
      .eq("service", service)
      .eq("operation", operation)
      .lte("effective_from", at.toISOString())
      .order("effective_from", { ascending: false })
      .limit(1);
    if (model) query = query.eq("model", model);
    const { data, error } = await query.maybeSingle();
    if (error) return null;
    if (data?.effective_to && Date.parse(data.effective_to) <= at.getTime()) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function preflightApiUsage({ operationKey, estimatedMaxCostUsd, override = false }) {
  try {
    const { data: policy } = await supabaseAdmin.from("api_budgets")
      .select("id, per_request_ceiling_usd, max_requests_per_minute, active")
      .eq("scope_type", "operation")
      .eq("scope_key", operationKey)
      .eq("active", true)
      .maybeSingle();
    if (!policy) return { allowed: true, policyId: null, decision: "allow" };
    if (override) return { allowed: true, policyId: policy.id, decision: "override" };
    if (policy.per_request_ceiling_usd != null && n(estimatedMaxCostUsd) > n(policy.per_request_ceiling_usd)) {
      return { allowed: false, policyId: policy.id, decision: "block", code: "REQUEST_COST_CEILING" };
    }
    if (policy.max_requests_per_minute) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabaseAdmin.from("api_usage_events")
        .select("id", { count: "exact", head: true })
        .eq("operation", operationKey)
        .gte("occurred_at", since);
      if ((count || 0) >= policy.max_requests_per_minute) {
        return { allowed: false, policyId: policy.id, decision: "block", code: "REQUEST_RATE_BREAKER" };
      }
    }
    return { allowed: true, policyId: policy.id, decision: "allow" };
  } catch {
    // Telemetry degradation must not remove the static request limits enforced
    // by each adapter. Surface coverage degradation in the OPEX dashboard.
    return { allowed: true, policyId: null, decision: "allow", degraded: true };
  }
}

export async function recordApiUsage(event) {
  const row = {
    occurred_at: event.occurredAt || new Date().toISOString(),
    request_id: event.requestId || crypto.randomUUID(),
    idempotency_key: event.idempotencyKey || null,
    parent_run_id: event.parentRunId || null,
    workflow_id: event.workflowId || null,
    workspace_id: event.workspaceId || null,
    brand_id: event.brandId || null,
    actor_user_id: event.actorUserId || null,
    specialist_id: event.specialistId || null,
    feature: event.feature || "unallocated",
    environment: event.environment || process.env.NODE_ENV || "development",
    provider: event.provider,
    service: event.service,
    requested_model: event.requestedModel || null,
    resolved_model: event.resolvedModel || event.requestedModel || null,
    operation: event.operation || "request",
    status: event.status || "succeeded",
    retry_number: n(event.retryNumber),
    latency_ms: event.latencyMs == null ? null : Math.max(0, Math.round(n(event.latencyMs))),
    input_tokens: Math.max(0, Math.round(n(event.inputTokens))),
    output_tokens: Math.max(0, Math.round(n(event.outputTokens))),
    cache_read_tokens: Math.max(0, Math.round(n(event.cacheReadTokens))),
    cache_write_tokens: Math.max(0, Math.round(n(event.cacheWriteTokens))),
    images: Math.max(0, Math.round(n(event.images))),
    pages: Math.max(0, Math.round(n(event.pages))),
    requests: Math.max(0, Math.round(n(event.requests ?? 1))),
    bytes: Math.max(0, Math.round(n(event.bytes))),
    units: event.units || {},
    reported_cost_usd: event.reportedCostUsd == null ? null : money(event.reportedCostUsd),
    estimated_cost_usd: event.estimatedCostUsd == null ? null : money(event.estimatedCostUsd),
    reconciled_cost_usd: event.reconciledCostUsd == null ? null : money(event.reconciledCostUsd),
    currency: event.currency || "USD",
    cost_source: event.costSource || "unpriced",
    rate_card_id: event.rateCardId || null,
    preflight_max_cost_usd: event.preflightMaxCostUsd == null ? null : money(event.preflightMaxCostUsd),
    budget_policy_id: event.budgetPolicyId || null,
    breaker_decision: event.breakerDecision || null,
    error_code: event.errorCode || null,
    metadata: event.metadata || {},
  };
  try {
    const { data, error } = await supabaseAdmin.from("api_usage_events").insert(row).select("id").maybeSingle();
    if (error && error.code !== "42P01") console.warn("[api-usage] write failed:", error.message);
    return data?.id || null;
  } catch (error) {
    console.warn("[api-usage] write failed:", error?.message || error);
    return null;
  }
}

export function completionTelemetryEvent({ telemetry = {}, usage = {}, provider, model, status, latencyMs, rate, preflight, errorCode }) {
  const providerReported = usage.cost_source === "provider_reported" || (usage.cost_source == null && usage.cost_usd != null);
  const reported = providerReported ? n(usage.cost_usd) : null;
  const estimated = providerReported ? null : (usage.cost_usd == null ? calculateTokenCost(usage, rate) : n(usage.cost_usd));
  return {
    ...telemetry,
    provider,
    service: "messages",
    requestedModel: model,
    resolvedModel: usage.model || model,
    operation: telemetry.operationKey || "completion",
    status,
    latencyMs,
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cacheReadTokens: usage.cached_tokens,
    cacheWriteTokens: usage.cache_creation_tokens,
    reportedCostUsd: reported,
    estimatedCostUsd: estimated,
    costSource: reported != null ? "provider_reported" : estimated != null ? "rate_card_estimate" : "unpriced",
    rateCardId: rate?.id || null,
    preflightMaxCostUsd: telemetry.preflightMaxCostUsd,
    budgetPolicyId: preflight?.policyId || null,
    breakerDecision: preflight?.decision || "allow",
    errorCode,
  };
}
