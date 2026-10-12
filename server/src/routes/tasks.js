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

const app = new Hono();
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
  let ctx;
  try { ctx = await loadTaskContext({ workspaceId: scoped.brand.workspace_id, brandId, type }); }
  catch (e) { return c.json({ error: e.message, code: e.code || "BRAND_CORE_UNAVAILABLE" }, e.status || 409); }
  const id = crypto.randomUUID();
  const eta = type === "email_sequence" && heroes ? ETA_SECONDS.email_sequence_heroes : ETA_SECONDS[type];
  const job = {
    id, type, brandId, workspaceId: scoped.brand.workspace_id, brief: brief.trim(), heroes: !!heroes,
    status: "running", stage: "Planning", eta_s: eta, created_at: new Date().toISOString(), created_by: scoped.auth.userId || null,
    brand_core: { version: ctx.bio?.version ?? null, foundation_missing: ctx.layer1.foundation_missing, references: ctx.layer1.references.length, rules: ctx.layer1.rules.length },
    items: [], notices: [], result: null, error: null,
  };
  remember(job);
  const onEvent = (ev) => {
    if (ev.type === "stage") job.stage = ev.stage;
    else if (ev.type === "item") job.items[ev.item.index] = ev.item;
    else if (ev.type === "notice") job.notices.push(ev.message);
  };
  runTask({ type, brief: job.brief, layer1: ctx.layer1, count, heroes, skillsPayloads: ctx.skillsPayloads, onEvent })
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
  const index = Number(c.req.param("index"));
  const item = job.items[index];
  if (!item || !job.result?.spec) return c.json({ error: "Item not ready" }, 409);
  const body = await c.req.json().catch(() => ({}));
  try {
    const ctx = await loadTaskContext({ workspaceId: job.workspaceId, brandId: job.brandId, type: job.type });
    const ruleIds = Array.isArray(body.ruleIds) ? body.ruleIds : (job.saved_rules || []).map((r) => r.id);
    job.items[index] = { ...item, status: "fixing", stage: "Fixing" };
    const res = await rerunItem({ type: job.type, brief: job.brief, layer1: ctx.layer1, spec: job.result.spec, item, heroes: job.heroes, ruleIds, skillsPayloads: ctx.skillsPayloads });
    job.items[index] = res.item;
    job.status = job.items.every((it) => it.status === "ready") ? "ready" : "flagged";
    job.reruns = [...(job.reruns || []), { index, ...res.metrics }];
    return c.json({ item: res.item, metrics: res.metrics });
  } catch (e) {
    job.items[index] = item;
    return c.json({ error: e.message }, e.status || 500);
  }
});

export default app;
