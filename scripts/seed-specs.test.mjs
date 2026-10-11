import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { rows, selectRows, buildScopedUpdates, parseSeedOptions, seedSpecs } from "./seed-specs.mjs";
const baseline = JSON.parse(fs.readFileSync(new URL("./fixtures/hero-model-baseline.json", import.meta.url)));
const heroes = {
  a02: ["anthropic/claude-sonnet-5-5", "anthropic/claude-sonnet-4-6"],
  a12: ["anthropic/claude-sonnet-5-5", "anthropic/claude-sonnet-4-6"],
  a13: ["anthropic/claude-sonnet-5-5", "anthropic/claude-sonnet-4-6"],
  a14: ["openrouter/google/gemini-3.8-flash", "openrouter/google/gemini-2.5-flash"],
  a16: ["anthropic/claude-sonnet-5-5", "anthropic/claude-sonnet-4-6"],
  a18: ["anthropic/claude-haiku-5-5", "anthropic/claude-haiku-4-5-20251001"],
  a24: ["openrouter/google/gemini-3.8-flash", "openrouter/google/gemini-2.5-flash"],
  a37: ["anthropic/claude-sonnet-5-5", "anthropic/claude-sonnet-4-6"],
};
const previousRoutes = {
  opus: "anthropic/claude-opus-4-7", sonnet: "anthropic/claude-sonnet-4-6", haiku: "anthropic/claude-haiku-4-5-20251001",
  gpt5: "openrouter/openai/gpt-5", gemPro: "openrouter/google/gemini-2.5-pro", gemFlash: "openrouter/google/gemini-2.5-flash",
  gptimage: "vendor/fal/gpt-image-2", flux: "vendor/fal/flux-1.1-pro", fluxSchnell: "vendor/fal/flux-schnell", recraft: "vendor/fal/recraft-v3",
  exa: "vendor/exa", elevenlabs: "vendor/elevenlabs", v0: "vendor/v0", gamma: "vendor/gamma", framer: "vendor/framer",
};
test("exactly eight hero rows upgrade; non-hero primaries stay unchanged with approved image fallbacks", () => {
  assert.deepEqual(rows.map(row=>row.specialist_id).sort(),Object.keys(baseline).sort());
  for (const row of rows) {
    const route = row.payload.modelRouting;
    if (heroes[row.specialist_id]) assert.deepEqual([route.primary, route.fallback], heroes[row.specialist_id]);
    else { assert.equal(route.primary, previousRoutes[baseline[row.specialist_id]], row.specialist_id); assert.equal(route.fallback, { gptimage: "vendor/fal/flux-1.1-pro", flux: "vendor/fal/flux-schnell" }[baseline[row.specialist_id]] ?? null, row.specialist_id); }
  }
  assert.equal(rows.filter(row=>row.payload.modelRouting.fallback).length, Object.keys(heroes).length + Object.values(baseline).filter(key => ["gptimage", "flux"].includes(key)).length);
});
test("--only selects eight rows and rejects invalid ids or arguments", () => {
  assert.equal(selectRows(["--only",Object.keys(heroes).join(",")]).length,8);
  assert.throws(()=>selectRows(["--only","a02,bogus"]),/Unknown/);
  assert.throws(()=>selectRows(["--only",""]),/Usage/);
  assert.throws(()=>selectRows(["--all"]),/Usage/);
});
test("hero models have labels, are runnable, and retain the three-agent cap", () => {
  const sandbox = { window: {}, localStorage: { getItem: () => null, setItem: () => {} } };
  vm.runInNewContext(fs.readFileSync(new URL("../src/portal-data.js", import.meta.url), "utf8"), sandbox);
  for (const id of Object.keys(heroes)) {
    const agent = sandbox.window.CI_AGENTS.find(row => row.id === id);
    assert.ok(sandbox.window.CI_MODELS[agent.model]?.label, id);
  }
  const portal = fs.readFileSync(new URL("../src/portal-brandolph.jsx",import.meta.url),"utf8");
  for (const model of ["sonnet55","haiku55","gemFlash38"]) assert.match(portal,new RegExp(`"${model}"`));
  assert.match(portal,/RUNNABLE\(a\.model\)\)\.slice\(0, 3\)/);
});

