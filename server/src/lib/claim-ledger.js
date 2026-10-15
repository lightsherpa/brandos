import { createHash } from 'node:crypto';
import { BIO_FIELDS, normalizeBio } from './bio-schema.js';
import { computeFocus } from './bio-focus.js';
import { claimId } from './claim-id.js';
import { readField } from './claim-review.js';
import { isBrandEvidenceSource, sameBrandHost } from './bio-source-policy.js';
import { cleanQuote, normalizeSourceKinds, normalizeSourcePage } from './source-kind.js';
export const certifierS1Enabled = () => ['1', 'true'].includes(String(process.env.CERTIFIER_V2_S1 || '').toLowerCase());
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);
export const safeEvidenceUrl = raw => {
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
const sourceIds = value => {
  if (!value || typeof value !== 'object') return [];
  return [...new Set([value.sourceId, ...Object.values(value).flatMap(sourceIds)].filter(Boolean))];
};
const SECTIONS = ['foundation', 'guidelines', 'strategy'];
const LEVELS = ['to_confirm', 'conflicting', 'guessed', 'low', 'medium', 'high'];
function confidenceLevel({ value, confidence, firstParty, conflict, missing }) {
  if (missing || empty(value) || !confidence) return 'to_confirm';
  if (conflict) return 'conflicting';
  const conf = Number(confidence.conf);
  const defaults = Array.isArray(value) && value.some(c => c?.role === 'primary' && ['#000', '#fff', '#000000', '#ffffff', '#161616'].includes(c.hex?.toLowerCase()));
  const kinds = normalizeSourceKinds(confidence.source_kind || confidence.source);
  if (conf < 50 || kinds.includes('guess') || defaults) return 'guessed';
  if (conf >= 85 && firstParty) return 'high';
  if (conf >= 70 || firstParty) return 'medium';
  return 'low';
}
export function buildClaimLedger({ brandId, bioVersion, payload = {}, sources = [], messages = [], brandUrl }) {
  payload = normalizeBio(payload);
  const focus = new Map(computeFocus(payload).map(item => [item.field, item]));
  // computeFocus intentionally drops high-confidence fields; reuse its full
  // importance registry for tie-breaking even when a claim was dropped there.
  const importance = new Map(computeFocus({ ...payload,
    confidence:Object.fromEntries(BIO_FIELDS.map(f => [f.path.join('.'), {conf:0}])),
  }).map(item => [item.field,item]));
  const claims = BIO_FIELDS.map(field => {
    const path = field.path.join('.');
    const id = claimId(brandId, bioVersion, path);
    const value = readField(payload, path) ?? null;
    const conf = payload.confidence?.[path];
    const rawEvidence = payload.evidence?.[path];
    const quote = typeof rawEvidence === 'string' ? rawEvidence : rawEvidence?.quote || rawEvidence?.snippet || '';
    const reference = [conf?.source, quote, rawEvidence?.source_id, rawEvidence?.sourceId].filter(Boolean).join(' ');
    const explicitIds = sourceIds(value).concat(rawEvidence?.source_id || rawEvidence?.sourceId || []);
    const answers = messages.filter(m => m.bio_version === bioVersion && m.claim_ids?.includes(id) && m.author_role === 'client' && m.sent_at).sort((a,b) => String(a.id).localeCompare(String(b.id)));
    const matches = sources.filter(s => {
      if (!isBrandEvidenceSource(s) || s.signals?.purpose === 'aspiration') return false;
      if (s.kind === 'client_answer') return s.signals?.bio_version === bioVersion && s.signals?.claim_ids?.includes(id);
      return explicitIds.includes(s.id) || answers.some(a => a.source_id === s.id)
        || (s.signals?.claim_ids?.includes(id) && s.signals?.bio_version === bioVersion)
        || (s.src && reference.toLowerCase().includes(String(s.src).toLowerCase()));
    }).sort((a,b) => String(a.id).localeCompare(String(b.id)));
    const kindFromRow = (s) => s.kind === 'client_answer' ? 'your_answers' : s.kind === 'file_upload' ? 'brand_deck' : normalizeSourceKinds(s.src || s.kind)[0];
    const distinctQuote = (excerpt, ...same) => {
      const cleaned = cleanQuote(typeof excerpt === 'string' ? excerpt : '');
      if (!cleaned) return null;
      return same.some((item) => item && cleaned === String(item).trim()) ? null : cleaned;
    };
    const evidence = matches.map(s => {
      const kinds = [kindFromRow(s)];
      const excerpt = answers.find(a => a.source_id === s.id)?.body || s.signals?.quote || s.signals?.snippet || quote || null;
      return { source_id: s.id, source_kind: kinds, source_page: normalizeSourcePage(s.signals?.page || rawEvidence?.page), label: kinds[0], kind: s.kind,
        quote: distinctQuote(excerpt, s.src, conf?.source, quote && quote === conf?.source ? quote : null),
        url: safeEvidenceUrl(s.src), asset_url: safeEvidenceUrl(s.evidence_url),
        screenshot: safeEvidenceUrl(s.signals?.screenshotUrl || s.signals?.screenshot_url),
        page: s.signals?.page || rawEvidence?.page || null,
        mime: s.signals?.mime || '', first_party: ['file_upload', 'client_answer'].includes(s.kind) || sameBrandHost(brandUrl, s.src),
      };
    });
    // Keep one provenance label. A quote is only the excerpt, never a copy of the label.
    if (!evidence.length && (quote || conf?.source || conf?.source_kind)) {
      const kinds = normalizeSourceKinds(conf?.source_kind || conf?.source);
      const url = safeEvidenceUrl(String(conf?.source || '').match(/https?:\/\/[^\s)\]]+/)?.[0]);
      evidence.push({ source_kind: kinds, source_page: normalizeSourcePage(conf?.source_page), label: kinds[0],
        quote: distinctQuote(quote, conf?.source),
        url, asset_url: null, first_party: kinds.some((kind) => ['brand_deck', 'your_answers', 'cd_edit'].includes(kind)) || sameBrandHost(brandUrl, url) });
    }
    const candidates = Array.isArray(value) ? value : [];
    const conflict = ['visual.palette', 'visual.type'].includes(path) && candidates.some((a,i) => candidates.some((b,j) => i !== j && (a.source || a.sourceId) && (b.source || b.sourceId) && (a.source || a.sourceId) !== (b.source || b.sourceId)
      && (path === 'visual.palette' ? a.role && a.role === b.role && a.hex !== b.hex : a.kind === b.kind && a.family !== b.family)));
    // Visual uploads often carry confidence on the object/candidates.
    const effectiveConf = conf || (explicitIds.length && !empty(value) ? { conf: Number(value?.conf ?? (candidates.length ? Math.min(...candidates.map(c => Number(c.conf ?? 80))) : 80)), source: matches.map(s => s.src).join(', ') } : null);
    const section = path.startsWith('visual.') || path.startsWith('voice.') ? 'foundation' : path.startsWith('strategic.') ? 'guidelines' : 'strategy';
    const item = focus.get(path);
    const priority = importance.get(path);
    return { claim_id: id, bio_version: bioVersion, field_path: path, section, kind: field.kind, value,
      level: confidenceLevel({ value, confidence: effectiveConf, firstParty: evidence.some(e => e.first_party), conflict, missing: item?.status === 'missing' || !evidence.length }),
      importance: ['visual.logo', 'visual.palette', 'visual.type'].includes(path) ? 1.1 : priority?.importance ?? 0.3,
      why: item?.status === 'missing' ? 'provenance.missingNotFound' : normalizeSourceKinds(effectiveConf?.source_kind || effectiveConf?.source).includes('guess') ? 'provenance.guessCheck' : 'provenance.where',
      open_questions: messages.filter(m => m.bio_version === bioVersion && m.claim_ids?.includes(id) && m.author_role === 'cd' && !answers.some(a => a.reply_to === m.id)).length,
      evidence, evidence_token: hash([id, value, conf || null, rawEvidence || null, matches.map(s => [s.id, s.signals, s.src]), answers.map(a => [a.id, a.body, a.source_id])]),
    };
  });
  claims.sort((a,b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || b.importance - a.importance || a.field_path.localeCompare(b.field_path));
  return { bio_version: bioVersion, claims };
}
