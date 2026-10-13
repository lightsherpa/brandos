// Output-token budget for text completions.
//
// Social Captions and the other low-credit specialists were being cut off
// because a missing budget fell through to cr_estimate * 100 (a 3-credit
// agent got ~300 tokens) and the old fallback then clamped that into
// [200, 4000]. Specialist text runs now omit maxTokens so this helper
// applies: honor spec.payload.max_output_tokens when a spec author set one,
// otherwise size from the credit estimate, then keep the request inside
// [TEXT_TOKEN_FLOOR, TEXT_TOKEN_CAP].
//
// Callers that pass maxTokens (deliverable JSON, voice QA, the sharpener)
// are asking for a specific budget. Those stay as given, except for the
// 16-token provider floor — GPT-5 rejects max_tokens below 16.

export const TEXT_TOKEN_FLOOR = 2000;
export const TEXT_TOKEN_CAP = 8000;
export const PROVIDER_TOKEN_FLOOR = 16;

function positiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/**
 * @param {object} [args]
 * @param {number} [args.maxTokens] explicit caller budget. Wins outright,
 *   aside from the provider floor. Pass this only when the caller has sized
 *   the completion itself.
 * @param {object} [args.spec] specialist spec row. Reads
 *   payload.max_output_tokens (or payload.maxOutputTokens) and payload.cr_estimate.
 */
export function resolveTextTokenBudget({ maxTokens, spec } = {}) {
  const explicit = positiveInt(maxTokens);
  if (explicit != null) return Math.max(PROVIDER_TOKEN_FLOOR, explicit);

  const payload = spec?.payload && typeof spec.payload === "object" ? spec.payload : {};
  const fromSpec = positiveInt(payload.max_output_tokens ?? payload.maxOutputTokens);
  const fromCredits = positiveInt((Number(payload.cr_estimate) || 8) * 100) || TEXT_TOKEN_FLOOR;
  const requested = fromSpec ?? fromCredits;
  const clamped = Math.min(TEXT_TOKEN_CAP, Math.max(TEXT_TOKEN_FLOOR, requested));
  return Math.max(PROVIDER_TOKEN_FLOOR, clamped);
}

// Certifier reservations use a conservative UTF-8 byte token upper bound,
// including tools and cache-write pricing. Reserve the worst fallback price
// BEFORE calling the provider, not after its usage has already been billed.
export class CertifierBudget {
  constructor(cap = 0.30) { this.cap = cap; this.spent = 0; }
  allowance(inputTokens, requested = 8000, mayFallback = true) {
    const inputCost = inputTokens * (mayFallback ? 6.25 : 3.75) / 1e6;
    const output = Math.min(requested, Math.floor((this.cap - this.spent - inputCost) * 1e6 / 15));
    if (output < 16) throw Object.assign(new Error('Certifier cost cap reached'), { code: 'CERTIFIER_COST_CAP', status: 429 });
    return output;
  }
  charge(cost) {
    if (!Number.isFinite(cost) || cost < 0 || this.spent + cost > this.cap + 1e-9) throw Object.assign(new Error('Certifier cost cap reached'), { code: 'CERTIFIER_COST_CAP', status: 429 });
    this.spent = Number((this.spent + cost).toFixed(9));
  }
}
