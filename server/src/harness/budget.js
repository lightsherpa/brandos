// Per-task budgets (HARNESS §6, CREWS §1-2 targets). Enforced in code: the
// pipeline asks the budget before each call and records the actual spend.

export const TASK_BUDGETS = Object.freeze({
  // Social targets ≤$0.25; the cap leaves room for 1 revision.
  social_post:    { maxUsd: 0.60, maxImageCalls: 7, maxTextCalls: 12, imageConcurrency: 3 },
  // Email targets ≤$0.15 (no heroes) / ≤$0.30 (3 heroes).
  email_sequence: { maxUsd: 0.50, maxImageCalls: 7, maxTextCalls: 10, imageConcurrency: 3 },
});

export class BudgetExceededError extends Error {
  constructor(message) { super(message); this.code = "BUDGET_EXCEEDED"; }
}

export function createBudget(taskType, overrides = {}) {
  const limits = { ...(TASK_BUDGETS[taskType] || TASK_BUDGETS.social_post), ...overrides };
  const ledger = [];
  const spent = () => ledger.reduce((sum, row) => sum + (Number(row.cost_usd) || 0), 0);
  const count = (kind) => ledger.filter((row) => row.kind === kind).length;
  return {
    limits,
    ledger,
    spentUsd: spent,
    /** Throws when the next call would break a cap. `estimateUsd` is the pre-flight max. */
    reserve(kind, estimateUsd = 0) {
      const max = kind === "image" ? limits.maxImageCalls : limits.maxTextCalls;
      if (count(kind) >= max) throw new BudgetExceededError(`${kind} call cap (${max}) reached`);
      if (spent() + estimateUsd > limits.maxUsd) throw new BudgetExceededError(`task budget $${limits.maxUsd} would be exceeded`);
    },
    record(row) { ledger.push({ at: new Date().toISOString(), ...row }); },
    summary() {
      const byStep = {};
      for (const row of ledger) byStep[row.step] = Number(((byStep[row.step] || 0) + (Number(row.cost_usd) || 0)).toFixed(4));
      return { total_usd: Number(spent().toFixed(4)), calls: ledger.length, by_step: byStep, limits };
    },
  };
}

/** Promise pool: at most `limit` tasks run at once (3 image calls per bundle). */
export function createSemaphore(limit = 3) {
  let active = 0; const queue = [];
  const next = () => { if (active >= limit || !queue.length) return; active++; const { fn, resolve, reject } = queue.shift(); Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); }); };
  const run = (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
  run.active = () => active;
  return run;
}
