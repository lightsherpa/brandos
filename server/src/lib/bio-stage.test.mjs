import { test } from "node:test";
import assert from "node:assert/strict";
import { bioStage, productionBlocker } from "./bio-stage.js";

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

test("self-certification alone never unlocks production or analysis", () => {
  assert.equal(productionBlocker({ self_certified: true }, now).code, "BIO_NOT_CERTIFIED");
  assert.equal(productionBlocker(null, now).code, "BIO_NOT_CERTIFIED");
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