test("scoped seed changes only routing and preserves custom payload and live status", () => {
  const selected = selectRows(["--only", "a02"]);
  const existing = { specialist_id: "a02", version: 1, active: false,
    payload: { name: "custom", max_output_tokens: 3456, tools: ["private tool"], modelRouting: { primary: "old" } } };
  const [updated] = buildScopedUpdates(selected, [existing]);
  assert.equal(updated.active, false);
  assert.equal(updated.payload.name, "custom");
  assert.equal(updated.payload.max_output_tokens, 3456);
  assert.deepEqual(updated.payload.tools, ["private tool"]);
  assert.equal(updated.payload.modelRouting.primary, "anthropic/claude-sonnet-5-5");
  assert.equal(existing.payload.modelRouting.primary, "old");
  assert.throws(() => buildScopedUpdates(selected, []), /requires existing/);
});

test("--keep-db-route replaces only prompt/contract fields and preserves the complete DB route", () => {
  const oldRoute = { primary: "anthropic/claude-opus-5", fallback: "custom/fallback", reason: "manual cost setting", routingMetadata: { owner: "operator" } };
  const existing = { specialist_id: "a07", version: 1, active: false, payload: {
    name: "Custom name", cr_estimate: 9, max_output_tokens: 1234, internal: true,
    custom: { keep: true }, modelRouting: oldRoute, role: "old role", outputContract: "old contract",
  } };
  const fields = { role: "new role", objective: "new objective", method: ["new method"],
    outputContract: "new contract", voice: "new voice", tools: ["tool"], refusals: ["refusal"], bioSlices: ["voice"] };
  const source = { specialist_id: "a07", version: 1, active: true, payload: {
    ...fields, name: "Source name", cr_estimate: 99, max_output_tokens: 9999,
    modelRouting: { primary: "anthropic/claude-opus-4-7", fallback: null },
  } };
  const original = structuredClone(existing);
  const [updated] = buildScopedUpdates([source], [existing], { keepDbRoute: true });
  assert.deepEqual(updated, { ...existing, payload: { ...existing.payload, ...fields } });
  assert.deepEqual(updated.payload.modelRouting, oldRoute);
  assert.deepEqual(existing, original);
});
test("route-preserving seeds reject missing DB rows or missing routing", () => {
  const source = rows.find(row => row.specialist_id === "a07");
  assert.throws(() => buildScopedUpdates([source], [], { keepDbRoute: true }), /requires existing/);
  assert.throws(() => buildScopedUpdates([source], [{ ...source, payload: {} }], { keepDbRoute: true }), /missing DB routing/);
});
test("seed options accept equals syntax and dry-run/keep flags in either order; reject full seeds", () => {
  const options = parseSeedOptions(["--dry-run", "--only=a07,a08", "--keep-db-route"]);
  assert.deepEqual([...options.ids], ["a07", "a08"]);
  assert.equal(options.keepDbRoute, true); assert.equal(options.dryRun, true);
  assert.equal(selectRows(["--only=a07,a08", "--keep-db-route"]).length, 2);
  for (const args of [[], ["--all"], ["--keep-db-route"], ["--only"], ["--only=a07,"], ["--only=a07", "--only=a08"]]) {
    assert.throws(() => parseSeedOptions(args), /Usage/);
  }
});
test("--dry-run --keep-db-route fetches live routing but never sends a write", async () => {
  const route = { primary: "anthropic/claude-opus-5", fallback: "custom/fallback", reason: "manual" };
  const existing = { specialist_id: "a07", version: 1, active: false, payload: { modelRouting: route, custom: "preserve" } };
  const calls = [], output = [];
  const result = await seedSpecs(["--only=a07", "--keep-db-route", "--dry-run"], {
    env: { SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-key" },
    fetchImpl: async (url, options) => { calls.push({ url, options }); return Response.json([existing]); },
    logger: { log: message => output.push(message) },
  });
  assert.equal(calls.length, 1);
  assert.ok(calls.every(call => !call.options.method || call.options.method === "GET"));
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.updates[0].payload.modelRouting, route);
  assert.equal(result.updates[0].payload.custom, "preserve");
  assert.ok(output.some(line => line.includes("anthropic/claude-opus-5\tcustom/fallback")));
  assert.ok(output.some(line => line.includes("nothing written")));
});
