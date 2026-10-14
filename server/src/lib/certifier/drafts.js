import { randomUUID } from 'node:crypto';
// Drafts are internal memory only; the human sends through the existing S3 API.
const drafts = new Map();
export async function saveQuestionDraft({ workspaceId, brandId, bioId, version, question }) {
  const key = JSON.stringify([workspaceId, brandId, bioId, String(version), question]);
  if (!drafts.has(key)) drafts.set(key, { id: randomUUID(), question: structuredClone(question) });
  return drafts.get(key).id;
}
