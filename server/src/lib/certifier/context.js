import { BIO_FIELDS, normalizeBio } from '../bio-schema.js';
import { groupClaims } from '../steward-copilot.js';
import { foundationStatus } from '../brand-foundation.js';
import { sameBrandHost } from '../bio-source-policy.js';

export const escapeText = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const tokenUpperBound = value => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

// Never serialize a DB row wholesale. In particular, source signals may hold
// user IDs, model-generated analyses, and unrelated internal metadata.
export function sourceRecord(row, brand) {
  const s = row.signals || {};
  const pages = Array.isArray(s.pages) ? s.pages.map(p => typeof p === 'string' ? p : String(p?.text || '')) : undefined;
  const image = row.kind === 'image' || /^image\//.test(s.mime || '');
  const derived = s.derived_from_model === true || /compile|^discovery$|discovery_output|model_output|ai_output/.test(row.kind);
  const caption = [s.caption, s.asset_role && `role: ${s.asset_role}`].filter(Boolean).join('\n');
  const text = image ? caption : row.kind === 'client_answer' ? String(row.src || '')
    : pages ? pages.join('\n') : String(s.text_extract ?? s.raw_text ?? s.text ?? s.markdown ?? '');
  let domain; try { domain = new URL(row.src).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* uploads are independent records */ }
  return { source_id: row.id, kind: image ? 'image' : pages || s.ext === 'pdf' ? 'pdf' : row.kind,
    text, ...(pages ? { pages } : {}), first_party: ['file_upload', 'client_answer', 'cd_note'].includes(row.kind) || sameBrandHost(brand.url, row.src),
    derived_from_model: derived, asset_role: s.asset_role || null, src_domain: domain, bucket: row.bucket || null,
    field_paths: Array.isArray(s.field_paths) ? s.field_paths : [], bio_version: s.bio_version, created_at: row.created_at };
}

