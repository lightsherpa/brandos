import { normalizeBio } from "./bio-schema.js";
import { foundationStatus, validateFoundationVisual } from './brand-foundation.js';
export const RESOLVED = new Set(['confirmed', 'fixed']);
export const readField = (payload, path) => path.split('.').reduce((v, k) => v?.[k], payload);
export const writeField = (patch, path, value) => {
  const [section, key] = path.split('.');
  (patch[section] ||= {})[key] = value;
  return patch;
};
export function claimState(claim, decision, messages = []) {
  const relevant = messages.filter(m => m.bio_version === claim.bio_version && m.claim_ids?.includes(claim.claim_id));
  const answers = relevant.filter(m => m.author_role === 'client' && m.sent_at);
  const answered = new Set(answers.map(m => m.reply_to));
  if (claim.open_questions || relevant.some(m => m.author_role === 'cd' && !answered.has(m.id))) return 'asked';
  if (decision && RESOLVED.has(decision.state) && decision.evidence_token === claim.evidence_token) return decision.state;
  if (answers.length) return 'new_evidence';
  if (decision?.state === 'asked' || relevant.some(m => m.author_role === 'cd')) return 'asked';
  return 'to_confirm';
}
export function eligibleForBulk(claim) { return ['high', 'medium'].includes(claim.level); }
export function confirmSection(claims, decisions, section) {
  const next = { ...decisions };
  for (const claim of claims) {
    if (claim.section === section && eligibleForBulk(claim) && !claim.open_questions && !next[claim.claim_id]) {
      next[claim.claim_id] = { state: 'confirmed', evidence_token: claim.evidence_token };
    }
  }
  return next;
}
export function reviewPatch(claims, decisions) {
  const patch = {};
  for (const claim of claims) {
    const decision = decisions[claim.claim_id];
    if (decision?.state === 'fixed') writeField(patch, claim.field_path, decision.value);
  }
  return patch;
}
export function reviewGate({ claims = [], decisions = {}, payload = {}, logoRights = [], messages = [], section }) {
  const foundation = foundationStatus(payload, { logoRights });
  const scope = section ? claims.filter(c => c.section === section) : claims;
  const unresolved = scope.filter(c => !RESOLVED.has(claimState(c, decisions[c.claim_id], messages)));
  const waiting = unresolved.filter(c => ['asked', 'new_evidence'].includes(claimState(c, decisions[c.claim_id], messages)));
  return { ready: foundation.certifiable && scope.length > 0 && unresolved.length === 0,
    foundation, unresolved: unresolved.map(c => c.claim_id), waiting: waiting.length };
}
export function validateClaimReview(ledger, review, workingPayload, logoRights) {
  if (!review || review.bio_version !== ledger.bio_version) return { code: 'STALE_CLAIM_REVIEW', error: 'Review the current Brand Core version.' };
  workingPayload = normalizeBio(workingPayload);
  const decisions = review.decisions || {};
  if (Object.keys(decisions).some(id => !ledger.claims.some(c => c.claim_id === id))) return { code: 'CLAIM_REVIEW_INVALID', error: 'Unknown claim in review.' };
  for (const claim of ledger.claims) {
    const d = decisions[claim.claim_id];
    if (claim.open_questions || !d || !RESOLVED.has(d.state)) return { code: 'CLAIMS_UNRESOLVED', error: 'Resolve every claim before certification.' };
    if (d.evidence_token !== claim.evidence_token) return { code: 'STALE_CLAIM_REVIEW', error: 'Evidence changed. Review the claim again.' };
    const expected = d.state === 'fixed' ? d.value : claim.value;
    if (JSON.stringify(readField(workingPayload, claim.field_path) ?? null) !== JSON.stringify(expected ?? null)) {
      return { code: 'CLAIM_REVIEW_INVALID', error: 'The patch must match the reviewed claim values.' };
    }
  }
  const malformed = validateFoundationVisual(workingPayload.visual);
  if (malformed) return { code: 'CLAIM_REVIEW_INVALID', error: malformed };
  const gate = reviewGate({ claims: ledger.claims, decisions, payload: workingPayload, logoRights });
  if (!gate.ready) return { code: 'FOUNDATION_INCOMPLETE', error: 'Add a rights-confirmed logo, primary colour and display font before certification.' };
  return null;
}
