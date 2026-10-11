import test from "node:test";
import assert from "node:assert/strict";
import { outputStatusForQa, parseVoiceQaJson, voiceQa } from "./qa-voice.js";

function completer(replies) {
  const calls = [];
  const complete = async function* (params) {
    calls.push(params);
    const reply = replies[calls.length - 1];
    if (reply?.error) yield { type: "error", message: reply.error };
    else {
      yield { type: "token", text: reply.text };
      yield { type: "done", usage: { cost_usd: 0.01 } };
    }
  };
  return { calls, complete };
}

test("a valid JSON verdict is used without a second call", async () => {
  const { calls, complete } = completer([{ text: '{"passed":true,"voice_match":88,"violations":[]}' }]);
  const qa = await voiceQa({ body: "A quiet cup.", bio: { voice: {} }, refusals: [], complete });
  assert.equal(calls.length, 1);
  assert.equal(qa.passed, true);
  assert.equal(outputStatusForQa(qa), "approved");
});

test("an unparseable reply is retried once with stricter JSON instructions", async () => {
  const { calls, complete } = completer([
    { text: "I think this passes." },
    { text: '{"passed":false,"voice_match":40,"violations":["register drifts"]}' },
  ]);
  const qa = await voiceQa({ body: "A quiet cup.", bio: { voice: {} }, refusals: [], complete });
  assert.equal(calls.length, 2);
  assert.match(calls[1].system, /exactly one JSON object/i);
  assert.match(calls[1].messages[0].content, /not valid JSON/);
  assert.equal(qa.passed, false);
  assert.equal(qa.voice_match, 40);
  assert.equal(outputStatusForQa(qa), "flagged");
  assert.equal(qa.usage.cost_usd, 0.02);
});

test("a still-unparseable reply is needs_review and never approved", async () => {
  const { calls, complete } = completer([
    { text: "not json" },
    { text: "still not json" },
  ]);
  const qa = await voiceQa({
    body: "A quiet cup.",
    bio: { voice: { forbidden: [] } },
    refusals: [],
    complete,
  });
  assert.equal(calls.length, 2);
  assert.equal(qa.passed, false);
  assert.equal(qa.status, "needs_review");
  assert.equal(outputStatusForQa(qa), "needs_review");
  assert.ok(qa.violations.includes("qa_unparseable_response"));
  assert.notEqual(outputStatusForQa(qa), "approved");
});

test("JSON wrapped in prose still parses", () => {
  const verdict = parseVoiceQaJson('Here you go: {"passed":true,"voice_match":72,"violations":[]} thanks');
  assert.equal(verdict.voice_match, 72);
});
