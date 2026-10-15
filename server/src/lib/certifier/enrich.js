import { HIGH_IMPACT } from '../steward-copilot.js';
import { checkFinalSchema, unknownStatement } from './validate.js';
const ORDER = ['to_confirm', 'conflicting', 'guessed', 'low', 'medium', 'high'];
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && v != null && !Object.keys(v).length);
export function confidenceFor(claim, cites, manifest) {
  if (claim.provenance === 'conflicting' || claim.distinctValues > 1) return 'conflicting';
  if (claim.provenance === 'missing' || empty(claim.value)) return 'to_confirm';
  const ev = cites.filter(c => manifest.has(c.source_id) && !manifest.get(c.source_id).derived_from_model);
  const defaults = claim.field === 'visual.palette' && ['#000000', '#ffffff', '#161616', '#000', '#fff'].includes(claim.value?.hex?.toLowerCase());
  if (defaults || !ev.length) return 'guessed';
  const fp = ev.some(c => manifest.get(c.source_id).first_party);
  const independent = new Set(ev.map(c => manifest.get(c.source_id).src_domain || c.source_id)).size;
  let level = independent >= 2 && fp ? 'high' : fp ? 'medium' : 'low';
  if (claim.suggested_concern === 'weak') level = { high: 'medium', medium: 'low', low: 'guessed' }[level];
  if (claim.suggested_concern === 'conflict') level = 'conflicting';
  return level;
}
export function enrich(out, ctx, { repairPasses = 0, replaced = 0, costUsd = 0, model, mode = 'full', claimId, previousBrief, now = new Date().toISOString() } = {}) {
  const chosen = claimId ? [ctx.ledger.get(claimId)].filter(Boolean) : [...ctx.ledger.values()];
  const claims = chosen.map(claim => {
    const generated = out.claims.find(c => c.claim_id === claim.claim_id);
    const rationale = generated?.rationale?.length ? generated.rationale : [unknownStatement()];
    const citations = rationale.flatMap(s => s.unknown ? [] : s.citations || []);
    const confidence = confidenceFor({ ...claim, suggested_concern: generated?.suggested_concern }, citations, ctx.manifest);
    const newer = claim.evidence_source_ids.some(id => ctx.manifest.get(id)?.kind === 'client_answer' &&
      Date.parse(ctx.manifest.get(id).created_at) > Date.parse(ctx.previousCreatedAt || now));
    const gateMissing = claim.gate === 'logo' ? !ctx.foundation.logo : claim.gate === 'display_font' ? !ctx.foundation.display : claim.gate === 'primary_colour' ? !ctx.foundation.primary : false;
    return { claim_id: claim.claim_id, layer: claim.layer, section: claim.section, field: claim.field, value: claim.value,
      rationale, ...(generated?.suggested_concern ? { suggested_concern: generated.suggested_concern } : {}), confidence, rank: 1,
      status_label: confidence === 'to_confirm' ? 'To confirm' : newer ? 'New evidence' : ['low', 'guessed', 'conflicting'].includes(confidence) ? 'Needs review' : 'Evidence ok',
      blocks_certification: !!claim.gate && (gateMissing || !['medium', 'high'].includes(confidence)),
      ...(confidence === 'to_confirm' ? { actions: ['ask_client', 'add'] } : {}) };
  });
  claims.sort((a, b) => ORDER.indexOf(a.confidence) - ORDER.indexOf(b.confidence) || Number(b.blocks_certification) - Number(a.blocks_certification)
    || a.layer - b.layer || Number(HIGH_IMPACT.has(b.field)) - Number(HIGH_IMPACT.has(a.field)) || a.claim_id.localeCompare(b.claim_id));
  claims.forEach((c, i) => { c.rank = i + 1; });
  const groups = new Map();
  out.questions.forEach((q, i) => { if (!groups.has(q.section)) groups.set(q.section, []);
    const { section, ...question } = q;
    groups.get(section).push({ ...question, question_id: `${ctx.runId}:q${i + 1}` });
  });
  const brief = { brand_core_version: ctx.version, mode, brand_in_60s: mode === 'single_claim' ? [] : out.brand_in_60s,
    claims, question_groups: [...groups].map(([section, questions]) => ({ section, questions })),
    meta: { model: model || 'anthropic/claude-sonnet-5-5', cost_usd: costUsd, repair_passes: repairPasses, replaced_with_unknown: replaced,
      label: 'Prepared by assistant — not a certification' } };
  if (mode === 'single_claim' && previousBrief) {
    // Preserve all untouched claim cards AND their ranks byte-for-byte.
    const old = previousBrief.claims.find(c => c.claim_id === claimId);
    if (old && claims[0]) claims[0].rank = old.rank;
    brief.claims = previousBrief.claims.map(c => c.claim_id === claimId ? claims[0] : c);
    brief.brand_in_60s = previousBrief.brand_in_60s;
    const remaining = previousBrief.question_groups.flatMap(g => g.questions.filter(q => !q.claim_ids.includes(claimId)).map(q => ({ section: g.section, q })));
    for (const { section, q } of remaining) { if (!groups.has(section)) groups.set(section, []); groups.get(section).push(q); }
    brief.question_groups = [...groups].map(([section, questions]) => ({ section, questions }));
  }
  if (!checkFinalSchema(brief)) throw new Error('Enriched brief failed schema: ' + JSON.stringify(checkFinalSchema.errors));
  return brief;
}
