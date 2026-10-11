import { test } from "node:test";
import assert from "node:assert/strict";
import { outputStatusForQa, voiceQa } from "./qa-voice.js";
import { closeQa, qaNeedsCorrection, selfCorrectText } from "./self-correction.js";

function jsonComplete(payload) {
  const text = JSON.stringify(payload);
  return async function* complete() {
    yield { type: "token", text };
    yield { type: "done", usage: { cost_usd: 0 } };
  };
}

const bio = { voice: { forbidden: ["synergy"], register: "quiet" } };

async function qa(body) {
  return voiceQa({
    body,
    bio,
    refusals: [],
    complete: jsonComplete({ passed: true, voice_match: 88, violations: [] }),
  });
}

test("an off-brand word is caught and fixed", async () => {
  const first = "Unlock synergy for the launch.";
  const fixed = "A quiet cup.";
  const initial = await qa(first);
  assert.equal(initial.passed, false);
  assert.match(initial.violations.join(" "), /synergy/);
  assert.equal(qaNeedsCorrection(initial), true);

  let revisions = 0;
  const result = await selfCorrectText({
    output: first,
    qa: initial,
    revise: async (instruction) => {
      revisions += 1;
      assert.match(instruction, /synergy/);
      assert.match(instruction, /Fix exactly the failing checks/);
      return fixed;
    },
    review: qa,
  });

  assert.equal(revisions, 1);
  assert.equal(result.passes, 1);
  assert.equal(result.output, fixed);
  assert.equal(result.qa.passed, true);
  assert.equal(outputStatusForQa(result.qa), "approved");
  assert.equal(qaNeedsCorrection(result.qa), false);
});

test("needs_review revises at most twice and does not fail open", async () => {
  const stuck = { passed: true, status: "needs_review", violations: ["qa_unparseable_response"], voice_match: null };
  assert.equal(closeQa(stuck).passed, false);
  let calls = 0;
  const result = await selfCorrectText({
    output: "draft",
    qa: stuck,
    revise: async () => {
      calls += 1;
      return `draft ${calls}`;
    },
    review: async () => stuck,
  });
  assert.equal(calls, 2);
  assert.equal(result.passes, 2);
  assert.equal(result.qa.passed, false);
  assert.equal(result.qa.status, "needs_review");
  assert.equal(outputStatusForQa(result.qa), "needs_review");
  assert.notEqual(outputStatusForQa(result.qa), "approved");
});

test("a passing verdict does not revise, and a failed revise stays unapproved", async () => {
  const passed = await selfCorrectText({
    output: "A quiet cup.",
    qa: { passed: true, voice_match: 90, violations: [] },
    revise: async () => { throw new Error("should not revise"); },
    review: async () => { throw new Error("should not review"); },
  });
  assert.equal(passed.passes, 0);
  assert.equal(passed.qa.passed, true);

  const blocked = await selfCorrectText({
    output: "synergy",
    qa: { passed: false, violations: ['uses forbidden word "synergy"'] },
    revise: async () => { throw new Error("provider down"); },
    review: async () => ({ passed: true, violations: [] }),
  });
  assert.equal(blocked.passes, 0);
  assert.equal(blocked.output, "synergy");
  assert.equal(blocked.qa.passed, false);
  assert.equal(outputStatusForQa(blocked.qa), "flagged");
});
