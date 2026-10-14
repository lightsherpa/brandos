// Task pipeline API (feat/task-pipeline). One task = one deliverable card.
//   POST /api/tasks                         { brandId, type, brief, count?, heroes? } → { id, eta_s }
//   GET  /api/tasks?brandId=                recent tasks (resume after leaving the page)
//   GET  /api/tasks/:id                     snapshot: stage, items (progressive), metrics
//   POST /api/tasks/:id/rules               { index, kind, value, reason, checkId } "Save as rule"
//   POST /api/tasks/:id/items/:index/rerun  copy-only re-run of one flagged item (Beat 5)
// Jobs run server-side, so the user can leave the page and come back.
import { Hono } from "hono";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { hasPermission } from "../lib/permissions.js";
import { runTask, rerunItem, ETA_SECONDS } from "../harness/pipeline.js";
import { loadTaskContext } from "../harness/task-context.js";
import { saveRule } from "../harness/rules.js";
import { TASKS } from "../harness/registry.js";
import { creditErrorResponse } from "../lib/credits.js";
import { preflight, openRun, settle, taskCredits, MAX_RERUNS_PER_ITEM } from "../harness/settlement.js";

// Feature flag: server env TASKS_ENABLED (default off). When off every route
// 404s except GET /enabled, which the client uses to hide the nav + route.
export const tasksEnabled = () => ['1', 'true'].includes(String(process.env.TASKS_ENABLED || '').toLowerCase());
// "Save as rule" edits the brand: Owner/Editor only (brand.manage — workspace
// owner/admin, platform admin, creative director). Contributor/Viewer → 403.
export const RULE_PERMISSION = "brand.manage";
export const canSaveRule = (auth, workspaceId) => hasPermission(auth, RULE_PERMISSION, workspaceId);

const app = new Hono();
app.get("/enabled", (c) => c.json({ enabled: tasksEnabled() }));
app.use("*", async (c, next) => {
  if (!tasksEnabled()) return c.json({ error: "Tasks are not enabled", code: "TASKS_DISABLED" }, 404);
  return next();
});
const jobs = new Map();           // in-process store; survives navigation, not a server restart
const MAX_JOBS = 200;

function remember(job) {
  jobs.set(job.id, job);
  if (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
}
function snapshot(job) {
  const { workspaceId, ...rest } = job;
  return rest;
}

async function scopeBrand(c, brandId) {
  const auth = c.get("auth");
  const { data: brand } = await supabaseAdmin.from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand) return { error: c.json({ error: "Brand not found" }, 404) };
  if (!hasPermission(auth, "brief.run", brand.workspace_id)) return { error: c.json({ error: "Forbidden", code: "PERMISSION_REQUIRED", permission: "brief.run" }, 403) };
  return { auth, brand };
}

