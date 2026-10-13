// Trusted host persistence. Not exposed as a model tool, and deliberately
// outside lib/certifier's SELECT-only boundary.
import { supabaseAdmin } from './supabase.js';
import { reserveCredits, releaseCredits } from './credits.js';
import { routeCreditMultiplier } from './models/router.js';
export const CERTIFIER_CREDITS = Object.freeze({ full: 14, single_claim: 3 });
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
  const { error: dbError } = await supabaseAdmin.from('certifier_briefs').insert({
    id: result.runId, workspace_id: ctx.workspaceId, brand_id: ctx.brandId, bio_id: ctx.bioId, version: Number(ctx.version),
    brief: result.brief || null, cost_usd: result.costUsd, model: result.model, run_log: result.log,
    status: error ? 'failed' : 'completed', error_code: error ? error.code || 'CERTIFIER_FAILED' : null,
  });
  if (dbError) throw new Error(`Certifier run log save failed: ${dbError.message}`);
}
export async function latestCertifierBrief({ bioId, brandId }) {
  const { data, error } = await supabaseAdmin.from('certifier_briefs').select('id, version, brief, created_at')
    .eq('bio_id', bioId).eq('brand_id', brandId).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Certifier brief read failed: ${error.message}`);
  return data;
}
export async function confirmCertifierClaim({ ctx, claimId, userId }) {
  const { data, error } = await supabaseAdmin.from('certifier_claim_confirmations').insert({
    workspace_id: ctx.workspaceId, brand_id: ctx.brandId, bio_id: ctx.bioId, version: Number(ctx.version),
    claim_id: claimId, actor_user_id: userId,
  }).select('id').single();
  if (error) throw Object.assign(new Error(error.message), { status: error.code === '23505' ? 409 : 500 });
  return data;
}
