import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { rows, selectRows, buildScopedUpdates } from "./seed-specs.mjs";
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
test("exactly eight hero rows upgrade; every non-hero primary and null fallback is preserved", () => {
  assert.deepEqual(rows.map(row=>row.specialist_id).sort(),Object.keys(baseline).sort());
  for (const row of rows) {
    const route = row.payload.modelRouting;
    if (heroes[row.specialist_id]) assert.deepEqual([route.primary, route.fallback], heroes[row.specialist_id]);
    else { assert.equal(route.primary, previousRoutes[baseline[row.specialist_id]], row.specialist_id); assert.equal(route.fallback,null); }
  }
  assert.equal(rows.filter(row=>row.payload.modelRouting.fallback).length,8);
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
