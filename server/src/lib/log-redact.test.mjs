import assert from "node:assert/strict";
import test from "node:test";

import { redactLogLine } from "./log-redact.js";
import { mintDelegationToken } from "./delegation-token.js";

test("a real minted token never survives a request log line", () => {
  const { token } = mintDelegationToken();
  // The exact shape hono/logger emits.
  const line = `  <-- GET /api/discovery/delegation/${token}`;
  const redacted = redactLogLine(line);
  assert.ok(!redacted.includes(token), "the live credential must not reach the log sink");
  assert.equal(redacted, "  <-- GET /api/discovery/delegation/[redacted]");
});

test("PATCH lines and status lines are redacted too", () => {
  const { token } = mintDelegationToken();
  for (const line of [
    `  --> PATCH /api/discovery/delegation/${token} 200 12ms`,
    `  <-- PATCH /api/discovery/delegation/${token}`,
    `error handling /api/discovery/delegation/${token}: boom`,
  ]) {
    assert.ok(!redactLogLine(line).includes(token), line);
  }
});

test("the emailed handoff link shape is redacted wherever it appears", () => {
  const { token } = mintDelegationToken();
  const line = `invite sent: https://app.getcaastor.co/#/discovery/handoff/${token}`;
  assert.ok(!redactLogLine(line).includes(token));
  assert.equal(redactLogLine(line), "invite sent: https://app.getcaastor.co/#/discovery/handoff/[redacted]");
});

test("token-bearing query parameters are redacted", () => {
  assert.equal(redactLogLine("GET /x?token=abc123def&y=1"), "GET /x?token=[redacted]&y=1");
  assert.equal(redactLogLine("GET /x?a=1&access_token=abc123def"), "GET /x?a=1&access_token=[redacted]");
  assert.equal(redactLogLine("GET /x?a=1&TOKEN=abc123def"), "GET /x?a=1&TOKEN=[redacted]");
});

test("multiple tokens in one line are all redacted", () => {
  const a = mintDelegationToken().token;
  const b = mintDelegationToken().token;
  const out = redactLogLine(`/api/discovery/delegation/${a} then /api/discovery/delegation/${b}`);
  assert.ok(!out.includes(a) && !out.includes(b));
});

test("ordinary log lines pass through untouched", () => {
  for (const line of [
    "  <-- GET /api/briefs",
    "  --> POST /api/discovery/delegation 200 41ms", // the create route carries no token in the path
    "caastoros-server listening on http://localhost:8787",
    "  <-- GET /api/runs/9f2b1c4e-0000-4000-8000-000000000000",
  ]) {
    assert.equal(redactLogLine(line), line, line);
  }
});

test("non-string input is coerced rather than thrown on", () => {
  assert.equal(redactLogLine(null), "");
  assert.equal(redactLogLine(undefined), "");
  assert.equal(redactLogLine(42), "42");
});
test('Brand Book capability tokens are redacted from HTML and asset request logs',()=>{
 const token='A'.repeat(43);
 for(const line of [`GET /api/brand-book/shared/${token}`,`GET /brand-book/shared/${token}/assets/asset-001.png 200`,`share: https://brand.test/api/brand-book/shared/${token}?locale=es`,`GET /api/brand-book/shared/%41${token.slice(1)}/assets/asset-001.png`]){
  const redacted=redactLogLine(line);assert.ok(!redacted.includes(token));assert.match(redacted,/brand-book\/shared\/\[redacted\]/);
 }
 assert.equal(redactLogLine('GET /api/brand-book/shared'), 'GET /api/brand-book/shared');
});
