import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bioStage, productionBlocker, selectProductionBio } from "./bio-stage.js";

const now = new Date("2026-10-03T12:00:00Z");
const future = "2027-01-01T00:00:00Z";
const past = "2026-01-01T00:00:00Z";

test("stage follows the agreed journey", () => {
  assert.equal(bioStage(null, false, now), "no_bio");
  assert.equal(bioStage({}, false, now), "draft");
  assert.equal(bioStage({ self_certified: true }, false, now), "checks_passed");
  assert.equal(bioStage({ self_certified: true }, true, now), "awaiting_review");
  assert.equal(bioStage({ certified: true, cert_valid_until: future }, false, now), "certified");
  assert.equal(bioStage({ certified: true, client_acceptance_required: true }, false, now), "awaiting_your_approval");
  assert.equal(bioStage({ certified: true, client_acceptance_required: true, client_accepted_at: past }, false, now), "certified");
  assert.equal(bioStage({ certified: true, cert_valid_until: past }, false, now), "expired");
});

test("self-certification below 80 never unlocks production", () => {
  assert.equal(productionBlocker({ self_certified: true }, now).code, "BIO_NOT_CERTIFIED");
  assert.equal(productionBlocker({ self_certified: true, score: 79 }, now).code, "BIO_NOT_CERTIFIED");
  assert.equal(productionBlocker(null, now).code, "BIO_NOT_CERTIFIED");
});

test("specialist runs use the newest certified BIO, including a self-cert at or above 80", () => {
  const v1 = { version: 1, certified: true, score: 90 };
  const v2 = { version: 2, certified: false, self_certified: true, score: 82 };
  const low = { version: 3, self_certified: true, score: 70 };
  const expired = { version: 4, certified: true, cert_valid_until: past };
  const awaiting = { version: 5, certified: true, client_acceptance_required: true };
  assert.equal(productionBlocker({ self_certified: true, score: 80, version: 2 }, now), null);
  assert.equal(selectProductionBio([v1, v2], now).version, 2);
  assert.equal(selectProductionBio([v1, low], now).version, 1);
  assert.equal(selectProductionBio([low], now), null);
  assert.equal(selectProductionBio([v2], now).version, 2);
  assert.equal(selectProductionBio([v1, expired], now).version, 1);
  assert.equal(selectProductionBio([v1, v2, awaiting], now).version, 5);
  assert.equal(productionBlocker(awaiting, now).code, "BIO_AWAITING_ACCEPTANCE");
  const source = readFileSync(new URL("./load-brand-bio.js", import.meta.url), "utf8");
  assert.match(source, /selectProductionBio\(rows \|\| \[\]\)/);
  assert.match(source, /function loadBioForRun/);
});

test("unchanged Creative Director certification unlocks directly", () => {
  assert.equal(productionBlocker({ certified: true, cert_valid_until: future }, now), null);
  assert.equal(productionBlocker({ certified: true, cert_valid_until: null }, now), null);
});

test("changed BIO waits for the user's acceptance, then unlocks without another review", () => {
  const changed = { certified: true, client_acceptance_required: true };
  assert.equal(productionBlocker(changed, now).code, "BIO_AWAITING_ACCEPTANCE");
  assert.equal(productionBlocker({ ...changed, client_accepted_at: past }, now), null);
});

test("expired certification blocks", () => {
  assert.equal(productionBlocker({ certified: true, cert_valid_until: past }, now).code, "BIO_NOT_CERTIFIED");
});

test("acceptance binds to the exact version the user reviewed", async () => {
  const { acceptanceError } = await import("./bio-stage.js");
  const pending = { certified: true, client_acceptance_required: true, version: 4 };
  assert.equal(acceptanceError(pending, 4), null);
  assert.equal(acceptanceError(pending, 3).code, "STALE_VERSION");
  assert.equal(acceptanceError({ ...pending, client_accepted_at: past }, 4).code, "NOTHING_TO_ACCEPT");
  assert.equal(acceptanceError({ certified: true, version: 4 }, 4).code, "NOTHING_TO_ACCEPT");
  assert.equal(acceptanceError(null, 4).code, "NOTHING_TO_ACCEPT");
});