app.post("/", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { brandId, type, brief, count, heroes } = body;
  if (!TASKS[type]) return c.json({ error: "Unknown task type", code: "UNKNOWN_TASK" }, 400);
  if (!brandId || typeof brief !== "string" || brief.trim().length < 10) return c.json({ error: "brandId and a brief (≥10 chars) are required" }, 400);
  const scoped = await scopeBrand(c, brandId);
  if (scoped.error) return scoped.error;
  const workspaceId = scoped.brand.workspace_id;
  const credits = taskCredits({ type, heroes: !!heroes });
  let ctx;
  try { ctx = await loadTaskContext({ workspaceId, brandId, type, heroes: !!heroes }); }
  catch (e) { return c.json({ error: e.message, code: e.code || "BRAND_CORE_UNAVAILABLE", ...(e.code === "FOUNDATION_INCOMPLETE" ? {state:"foundation_incomplete",credits:0,missing:e.missing || []}: {}) }, e.status || 409); }
  const pre = await preflight({ workspaceId, credits });
  if (!pre.ok) return creditErrorResponse(c, pre.check);
  let run;
  try { run = await openRun({ workspaceId, brandId, type, brief: brief.trim(), bioVersion: ctx.bio?.version, credits }); }
  catch (e) { return c.json({ error: e.message, code: e.code || "RUN_OPEN_FAILED", credits_required: credits }, e.status || 500); }
  const id = crypto.randomUUID();
  const eta = type === "email_sequence" && heroes ? ETA_SECONDS.email_sequence_heroes : ETA_SECONDS[type];
  const job = {
    id, type, brandId, workspaceId: scoped.brand.workspace_id, brief: brief.trim(), heroes: !!heroes,
    status: "running", stage: "Planning", eta_s: eta, run_id: run.runId, credits, created_at: new Date().toISOString(), created_by: scoped.auth.userId || null,
    brand_core: { version: ctx.bio?.version ?? null, foundation_missing: ctx.layer1.foundation_missing, references: ctx.layer1.references.length, rules: ctx.layer1.rules.length },
    items: [], notices: [], result: null, error: null,
  };
  remember(job);
  const onEvent = (ev) => {
    if (ev.type === "stage") job.stage = ev.stage;
    else if (ev.type === "item") job.items[ev.item.index] = ev.item;
    else if (ev.type === "notice") job.notices.push(ev.message);
  };
  settle({ workspaceId, brandId, userId: job.created_by, run,
    work: () => runTask({ type, brief: job.brief, layer1: ctx.layer1, count, heroes, skillsPayloads: ctx.skillsPayloads, onEvent }),
    toOutput: (res) => taskOutput(job, res) })
    .then((res) => { job.result = { spec: res.spec, metrics: res.metrics }; job.items = res.items; job.status = res.status; job.stage = "Ready"; job.finished_at = new Date().toISOString(); })
    .catch((e) => { job.status = "failed"; job.error = e.message; job.finished_at = new Date().toISOString(); console.error(`[task-pipeline] ${id} failed: ${e.message}`); });
  return c.json({ id, eta_s: eta, stage: job.stage }, 202);
});

app.get("/", requireAuth, async (c) => {
  const brandId = c.req.query("brandId");
  const auth = c.get("auth");
  const list = [...jobs.values()].filter((j) => (!brandId || j.brandId === brandId) && hasPermission(auth, "brief.run", j.workspaceId)).slice(-20).reverse();
  return c.json({ tasks: list.map((j) => ({ id: j.id, type: j.type, status: j.status, stage: j.stage, created_at: j.created_at, brief: j.brief.slice(0, 120) })) });
});

export function taskOutput(job, res) {
  const ready = res.status === "ready";
  return {
    kind: "task", status: ready ? "approved" : "needs_review", ledger_kind: ready ? "run" : "run_flagged",
    body: JSON.stringify({ task_id: job.id, type: job.type, spec: res.spec, items: res.items }),
    asset_url: res.items?.find((it) => it?.asset_url)?.asset_url || null,
    qa_passed: ready, qa_evidence: { items: (res.items || []).map((it) => ({ index: it?.index, status: it?.status, checks: it?.checks })) },
    rationale: ready ? null : "One or more items need review",
  };
}

export function rerunOutput(job, index, res) {
  const ready = res.item?.status === "ready";
  return {
    kind: "task_rerun", status: ready ? "approved" : "needs_review", ledger_kind: ready ? "run" : "run_flagged",
    body: JSON.stringify({ task_id: job.id, index, item: res.item }), asset_url: res.item?.asset_url || null,
    qa_passed: ready, qa_evidence: { index, checks: res.item?.checks }, rationale: ready ? null : "Re-run still needs review",
  };
}

/** Server-side re-run cap: at most MAX_RERUNS_PER_ITEM per item, one at a time. */
export function rerunGate(job, index) {
  job.rerun_counts = job.rerun_counts || {};
  const used = job.rerun_counts[index] || 0;
  if (used >= MAX_RERUNS_PER_ITEM) return { ok: false, status: 429, body: { error: `This item has already been re-run ${MAX_RERUNS_PER_ITEM} times`, code: "RERUN_LIMIT", limit: MAX_RERUNS_PER_ITEM } };
  if (job.items[index]?.status === "fixing") return { ok: false, status: 409, body: { error: "A re-run is already in progress", code: "RERUN_IN_PROGRESS" } };
  return { ok: true, used };
}

function getJob(c) {
  const job = jobs.get(c.req.param("id"));
  if (!job) return { error: c.json({ error: "Task not found (it may have expired after a server restart)" }, 404) };
  if (!hasPermission(c.get("auth"), "brief.run", job.workspaceId)) return { error: c.json({ error: "Forbidden" }, 403) };
  return { job };
}

