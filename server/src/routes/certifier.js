import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { assertHumanActor } from '../lib/human-actor.js';
import { buildCertifierContext } from '../lib/certifier/context.js';
import { certifierEnabled, runCertifier } from '../lib/certifier/run.js';
import { saveQuestionDraft } from '../lib/certifier/drafts.js';
import { validateBrief } from '../lib/certifier/validate.js';
import { latestCertifierBrief, recordCertifierRun, reserveCertifier, refundCertifier, confirmCertifierClaim } from '../lib/certifier-store.js';

export function createCertifierRoutes(requireSteward) {
  const app = new Hono();
  app.use('*', (c, next) => certifierEnabled() ? next() : c.json({ error: 'Not found', code: 'FLAG_OFF' }, 404));
  app.use('*', assertHumanActor, requireAuth, assertHumanActor, requireSteward);
  // Same review assignment boundary as jobs/:id, plus the brand's actual
  // workspace. A platform CD may review an assigned client workspace.
  async function loadScope(c) {
    const bioId = c.req.param('bioId'); const steward = c.get('steward'); const auth = c.get('auth');
    const { data: bio, error: bioError } = await supabaseAdmin.from('bios').select('id, brand_id, version').eq('id', bioId).maybeSingle();
    if (bioError) throw Object.assign(new Error('Brand Core lookup failed'), { status: 503 });
    if (!bio) throw Object.assign(new Error('Brand Core not found'), { status: 404 });
    const { data: brand, error: brandError } = await supabaseAdmin.from('brands').select('id, workspace_id').eq('id', bio.brand_id).maybeSingle();
    if (brandError) throw Object.assign(new Error('Brand lookup failed'), { status: 503 });
    if (!brand || auth.scope === 'workspace' && auth.workspaceId !== brand.workspace_id) throw Object.assign(new Error('Brand outside workspace'), { status: 403 });
    const { data: jobs, error } = await supabaseAdmin.from('steward_jobs').select('id, assigned_to').eq('bio_id', bio.id).eq('brand_id', brand.id);
    if (error) throw Object.assign(new Error('Review assignment lookup failed'), { status: 503 });
    if (!jobs?.some(job => !job.assigned_to || job.assigned_to === steward.id || steward.roles?.includes('lead_steward'))) throw Object.assign(new Error('Review unavailable to this Creative Director'), { status: 403 });
    return { bioId, brandId: brand.id, workspaceId: brand.workspace_id, version: String(bio.version) };
  }
  async function latestVersion(scope) {
    const { data, error } = await supabaseAdmin.from('bios').select('version').eq('brand_id', scope.brandId).order('version', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) throw Object.assign(new Error('Latest Brand Core lookup failed'), { status: 503 });
    return String(data.version);
  }
  app.onError((e, c) => c.json({ error: e.message, code: e.code || 'CERTIFIER_FAILED' }, e.status || 500));
  async function generate(c, mode) {
    const scope = await loadScope(c); const claimId = mode === 'single_claim' ? c.req.param('claimId') : undefined;
    if (mode === 'full') { const body = await c.req.json().catch(() => ({})); if (body.mode !== 'full') return c.json({ error: 'mode must be full' }, 400); }
    if (await latestVersion(scope) !== scope.version) return c.json({ error: 'Brand Core version changed', code: 'CERTIFIER_STALE' }, 409);
    const ctx = await buildCertifierContext(scope); let previous;
    if (mode === 'single_claim') {
      if (!ctx.ledger.has(claimId)) return c.json({ error: 'Claim not found' }, 404);
      previous = await latestCertifierBrief(scope);
      if (!previous || String(previous.version) !== scope.version) return c.json({ error: 'Generate a full brief for this version first' }, 409);
      ctx.previousCreatedAt = previous.created_at;
    }
    const runId = randomUUID(); const key = await reserveCertifier({ ...scope, runId, mode });
    let result;
    try {
      result = await runCertifier(ctx, { runId, mode, claimId, previousBrief: previous?.brief, saveDraft: saveQuestionDraft,
        signal: c.req.raw.signal, cd_locale: c.get('auth').locale || 'en' });
      await recordCertifierRun(ctx, result);
    } catch (error) {
      // Do not replace the original error if audit/refund also fails; log the
      // reconciliation key without credentials or model arguments.
      try { if (!result) await recordCertifierRun(ctx, error.certifierRun || { runId, log: [], costUsd: 0, model: 'anthropic/claude-sonnet-5-5' }, error); }
      catch (auditError) { console.error('[certifier] run audit failed', runId, auditError.message); }
      try { await refundCertifier(scope.workspaceId, key); } catch (refundError) { console.error('[certifier] refund failed', runId, refundError.message); }
      throw error;
    }
    return c.json(result.brief);
  }
  app.post('/:bioId/brief', c => generate(c, 'full'));
  app.post('/:bioId/claims/:claimId/redraft', c => generate(c, 'single_claim'));
  app.get('/:bioId/brief', async c => {
    const scope = await loadScope(c); const saved = await latestCertifierBrief(scope);
    if (!saved) return c.json({ error: 'Brief not found' }, 404);
    const brief = structuredClone(saved.brief); const ctx = await buildCertifierContext(scope);
    for (const card of brief.claims) {
      const claim = ctx.ledger.get(card.claim_id);
      if (claim?.evidence_source_ids.some(id => Date.parse(ctx.manifest.get(id).created_at) > Date.parse(saved.created_at))) card.status_label = 'New evidence';
    }
    return c.json({ brief, stale: String(saved.version) !== await latestVersion(scope), run_id: saved.id });
  });
  app.post('/:bioId/claims/:claimId/confirm', assertHumanActor, async c => {
    const scope = await loadScope(c);
    if (await latestVersion(scope) !== scope.version) return c.json({ error: 'Brand Core version changed', code: 'CERTIFIER_STALE' }, 409);
    const saved = await latestCertifierBrief(scope); const id = c.req.param('claimId');
    const card = saved?.brief?.claims.find(cl => cl.claim_id === id);
    if (!card || String(saved.version) !== scope.version) return c.json({ error: 'Reviewed claim not found' }, 404);
    const ctx = await buildCertifierContext(scope);
    const res = validateBrief({ brand_in_60s: [], claims: [{ claim_id: id, rationale: card.rationale }], questions: [] }, ctx.manifest, ctx.ledger);
    const gate = ctx.ledger.get(id)?.gate;
    const gatePresent = !gate || (gate === 'logo' ? ctx.foundation.logo : gate === 'primary_colour' ? ctx.foundation.primary : ctx.foundation.display);
    if (!gatePresent || !res.valid || !card.rationale.some(st => st.citations?.length && !st.unknown) || card.blocks_certification) return c.json({ error: 'Evidence required before confirmation', code: 'CERTIFIER_EVIDENCE_REQUIRED' }, 409);
    const confirmation = await confirmCertifierClaim({ ctx, claimId: id, userId: c.get('auth').userId });
    return c.json({ confirmation });
  });
  return app;
}
