import test from "node:test";
import assert from "node:assert/strict";
import { draftsBySection, openQuestions, claimThreadState } from "./cert-chat-model.js";

const msgs = [
  { id: "q1", author_role: "cd", claim_ids: ["visual.logo"], sent_at: "2026-10-13T10:00:00Z" },
  { id: "q2", author_role: "cd", claim_ids: ["visual.type"], sent_at: "2026-10-13T10:00:00Z" },
  { id: "q3", author_role: "cd", claim_ids: ["visual.palette"], sent_at: "2026-10-13T10:00:00Z" },
  { id: "d1", author_role: "cd", claim_ids: ["identity.positioning"], sent_at: null },
  { id: "d2", author_role: "cd", claim_ids: ["visual.imagery"], sent_at: null },
  { id: "a1", author_role: "client", claim_ids: ["visual.logo"], reply_to: "q1", body: "Use the PNG", sent_at: "2026-10-13T11:00:00Z" },
  { id: "a2", author_role: "client", claim_ids: ["visual.type"], reply_to: "q2", source_id: "font", sent_at: "2026-10-13T11:01:00Z" },
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
  assert.equal(s.get("visual.type").answers[0].source_id, "font");
  assert.equal(s.get("visual.palette").state, "asked");
  assert.equal(s.has("identity.positioning"), false);
});

test("stable claim IDs retain field grouping and focus evidence lookup", () => {
  const versioned = [
    { id: "d", author_role: "cd", bio_version: 3, claim_ids: ["stable-hash"], field_paths: ["visual.logo"] },
    { id: "a", author_role: "client", bio_version: 3, claim_ids: ["stable-hash"], field_paths: ["visual.logo"], sent_at: "now" },
  ];
  assert.equal(draftsBySection(versioned).visual[0].id, "d");
  assert.equal(claimThreadState(versioned).get("visual.logo").state, "new_evidence");
});

test("evidence from a previous BIO version never marks the current claim answered", () => {
  const messages = [
    { author_role: "client", claim_ids: ["v1-hash"], field_paths: ["visual.logo"], bio_version: 1, sent_at: "now" },
    { author_role: "cd", claim_ids: ["v2-hash"], field_paths: ["visual.logo"], bio_version: 2, sent_at: "now" },
  ];
  assert.equal(claimThreadState(messages, 2).get("visual.logo").state, "asked");
  assert.deepEqual(claimThreadState(messages, 2).get("visual.logo").answers, []);
});
