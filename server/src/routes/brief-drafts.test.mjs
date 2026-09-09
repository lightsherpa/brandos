import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBriefDraftRoutes } from "./brief-drafts.js";
import { createBriefDraftStore, emptyDraft } from "../../../src/lib/brief-draft-store.js";

const BRAND = randomUUID(), OTHER_BRAND = randomUUID(), FOREIGN_BRAND = randomUUID();
function fixture() {
  const tables = { brands: [{ id: BRAND, workspace_id: "workspace-a" }, { id: OTHER_BRAND, workspace_id: "workspace-a" }, { id: FOREIGN_BRAND, workspace_id: "workspace-b" }], brief_drafts: [] };
  const touched = [];
  let unavailable = false;
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = "select"; }
    select() { return this; }
    eq(k, v) { this.filters.push([k, v]); return this; }
    order() { return this; }
    update(p) { this.op = "update"; this.payload = p; return this; }
    insert(p) { this.op = "insert"; this.payload = p; return this; }
    run() {
      touched.push(this.table);
      if (unavailable) return { error: { code: "08006", message: "offline" } };
      const rows = tables[this.table];
      if (!rows) throw new Error(`Unexpected side effect: ${this.table}`);
      if (this.op === "insert") {
        if (rows.some((r) => r.id === this.payload.id)) return { error: { code: "23505" } };
        rows.push(structuredClone(this.payload));
        return { data: [structuredClone(this.payload)] };
      }
      const found = rows.filter((r) => this.filters.every(([k, v]) => r[k] === v));
      if (this.op === "update") found.forEach((r) => Object.assign(r, structuredClone(this.payload)));
      return { data: structuredClone(found) };
    }
    async maybeSingle() { const r = this.run(); return { ...r, data: r.data?.[0] || null }; }
    single() { return this.maybeSingle(); }
    then(a, b) { return Promise.resolve(this.run()).then(a, b); }
  }
  const app = createBriefDraftRoutes({ db: { from: (t) => new Query(t) }, authenticate: async (c, next) => {
    const userId = c.req.header("x-user");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    c.set("auth", { userId, scope: "workspace", permissions: new Set(userId === "reader" ? ["brief.read"] : ["brief.read", "brief.write"]), memberships: [{ workspace_id: "workspace-a", status: "active" }] });
    return next();
  } });
  const request = (path, init = {}, user = "alice") => app.request(path.replace("/api/briefs/drafts", "") || "/", { ...init, headers: { "x-user": user, ...init.headers } });
  const put = (id, patch = {}, user = "alice") => request(`/api/briefs/drafts/${id}`, { method: "PUT", body: JSON.stringify({ ownerUserId: user, brandId: BRAND, workspaceId: "workspace-a", revision: 0, mutationId: randomUUID(), payload: { ...emptyDraft(), input: "Launch" }, ...patch }) }, user);
  const list = (brand = BRAND, user = "alice") => request(`/api/briefs/drafts?brandId=${brand}&ownerUserId=${user}`, {}, user);
  return { tables, touched, request, put, list, offline(value) { unavailable = value; } };
}
function memoryStorage() {
  const entries = new Map();
  return { get length() { return entries.size; }, key: (i) => [...entries.keys()][i], getItem: (k) => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: (k) => entries.delete(k) };
}
function store(f, storage, opts = {}) {
  return createBriefDraftStore({ userId: "alice", brandId: BRAND, storage, request: f.request, uuid: randomUUID, delay: 60000, ...opts });
}
const tick = () => new Promise((r) => setImmediate(r));

test("draft save, list and answers round-trip without BIO, runs or credit access", async () => {
  const f = fixture(), id = randomUUID();
  const payload = { ...emptyDraft(), input: "Raw input\nsecond line", answers: { 0: "My audience" }, sharpData: { questions: [{ q: "Who?" }], proposedSpecialists: ["a12"], deliveryPlan: { outputs: [] } }, mode: "visual" };
  const saved = await f.put(id, { payload });
  assert.equal(saved.status, 200);
  const list = await (await f.list()).json();
  assert.deepEqual(list.drafts[0].payload, payload);
  assert.equal(list.drafts[0].id, id);
  assert.deepEqual(new Set(f.touched), new Set(["brands", "brief_drafts"]));
});

