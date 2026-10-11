import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  PROVIDER_TOKEN_FLOOR,
  TEXT_TOKEN_CAP,
  TEXT_TOKEN_FLOOR,
  resolveTextTokenBudget,
} from "./token-budget.js";

test("a low-credit text specialist gets the floor instead of cr_estimate * 100", () => {
  // Social Captions is 3 credits. The old path asked for 300 tokens and
  // truncated the caption. Subject Lines / Microcopy are 2 credits (200).
  assert.equal(resolveTextTokenBudget({ spec: { payload: { cr_estimate: 3 } } }), TEXT_TOKEN_FLOOR);
  assert.equal(resolveTextTokenBudget({ spec: { payload: { cr_estimate: 2 } } }), TEXT_TOKEN_FLOOR);
  assert.equal(resolveTextTokenBudget({ spec: { payload: {} } }), TEXT_TOKEN_FLOOR);
});

test("a per-spec max_output_tokens is honored inside the floor and cap", () => {
  assert.equal(
    resolveTextTokenBudget({ spec: { payload: { cr_estimate: 3, max_output_tokens: 3500 } } }),
    3500,
  );
  assert.equal(
    resolveTextTokenBudget({ spec: { payload: { cr_estimate: 3, maxOutputTokens: 5000 } } }),
    5000,
  );
  assert.equal(
    resolveTextTokenBudget({ spec: { payload: { max_output_tokens: 12000 } } }),
    TEXT_TOKEN_CAP,
    "a spec cannot raise the cap by itself",
  );
  assert.equal(
    resolveTextTokenBudget({ spec: { payload: { max_output_tokens: 100, cr_estimate: 3 } } }),
    TEXT_TOKEN_FLOOR,
    "a spec budget under the floor is raised so low-credit agents are not truncated again",
  );
});

test("credit estimates above the floor are kept until they hit the cap", () => {
  assert.equal(resolveTextTokenBudget({ spec: { payload: { cr_estimate: 30 } } }), 3000);
  assert.equal(resolveTextTokenBudget({ spec: { payload: { cr_estimate: 90 } } }), TEXT_TOKEN_CAP);
});

test("an explicit maxTokens is kept, with the 16-token provider floor", () => {
  assert.equal(resolveTextTokenBudget({ maxTokens: 300, spec: { payload: { cr_estimate: 1 } } }), 300);
  assert.equal(resolveTextTokenBudget({ maxTokens: 1600 }), 1600);
  assert.equal(resolveTextTokenBudget({ maxTokens: 4 }), PROVIDER_TOKEN_FLOOR);
  assert.equal(resolveTextTokenBudget({ maxTokens: 0, spec: { payload: { cr_estimate: 3 } } }), TEXT_TOKEN_FLOOR);
});

test("text specialist runs do not pass cr_estimate * 100 as maxTokens", () => {
  const src = fs.readFileSync(new URL("../../routes/runs.js", import.meta.url), "utf8");
  assert.match(src, /isDeliverableText\s*\n?\s*\?/);
  assert.doesNotMatch(src, /cr_estimate \?\? 8\) \* 100/);
  assert.match(src, /maxTokens:\s*isDeliverableText/);
  assert.match(src, /resolveTextTokenBudget\(\{\s*spec:\s*effectiveSpec\s*\}\)/);
});
