import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
export const OUTPUT_SCHEMA = JSON.parse(readFileSync(new URL('./OUTPUT.schema.json', import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
export const MODEL_OUTPUT_SCHEMA = { ...OUTPUT_SCHEMA.$defs.model_output, $defs: OUTPUT_SCHEMA.$defs };
export const checkModelSchema = ajv.compile(MODEL_OUTPUT_SCHEMA);
export const checkFinalSchema = ajv.compile(OUTPUT_SCHEMA);
export const unknownStatement = () => ({ text: 'Unknown — not supported by sources.', unknown: true, citations: [] });
export const emptyBriefFrom = ledger => ({ brand_in_60s: [], claims: [...ledger.keys()].map(claim_id => ({ claim_id, rationale: [unknownStatement()] })), questions: [] });
export const norm = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();

// Map normalization back onto the raw extract. Offsets always highlight the
// ORIGINAL source (including NFKC expansion and collapsed whitespace).
function normalizedMap(raw) {
  let text = ''; const starts = []; const ends = [];
  for (let i = 0; i < raw.length;) {
    const start = i; let segment = String.fromCodePoint(raw.codePointAt(i)); i += segment.length;
    while (i < raw.length && /\p{M}/u.test(String.fromCodePoint(raw.codePointAt(i)))) {
      const mark = String.fromCodePoint(raw.codePointAt(i)); segment += mark; i += mark.length;
    }
    for (const char of segment.normalize('NFKC').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')) {
      if (/\s/.test(char)) { if (!text || text.endsWith(' ')) { if (text) ends[ends.length - 1] = i; continue; } }
      const c = /\s/.test(char) ? ' ' : char;
      text += c; for (let j = 0; j < c.length; j++) { starts.push(start); ends.push(i); }
    }
  }
  if (text.endsWith(' ')) { text = text.slice(0, -1); starts.pop(); ends.pop(); }
  return { text, starts, ends };
}
function dice(a, b) {
  const pairs = words => words.slice(1).map((w, i) => words[i] + ' ' + w);
  const x = pairs(a), y = pairs(b); if (!x.length || !y.length) return 0;
  const counts = new Map(); for (const p of x) counts.set(p, (counts.get(p) || 0) + 1);
  let hits = 0; for (const p of y) if (counts.get(p)) { hits++; counts.set(p, counts.get(p) - 1); }
  return 2 * hits / (x.length + y.length);
}
export function locate(raw, span) {
  const m = normalizedMap(String(raw ?? '')); const needle = norm(span);
  if (!needle) return null;
  let start = m.text.indexOf(needle), end = start + needle.length;
  if (start < 0) {
    const words = [...m.text.matchAll(/\S+/g)]; const target = needle.split(' '); let best = 0.9;
    for (let i = 0; i < words.length; i++) for (const length of [target.length - 1, target.length, target.length + 1]) {
      if (length < 2 || i + length > words.length) continue;
      const score = dice(words.slice(i, i + length).map(w => w[0]), target);
      if (score >= best) { best = score; start = words[i].index; end = words[i + length - 1].index + words[i + length - 1][0].length; }
    }
  }
  return start < 0 ? null : { start: m.starts[start], end: m.ends[end - 1] };
}
export function forEachStatement(out, fn) {
  if (Array.isArray(out?.brand_in_60s)) out.brand_in_60s.forEach((st, i) => fn(st, `/brand_in_60s/${i}`));
  if (Array.isArray(out?.claims)) out.claims.forEach((c, i) => { if (Array.isArray(c?.rationale)) c.rationale.forEach((st, j) => fn(st, `/claims/${i}/rationale/${j}`)); });
  if (Array.isArray(out?.questions)) out.questions.forEach((q, i) => fn(q?.why, `/questions/${i}/why`));
}
const verdict = /\b(certified|certify|approve[ds]?|reject(?:ed)?|is correct)\b/i;
export function validateBrief(out, manifest, ledger) {
  const errors = [];
  if (!checkModelSchema(out)) errors.push(...checkModelSchema.errors.map(e => ({ path: e.instancePath, code: 'schema' })));
  forEachStatement(out, (st, path) => {
    if (!st || typeof st !== 'object') return;
    if (verdict.test(st.text || '')) errors.push({ path, code: 'verdict' });
    if (st.unknown === true) { if (st.citations?.length) errors.push({ path, code: 'unknown_with_citations' }); return; }
    if (!Array.isArray(st.citations) || !st.citations.length) { errors.push({ path, code: 'missing_citation' }); return; }
    st.citations.forEach((c, i) => {
      const p = `${path}/citations/${i}`;
      const src = manifest.get(c?.source_id);
      if (!src) return errors.push({ path: p, code: 'unknown_source' });
      if (src.derived_from_model) return errors.push({ path: p, code: 'circular_source' });
      if (c.image && c.image !== c.source_id && !manifest.has(c.image)) return errors.push({ path: p, code: 'bad_image' });
      if (src.kind === 'image' && c.image !== src.source_id) return errors.push({ path: p, code: 'bad_image' });
      const pages = src.pages;
      if (c.page != null && (!Number.isInteger(c.page) || c.page < 1 || pages?.[c.page - 1] == null)) return errors.push({ path: p, code: 'bad_page' });
      // Search page-by-page so a quote can never span two PDF pages.
      const candidates = c.page ? [[c.page, pages[c.page - 1]]] : pages ? pages.map((t, j) => [j + 1, t]) : [[null, src.text]];
      for (const [page, text] of candidates) {
        const hit = locate(text, c.span); if (!hit) continue;
        const canonical = text.slice(hit.start, hit.end);
        if (canonical.length > 400 || canonical.length < 3) continue;
        c.span = canonical; c.char_start = hit.start; c.char_end = hit.end;
        if (page) c.page = page;
        return;
      }
      errors.push({ path: p, code: 'span_not_found' });
    });
  });
  const seen = new Set();
  if (Array.isArray(out?.claims)) out.claims.forEach((c, i) => {
    if (!ledger.has(c?.claim_id) || seen.has(c.claim_id)) errors.push({ path: `/claims/${i}`, code: 'unknown_claim' });
    seen.add(c?.claim_id);
  });
  const questionClaims = new Set();
  if (Array.isArray(out?.questions)) out.questions.forEach((q, i) => {
    if (!Array.isArray(q?.claim_ids)) return;
    if (q.claim_ids.some(id => !ledger.has(id) || ledger.get(id).section !== q.section || questionClaims.has(id))) errors.push({ path: `/questions/${i}`, code: 'unknown_claim' });
    q.claim_ids.forEach(id => questionClaims.add(id));
    if (verdict.test(q.text || '') || /\b(BIO|Layer|confidence|agent)\b/i.test(q.text || '')) errors.push({ path: `/questions/${i}`, code: 'question_language' });
    if (/^(is|are|do|does|you're|isn't|right\?)\b|, right\?$/i.test(q.text?.trim() || '')) errors.push({ path: `/questions/${i}`, code: 'leading_question', soft: true });
  });
  return { valid: !errors.some(e => !e.soft), errors };
}
export function sanitizeBrief(out, manifest, ledger) {
  if (!out || typeof out !== 'object') return { out: emptyBriefFrom(ledger), replaced: ledger.size };
  const candidate = structuredClone(out); let replaced = 0;
  const result = validateBrief(candidate, manifest, ledger);
  const bad = result.errors.filter(e => !e.soft);
  forEachStatement(candidate, (st, path) => {
    if (bad.some(e => e.path === path || e.path.startsWith(path + '/'))) {
      const parts = path.split('/').slice(1); const last = parts.pop();
      const parent = parts.reduce((v, k) => v?.[k], candidate);
      if (parent) { parent[last] = unknownStatement(); replaced++; }
    }
  });
  if (Array.isArray(candidate.claims)) candidate.claims = candidate.claims.filter((_, i) => !bad.some(e => e.code === 'unknown_claim' && e.path === `/claims/${i}`));
  if (Array.isArray(candidate.questions)) candidate.questions = candidate.questions.filter((_, i) => !bad.some(e => e.path === `/questions/${i}`));
  // Revalidate after degradation; never emit a structurally malformed brief.
  if (!validateBrief(candidate, manifest, ledger).valid) return { out: emptyBriefFrom(ledger), replaced: replaced + ledger.size };
  return { out: candidate, replaced };
}
export async function runWithRepair(callModel, ctx) {
  let out = await callModel(ctx.messages); let result = validateBrief(out, ctx.manifest, ctx.ledger); let repairPasses = 0;
  if (!result.valid && ctx.costSoFar() < 0.26) {
    repairPasses = 1;
    try { out = await callModel([...ctx.messages, { role: 'user', content: 'Your brief failed validation. Fix ONLY these items; copy spans verbatim or set unknown:true:\n' + JSON.stringify(result.errors) }]); }
    catch (error) { if (!['CERTIFIER_COST_CAP', 'CERTIFIER_INPUT_BUDGET'].includes(error.code)) throw error; }
  }
  return { ...sanitizeBrief(out, ctx.manifest, ctx.ledger), repairPasses };
}