export function contextFromRecords({ workspaceId, brandId, bioId, brand, bio, sources = [], notes = [], answers = [] }) {
  if (brand?.id !== brandId || brand?.workspace_id !== workspaceId || bio?.id !== bioId || bio?.brand_id !== brandId) {
    throw Object.assign(new Error('Brand Core outside run scope'), { status: 404, code: 'CERTIFIER_SCOPE' });
  }
  const payload = normalizeBio(bio.payload);
  const manifest = new Map(sources.filter(s => s.brand_id === brandId && (s.kind !== 'client_answer' || s.signals?.bio_version === bio.version))
    .map(s => [s.id, sourceRecord(s, brand)]));
  for (const note of notes) if (note.brand_id === brandId && note.narrative) {
    const id = `cd-note:${note.id}`;
    manifest.set(id, sourceRecord({ id, kind: 'cd_note', src: '', signals: { text: note.narrative }, created_at: note.created_at }, brand));
  }
  // Upload answers in S3 link the existing source, rather than changing its signals.
  for (const answer of answers) if (answer.brand_id === brandId && answer.bio_version === bio.version && manifest.has(answer.source_id)) {
    const source = manifest.get(answer.source_id);
    source.field_paths = [...new Set([...source.field_paths, ...(answer.field_paths || [])])];
    source.bio_version = answer.bio_version;
    source.created_at = answer.created_at || source.created_at;
  }
  const grouped = Object.values(groupClaims(payload)).flat();
  const ledger = new Map();
  for (const def of BIO_FIELDS) {
    const field = def.path.join('.'); const value = payload[def.path[0]][def.path[1]];
    const parent = grouped.find(c => c.field === field);
    const section = ['aspirations', 'positioning'].includes(def.path[0]) ? 'strategic' : def.path[0];
    const layer = section === 'visual' || section === 'identity' ? 1 : section === 'voice' || section === 'audience' ? 2 : 3;
    const items = Array.isArray(value) && value.length ? value.map((v, i) => [ `${field}[${i}]`, v ]) : [[field, value]];
    for (const [id, val] of items) {
      const gate = field === 'visual.logo' ? 'logo' : field === 'visual.palette' && val?.role === 'primary' ? 'primary_colour'
        : field === 'visual.type' && (empty(val) || /^(display|both)$/i.test(val?.kind || '')) ? 'display_font' : null;
      const evidenceIds = [...manifest.values()].filter(s => s.field_paths.includes(field) || s.field_paths.includes(id)).map(s => s.source_id);
      ledger.set(id, { claim_id: id, field, layer, section, value: val ?? null, provenance: empty(val) ? 'missing' : parent?.status || 'inferred', gate,
        evidence_source_ids: evidenceIds, ...(payload.conflicts?.some(c => (c.field_path || c.field) === field) ? { provenance: 'conflicting' } : {}) });
    }
  }
  if (!payload.visual.palette.some(c => c.role === 'primary')) {
    const candidates = payload.visual.palette.filter(c => /^#[\da-f]{6}$/i.test(c?.hex || ''))
      .filter(c => { const rgb = c.hex.slice(1).match(/../g).map(x => parseInt(x, 16)); return Math.max(...rgb) - Math.min(...rgb) > 24; });
    ledger.set('visual.palette.primary', { claim_id: 'visual.palette.primary', field: 'visual.palette', layer: 1, section: 'visual',
      value: candidates.length ? candidates.map(c => c.hex) : null, provenance: candidates.length > 1 ? 'conflicting' : 'missing', gate: 'primary_colour', evidence_source_ids: [] });
  }
  if (payload.visual.type.length && !payload.visual.type.some(f => /^(display|both)$/i.test(f?.kind || ''))) {
    ledger.set('visual.type.display', { claim_id: 'visual.type.display', field: 'visual.type', layer: 1, section: 'visual',
      value: null, provenance: 'missing', gate: 'display_font', evidence_source_ids: [] });
  }
  const logoRights = sources.filter(s => s.brand_id === brandId && s.kind === 'file_upload' && s.bucket === 'visual' && s.signals?.rights_confirmed === true && s.signals?.asset_role === 'logo' && s.signals?.ext === 'png' && s.signals?.purpose !== 'aspiration').map(s => s.id);
  return { workspaceId, brandId, bioId, version: String(bio.version), ledger, manifest,
    brand: { id: brand.id, name: brand.name, url: brand.url, industry: brand.industry },
    client_locale: brand.default_locale || 'en', foundation: foundationStatus(payload, { logoRights }) };
}

// This module only SELECTs; caller chooses the pinned BIO, never latest-by-accident.
export async function buildCertifierContext({ workspaceId, brandId, bioId, db }) {
  if (!db) db = (await import('../supabase.js')).supabaseAdmin;
  const read = async q => { const { data, error } = await q; if (error) throw new Error(`Certifier read failed: ${error.message}`); return data; };
  const brand = await read(db.from('brands').select('id, workspace_id, name, url, industry, default_locale').eq('id', brandId).eq('workspace_id', workspaceId).maybeSingle());
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 });
  const bio = await read(db.from('bios').select('id, brand_id, version, payload, score, certified, self_certified').eq('id', bioId).eq('brand_id', brandId).maybeSingle());
  if (!bio) throw Object.assign(new Error('Brand Core not found'), { status: 404 });
  const sources = await read(db.from('bio_sources').select('id, brand_id, kind, bucket, src, signals, raw_ref, created_at').eq('brand_id', brandId));
  const notes = await read(db.from('cert_decisions').select('id, brand_id, narrative, created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1));
  const answers = await read(db.from('cert_messages').select('brand_id, bio_version, field_paths, source_id, created_at').eq('brand_id', brandId).eq('bio_version', bio.version).eq('author_role', 'client'));
  return contextFromRecords({ workspaceId, brandId, bioId, brand, bio, sources, notes, answers });
}

export function serializeContext(ctx, { claimId, maxTokens = 40000 } = {}) {
  const claims = claimId ? [ctx.ledger.get(claimId)].filter(Boolean) : [...ctx.ledger.values()];
  let text = `${JSON.stringify({ brand: ctx.brand, foundation: ctx.foundation })}\n` + claims.map(c =>
    `<claim id="${escapeText(c.claim_id)}" layer="${c.layer}" section="${c.section}" provenance="${c.provenance}" gate="${c.gate || ''}">${escapeText(JSON.stringify(c.value))}</claim>`).join('\n');
  const sorted = [...ctx.manifest.values()].sort((a, b) => Number(['visual', 'foundations'].includes(b.bucket) || !!b.asset_role) - Number(['visual', 'foundations'].includes(a.bucket) || !!a.asset_role) || Number(b.first_party) - Number(a.first_party));
  for (const s of sorted) {
    const parts = s.pages || [s.text];
    for (let page = 0; page < parts.length; page++) {
      // 2k-token upper bound chunks; original source id remains the citation id.
      let chunks = ''; let index = 0;
      for (const ch of parts[page]) {
        if (tokenUpperBound(chunks + ch) > 2000) { append(chunks, index++); chunks = ''; }
        chunks += ch;
      }
      if (chunks) append(chunks, index);
      function append(chunk, i) {
        const block = `\n<source id="${escapeText(s.source_id)}" chunk="${i}" kind="${escapeText(s.kind)}"${s.pages ? ` page="${page + 1}"` : ''}${s.kind === 'image' ? ` image="${escapeText(s.source_id)}"` : ''} asset_role="${escapeText(s.asset_role || '')}" first_party="${s.first_party}" derived_from_model="${s.derived_from_model}">${escapeText(chunk)}</source>`;
        if (tokenUpperBound(text + block) <= maxTokens) text += block;
      }
    }
  }
  if (tokenUpperBound(text) > 60000) throw Object.assign(new Error('Claim ledger exceeds input budget'), { code: 'CERTIFIER_INPUT_BUDGET' });
  return text + '\nAdditional source text is available via search_sources and read_source.';
}
