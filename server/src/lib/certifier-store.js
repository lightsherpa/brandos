// Trusted host persistence. Models never receive DB credentials or these RPCs.
import { supabaseAdmin } from './supabase.js';
import { reserveCredits, releaseCredits } from './credits.js';
import { routeCreditMultiplier } from './models/router.js';
export const CERTIFIER_CREDITS = Object.freeze({ full: 14, single_claim: 3 });
const rpcError = error => {
  const code = String(error.message || '').match(/CERTIFIER_[A-Z_]+/)?.[0] || 'CERTIFIER_STORE_UNAVAILABLE';
  return Object.assign(new Error(error.message), { code, status: code === 'CERTIFIER_BUSY' ? 409 : code === 'CERTIFIER_COST_CAP' ? 429 : code === 'CERTIFIER_SCOPE' ? 404 : 503 });
};
const paramsFor = ctx => ({ p_workspace_id: ctx.workspaceId, p_brand_id: ctx.brandId, p_bio_id: ctx.bioId, p_bio_version: Number(ctx.version) });
export function createCertifierState(db = supabaseAdmin) {
  const rpc = async (name, params) => {
    const { data, error } = await db.rpc(name, params);
    if (error) throw rpcError(error);
    if (data == null) throw Object.assign(new Error('Certifier state unavailable'), { code: 'CERTIFIER_STORE_UNAVAILABLE', status: 503 });
    return data;
  };
  return {
    async acquire(ctx, runId) {
      const row = await rpc('certifier_acquire_run', { ...paramsFor(ctx), p_run_id: runId });
      const scope = { p_brand_id: ctx.brandId, p_bio_version: Number(ctx.version), p_run_id: runId };
      // Only a request-local mirror for sizing. All authority and spend are DB-backed.
      return { spent: Number(row.spent), cap: Number(row.cap),
        reserve: (callId, estimate) => rpc('certifier_reserve_budget', { ...scope, p_call_id: callId, p_est: estimate }),
        settle: (callId, actual) => rpc('certifier_settle_budget', { ...scope, p_call_id: callId, p_actual: actual }),
        release: () => rpc('certifier_release_run', scope) };
    },
  };
}
export const certifierState = createCertifierState();
export async function reserveCertifier({ workspaceId, runId, mode }) {
  const key = `certifier:${runId}`;
  const result = await reserveCredits({ workspaceId, amount: CERTIFIER_CREDITS[mode] * routeCreditMultiplier('anthropic/claude-sonnet-5-5'), key, kind: 'steward_certifier' });
  if (!result.ok) throw Object.assign(new Error(result.message), { code: result.code, status: result.code === 'OUT_OF_CREDITS' ? 402 : 429 });
  return key;
}
export async function refundCertifier(workspaceId, key) {
  return releaseCredits({ workspaceId, reservationKey: key, releaseKey: `${key}:release`, reason: 'steward_certifier_refund' });
}
export async function recordCertifierRun(ctx, result, error, db = supabaseAdmin) {
  const { error: dbError } = await db.rpc('certifier_record_run', { ...paramsFor(ctx), p_run_id: result.runId,
    p_brief: result.brief || null, p_cost: result.costUsd, p_model: result.model, p_log: result.log,
    p_error: error ? error.code || 'CERTIFIER_FAILED' : null });
  if (dbError) throw rpcError(dbError);
}
export async function latestCertifierBrief(scope, db = supabaseAdmin) {
  const { data, error } = await db.from('certifier_briefs').select('id, version, brief, created_at')
    .eq('workspace_id', scope.workspaceId).eq('brand_id', scope.brandId).eq('bio_id', scope.bioId).eq('version', Number(scope.version))
    .eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw rpcError(error);
  return data;
}
export async function confirmCertifierClaim({ ctx, claimId, userId }, db = supabaseAdmin) {
  const { data, error } = await db.from('certifier_claim_confirmations').insert({ workspace_id: ctx.workspaceId,
    brand_id: ctx.brandId, bio_id: ctx.bioId, bio_version: Number(ctx.version), claim_id: claimId, actor_user_id: userId,
  }).select('id, actor_user_id, claim_id, bio_version, created_at').single();
  if (error) throw error.code === '23505' ? Object.assign(new Error('Claim already confirmed'), { status: 409 }) : rpcError(error);
  return data;
}
export async function saveCertifierQuestion({ workspaceId, brandId, bioId, runId, version, question }, db = supabaseAdmin) {
  const { data, error } = await db.from('certifier_question_drafts').insert({ workspace_id: workspaceId, brand_id: brandId,
    bio_id: bioId, run_id: runId, version: Number(version), status: 'draft', section: question.section,
    claim_ids: question.claim_ids, text: question.text, why: question.why, answer_type: question.answer_type || 'free_text',
  }).select('id').single();
  if (error) throw rpcError(error);
  return data.id;
}
