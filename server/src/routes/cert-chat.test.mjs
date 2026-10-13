import { test, mock } from "node:test";
import assert from "node:assert/strict";

/* S3 cert-chat route: flag, batch send → one notification, answers become
   evidence and never write bios, client isolation, no spoofed author. */
const root = new URL("../", import.meta.url);
let auth; let steward; let rows; let sources; let notifications; let writes;
const BRAND = { id: "brand-a", workspace_id: "ws-a" };
const JOB = { id: "job-1", brand_id: "brand-a", assigned_to: "cd-1" };

function query(table) {
  const f = { eq: {}, in: null, isNull: [], notNull: [] };
  let op = "select"; let payload = null; let cols = null;
  const match = (r) => Object.entries(f.eq).every(([k, v]) => r[k] === v)
    && (!f.in || f.in.includes(r.id)) && f.isNull.every((k) => r[k] == null) && f.notNull.every((k) => r[k] != null);
  const run = () => {
    if (table === "brands") return [BRAND].filter(match);
    if (table === "steward_jobs") return [JOB].filter(match);
    if (table === "team_members") return steward ? [steward] : [];
    if (table === "bio_sources") {
      if (op === "insert") { const r = { id: `src-${sources.length}`, ...payload }; sources.push(r); writes.push(["bio_sources", r]); return [r]; }
      return sources.filter(match);
    }
    if (table === "cert_messages") {
      if (op === "insert") { const r = { id: `m-${rows.length}`, created_at: new Date().toISOString(), sent_at: null, reply_to: null, source_id: null, ...payload }; rows.push(r); writes.push(["cert_messages", r]); return [r]; }
      const hit = rows.filter(match);
      if (op === "update") hit.forEach((r) => Object.assign(r, payload));
      if (op === "delete") rows = rows.filter((r) => !hit.includes(r));
      return cols ? hit.map((r) => Object.fromEntries(cols.map((k) => [k, r[k]]))) : hit;
    }
    writes.push([table, op]);
    return [];
  };
  const q = {
    select(c) { if (c && op === "select") cols = c.split(",").map((k) => k.trim()); return q; }, order() { return q; }, limit() { return q; },
    eq(k, v) { f.eq[k] = v; return q; }, in(k, v) { f.in = v; return q; },
    is(k) { f.isNull.push(k); return q; }, not(k) { f.notNull.push(k); return q; },
    insert(v) { op = "insert"; payload = v; return q; }, update(v) { op = "update"; payload = v; return q; },
    delete() { op = "delete"; return q; },
    async maybeSingle() { return { data: run()[0] || null, error: null }; },
    async single() { return { data: run()[0] || null, error: null }; },
    then(res, rej) { return Promise.resolve({ data: run(), error: null }).then(res, rej); },
  };
  return q;
}
const db = { from: query, rpc: async () => { writes.push(["rpc"]); return { data: null, error: null }; } };
mock.module(new URL("lib/supabase.js", root).href, { namedExports: { supabaseAdmin: db } });
mock.module(new URL("middleware/auth.js", root).href, { namedExports: { requireAuth: async (c, next) => { c.set("auth", auth); await next(); } } });
mock.module(new URL("lib/notify.js", root).href, { namedExports: {
  notify: async (n) => { notifications.push(n); }, brandOwnerUserId: async () => "owner-1",
  notifyTeamRole: async () => {}, teamMemberUserId: async () => null,
} });
const { default: app } = await import("./cert-chat.js");

const cd = () => ({ userId: "cd-user", scope: "platform", permissions: new Set() });
const client = (ws = "ws-a", scope = "workspace") => ({ userId: "client-user", scope, persona: "workspace_admin",
  permissions: new Set(["bio.propose"]), memberships: [{ workspace_id: ws, status: "active" }], assignedWorkspaceIds: new Set([ws]) });
const req = (path, method = "GET", body) => app.request(path, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
const reset = () => {
  process.env.CERTIFIER_V2_S3 = "true";
  rows = []; sources = [{ id: "font-src", brand_id: "brand-a", kind: "file_upload" }, { id: "foreign-src", brand_id: "brand-b", kind: "file_upload" }];
  notifications = []; writes = []; auth = cd(); steward = { id: "cd-1", roles: ["steward"], active: true };
};

test("flag off → every route 404s", async () => {
  reset(); delete process.env.CERTIFIER_V2_S3;
  assert.equal((await req("/jobs/job-1")).status, 404);
  auth = client();
  const res = await req("/brands/brand-a");
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, "FLAG_OFF");
});