app.get("/:id", requireAuth, (c) => {
  const { job, error } = getJob(c);
  return error || c.json(snapshot(job));
});

app.post("/:id/rules", requireAuth, async (c) => {
  const { job, error } = getJob(c);
  if (error) return error;
  if (!canSaveRule(c.get("auth"), job.workspaceId)) return c.json({ error: "Only Owners and Editors can save brand rules", code: "PERMISSION_REQUIRED", permission: RULE_PERMISSION }, 403);
  const body = await c.req.json().catch(() => ({}));
  try {
    const rule = await saveRule({ brandId: job.brandId, rule: body, source: { taskId: job.id, index: body.index, checkId: body.checkId }, userId: c.get("auth").userId });
    job.saved_rules = [...(job.saved_rules || []), rule];
    return c.json({ rule });
  } catch (e) { return c.json({ error: e.message }, e.status || 500); }
});

app.post("/:id/items/:index/rerun", requireAuth, async (c) => {
  const { job, error } = getJob(c);
  if (error) return error;
  const body = await c.req.json().catch(() => ({}));
  const r = await executeRerun({ job, index: Number(c.req.param("index")), body, userId: c.get("auth").userId });
  if (r.credit) return creditErrorResponse(c, r.credit);
  return c.json(r.body, r.status);
});

const rerunDeps = { preflight, loadTaskContext, openRun, settle, rerunItem };

/**
 * One copy-only re-run. Race-safe: the gate, the `fixing` state and the
 * count bump happen synchronously (no await in between), so a concurrent
 * second request sees `fixing` and gets 409. Anything failing before
 * settle() starts rolls both back; once settle() owns the run, the count
 * stays (credits were reserved and settle releases them on error).
 */
export async function executeRerun({ job, index, body = {}, userId = null }, deps = rerunDeps) {
  const item = job.items[index];
  if (!item || !job.result?.spec) return { status: 409, body: { error: "Item not ready" } };
  const gate = rerunGate(job, index);
  if (!gate.ok) return { status: gate.status, body: gate.body };
  job.rerun_counts[index] = gate.used + 1;
  job.items[index] = { ...item, status: "fixing", stage: "Fixing" };
  const rollback = () => { job.rerun_counts[index] = gate.used; job.items[index] = item; };
  let run, ctx;
  try {
    const credits = taskCredits({ type: job.type, rerun: true });
    const pre = await deps.preflight({ workspaceId: job.workspaceId, credits });
    if (!pre.ok) { rollback(); return { credit: pre.check }; }
    ctx = await deps.loadTaskContext({ workspaceId: job.workspaceId, brandId: job.brandId, type: job.type, copyOnly: true });
    run = await deps.openRun({ workspaceId: job.workspaceId, brandId: job.brandId, type: job.type, brief: job.brief, bioVersion: ctx.bio?.version, credits, kind: "rerun", parentTaskId: job.id, itemIndex: index });
  } catch (e) {
    rollback();
    return { status: e.status || 500, body: { error: e.message, code: e.code, credits_required: e.credits_required } };
  }
  try {
    const ruleIds = Array.isArray(body.ruleIds) ? body.ruleIds : (job.saved_rules || []).map((r) => r.id);
    const res = await deps.settle({ workspaceId: job.workspaceId, brandId: job.brandId, userId, run,
      work: () => deps.rerunItem({ type: job.type, brief: job.brief, layer1: ctx.layer1, spec: job.result.spec, item, heroes: job.heroes, ruleIds, skillsPayloads: ctx.skillsPayloads }),
      toOutput: (r) => rerunOutput(job, index, r) });
    job.items[index] = res.item;
    job.status = job.items.every((it) => it.status === "ready") ? "ready" : "flagged";
    job.reruns = [...(job.reruns || []), { index, run_id: run.runId, ...res.metrics }];
    return { status: 200, body: { item: res.item, metrics: res.metrics, run_id: run.runId, reruns_left: MAX_RERUNS_PER_ITEM - job.rerun_counts[index] } };
  } catch (e) {
    job.items[index] = item;   // count stays: the reservation was made and settled
    return { status: e.status || 500, body: { error: e.message, code: e.code } };
  }
}

export default app;
