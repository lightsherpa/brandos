import { test, mock } from "node:test";
import assert from "node:assert/strict";
process.env.TASKS_ENABLED = "true";
const root = new URL("../", import.meta.url);
// x-scope header picks the viewer: "workspace" = client portal, "platform" = team/admin.
mock.module(new URL("middleware/auth.js", root).href, { namedExports: { requireAuth: async (c, next) => { c.set("auth", { userId: "u", scope: c.req.header("x-scope") || "workspace" }); return next(); } } });
mock.module(new URL("lib/permissions.js", root).href, { namedExports: { hasPermission: () => true } });
mock.module(new URL("lib/supabase.js", root).href, { namedExports: { supabaseAdmin: { from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: "brand", workspace_id: "ws" } }; } }) } } });
mock.module(new URL("harness/task-context.js", root).href, { namedExports: { loadTaskContext: async () => ({ bio: { version: 1 }, layer1: { foundation_missing: [], references: [], rules: [] }, skillsPayloads: {} }) } });
const image = { asset_url: "https://x/img.png", model: "vendor/fal/flux-schnell", fallback_from: "vendor/fal/flux-1.1-pro", reference_count: 2, ocr: { pass: true }, attempts: [{ route: "vendor/fal/flux-1.1-pro", model: "flux-1.1-pro", ms: 900, error: "timeout" }] };
const item = { index: 0, status: "ready", copy: { caption: "hi" }, image, checks: [] };
const pipeline = await import(new URL("harness/pipeline.js", root).href);
mock.module(new URL("harness/pipeline.js", root).href, { namedExports: {
  runTask: async () => ({ status: "ready", spec: { posts: [{}] }, items: [item],
    metrics: { total_ms: 4200, stage_ms: { Writing: 1000 }, cost: { total_usd: 0.0123, calls: 3 }, ledger: [{ model: "anthropic/claude-sonnet-4-6", cost_usd: 0.01 }], models: ["anthropic/claude-sonnet-4-6"] } }),
  rerunItem: async () => ({}),
  reviseComponent: pipeline.reviseComponent,
  publicItem: pipeline.publicItem,
  publicMetrics: pipeline.publicMetrics,
  ETA_SECONDS: pipeline.ETA_SECONDS,
} });
mock.module(new URL("harness/settlement.js", root).href, { namedExports: {
  preflight: async () => ({ ok: true }), openRun: async () => ({ runId: "run" }), settle: async (args) => args.work(), taskCredits: () => 12, MAX_RERUNS_PER_ITEM: 2,
} });
const { default: app, snapshot } = await import("./tasks.js");

const INTERNAL = /"(model|models|model_used|fallback_from|attempts|route|ledger|cost|provider|provider_endpoint|prompt_tokens|completion_tokens|cached_tokens|[a-z_]*_usd)":/;

test("client task snapshot carries credits but no *_usd, model routes or ledger", async () => {
  const created = await app.request("/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId: "brand", type: "social_post", brief: "A valid task brief" }) });
  assert.equal(created.status, 202);
  const { id } = await created.json();
  await new Promise((r) => setImmediate(r));   // let settle() land the result

  const client = await (await app.request(`/${id}`)).text();
  assert.doesNotMatch(client, INTERNAL);
  assert.doesNotMatch(client, /flux|sonnet|anthropic|fal\//i);
  const body = JSON.parse(client);
  assert.equal(body.credits, 12);
  assert.equal(body.result.metrics.total_ms, 4200);
  assert.equal(body.items[0].image.asset_url, "https://x/img.png");
  assert.equal(body.workspaceId, undefined);

  const team = await (await app.request(`/${id}`, { headers: { "x-scope": "platform" } })).json();
  assert.equal(team.result.metrics.cost.total_usd, 0.0123);
  // Public task items never carry vendor fields (client-payload). Platform still sees cost.
  assert.equal(team.items[0].image.model, undefined);
  assert.equal(team.items[0].image.asset_url, "https://x/img.png");
});

test("snapshot redacts rerun metrics for clients", () => {
  const job = { id: "j", workspaceId: "ws", credits: 3, items: [item], reruns: [{ index: 0, run_id: "r", total_ms: 10, cost: { total_usd: 0.002 }, ledger: [] }] };
  const out = JSON.stringify(snapshot(job, { scope: "workspace" }));
  assert.doesNotMatch(out, INTERNAL);
  assert.match(out, /"credits":3/);
  assert.match(JSON.stringify(snapshot(job, { scope: "platform" })), /"total_usd":0.002/);
});

test("redactForClient strips internal keys inside persisted JSON body strings", async () => {
  const { redactForClient, forViewer } = await import("../lib/client-redact.js");
  const row = { id: "o", body: JSON.stringify({ text: "hi", model: "vendor/fal/flux-schnell", cost: { total_usd: 1 }, provider_endpoint: "https://fal.run" }) };
  const clean = JSON.parse(redactForClient(row).body);
  assert.equal(clean.text, "hi");
  assert.equal("model" in clean, false);
  assert.equal("cost" in clean, false);
  assert.equal("provider_endpoint" in clean, false);
  assert.equal(forViewer({ scope: "platform" }, row).body, row.body);
});

test("routeTier maps routes to the opaque re-run tiers clients see", async () => {
  const { routeTier } = await import("../lib/client-redact.js");
  for (const [route, tier] of [["anthropic/claude-opus-4-7", "premium"], ["anthropic/claude-sonnet-4-6", "standard"], ["anthropic/claude-haiku-4-5-20251001", "fast"],
    ["openrouter/google/gemini-2.5-pro", "longContext"], ["openrouter/google/gemini-2.5-flash", "economy"],
    ["vendor/fal/flux-1.1-pro", "imagePremium"], ["vendor/fal/flux-schnell", "imageDraft"], ["vendor/fal/recraft-v3", "illustration"]]) assert.equal(routeTier(route), tier, route);
  assert.equal(routeTier(undefined), null);
});
