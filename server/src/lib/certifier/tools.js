import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { MODEL_OUTPUT_SCHEMA, OUTPUT_SCHEMA, validateBrief } from './validate.js';
import { tokenUpperBound } from './context.js';
const contract = JSON.parse(readFileSync(new URL('./TOOLS.json', import.meta.url)));
export const FORBIDDEN_TOOLS = new Set(contract.forbidden_tool_names);
export const TOOL_NAMES = new Set(contract.tools.map(t => t.name));
export const TOOL_DEFINITIONS = contract.tools.map(({ name, description, input_schema }) => ({ name, description,
  input_schema: name === 'submit_brief' ? MODEL_OUTPUT_SCHEMA : name === 'draft_client_question'
    ? { ...input_schema, $defs: OUTPUT_SCHEMA.$defs, properties: { ...input_schema.properties, why: { $ref: '#/$defs/statement' } } } : input_schema }));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map(TOOL_DEFINITIONS.map(t => [t.name, ajv.compile(t.input_schema)]));
function boundedText(text, max = 8000) {
  let result = ''; for (const char of String(text)) { if (tokenUpperBound(result + char) > max) break; result += char; } return result;
}
export function bindTools(ctx, { saveDraft = async () => { throw new Error('Draft storage unavailable'); } } = {}) {
  let readCalls = 0; const drafts = [];
  return { get readCalls() { return readCalls; }, drafts,
    async execute(name, args = {}) {
      if (!TOOL_NAMES.has(name)) return { error: 'forbidden_tool', review: FORBIDDEN_TOOLS.has(name) };
      const valid = validators.get(name); if (!valid(args)) return { error: 'tool_schema', errors: valid.errors };
      if (['read_brand_core', 'read_source', 'search_sources'].includes(name) && readCalls >= 6) return { error: 'read_limit' };
      if (['read_brand_core', 'read_source', 'search_sources'].includes(name)) readCalls++;
      if (name === 'read_brand_core') return { brand_core_version: ctx.version,
        claims: args.claim_id ? [ctx.ledger.get(args.claim_id)].filter(Boolean) : [...ctx.ledger.values()] };
      if (name === 'read_source') {
        const source = ctx.manifest.get(args.source_id); if (!source) return { error: 'unknown_source' };
        const text = args.page ? source.pages?.[args.page - 1] : source.text;
        if (text == null) return { error: 'bad_page' };
        return { source_id: source.source_id, kind: source.kind, page: args.page || null, text: boundedText(text),
          first_party: source.first_party, derived_from_model: source.derived_from_model, asset_role: source.asset_role };
      }
      if (name === 'search_sources') {
        const query = args.query.toLowerCase(); const hits = [];
        for (const source of ctx.manifest.values()) for (const [i, text] of (source.pages || [source.text]).entries()) {
          const index = text.toLowerCase().indexOf(query); if (index < 0) continue;
          hits.push({ source_id: source.source_id, page: source.pages ? i + 1 : null, snippet: text.slice(Math.max(0, index - 100), index + 400) });
        }
        return { hits: hits.slice(0, args.limit || 5) };
      }
      if (name === 'submit_brief') { const res = validateBrief(args, ctx.manifest, ctx.ledger); return { accepted: res.valid, errors: res.errors }; }
      // Validate questions before saving: client drafts never bypass citation/scope validation.
      const res = validateBrief({ brand_in_60s: [], claims: [], questions: [args] }, ctx.manifest, ctx.ledger);
      if (!res.valid) return { error: 'invalid_question', errors: res.errors };
      if (drafts.length >= 8) return { error: 'question_limit' };
      const old = drafts.find(d => d.question.claim_ids.some(id => args.claim_ids.includes(id)));
      if (old) return { draft_id: old.id, status: 'draft', question: structuredClone(old.question) };
      const id = await saveDraft({ workspaceId: ctx.workspaceId, brandId: ctx.brandId, bioId: ctx.bioId, runId: ctx.runId, version: ctx.version, question: args });
      drafts.push({ id, question: structuredClone(args) }); return { draft_id: id, status: 'draft', question: structuredClone(args) };
    } };
}
