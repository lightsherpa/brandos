import { readFileSync } from 'node:fs';
import { contextFromRecords } from './context.js';
import { unknownStatement } from './validate.js';
export function fixture(name) { return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url))); }
export function context(f) { return contextFromRecords({ ...f, workspaceId: f.brand.workspace_id, brandId: f.brand.id, bioId: f.bio.id }); }
const statement = (text, sources, span) => ({ text, citations: sources.map(source_id => ({ source_id, span })) });
export function recordedOutput(ctx, name) {
  const claims = [...ctx.ledger.values()].map(c => {
    let rationale;
    if (name === 'cake-me') rationale = [unknownStatement()];
    else if (c.claim_id === 'visual.logo') rationale = [{ text: 'The client supplied the logo and it appears on the site.', citations: ['logo-upload', 'logo-site'].map(source_id => ({ source_id, span: 'Official brand logo', image: source_id })) }];
    else if (c.claim_id === 'identity.pillars[0]' || name === 'lumen-dental' && c.claim_id === 'voice.forbidden[0]') rationale = [unknownStatement()];
    else if (name === 'nomad-roasters' && c.claim_id === 'visual.palette[0]') rationale = [{ text: 'The site and brand book disagree on the primary colour.', citations: [{source_id:'site',span:'#614e30'},{source_id:'book',span:'#ae324f'}] }];
    else if (name === 'nomad-roasters' && c.claim_id === 'voice.register') rationale = [statement('This register appears in one caption.', ['caption'], 'irreverent')];
    else if (name === 'nomad-roasters' && c.claim_id === 'positioning.competitors[0]') rationale = [statement('Only one foreign comparison is supplied.', ['competitor'], 'One foreign competitor')];
    else if (name === 'lumen-dental' && c.claim_id === 'audience.primary') rationale = [{ text: 'This audience is inferred from a stock image caption.', citations: [{ source_id: 'stock', span: 'families in stock photography', image: 'stock' }] }];
    else { const span = JSON.stringify(c.value); rationale = [statement('The site and supplied notes contain this detail.', ['site', 'book'], span)]; }
    return { claim_id: c.claim_id, rationale };
  });
  const weak = name === 'cake-me' ? ['visual.logo', 'visual.type', 'visual.palette.primary']
    : name === 'nomad-roasters' ? ['identity.pillars[0]', 'voice.register', 'positioning.competitors[0]', 'visual.palette[0]']
    : ['identity.pillars[0]', 'audience.primary', 'voice.forbidden[0]'];
  const questions = weak.map(id => ({ claim_ids: [id], section: ctx.ledger.get(id).section,
    text: ctx.client_locale.startsWith('es') ? '¿Podrías compartir el libro de marca, los archivos del logo y las fuentes, e indicar cuál es el color principal?' : id.includes('visual') ? 'Could you share the brand book, logo and font files, and identify the primary colour?'
      : id.includes('pillars') ? 'Which documents support this statement?' : 'Could you share the research or communication examples behind this detail?',
    answer_type: id.includes('visual') ? 'upload' : 'free_text', why: unknownStatement() }));
  return { brand_in_60s: name === 'cake-me' ? [unknownStatement()] : [statement('These are the supplied brand details.', ['site'], 'documented')], claims, questions };
}
export function modelMock(out, model = 'claude-sonnet-5-5') {
  return async function* () { yield { type: 'done', usage: { model, prompt_tokens: 100, completion_tokens: 100 }, content: [{ type: 'tool_use', id: 'submit', name: 'submit_brief', input: structuredClone(out) }] }; };
}