test("CD edits and batch-sends 3 Foundation questions → one notification to the Owner", async () => {
  reset();
  for (const f of ["visual.logo", "visual.type", "visual.palette"]) {
    assert.equal((await req("/jobs/job-1/questions", "POST", { claim_ids: [f], body: `Draft about ${f}`, author_role: "agent" })).status, 200);
  }
  assert.ok(rows.every((r) => r.author_role === "cd"), "author_role is never taken from the body");
  assert.equal((await req(`/questions/${rows[1].id}`, "PATCH", { body: "Which typeface is your display face?" })).status, 200);
  assert.equal(rows[1].body, "Which typeface is your display face?");
  const res = await req("/jobs/job-1/send", "POST", { ids: rows.map((r) => r.id) });
  assert.deepEqual(await res.json(), { sent: 3 });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientUserId, "owner-1");
  assert.match(notifications[0].title, /3 questions/);
  assert.equal((await req(`/questions/${rows[0].id}`, "PATCH", { body: "late edit" })).status, 409, "sent questions are frozen");
  assert.equal((await req("/jobs/job-1/questions", "POST", { claim_ids: ["not a path"], body: "x" })).status, 400);
});

test("non-stewards (incl. an agent actor) can't draft or send; other CD's job is 403", async () => {
  reset(); steward = null;
  assert.equal((await req("/jobs/job-1/questions", "POST", { claim_ids: ["visual.logo"], body: "x" })).status, 403);
  steward = { id: "cd-2", roles: ["steward"], active: true };
  assert.equal((await req("/jobs/job-1")).status, 403);
  assert.equal(rows.length, 0);
});

test("client answers with text and a font file: both become evidence, bios untouched", async () => {
  reset();
  for (const f of ["visual.logo", "visual.type"]) await req("/jobs/job-1/questions", "POST", { claim_ids: [f], body: `Q ${f}` });
  rows.push({ id: "draft", brand_id: "brand-a", job_id: "job-1", claim_ids: ["visual.imagery"], author_role: "cd", body: "unsent draft", sent_at: null });
  await req("/jobs/job-1/send", "POST", { ids: ["m-0", "m-1"] });
  writes = [];
  auth = client();
  const list = await (await req("/brands/brand-a")).json();
  assert.deepEqual(list.messages.map((m) => m.id), ["m-0", "m-1"], "client never sees drafts");
  assert.ok(list.messages.every((m) => !("author_user_id" in m)));

  const text = await req("/brands/brand-a/answers", "POST", { question_id: "m-0", body: "Use the PNG on page 25", author_role: "cd" });
  assert.equal(text.status, 200);
  const textAnswer = (await text.json()).message;
  assert.equal(textAnswer.author_role, "client");
  assert.deepEqual(textAnswer.claim_ids, ["visual.logo"]);
  const evidence = sources.find((s) => s.id === textAnswer.source_id);
  assert.equal(evidence.kind, "client_answer");
  assert.deepEqual(evidence.signals.claim_ids, ["visual.logo"]);

  const font = await req("/brands/brand-a/answers", "POST", { question_id: "m-1", source_id: "font-src" });
  assert.equal(font.status, 200);
  assert.equal((await font.json()).message.source_id, "font-src");
  assert.equal((await req("/brands/brand-a/answers", "POST", { question_id: "m-1", source_id: "foreign-src" })).status, 400);
  assert.equal((await req("/brands/brand-a/answers", "POST", { question_id: "draft", body: "x" })).status, 404, "can't answer an unsent draft");

  assert.deepEqual([...new Set(writes.map(([t]) => t))].sort(), ["bio_sources", "cert_messages"], "no bios / rpc writes");
});

test("client isolation: other workspace and platform-scope callers get 403", async () => {
  reset();
  auth = client("ws-b");
  assert.equal((await req("/brands/brand-a")).status, 403);
  assert.equal((await req("/brands/brand-a/answers", "POST", { question_id: "m-0", body: "x" })).status, 403);
  auth = client("ws-a", "platform");
  assert.equal((await req("/brands/brand-a/answers", "POST", { question_id: "m-0", body: "x" })).status, 403);
});
