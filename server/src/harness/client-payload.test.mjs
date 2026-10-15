import { test } from "node:test";
import assert from "node:assert/strict";
import { publicItem, internalItem, publicMetrics } from "./pipeline.js";
import { clientTaskSnapshot, taskOutput, rerunOutput } from "../routes/tasks.js";
import { sanitizeOutput } from "../lib/output-quality.js";

const vendorImage = {
  rejected: false,
  asset_url: "https://img.test/a.png",
  model: "vendor/fal/gpt-image-2.5",
  fallback_from: "vendor/fal/nano-banana-2.1",
  route: "vendor/fal/gpt-image-2.5",
  prompt: "use vendor/fal/gpt-image-2.5",
  cost_usd: 0.08,
  width: 1080,
  height: 1350,
  uses_reference: true,
  reference_count: 3,
  ocr: { pass: true, reason: "no text detected" },
  ms: 40,
  attempts: [{
    route: "vendor/fal/gpt-image-2.5",
    model: "gpt-image-2.5-edit",
    fallback_from: "vendor/fal/nano-banana-2.1",
    ms: 30,
    error: "Unknown fal route: vendor/fal/gpt-image-2.5",
    ocr: { pass: false },
  }],
  error: "fal submit failed for vendor/fal/gpt-image-2.5",
};
const metrics = {
  total_ms: 12,
  cost: { total_usd: 0.2, calls: 1 },
  models: ["vendor/fal/gpt-image-2.5", "anthropic/claude-sonnet-4-6"],
  ledger: [{ step: "imaging", model: "vendor/fal/gpt-image-2.5", fallback_from: "vendor/fal/nano-banana-2.1", route: "vendor/fal/gpt-image-2.5", cost_usd: 0.2, error: "openrouter/google/gemini-3.8-flash unavailable" }],
};

function vendorHits(value, path = "$") {
  const hits = [];
  const walk = (node, at) => {
    if (Array.isArray(node)) return node.forEach((entry, index) => walk(entry, `${at}[${index}]`));
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (["model", "models", "fallback_from", "route"].includes(key)) hits.push(`${at}.${key}`);
      walk(child, `${at}.${key}`);
    }
  };
  walk(value, path);
  const text = JSON.stringify(value);
  for (const token of ["vendor/fal", "gpt-image", "nano-banana", "openrouter/", "anthropic/", "claude", "gemini", "flux", "recraft"]) {
    if (text.includes(token)) hits.push(token);
  }
  if (/\bfal\b/i.test(text)) hits.push("fal");
  return hits;
}

test("public items omit model, vendor route, and fallback fields", () => {
  const raw = { status: "ready", html: "<html>ok</html>", copy: { caption: "Friday" }, image: vendorImage };
  const pub = publicItem(raw);
  assert.deepEqual(vendorHits(pub), []);
  assert.equal(pub.image.asset_url, "https://img.test/a.png");
  assert.equal(pub.image.reference_count, 3);
  assert.equal(pub.image.ocr.pass, true);
  assert.equal(pub.image.attempts[0].ocr_pass, false);
  assert.equal(pub.image.attempts[0].ms, 30);
  assert.equal(pub.html, "<html>ok</html>");
  assert.equal("prompt" in pub.image, false);
  assert.equal("cost_usd" in pub.image, false);
  const again = publicItem(pub);
  assert.deepEqual(vendorHits(again), []);
  assert.equal(again.image.attempts[0].ocr_pass, false);
  const kept = internalItem(raw);
  assert.equal(kept.image.model, "vendor/fal/gpt-image-2.5");
  assert.equal(kept.image.fallback_from, "vendor/fal/nano-banana-2.1");
  assert.equal(kept.image.attempts[0].route, "vendor/fal/gpt-image-2.5");
  assert.equal(kept.image.attempts[0].model, "gpt-image-2.5-edit");
  assert.equal(kept.image.asset_url, "https://img.test/a.png");
});

test("client metrics and task snapshots drop vendor fields without mutating server records", () => {
  const serverMetrics = structuredClone(metrics);
  const shown = publicMetrics(serverMetrics);
  assert.deepEqual(vendorHits(shown), []);
  assert.equal(shown.cost.total_usd, 0.2);
  assert.equal(shown.ledger[0].step, "imaging");
  assert.equal(shown.ledger[0].cost_usd, 0.2);
  assert.deepEqual(serverMetrics.models, metrics.models);
  assert.equal(serverMetrics.ledger[0].model, "vendor/fal/gpt-image-2.5");
  const job = {
    id: "task", workspaceId: "secret-ws", type: "social_post", heroes: false,
    items: [internalItem({ index: 0, status: "ready", html: "<html>ok</html>", image: vendorImage })],
    result: { spec: { posts: [{ caption: "Friday" }] }, metrics: serverMetrics },
    reruns: [{ index: 0, run_id: "run", ...structuredClone(metrics) }],
  };
  const view = clientTaskSnapshot(job);
  assert.equal(view.workspaceId, undefined);
  assert.deepEqual(vendorHits(view), []);
  assert.equal(view.items[0].image.asset_url, "https://img.test/a.png");
  assert.equal(view.result.metrics.cost.calls, 1);
  assert.equal(view.reruns[0].run_id, "run");
  assert.equal(job.result.metrics.models[0], "vendor/fal/gpt-image-2.5");
  assert.equal(job.items[0].image.model, "vendor/fal/gpt-image-2.5");
});

test("persisted task and rerun bodies and output reads omit vendor fields", () => {
  const res = { status: "ready", spec: { posts: [] }, items: [internalItem({ index: 0, status: "ready", image: vendorImage })], metrics, brand_core: null };
  const job = { id: "task", type: "social_post", brief: "Make Friday sweeter", heroes: false, notices: [], credits: 12, brand_core: {}, provenance: {} };
  const stored = JSON.parse(taskOutput(job, res).body);
  assert.deepEqual(vendorHits(stored), []);
  assert.equal(stored.items[0].image.asset_url, "https://img.test/a.png");
  assert.equal(stored.snapshot.credits, 12);
  assert.equal(stored.snapshot.metrics.cost, undefined);
  assert.equal(res.metrics.models[0], "vendor/fal/gpt-image-2.5");
  assert.equal(res.items[0].image.model, "vendor/fal/gpt-image-2.5");
  const rerun = JSON.parse(rerunOutput(job, 0, { item: internalItem({ index: 0, status: "flagged", image: vendorImage }), metrics }).body);
  assert.deepEqual(vendorHits(rerun), []);
  assert.equal(rerun.item.image.reference_count, 3);
  const saved = { task_id: "task", items: [{ status: "ready", image: structuredClone(vendorImage) }], snapshot: { metrics: structuredClone(metrics) } };
  const output = { body: JSON.stringify(saved), asset_url: "https://img.test/a.png" };
  const clean = sanitizeOutput(output);
  const body = JSON.parse(clean.body);
  assert.deepEqual(vendorHits(body), []);
  assert.equal(body.items[0].image.asset_url, "https://img.test/a.png");
  assert.equal(JSON.parse(output.body).items[0].image.model, "vendor/fal/gpt-image-2.5");
  const untouched = { body: { items: [{ quality_gated: true, status: "ready", html: "ready HTML" }] } };
  assert.equal(sanitizeOutput(untouched), untouched);
});
