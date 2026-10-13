import test from "node:test";
import assert from "node:assert/strict";
import { draftsBySection, openQuestions, claimThreadState } from "./cert-chat-model.js";

const msgs = [
  { id: "q1", author_role: "cd", claim_ids: ["visual.logo"], sent_at: "2026-10-13T10:00:00Z" },
  { id: "q2", author_role: "cd", claim_ids: ["visual.typography"], sent_at: "2026-10-13T10:00:00Z" },
  { id: "q3", author_role: "cd", claim_ids: ["visual.palette"], sent_at: "2026-10-13T10:00:00Z" },
  { id: "d1", author_role: "cd", claim_ids: ["identity.positioning"], sent_at: null },
  { id: "d2", author_role: "cd", claim_ids: ["visual.imagery"], sent_at: null },
  { id: "a1", author_role: "client", claim_ids: ["visual.logo"], reply_to: "q1", body: "Use the PNG", sent_at: "2026-10-13T11:00:00Z" },
  { id: "a2", author_role: "client", claim_ids: ["visual.typography"], reply_to: "q2", source_id: "font", sent_at: "2026-10-13T11:01:00Z" },
];

test("drafts group by section; sent questions are not drafts", () => {
  const g = draftsBySection(msgs);
  assert.deepEqual(Object.keys(g).sort(), ["identity", "visual"]);
  assert.deepEqual(g.visual.map((m) => m.id), ["d2"]);
});

test("open questions exclude answered and unsent", () => {
  assert.deepEqual(openQuestions(msgs).map((m) => m.id), ["q3"]);
});

test("answered claims show new evidence, unanswered sent claims show asked, drafts show nothing", () => {
  const s = claimThreadState(msgs);
  assert.equal(s.get("visual.logo").state, "new_evidence");
  assert.equal(s.get("visual.typography").answers[0].source_id, "font");
  assert.equal(s.get("visual.palette").state, "asked");
  assert.equal(s.has("identity.positioning"), false);
});
