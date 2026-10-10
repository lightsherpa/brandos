// Route-level proof for CAA-51 (CAA-49 §S2). Exercises the real Hono app with
// an in-memory stand-in for Supabase, so these assertions are about the actual
// request/response behaviour rather than a re-implementation of it.
//
// Run: npm run test:delegation
// (needs --experimental-test-module-mocks; kept out of `test:units` so the
// shared suite does not carry an experimental flag.)
//
// What it proves, against the issue's acceptance criteria:
//   • database access cannot recover a usable pending link — the stored row has
//     no plaintext token, only a digest, and replaying the digest fails;
//   • the raw token completes the intended GET → PATCH flow exactly once;
//   • expired, returned, and tampered tokens fail closed;
//   • chapter isolation still holds on both read and write;
//   • oversized / off-schema bodies are rejected;
//   • token spraying and replay hit a rate limit.

import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { randomUUID } from "node:crypto";

const ROOT = new URL("../", import.meta.url);

/* ── in-memory Supabase double ───────────────────────────────────────── */

const db = { brands: [], discovery_sessions: [], discovery_delegations: [] };

function matches(row, filters) {
  return filters.every(([col, val]) => row[col] === val);
}

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.op = "select";
    this.payload = null;
  }
  select() { return this; }
  eq(col, val) { this.filters.push([col, val]); return this; }
  order() { return this; }

  insert(row) {
    this.op = "insert";
    this.payload = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    return this;
  }
  update(patch) { this.op = "update"; this.payload = patch; return this; }

  run() {
    const rows = db[this.table];
    if (this.op === "insert") {
      // Enforce the migration's UNIQUE(token_hash) so a digest collision would
      // surface here rather than silently duplicating a credential.
      if (this.table === "discovery_delegations" && rows.some((r) => r.token_hash === this.payload.token_hash)) {
        return { data: null, error: { message: "duplicate key value violates unique constraint" } };
      }
      rows.push(this.payload);
      return { data: this.payload, error: null };
    }
    if (this.op === "update") {
      const hit = rows.filter((r) => matches(r, this.filters));
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: hit, error: null };
    }
    return { data: rows.filter((r) => matches(r, this.filters)), error: null };
  }

  async maybeSingle() {
    const { data, error } = this.run();
    if (error) return { data: null, error };
    return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
  }
  async single() {
    const r = await this.maybeSingle();
    if (!r.data && !r.error) return { data: null, error: { message: "no rows" } };
    return r;
  }
  then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }
}

const sentEmails = [];

mock.module(new URL("lib/supabase.js", ROOT).href, {
  namedExports: { supabaseAdmin: { from: (table) => new Query(table) }, userClient: () => null },
});
mock.module(new URL("lib/email.js", ROOT).href, {
  namedExports: { sendEmail: async (msg) => { sentEmails.push(msg); } },
});
mock.module(new URL("lib/notify.js", ROOT).href, {
  namedExports: { notify: async () => {}, brandOwnerUserId: async () => "owner-user" },
});
mock.module(new URL("middleware/auth.js", ROOT).href, {
  namedExports: {
    requireAuth: async (c, next) => {
      c.set("auth", { userId: "user-1", workspaceId: "ws-1", role: "owner" });
      return next();
    },
  },
});
// Key rate limits off a per-test header so one test's budget cannot starve the next.
mock.module(new URL("lib/http-policy.js", ROOT).href, {
  namedExports: { requestIp: (c) => c.req.header("x-test-ip") || "203.0.113.1" },
});

const { default: app } = await import("../routes/discovery-delegation.js");

/* ── helpers ─────────────────────────────────────────────────────────── */

const BRAND = "brand-1";
db.brands.push({ id: BRAND, name: "Acme", workspace_id: "ws-1" });

