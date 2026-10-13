/* Pure helpers for the S3 CD ↔ client thread. Claim ids are Brand Core field
   paths ("visual.typography", "identity.positioning"); the section is the
   first segment. */
export const sectionOf = (claimId = "") => String(claimId).split(".")[0] || "other";

/* Unsent CD drafts grouped by section → { visual: [msg, ...], ... } (batch-send unit). */
export function draftsBySection(messages = []) {
  const out = {};
  for (const m of messages) {
    if (m.author_role !== "cd" || m.sent_at) continue;
    (out[sectionOf(m.claim_ids?.[0])] ||= []).push(m);
  }
  return out;
}

/* Sent CD questions the client hasn't answered yet. */
export function openQuestions(messages = []) {
  const answered = new Set(messages.filter((m) => m.author_role === "client").map((m) => m.reply_to));
  return messages.filter((m) => m.author_role === "cd" && m.sent_at && !answered.has(m.id));
}

/* Per claim: "new_evidence" (client answered) beats "asked" (sent, unanswered).
   Returns Map claimId → { state, answers: [clientMsg, ...] }. */
export function claimThreadState(messages = []) {
  const map = new Map();
  const entry = (id) => map.get(id) || map.set(id, { state: null, answers: [] }).get(id);
  for (const m of messages) {
    if (!m.sent_at) continue;
    for (const id of m.claim_ids || []) {
      const e = entry(id);
      if (m.author_role === "client") { e.state = "new_evidence"; e.answers.push(m); }
      else if (!e.state) e.state = "asked";
    }
  }
  return map;
}
