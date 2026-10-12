// Credit settlement for tasks and item re-runs. Mirrors routes/runs.js:
//   preflight (402 on insufficient, $0 spent) → briefs + runs rows →
//   reserveCredits (atomic) → model work → finalize_run_atomic (output +
//   qa_results + ledger) or failRunAndReleaseCredits on error.
// Every model call made inside work() is attributed to the run in
// api_usage_events via runWithUsage().
import { supabaseAdmin } from "../lib/supabase.js";
import { assertCreditsAvailable, reserveCredits, failRunAndReleaseCredits } from "../lib/credits.js";
import { runWithUsage } from "./usage-context.js";
import { TASKS } from "./registry.js";

// PLACEHOLDER credit prices, pending Oscar's sign-off. The single source for
// what a task or re-run reserves; change here only.
export const TASK_CREDITS = Object.freeze({ social_post: 12, email_sequence: 6, email_sequence_heroes: 12, rerun: 2 });
export const MAX_RERUNS_PER_ITEM = 2;

export function taskCredits({ type, heroes = false, rerun = false }) {
  if (rerun) return TASK_CREDITS.rerun;
  if (type === "email_sequence" && heroes) return TASK_CREDITS.email_sequence_heroes;
  return TASK_CREDITS[type] ?? 12;
}

const defaultDeps = { db: supabaseAdmin, assertCreditsAvailable, reserveCredits, failRunAndReleaseCredits };

/** Step 1 (before any model call): preflight. Returns { ok:false, check } for 402/429. */
export async function preflight({ workspaceId, credits }, deps = defaultDeps) {
  const check = await deps.assertCreditsAvailable(workspaceId, credits);
  return check.ok ? { ok: true, check } : { ok: false, check };
}

/** Step 2: briefs + runs rows and the atomic reservation. Throws {status, code} on failure. */
export async function openRun({ workspaceId, brandId, type, brief, bioVersion, credits, kind = "task", parentTaskId = null, itemIndex = null }, deps = defaultDeps) {
  const db = deps.db;
  const writer = TASKS[type].writer;
  const { data: spec } = await db.from("specs").select("version").eq("specialist_id", writer).eq("active", true).maybeSingle();
  const { data: briefRow, error: bErr } = await db.from("briefs").insert({
    brand_id: brandId, title: `${TASKS[type].label}${kind === "rerun" ? ` · re-run item ${itemIndex + 1}` : ""}`, type: `task.${type}`,
    payload: { request: brief, task_type: type, kind, parent_task_id: parentTaskId, item_index: itemIndex }, status: "running",
  }).select("id").single();
  if (bErr) throw Object.assign(new Error(`brief insert failed: ${bErr.message}`), { status: 500 });
  const { data: runRow, error: rErr } = await db.from("runs").insert({
    brief_id: briefRow.id, specialist_id: writer, spec_version: spec?.version ?? 1, bio_version: bioVersion ?? 0,
    status: "running", started_at: new Date().toISOString(),
  }).select("id").single();
  if (rErr) throw Object.assign(new Error(`run insert failed: ${rErr.message}`), { status: 500 });
  const reservationKey = `task:${runRow.id}:credits`;
  const res = await deps.reserveCredits({ workspaceId, amount: credits, key: reservationKey, kind: "reservation", runId: runRow.id });
  if (!res.ok) {
    await db.from("runs").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", runRow.id);
    throw Object.assign(new Error(res.message), { status: res.code === "OUT_OF_CREDITS" ? 402 : 429, code: res.code, credits_required: credits });
  }
  return { runId: runRow.id, briefId: briefRow.id, reservationKey, writer };
}

/** Step 3+4: run work() under usage attribution, then finalize or release. */
export async function settle({ workspaceId, brandId, userId, run, work, toOutput }, deps = defaultDeps) {
  const t0 = Date.now();
  let result, out;
  try {
    result = await runWithUsage({ runId: run.runId, workspaceId, brandId, userId, specialistId: run.writer }, work);
    out = toOutput(result);
  } catch (e) {
    await release(workspaceId, run, deps);
    throw e;
  }
  const models = [...new Set((result.metrics?.ledger || []).map((r) => r.model).filter(Boolean))];
  const { error } = await deps.db.rpc("finalize_run_atomic", {
    p_workspace_id: workspaceId, p_run_id: run.runId, p_reservation_key: run.reservationKey,
    p_model_used: models.join(",").slice(0, 400) || null, p_prompt_tokens: 0, p_completion_tokens: 0, p_cached_tokens: 0,
    p_cost_usd: Number(result.metrics?.cost?.total_usd || 0), p_latency_ms: Date.now() - t0,
    p_output_kind: out.kind, p_output_body: out.body, p_asset_url: out.asset_url || null,
    p_output_status: out.status, p_rationale: out.rationale || null,
    p_qa_passed: out.qa_passed, p_qa_evidence: out.qa_evidence || {}, p_ledger_kind: out.ledger_kind,
  });
  if (error) {
    await release(workspaceId, run, deps);
    throw Object.assign(new Error(`finalize failed: ${error.message}`), { status: 500 });
  }
  return result;
}

/**
 * Release the reservation. If the release itself fails, log at error level
 * and mark the run `release_failed` for reconciliation; never swallow it
 * silently. The caller's original error is still the one thrown.
 */
async function release(workspaceId, run, deps) {
  try {
    await deps.failRunAndReleaseCredits({ workspaceId, runId: run.runId, reservationKey: run.reservationKey, releaseKey: `${run.reservationKey}:release`, reason: "run_refund" });
    return true;
  } catch (err) {
    console.error(`[settlement] RELEASE FAILED run=${run.runId} key=${run.reservationKey}: ${err.message} (needs reconciliation)`);
    const { error } = await deps.db.from("runs").update({ status: "release_failed", ended_at: new Date().toISOString() }).eq("id", run.runId);
    if (error) console.error(`[settlement] could not mark run ${run.runId} release_failed: ${error.message}`);
    return false;
  }
}