let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter += 1) % 250}`;

function req(path, { method = "GET", body, ip = freshIp() } = {}) {
  return app.request(path, {
    method,
    headers: { "content-type": "application/json", "x-test-ip": ip },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function mintLink(chapter = "voice", ip = freshIp()) {
  const res = await req("/delegation", {
    method: "POST",
    ip,
    body: { brandId: BRAND, chapter, invitee_email: "colleague@example.com" },
  });
  assert.equal(res.status, 200, "delegation should be created");
  return res.json();
}

/* ── at rest ─────────────────────────────────────────────────────────── */

test("the stored row holds no plaintext token — only a digest", async () => {
  const { token } = await mintLink();
  const row = db.discovery_delegations.at(-1);

  assert.equal(row.token, undefined, "the plaintext column is gone (migration drops it)");
  assert.match(row.token_hash, /^[0-9a-f]{64}$/);

  // The decisive property: nothing reachable from the row reconstructs the link.
  const serialised = JSON.stringify(row);
  assert.ok(!serialised.includes(token), "a full dump of the row must not contain the token");

  // …and the digest itself is not a usable credential.
  const replay = await req(`/delegation/${row.token_hash}`);
  assert.equal(replay.status, 404, "replaying the stored digest as a token must miss");
});

test("the raw token is returned exactly once, in the create response and the invite email", async () => {
  sentEmails.length = 0;
  const { token, link } = await mintLink();
  assert.ok(link.includes(token), "the emailed link carries the raw token");
  assert.equal(sentEmails.length, 1);
  assert.ok(sentEmails[0].html.includes(token));
});

/* ── the happy path still works ──────────────────────────────────────── */

test("a raw token completes the intended GET → PATCH flow once", async () => {
  const { token } = await mintLink("voice");

  const read = await req(`/delegation/${token}`);
  assert.equal(read.status, 200);
  const view = await read.json();
  assert.equal(view.chapter, "voice");
  assert.equal(view.brandName, "Acme");

  const write = await req(`/delegation/${token}`, {
    method: "PATCH",
    body: { fields: { register: "Warm, direct.", forbidden: ["synergy"] } },
  });
  assert.equal(write.status, 200);
  assert.deepEqual(await write.json(), { ok: true });

  const session = db.discovery_sessions.at(-1);
  assert.deepEqual(session.draft_payload.voice, { register: "Warm, direct.", forbidden: ["synergy"] });

  // ONCE: the delegation is now 'returned', so the same link is spent.
  assert.equal(db.discovery_delegations.at(-1).status, "returned");
  assert.equal((await req(`/delegation/${token}`)).status, 410, "GET after return fails closed");
  assert.equal((await req(`/delegation/${token}`, { method: "PATCH", body: { fields: { register: "second" } } })).status, 410,
    "PATCH after return fails closed");
  assert.equal(db.discovery_sessions.at(-1).draft_payload.voice.register, "Warm, direct.", "…and the draft is unchanged");
});

test("token endpoints are marked no-store so no cache retains the credential", async () => {
  const { token } = await mintLink();
  const res = await req(`/delegation/${token}`);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
});

/* ── fail closed ─────────────────────────────────────────────────────── */

test("tampered tokens fail closed", async () => {
  const { token } = await mintLink();
  const flip = (t) => (t[0] === "A" ? "B" : "A") + t.slice(1);

  for (const bad of [flip(token), token.slice(0, -1), `${token}x`, randomUUID(), "..%2F..%2Fetc", "short"]) {
    const res = await req(`/delegation/${bad}`, { ip: freshIp() });
    assert.equal(res.status, 404, `tampered token ${bad.slice(0, 12)}… must 404`);
  }
});

test("expired tokens fail closed and are marked expired", async () => {
  const { token } = await mintLink();
  const row = db.discovery_delegations.at(-1);
  row.created_at = new Date(Date.now() - 8 * 86400000).toISOString(); // TTL is 7 days

  const read = await req(`/delegation/${token}`);
  assert.equal(read.status, 410);
  assert.equal((await read.json()).status, "expired");
  assert.equal(row.status, "expired", "the row is flipped so the link cannot be retried");

  const write = await req(`/delegation/${token}`, { method: "PATCH", body: { fields: { register: "x" } } });
  assert.equal(write.status, 410);
});

test("a cancelled delegation fails closed", async () => {
  const { token } = await mintLink();
  db.discovery_delegations.at(-1).status = "cancelled";
  assert.equal((await req(`/delegation/${token}`)).status, 410);
});

/* ── chapter isolation + bounded payloads ────────────────────────────── */

test("a delegate cannot read or write outside the delegated chapter", async () => {
  const { token } = await mintLink("goals");
  const session = db.discovery_sessions.at(-1);
  session.draft_payload = { goals: { northStar: "own the category" }, voice: { register: "SECRET" } };

  const view = await (await req(`/delegation/${token}`)).json();
  assert.deepEqual(view.fields, { northStar: "own the category" }, "only the delegated chapter is exposed");
  assert.ok(!JSON.stringify(view).includes("SECRET"), "no other chapter leaks");

  // Writing another chapter's field is rejected outright…
  const cross = await req(`/delegation/${token}`, { method: "PATCH", body: { fields: { register: "hijacked" } } });
  assert.equal(cross.status, 400);
  assert.equal((await cross.json()).code, "UNKNOWN_FIELD");

  // …and the untouched chapter survives a legitimate write.
  const ok = await req(`/delegation/${token}`, { method: "PATCH", body: { fields: { q2: "ship RC1" } } });
  assert.equal(ok.status, 200);
  assert.equal(session.draft_payload.voice.register, "SECRET", "other chapters are copied through verbatim");
  assert.equal(session.draft_payload.goals.northStar, "own the category", "sibling fields survive the merge");
  assert.equal(session.draft_payload.goals.q2, "ship RC1");
});

test("oversized and off-schema bodies are rejected", async () => {
  const { token } = await mintLink("voice");

  const huge = await req(`/delegation/${token}`, { method: "PATCH", body: { fields: { register: "a".repeat(5000) } } });
  assert.equal(huge.status, 400);
  assert.equal((await huge.json()).code, "FIELD_TOO_LARGE");

  const wrongType = await req(`/delegation/${token}`, { method: "PATCH", body: { fields: { forbidden: "not an array" } } });
  assert.equal(wrongType.status, 400);

  const noFields = await req(`/delegation/${token}`, { method: "PATCH", body: { nope: 1 } });
  assert.equal(noFields.status, 400);

  assert.equal(db.discovery_delegations.at(-1).status, "pending", "a rejected body must not spend the link");
});

test("an oversized content-length is refused before the body is parsed", async () => {
  const { token } = await mintLink();
  const res = await app.request(`/delegation/${token}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "content-length": String(1024 * 1024), "x-test-ip": freshIp() },
    body: JSON.stringify({ fields: { register: "small body, lying header" } }),
  });
  assert.equal(res.status, 413);
});

