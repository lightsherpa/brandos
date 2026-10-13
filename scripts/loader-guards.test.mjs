import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkArgs, checkLatest, isLocalUrl } from "./lib/loader-guards.mjs";
const ID = "35f265f0-0546-4a9a-b793-a49887ad7125";
const base = { only: ID, expectedId: ID, assets: "/tmp/a", actor: "u", expectVersion: "2", apply: false, iKnowProd: false, supabaseUrl: "http://127.0.0.1:54321" };
test("isLocalUrl", () => {
  assert.ok(isLocalUrl("http://127.0.0.1:54321")); assert.ok(isLocalUrl("http://localhost:54321"));
  assert.ok(!isLocalUrl("https://yemzrohzqfuxmekcgnnh.supabase.co")); assert.ok(!isLocalUrl("garbage"));
});
test("checkArgs requires --only, --expect-version", () => {
  assert.equal(checkArgs(base), null);
  assert.match(checkArgs({ ...base, only: "x" }), /--only/);
  assert.match(checkArgs({ ...base, expectVersion: null }), /--expect-version/);
  assert.match(checkArgs({ ...base, expectVersion: "v2" }), /--expect-version/);
});
test("--apply on non-local DB needs --i-know-this-is-prod", () => {
  const prod = { ...base, supabaseUrl: "https://yemzrohzqfuxmekcgnnh.supabase.co" };
  assert.equal(checkArgs(prod), null); // dry-run is fine
  assert.match(checkArgs({ ...prod, apply: true }), /i-know-this-is-prod/);
  assert.equal(checkArgs({ ...prod, apply: true, iKnowProd: true }), null);
  assert.equal(checkArgs({ ...base, apply: true }), null); // local
});
test("checkLatest refuses version mismatch and complete foundation", () => {
  assert.equal(checkLatest({ latest: { version: 2 }, expectVersion: "2", foundationComplete: false }), null);
  assert.match(checkLatest({ latest: { version: 3 }, expectVersion: "2", foundationComplete: false }), /latest version is v3/);
  assert.match(checkLatest({ latest: { version: 2 }, expectVersion: "2", foundationComplete: true }), /already has a complete foundation/);
  assert.match(checkLatest({ latest: null, expectVersion: "1" }), /no Brand Core/);
});
test("loader never self-certifies", () => {
  const src = fs.readFileSync(new URL("./load-cake-me-foundation.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /selfCertifyBio|CERTIFICATION_SECTIONS|reviewedSections/);
});
