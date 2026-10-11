// Self-correction loop for text specialist output.
//
// Text QA that returns needs_review, or that fails a check, asks the same
// agent to revise against those failures and then runs QA again. Demo cap
// is two fix passes. The loop stops when the output passes, when a pass
// makes no progress, or when the cap is hit. It never marks a failing or
// unreadable verdict as approved.

export const MAX_FIX_PASSES = 2;

export function closeQa(qa) {
  if (!qa || typeof qa !== "object") {
    return { passed: false, status: "needs_review", violations: ["qa_missing"], voice_match: null };
  }
  if (qa.status === "needs_review") return { ...qa, passed: false };
  return qa;
}

export function qaNeedsCorrection(qa) {
  const closed = closeQa(qa);
  return closed.status === "needs_review" || closed.passed === false;
}

export function correctionInstruction({ previousOutput, qa, passNo }) {
  const violations = Array.isArray(qa?.violations) ? qa.violations.filter(Boolean) : [];
  const checks = violations.length
    ? violations.map((violation, index) => `${index + 1}. ${violation}`).join("\n")
    : "1. QA returned needs_review and did not pass.";
  return [
    `Fix pass ${passNo}. Fix exactly the failing checks. Do not change content that passed.`,
    "Return the full revised output and nothing else.",
    "",
    "Failing checks:",
    checks,
    "",
    "Previous output:",
    String(previousOutput ?? ""),
  ].join("\n");
}

function failureSignature(qa, output) {
  const violations = Array.isArray(qa?.violations) ? qa.violations : [];
  return `${qa?.status || ""}|${violations.join("\n")}|${output}`;
}

export function mergeUsage(first, second) {
  if (!first) return second || null;
  if (!second) return first;
  const num = (left, right) => (Number(left) || 0) + (Number(right) || 0);
  const costs = [first.cost_usd, second.cost_usd].filter((n) => typeof n === "number");
  return {
    ...first,
    ...second,
    prompt_tokens: num(first.prompt_tokens, second.prompt_tokens),
    completion_tokens: num(first.completion_tokens, second.completion_tokens),
    cached_tokens: num(first.cached_tokens, second.cached_tokens),
    cache_creation_tokens: num(first.cache_creation_tokens, second.cache_creation_tokens),
    cost_usd: costs.length ? costs.reduce((sum, n) => sum + n, 0) : null,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.output
 * @param {object} opts.qa
 * @param {(instruction: string, passNo: number, previousOutput: string) => Promise<string>} opts.revise
 * @param {(output: string) => Promise<object>} opts.review
 * @param {number} [opts.maxPasses]
 */
export async function selfCorrectText({ output, qa, revise, review, maxPasses = MAX_FIX_PASSES }) {
  const cap = Math.max(0, Math.min(MAX_FIX_PASSES, Number(maxPasses) || 0));
  let currentOutput = String(output ?? "");
  let currentQa = closeQa(qa);
  let passes = 0;
  const attempted = new Set();

  while (passes < cap && qaNeedsCorrection(currentQa)) {
    const signature = failureSignature(currentQa, currentOutput);
    if (attempted.has(signature)) break;
    attempted.add(signature);
    const instruction = correctionInstruction({ previousOutput: currentOutput, qa: currentQa, passNo: passes + 1 });
    let revised;
    try {
      revised = await revise(instruction, passes + 1, currentOutput);
    } catch {
      break;
    }
    const next = String(revised ?? "").trim();
    if (!next || next === currentOutput) break;
    let nextQa;
    try {
      nextQa = closeQa(await review(next));
    } catch {
      break;
    }
    currentOutput = next;
    currentQa = nextQa;
    passes += 1;
  }

  return { output: currentOutput, qa: closeQa(currentQa), passes };
}
