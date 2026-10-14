// Internal assistant state stays in the trusted server, never in a DB role.
import { randomUUID } from 'node:crypto';
import { reserveCredits, releaseCredits } from './credits.js';
import { routeCreditMultiplier } from './models/router.js';
export const CERTIFIER_CREDITS = Object.freeze({ full: 14, single_claim: 3 });
const runs = new Map();
const confirmations = new Map();
const scopeKey = ctx => JSON.stringify([ctx.workspaceId, ctx.brandId, ctx.bioId, String(ctx.version)]);
export async function reserveCertifier({ workspaceId, runId, mode }) {
  const key = `certifier:${runId}`;
  const result = await reserveCredits({ workspaceId, amount: CERTIFIER_CREDITS[mode] * routeCreditMultiplier('anthropic/claude-sonnet-5-5'), key, kind: 'steward_certifier' });
  if (!result.ok) throw Object.assign(new Error(result.message), { code: result.code, status: result.code === 'OUT_OF_CREDITS' ? 402 : 429 });
  return key;
}
export async function refundCertifier(workspaceId, key) {
  return releaseCredits({ workspaceId, reservationKey: key, releaseKey: `${key}:release`, reason: 'steward_certifier_refund' });
}
export async function recordCertifierRun(ctx, result, error) {
  if (!error) runs.set(scopeKey(ctx), structuredClone({ id: result.runId, version: Number(ctx.version), brief: result.brief, created_at: new Date().toISOString() }));
}
export async function latestCertifierBrief(scope) {
  return structuredClone(runs.get(scopeKey(scope)) || null);
}
export async function confirmCertifierClaim({ ctx, claimId, userId }) {
  const key = JSON.stringify([scopeKey(ctx), claimId]);
  if (confirmations.has(key)) throw Object.assign(new Error('Claim already confirmed'), { status: 409 });
  const row = { id: randomUUID(), actor_user_id: userId };
  confirmations.set(key, row);
  return { id: row.id };
}
