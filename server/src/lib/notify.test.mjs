import { test, mock } from "node:test";
import assert from "node:assert/strict";
let events, inserts, filters, pref, memberships;
const db = { from(table) {
  const f = {};
  const q = {
    select() { return q; }, eq(k, v) { f[k] = v; return q; },
    async insert(row) { inserts.push(row); return { error: null }; },
    async maybeSingle() {
      filters.push([table, f]);
      if (table === "brands") return { data: { workspace_id: "ws" } };
      if (table === "workspace_memberships") return { data: memberships.find((m) => Object.entries(f).every(([k,v]) => m[k] === v)) || null };
      if (table === "notification_prefs") return { data: pref };
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return q;
} };
mock.module(new URL("./supabase.js", import.meta.url).href, { namedExports: { supabaseAdmin: db } });
mock.module(new URL("./inngest.js", import.meta.url).href, { namedExports: { inngest: { async send(event) { events.push(event); } } } });
const { notify, brandOwnerUserId } = await import("./notify.js");
const reset = () => { events = []; inserts = []; filters = []; pref = null; memberships = []; };
const payload = { recipientUserId: "owner", kind: "cert.questions", title: "3 questions", brandId: "brand", eventKey: "job:batch-1" };

test("email retries have deterministic event IDs; distinct batches and recipients differ", async () => {
  reset();
  await notify(payload); await notify(payload);
  assert.equal(events.length, 2);
  assert.equal(events[0].id, events[1].id);
  assert.equal(events[0].name, "notification/email");
  await notify({ ...payload, eventKey: "job:batch-2" });
  await notify({ ...payload, recipientUserId: "other" });
  assert.notEqual(events[0].id, events[2].id);
  assert.notEqual(events[0].id, events[3].id);
  assert.equal(events[0].data.recipientUserId, "owner");
});

test("notification preferences still gate channels", async () => {
  reset(); pref = { in_app: false, email: false };
  await notify(payload);
  assert.equal(events.length, 0); assert.equal(inserts.length, 0);
});

test("brand recipient follows active owner membership even after ownership transfer", async () => {
  reset();
  memberships = [
    { workspace_id: "ws", user_id: "earliest-user", is_owner: false, status: "active" },
    { workspace_id: "ws", user_id: "suspended-owner", is_owner: true, status: "suspended" },
    { workspace_id: "other-ws", user_id: "foreign-owner", is_owner: true, status: "active" },
    { workspace_id: "ws", user_id: "actual-owner", is_owner: true, status: "active" },
  ];
  assert.equal(await brandOwnerUserId("brand"), "actual-owner");
  assert.deepEqual(filters[1], ["workspace_memberships", { workspace_id: "ws", is_owner: true, status: "active" }]);
  await notify({ ...payload, recipientUserId: await brandOwnerUserId("brand") });
  assert.equal(events[0].data.recipientUserId, "actual-owner");
  memberships = []; assert.equal(await brandOwnerUserId("brand"), null);
});
