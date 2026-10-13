#!/usr/bin/env node
// Live Fixing-path E2E through the credit settlement (local Supabase only).
// Forces the reviewer to fail voice_on_brand on item 1 in the first pass, so
// the pipeline must take Fixing → re-review. Writes runs/outputs/ledger rows.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local> \
//   node --env-file=server/.env scripts/e2e-fixing.mjs --brand=<id>
import fs from "node:fs";
import path from "node:path";
const arg = (k, d = null) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(process.env.SUPABASE_URL || "")) { console.error("Refusing: SUPABASE_URL must be local"); process.exit(2); }
const { loadTaskContext } = await import("../server/src/harness/task-context.js");
const { runTask } = await import("../server/src/harness/pipeline.js");
const { review } = await import("../server/src/harness/reviewer.js");
const { preflight, openRun, settle, taskCredits } = await import("../server/src/harness/settlement.js");
const { taskOutput } = await import("../server/src/routes/tasks.js");
const { supabaseAdmin } = await import("../server/src/lib/supabase.js");

const brandId = arg("brand"); const type = "social_post";
const brief = "Tres posts de Instagram para NOMAD atHome Classics, la suscripción mensual de café de especialidad tostado en Barcelona. Para home brewers. CTA: suscríbete en nomadcoffee.es.";
const { data: brand } = await supabaseAdmin.from("brands").select("id, workspace_id, name").eq("id", brandId).single();
const ws = brand.workspace_id; const credits = taskCredits({ type });
const pre = await preflight({ workspaceId: ws, credits });
if (!pre.ok) { console.error(`[e2e] preflight refused: ${pre.check.code}`); process.exit(3); }
const ctx = await loadTaskContext({ workspaceId: ws, brandId, type });
const run = await openRun({ workspaceId: ws, brandId, type, brief, bioVersion: ctx.bio?.version, credits });
console.log(`[e2e] run ${run.runId} reserved ${credits} credits`);
let reviews = 0;
const forced = async (args) => {
  const v = await review(args);
  if (reviews++ === 0) v[0] = v[0].map((c) => (c.id === "voice_on_brand" ? { ...c, pass: false, target: "copy", reason: "FORCED (e2e): tone reads generic; use the brand's own phrasing" } : c));
  return v;
};
const t0 = Date.now(); const stages = [];
const job = { id: `e2e-fixing-${run.runId}`, type };
const res = await settle({ workspaceId: ws, brandId, userId: null, run,
  work: () => runTask({ type, brief, layer1: ctx.layer1, skillsPayloads: ctx.skillsPayloads, deps: { review: forced }, onEvent: (e) => { if (e.type === "stage") { stages.push([e.stage, ((Date.now() - t0) / 1000).toFixed(1)]); console.log(`  ${stages.at(-1)[1]}s ${e.stage}`); } } }),
  toOutput: (r) => taskOutput(job, r) });
const secs = (Date.now() - t0) / 1000;
const [{ data: runRow }, { data: outs }, { data: led }, { data: usage }] = await Promise.all([
  supabaseAdmin.from("runs").select("status, cost_usd, latency_ms, model_used").eq("id", run.runId).single(),
  supabaseAdmin.from("outputs").select("id, kind, status").eq("run_id", run.runId),
  supabaseAdmin.from("ledger").select("kind, credits, balance_after, idempotency_key").eq("run_id", run.runId),
  supabaseAdmin.from("api_usage_events").select("service, status, estimated_cost_usd, reported_cost_usd").eq("parent_run_id", run.runId),
]);
const summary = { run_id: run.runId, status: res.status, seconds: secs, cost_usd: res.metrics.cost.total_usd, by_step: res.metrics.cost.by_step, stages,
  items: res.items.map((it) => ({ index: it.index, status: it.status, revisions: it.revisions, before_failed: it.before?.failed?.map((c) => c.id) || [] })),
  db: { run: runRow, outputs: outs, ledger: led, api_usage: { rows: usage?.length, images: usage?.filter((u) => u.service === "image").length } } };
const dir = path.resolve("docs/brandos/handoffs/2026-10-12-task-pipeline/fixing-forced");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ ...summary, spec: res.spec }, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
