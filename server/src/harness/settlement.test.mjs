import { test } from "node:test";
import assert from "node:assert/strict";
process.env.SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test";
const { preflight, openRun, settle, taskCredits, TASK_CREDITS, MAX_RERUNS_PER_ITEM } = await import("./settlement.js");
const { loadRules } = await import("./rules.js");
const { usageContext } = await import("./usage-context.js");
const { generateSlot } = await import("./images.js");
const tasks = await import("../routes/tasks.js");

function fakeDb(log, { failRun = false, finalizeError = null } = {}) {
  const chain = (table) => {
    const q = { _t: table, _op: "select", _row: null };
    q.select = () => q; q.eq = () => q; q.order = () => q;
    q.insert = (row) => { q._op = "insert"; q._row = row; log.push(["insert", table, row]); return q; };
    q.update = (row) => { q._op = "update"; log.push(["update", table, row]); return q; };
    q.maybeSingle = async () => (table === "specs" ? { data: { version: 7 } } : { data: null });
    q.single = async () => (failRun && table === "runs" ? { error: { message: "boom" } } : { data: { id: `${table}-1` } });
    q.then = (r) => r({ data: null, error: null });
    return q;
  };
  return { from: chain, rpc: async (fn, args) => { log.push(["rpc", fn, args]); return { error: finalizeError }; } };
}
const deps = (log, opts = {}) => ({
  db: fakeDb(log, opts),
  assertCreditsAvailable: async (_ws, n) => (opts.broke ? { ok: false, code: "OUT_OF_CREDITS", message: "Out of credits", requested: n, balance: 0 } : { ok: true }),
  reserveCredits: async (a) => { log.push(["reserve", a]); return opts.reserveFail ? { ok: false, code: "OUT_OF_CREDITS", message: "Out of credits" } : { ok: true }; },
  failRunAndReleaseCredits: async (a) => { log.push(["release", a]); return {}; },
});

test("credits: placeholder prices live in one constant", () => {
  assert.equal(taskCredits({ type: "social_post" }), TASK_CREDITS.social_post);
  assert.equal(taskCredits({ type: "email_sequence", heroes: true }), TASK_CREDITS.email_sequence_heroes);
  assert.equal(taskCredits({ type: "social_post", rerun: true }), TASK_CREDITS.rerun);
  assert.equal(MAX_RERUNS_PER_ITEM, 2);
});

test("credits: insufficient preflight → not ok, nothing written, no model work", async () => {
  const log = [];
  const r = await preflight({ workspaceId: "w", credits: 12 }, deps(log, { broke: true }));
  assert.equal(r.ok, false); assert.equal(r.check.code, "OUT_OF_CREDITS");
  assert.equal(log.length, 0);
});

test("credits: reserve fails → 402, run marked failed, no work", async () => {
  const log = [];
  await assert.rejects(openRun({ workspaceId: "w", brandId: "b", type: "social_post", brief: "x", bioVersion: 2, credits: 12 }, deps(log, { reserveFail: true })), (e) => e.status === 402);
  assert.ok(log.some(([op, t, row]) => op === "update" && t === "runs" && row.status === "failed"));
});

test("credits: happy path reserves before work, attributes usage, finalizes with ledger kind", async () => {
  const log = [];
  const d = deps(log);
  const run = await openRun({ workspaceId: "w", brandId: "b", type: "social_post", brief: "x", bioVersion: 2, credits: 12 }, d);
  assert.equal(run.reservationKey, "task:runs-1:credits");
  const runsInsert = log.find(([op, t]) => op === "insert" && t === "runs")[2];
  assert.equal(runsInsert.specialist_id, "a16"); assert.equal(runsInsert.spec_version, 7); assert.equal(runsInsert.bio_version, 2);
  let seen;
  await settle({ workspaceId: "w", brandId: "b", userId: "u", run, work: async () => {
    assert.ok(log.some(([op]) => op === "reserve"), "reserved before work");
    seen = usageContext();
    return { status: "flagged", items: [], metrics: { cost: { total_usd: 0.25 }, ledger: [{ model: "m1" }] } };
  }, toOutput: (res) => tasks.taskOutput({ id: "t", type: "social_post" }, res) }, d);
  assert.equal(seen.runId, "runs-1"); assert.equal(seen.workspaceId, "w");
  const fin = log.find(([op, fn]) => op === "rpc" && fn === "finalize_run_atomic")[2];
  assert.equal(fin.p_output_status, "needs_review"); assert.equal(fin.p_ledger_kind, "run_flagged"); assert.equal(fin.p_cost_usd, 0.25);
  assert.ok(!log.some(([op]) => op === "release"));
});

