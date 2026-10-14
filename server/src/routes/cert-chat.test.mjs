import { test, mock } from "node:test";
import assert from "node:assert/strict";

/* S3 cert-chat route: flag, batch send → one notification, answers become
   evidence and never write bios, client isolation, no spoofed author. */
const root = new URL("../", import.meta.url);
let bio; let auth; let steward; let rows; let sources; let notifications; let writes;
const BRAND = { id: "brand-a", workspace_id: "ws-a" };
const JOB = { id: "job-1", brand_id: "brand-a", assigned_to: "cd-1", bio_id: "bio-1", status: "in_review" };

function query(table) {
  const f = { eq: {}, in: null, isNull: [], notNull: [] };
  let op = "select"; let payload = null; let cols = null;
  const match = (r) => Object.entries(f.eq).every(([k, v]) => r[k] === v)
    && (!f.in || f.in.includes(r.id)) && f.isNull.every((k) => r[k] == null) && f.notNull.every((k) => r[k] != null);
  const run = () => {
    if (table === "bios") return [bio].filter(match);
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
const db = { from: query, rpc: async (name, p) => {
  assert.equal(name, "answer_cert_question");
  const hash = JSON.stringify([p.p_question_id, p.p_body, p.p_source_id]);
  const old = rows.find((m) => m.brand_id === p.p_brand_id && m.author_user_id === p.p_user_id && m.idempotency_key === p.p_key);
  if (old) return { data: old.request_hash === hash ? { ok: true, message: Object.fromEntries(Object.entries(old).filter(([k]) => !["author_user_id", "idempotency_key", "request_hash"].includes(k))) } : { ok: false, status: 409, code: "IDEMPOTENCY_CONFLICT" } };
  const q = rows.find((m) => m.id === p.p_question_id && m.brand_id === p.p_brand_id && m.author_role === "cd" && m.sent_at);
  if (!q) return { data: { ok: false, status: 404 } };
  if (JOB.status === "completed" || bio.certified) return { data: { ok: false, status: 409 } };
  let sourceId = p.p_source_id;
  if (sourceId) {
    if (!sources.some((s) => s.id === sourceId && s.brand_id === p.p_brand_id && s.kind === "file_upload")) return { data: { ok: false, status: 400 } };
  } else {
    sourceId = `src-${sources.length}`;
    const src = { id: sourceId, kind: "client_answer", src: p.p_body, signals: { claim_ids: q.claim_ids, field_paths: q.field_paths, bio_version: q.bio_version } };
    sources.push(src); writes.push(["bio_sources", src]);
  }
  const answer = { id: `m-${rows.length}`, brand_id: p.p_brand_id, job_id: q.job_id, bio_version: q.bio_version,
    claim_ids: q.claim_ids, field_paths: q.field_paths, author_role: "client", author_user_id: p.p_user_id,
    reply_to: q.id, body: p.p_body, source_id: sourceId, sent_at: "now", idempotency_key: p.p_key, request_hash: hash };
  rows.push(answer); writes.push(["cert_messages", answer]);
  const { author_user_id, idempotency_key, request_hash, ...message } = answer;
  return { data: { ok: true, message } };
} };
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
  process.env.CERTIFIER_V2_S3 = "1";
  bio = { id: "bio-1", version: 3, certified: false }; JOB.status = "in_review";
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

  const text = await req("/brands/brand-a/answers", "POST", { question_id: "m-0", body: "Use the PNG on page 25", idempotency_key: "answer-text-1", author_role: "cd" });
  assert.equal(text.status, 200);
  const textAnswer = (await text.json()).message;
  assert.equal(textAnswer.author_role, "client");
  assert.deepEqual(textAnswer.field_paths, ["visual.logo"]);
  assert.equal(textAnswer.bio_version, 3);
  assert.match(textAnswer.claim_ids[0], /^[a-f0-9]{64}$/);
  const evidence = sources.find((s) => s.id === textAnswer.source_id);
  assert.equal(evidence.kind, "client_answer");
  assert.deepEqual(evidence.signals.claim_ids, textAnswer.claim_ids);
  assert.equal(evidence.signals.bio_version, 3);

  const font = await req("/brands/brand-a/answers", "POST", { question_id: "m-1", source_id: "font-src", idempotency_key: "answer-font-1" });
  assert.equal(font.status, 200);
  assert.equal((await font.json()).message.source_id, "font-src");
  assert.equal((await req("/brands/brand-a/answers", "POST", { question_id: "m-1", source_id: "foreign-src", idempotency_key: "answer-foreign" })).status, 400);
  assert.equal((await req("/brands/brand-a/answers", "POST", { question_id: "draft", body: "x", idempotency_key: "answer-draft" })).status, 404, "can't answer an unsent draft");

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


test("claims reject plausible but unknown schema paths and have stable versioned IDs", async () => {
  reset();
  for (const field of ["visual.typography", "identity.madeUp", "visual.logo.secret", "__proto__.polluted"]) {
    assert.equal((await req("/jobs/job-1/questions", "POST", { claim_ids: [field], body: "x" })).status, 400);
  }
  const draft = () => req("/jobs/job-1/questions", "POST", { claim_ids: ["visual.logo"], body: "x" });
  const a = (await (await draft()).json()).message;
  const b = (await (await draft()).json()).message;
  assert.deepEqual(a.claim_ids, b.claim_ids);
  bio.version++;
  const c = (await (await draft()).json()).message;
  assert.notDeepEqual(c.claim_ids, a.claim_ids);
  assert.equal(c.bio_version, 4);
});

test("all CD operations reject closed jobs and certified BIOs with 409", async () => {
  reset();
  await req("/jobs/job-1/questions", "POST", { claim_ids: ["visual.logo"], body: "x" });
  for (const status of ["completed", "cancelled", "rejected", "decertified"]) {
    JOB.status = status;
    assert.equal((await req("/jobs/job-1")).status, 409);
    assert.equal((await req("/jobs/job-1/questions", "POST", { claim_ids: ["visual.logo"], body: "x" })).status, 409);
    assert.equal((await req("/jobs/job-1/send", "POST", { ids: ["m-0"] })).status, 409);
    assert.equal((await req("/questions/m-0", "PATCH", { body: "x" })).status, 409);
    assert.equal((await req("/questions/m-0", "DELETE")).status, 409);
  }
  JOB.status = "in_review"; bio.certified = true;
  assert.equal((await req("/jobs/job-1")).status, 409);
});

test("answer key is required; duplicate answers reuse evidence; changed content conflicts", async () => {
  reset();
  await req("/jobs/job-1/questions", "POST", { claim_ids: ["visual.logo"], body: "x" });
  await req("/jobs/job-1/send", "POST", { ids: ["m-0"] });
  assert.ok(notifications[0].eventKey.includes("job-1:m-0"));
  await req("/jobs/job-1/send", "POST", { ids: ["m-0"] });
  assert.equal(notifications.length, 1);
  auth = client();
  const payload = { question_id: "m-0", body: "answer", idempotency_key: "retry-key-1" };
  assert.equal((await req("/brands/brand-a/answers", "POST", { ...payload, idempotency_key: undefined })).status, 400);
  const first = await (await req("/brands/brand-a/answers", "POST", payload)).json();
  const second = await (await req("/brands/brand-a/answers", "POST", payload)).json();
  assert.equal(first.message.id, second.message.id);
  assert.equal(sources.filter((s) => s.kind === "client_answer").length, 1);
  assert.equal(rows.filter((m) => m.author_role === "client").length, 1);
  assert.equal((await req("/brands/brand-a/answers", "POST", { ...payload, body: "different" })).status, 409);
});