/* ── rate limits ─────────────────────────────────────────────────────── */

test("token spraying from one IP is rate limited", async () => {
  const ip = "192.0.2.77";
  let sawLimit = false;
  for (let i = 0; i < 15; i += 1) {
    const res = await req(`/delegation/${randomUUID().replaceAll("-", "")}`, { ip });
    if (res.status === 429) {
      assert.ok(Number(res.headers.get("retry-after")) > 0, "429 must tell the caller when to retry");
      sawLimit = true;
      break;
    }
    assert.equal(res.status, 404);
  }
  assert.ok(sawLimit, "the miss limiter must bite within 15 unknown-token attempts");
});

test("replaying a valid link is rate limited", async () => {
  const ip = "192.0.2.88";
  const { token } = await mintLink("voice", ip);
  let sawLimit = false;
  for (let i = 0; i < 70; i += 1) {
    const res = await req(`/delegation/${token}`, { ip });
    if (res.status === 429) { sawLimit = true; break; }
    assert.equal(res.status, 200);
  }
  assert.ok(sawLimit, "the read limiter must bite on sustained replay");
});

/* ── create-side guards are unchanged ────────────────────────────────── */

test("creating a delegation still validates ownership, chapter, and email", async () => {
  const bad = async (body) => (await req("/delegation", { method: "POST", body })).status;
  assert.equal(await bad({ brandId: BRAND, chapter: "not-a-chapter", invitee_email: "a@b.co" }), 400);
  assert.equal(await bad({ brandId: BRAND, chapter: "voice", invitee_email: "nope" }), 400);
  assert.equal(await bad({ chapter: "voice", invitee_email: "a@b.co" }), 400);
  assert.equal(await bad({ brandId: "other-workspace-brand", chapter: "voice", invitee_email: "a@b.co" }), 403);
});
