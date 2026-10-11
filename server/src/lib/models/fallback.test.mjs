import test from "node:test";
import assert from "node:assert/strict";
import { createCompletionStreamer, isRetryableError } from "./fallback.js";
const primary = "anthropic/primary", fallback = "openrouter/fallback";
const params = { spec: { payload: { modelRouting: { primary, fallback } } } };
const done = { type: "done", usage: { model: "result", cost_usd: 0.01 } };
const collect = async iterable => { const events = []; for await (const event of iterable) events.push(event); return events; };
function harness(events, timeout = 100) {
  const calls = [];
  const stream = createCompletionStreamer(async function* (options) {
    calls.push(options);
    if (options.route === primary) yield* events(options);
    else { yield { type: "token", text: "fallback" }; yield done; }
  }, timeout);
  return { calls, run: (input = params) => collect(stream(input)) };
}
for (const status of [404, 429, 500, 501, 503, 529, 599]) {
  test(`${status} before a token falls back exactly once and records provenance`, async () => {
    const h = harness(async function* () { yield { type: "error", status, message: `HTTP ${status}` }; });
    const result = await h.run();
    assert.deepEqual(h.calls.map(x => x.route), [primary, fallback]);
    assert.equal(result.at(-1).usage.fallback_from, primary);
    assert.equal(h.calls[1].telemetry.fallbackFrom, primary);
    assert.equal(h.calls[0].signal.aborted, true);
  });
}
test("first-token timeout cancels stalled primary and ignores late output", async () => {
  const h = harness(async function* ({ signal }) {
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    yield { type: "token", text: "late primary" };
  }, 5);
  const result = await h.run();
  assert.equal(result[0].text, "fallback");
  assert.equal(h.calls[0].signal.aborted, true);
});
test("metadata and empty tokens do not stop the first-token deadline", async () => {
  const h = harness(async function* ({ signal }) {
    yield { type: "metadata" }; yield { type: "token", text: "" };
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
  }, 5);
  assert.deepEqual((await h.run()).map(x => x.type), ["token", "done"]);
});
for (const status of [400, 401, 403]) {
  test(`${status} never falls back even with retryable words in the error`, async () => {
    const h = harness(async function* () { yield { type: "error", status, message: `HTTP ${status}: network timeout 529 not found` }; });
    assert.equal((await h.run())[0].type, "error");
    assert.equal(h.calls.length, 1);
  });
}
test("successful primary keeps its output and usage", async () => {
  const h = harness(async function* () { yield { type: "token", text: "primary" }; yield done; });
  assert.deepEqual(await h.run(), [{ type: "token", text: "primary" }, done]);
  assert.equal(h.calls.length, 1);
});
test("error after first text token never falls back", async () => {
  const h = harness(async function* () { yield { type: "token", text: "partial" }; yield { type: "error", status: 529 }; });
  assert.equal((await h.run()).at(-1).type, "error"); assert.equal(h.calls.length, 1);
});
test("deadline is cleared after a token even if the rest of the stream is slow", async () => {
  const h = harness(async function* () {
    yield { type: "token", text: "primary" };
    await new Promise(resolve => setTimeout(resolve, 15)); yield done;
  }, 5);
  assert.equal((await h.run()).at(-1).type, "done"); assert.equal(h.calls.length, 1);
});
test("without fallback the existing route has no deadline or extra parameters", async () => {
  const h = harness(async function* () {
    await new Promise(resolve => setTimeout(resolve, 15)); yield { type: "error", status: 529 };
  }, 1);
  await h.run({ spec: { payload: { modelRouting: { primary, fallback: null } } } });
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].signal, undefined);
});
test("fallback failure stops after one hop", async () => {
  let calls = 0;
  const stream = createCompletionStreamer(async function* () { calls++; yield { type: "error", status: 503 }; });
  assert.equal((await collect(stream(params)))[0].status, 503); assert.equal(calls, 2);
});
test("network exceptions can fall back; auth/missing keys cannot", async () => {
  const h = harness(async function* () { throw new Error("fetch failed"); });
  assert.equal((await h.run()).at(-1).usage.fallback_from, primary);
  assert.equal(isRetryableError("Server has no ANTHROPIC_API_KEY configured."), false);
  assert.equal(isRetryableError("401 unauthorized: model not found"), false);
});