test("credits: work error releases the reservation", async () => {
  const log = [];
  const d = deps(log);
  const run = await openRun({ workspaceId: "w", brandId: "b", type: "email_sequence", brief: "x", bioVersion: 1, credits: 6 }, d);
  await assert.rejects(settle({ workspaceId: "w", brandId: "b", run, work: async () => { throw new Error("model down"); }, toOutput: () => ({}) }, d), /model down/);
  const rel = log.find(([op]) => op === "release")[1];
  assert.equal(rel.reservationKey, run.reservationKey); assert.equal(rel.releaseKey, `${run.reservationKey}:release`);
});

test("credits: image attempts write api_usage attributed to the run", async () => {
  const rows = [];
  const gen = async function* () { yield { type: "done", asset_url: "https://x/i.png", model: "openai/gpt-image-2.5/sunburst/edit", cost_usd: 0.08 }; };
  const { runWithUsage } = await import("./usage-context.js");
  const layer1 = { palette: {}, imagery: [], avoid: [], references: [] };
  await runWithUsage({ runId: "r9", workspaceId: "w", brandId: "b" }, () => generateSlot({ slot: 0, imageBrief: { subject: "cup", aspect: "4:5" }, layer1, gen, ocr: async () => ({ pass: true }), recordUsage: async (r) => rows.push(r) }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].parentRunId, "r9"); assert.equal(rows[0].service, "image"); assert.equal(rows[0].estimatedCostUsd, 0.08); assert.equal(rows[0].costSource, "rate_card_estimate");
});

test("rules: lookup error fails closed (throws 503)", async () => {
  const db = { from: () => { const q = { select: () => q, eq: () => q, order: async () => ({ data: null, error: { message: "relation missing" } }) }; return q; } };
  await assert.rejects(loadRules("b", db), (e) => e.status === 503 && e.code === "BRAND_RULES_UNAVAILABLE");
});

test("flag: TASKS_ENABLED off → /api/tasks 404 except /enabled", async () => {
  delete process.env.TASKS_ENABLED;
  const app = tasks.default;
  assert.equal((await app.request("/")).status, 404);
  const r = await app.request("/", { method: "POST", body: "{}" });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, "TASKS_DISABLED");
  assert.deepEqual(await (await app.request("/enabled")).json(), { enabled: false });
  process.env.TASKS_ENABLED = "true";
  assert.deepEqual(await (await app.request("/enabled")).json(), { enabled: true });
  assert.equal((await app.request("/x")).status, 401);   // gate open → auth applies
  delete process.env.TASKS_ENABLED;
});

test("roles: Save as rule needs Owner/Editor (brand.manage); Contributor/Viewer → no", () => {
  const auth = (perms) => ({ permissions: new Set(perms), scope: "workspace", memberships: [{ workspace_id: "w", status: "active" }] });
  assert.equal(tasks.RULE_PERMISSION, "brand.manage");
  assert.equal(tasks.canSaveRule(auth(["brand.manage", "brief.run"]), "w"), true);
  assert.equal(tasks.canSaveRule(auth(["brief.run", "output.write"]), "w"), false);
  assert.equal(tasks.canSaveRule(auth(["bio.read"]), "w"), false);
});

test("re-runs: capped at 2 per item server-side, one in flight at a time", () => {
  const job = { items: [{ status: "flagged" }, { status: "fixing" }] };
  assert.equal(tasks.rerunGate(job, 0).ok, true);
  job.rerun_counts[0] = 2;
  const g = tasks.rerunGate(job, 0);
  assert.equal(g.status, 429); assert.equal(g.body.code, "RERUN_LIMIT");
  assert.equal(tasks.rerunGate(job, 1).status, 409);
});