test("authentication, owner, workspace and brand boundaries fail closed", async () => {
  const f = fixture(), id = randomUUID();
  assert.equal((await f.list(BRAND, "")).status, 401);
  assert.equal((await f.put(id)).status, 200);
  assert.deepEqual((await (await f.list(BRAND, "bob")).json()).drafts, []);
  assert.equal((await f.put(id, {}, "bob")).status, 409);
  assert.equal((await f.put(randomUUID(), { brandId: FOREIGN_BRAND })).status, 403);
  assert.equal((await f.put(randomUUID(), { workspaceId: "workspace-b" })).status, 409);
  assert.equal((await f.put(randomUUID(), { ownerUserId: "bob" })).status, 403);
  assert.equal((await f.put(randomUUID(), {}, "reader")).status, 403);
  assert.equal((await f.put(id, { brandId: OTHER_BRAND })).status, 409);
  assert.equal(f.tables.brief_drafts[0].owner_user_id, "alice");
  assert.equal(f.tables.brief_drafts[0].revision, 1);
});

test("stale saves cannot overwrite a newer revision and lost acknowledgements retry idempotently", async () => {
  const f = fixture(), id = randomUUID(), mutationId = randomUUID();
  await f.put(id, { mutationId });
  assert.equal((await f.put(id, { mutationId })).status, 200);
  assert.equal(f.tables.brief_drafts[0].revision, 1);
  const results = await Promise.all([f.put(id, { revision: 1 }), f.put(id, { revision: 1 })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(f.tables.brief_drafts[0].revision, 2);
  assert.equal((await f.put(id, { revision: 0 })).status, 409);
});

test("invalid and oversized content is rejected without persistence", async () => {
  const f = fixture();
  assert.equal((await f.put(randomUUID(), { payload: null })).status, 400);
  assert.equal((await f.put(randomUUID(), { revision: -1 })).status, 400);
  assert.equal((await f.put(randomUUID(), { payload: { ...emptyDraft(), answers: { 0: 42 } } })).status, 400);
  assert.equal((await f.put(randomUUID(), { payload: { ...emptyDraft(), sharpData: { text: "x".repeat(140000) } } })).status, 413);
  assert.equal(f.tables.brief_drafts.length, 0);
});

test("edits during an in-flight save keep newer text and serialize writes on the same ID", async () => {
  const f = fixture(), storage = memoryStorage();
  let release, held = false;
  const draft = store(f, storage, { request: async (path, init) => {
    const response = await f.request(path, init);
    if (init?.method === "PUT" && !held) { held = true; await new Promise((r) => { release = r; }); }
    return response;
  } });
  await draft.load(); draft.update({ input: "first" });
  const saving = draft.flush(); await tick();
  const id = draft.getSnapshot().id;
  draft.update({ input: "newer", answers: { 0: "answer" } });
  release(); assert.equal(await saving, true);
  assert.equal(draft.getSnapshot().payload.input, "newer");
  assert.equal(f.tables.brief_drafts.length, 1);
  assert.equal(f.tables.brief_drafts[0].id, id);
  assert.equal(f.tables.brief_drafts[0].revision, 2);
  assert.equal(f.tables.brief_drafts[0].payload.answers[0], "answer");
  draft.dispose();
});

test("offline changes survive reload and reauthentication, with the original ID", async () => {
  const f = fixture(), storage = memoryStorage(), first = store(f, storage);
  await first.load(); first.update({ input: "recover me", mode: "words", answers: { 0: "keep this" } });
  const id = first.getSnapshot().id;
  f.offline(true); assert.equal(await first.flush(), false); first.dispose();
  const second = store(f, storage);
  await second.load();
  assert.equal(second.getSnapshot().payload.input, "recover me");
  assert.equal(second.getSnapshot().id, id);
  f.offline(false); await second.load();
  assert.equal(second.getSnapshot().status, "saved");
  assert.equal(f.tables.brief_drafts[0].id, id);
  assert.equal(f.tables.brief_drafts[0].payload.answers[0], "keep this");
  second.dispose();
});

test("a server-committed save whose response was lost is recovered exactly once", async () => {
  const f = fixture(), storage = memoryStorage(); let lose = true;
  const first = store(f, storage, { request: async (path, init) => {
    const res = await f.request(path, init);
    if (init?.method === "PUT" && lose) throw new Error("connection lost after commit");
    return res;
  } });
  await first.load(); first.update({ input: "persisted" });
  assert.equal(await first.flush(), false);
  first.dispose(); await tick(); lose = false;
  const next = store(f, storage); await next.load();
  assert.equal(next.getSnapshot().status, "saved");
  assert.equal(f.tables.brief_drafts.length, 1);
  assert.equal(f.tables.brief_drafts[0].revision, 1);
  next.dispose();
});

test("saved drafts list after a new session and resume remains idle without writes", async () => {
  const f = fixture(), first = store(f, memoryStorage());
  await first.load(); first.update({ input: "one" }); await first.flush();
  await first.select(null); first.update({ input: "two" }); await first.flush(); first.dispose();
  const resumed = store(f, memoryStorage()); await resumed.load();
  assert.equal(resumed.getSnapshot().id, null);
  assert.equal(resumed.getSnapshot().drafts.length, 2);
  const row = resumed.getSnapshot().drafts[0];
  await resumed.select(row);
  assert.equal(resumed.getSnapshot().id, row.id);
  assert.deepEqual(resumed.getSnapshot().payload, row.payload);
  assert.equal(f.tables.brief_drafts.every((d) => d.revision === 1), true);
  resumed.dispose();
});

test("brand and account switches cannot recover another scope's local text", async () => {
  const f = fixture(), storage = memoryStorage(), first = store(f, storage);
  await first.load(); f.offline(true); first.update({ input: "private text" }); await first.flush(); first.dispose();
  const brand = store(f, storage, { brandId: OTHER_BRAND }); await brand.load();
  assert.equal(brand.getSnapshot().payload.input, "");
  const user = store(f, storage, { userId: "bob", request: (p, i) => f.request(p, i, "bob") }); await user.load();
  assert.equal(user.getSnapshot().payload.input, "");
  brand.dispose(); user.dispose();
});

test("concurrent tab conflict preserves local text and can save a separate copy", async () => {
  const f = fixture(), storage = memoryStorage(), a = store(f, storage);
  await a.load(); a.update({ input: "baseline" }); await a.flush();
  const b = store(f, storage); await b.load(); await b.select(b.getSnapshot().drafts[0]);
  a.update({ input: "tab A" }); await a.flush();
  b.update({ input: "tab B" }); assert.equal(await b.flush(), false);
  assert.equal(b.getSnapshot().status, "conflict");
  assert.equal(b.getSnapshot().payload.input, "tab B");
  assert.equal(f.tables.brief_drafts[0].payload.input, "tab A");
  assert.equal(await b.select(null), false);
  assert.equal(await b.saveCopy(), true);
  assert.deepEqual(f.tables.brief_drafts.map((d) => d.payload.input), ["tab A", "tab B"]);
  a.dispose(); b.dispose();
});

test("local storage failure is visible while server saving still works", async () => {
  const f = fixture(), storage = memoryStorage(); storage.setItem = () => { throw new Error("quota"); };
  const draft = store(f, storage); await draft.load(); draft.update({ input: "in memory" });
  assert.equal(draft.getSnapshot().localError, true);
  assert.equal(await draft.flush(), true);
  assert.equal(f.tables.brief_drafts[0].payload.input, "in memory");
  draft.dispose();
});

test("first-visit offline authoring saves after scope is resolved, even if local storage is unavailable", async () => {
  const f = fixture(), storage = memoryStorage();
  storage.setItem = () => { throw new Error("quota"); };
  f.offline(true);
  const draft = store(f, storage); await draft.load();
  assert.equal(draft.getSnapshot().ready, true);
  draft.update({ input: "typed before first successful connection" });
  assert.equal(await draft.flush(), false);
  f.offline(false); await draft.load();
  assert.equal(draft.getSnapshot().status, "saved");
  assert.equal(f.tables.brief_drafts[0].payload.input, "typed before first successful connection");
  draft.dispose();
});

test("navigation flushes pending debounce without requiring unload events", async () => {
  const f = fixture(), draft = store(f, memoryStorage());
  await draft.load(); draft.update({ input: "navigate immediately" }); draft.dispose();
  await tick();
  assert.equal(f.tables.brief_drafts[0].payload.input, "navigate immediately");
});

test("a late list response cannot restore a disposed brand's state", async () => {
  const f = fixture(); let release;
  const draft = store(f, memoryStorage(), { request: async (p, i) => {
    const response = await f.request(p, i); await new Promise((r) => { release = r; }); return response;
  } });
  const loading = draft.load(); await tick(); draft.dispose(); release(); await loading;
  assert.equal(draft.getSnapshot().ready, false);
  assert.equal(draft.getSnapshot().workspaceId, null);
});

test("a changed authenticated account cannot commit the old account's queued edits", async () => {
  const f = fixture(), storage = memoryStorage(); let user = "alice";
  const draft = store(f, storage, { request: (p, i) => f.request(p, i, user) });
  await draft.load(); draft.update({ input: "Alice's pending work" }); user = "bob";
  assert.equal(await draft.flush(), false);
  assert.equal(f.tables.brief_drafts.length, 0);
  assert.equal(draft.getSnapshot().payload.input, "Alice's pending work");
  assert.ok(storage.length > 0);
  draft.dispose();
});

test("debounce coalesces rapid edits into a single server save", async () => {
  const f = fixture(), draft = store(f, memoryStorage(), { delay: 5 });
  await draft.load(); draft.update({ input: "a" }); draft.update({ input: "ab" }); draft.update({ input: "abc" });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(f.tables.brief_drafts.length, 1);
  assert.equal(f.tables.brief_drafts[0].revision, 1);
  assert.equal(f.tables.brief_drafts[0].payload.input, "abc");
  draft.dispose();
});
