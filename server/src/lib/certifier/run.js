import { hash as cryptoHash, randomUUID } from 'node:crypto';
import { createCompletionStreamer } from '../models/fallback.js';
import { streamToolCompletion } from '../models/anthropic.js';
import { certifierState } from '../certifier-store.js';
import { CertifierBudget } from '../models/token-budget.js';
import { resolveCompletionCost } from '../models/model-prices.js';
import { fillSystemPrompt } from './prompt.js';
import { serializeContext, tokenUpperBound } from './context.js';
import { bindTools, TOOL_DEFINITIONS } from './tools.js';
import { runWithRepair, emptyBriefFrom, checkFinalSchema } from './validate.js';
import { enrich } from './enrich.js';
const PRIMARY = 'anthropic/claude-sonnet-5-5';
const FALLBACK = 'anthropic/claude-sonnet-4-6';
export const certifierEnabled = () => String(process.env.CERTIFIER_V2_S2 || '').toLowerCase() === 'true';
const provider = createCompletionStreamer(p => streamToolCompletion({ ...p, model: p.route.split('/').pop() }));
// A brief and all redrafts share one budget for the exact Brand Core version.
const hash = args => cryptoHash('sha256', JSON.stringify(args));

export async function runCertifier(context, { mode = 'full', claimId, cd_locale = 'en', stream = provider,
  saveDraft, previousBrief, signal: callerSignal, runId = randomUUID(), timeoutMs, state = certifierState, persistRun = async () => {}, loadPreviousBrief } = {}) {
  if (!certifierEnabled()) throw Object.assign(new Error('Certifier disabled'), { status: 404, code: 'FLAG_OFF' });
  if (!['full', 'single_claim'].includes(mode) || mode === 'single_claim' && !context.ledger.has(claimId)) throw Object.assign(new Error('Unknown claim or mode'), { status: 400 });
  const ctx = { ...context, runId, ledger: mode === 'single_claim' ? new Map([[claimId, context.ledger.get(claimId)]]) : context.ledger };
  const session = await state.acquire(context, runId);
  const budget = new CertifierBudget(session.cap);
  budget.spent = session.spent;
  const startingCost = budget.spent;
  const tools = bindTools(ctx, { saveDraft }); const log = []; let model = PRIMARY;
  const controller = new AbortController();
  const abort = () => controller.abort(callerSignal.reason);
  if (callerSignal?.aborted) abort(); else callerSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Certifier total timeout')), timeoutMs ?? (mode === 'full' ? 90000 : 30000));
  try {
    budget.allowance(0, 16);
    if (loadPreviousBrief) { previousBrief = await loadPreviousBrief(); ctx.previousCreatedAt = context.previousCreatedAt; }
    const messages = [{ role: 'user', content: [{ type: 'text', text: serializeContext(ctx, { claimId: mode === 'single_claim' ? claimId : undefined }), cache_control: { type: 'ephemeral' } }] }];
    const system = [{ type: 'text', text: fillSystemPrompt({ ...ctx, cd_locale, mode, claim_id: claimId }), cache_control: { type: 'ephemeral' } }];
    let providerCalls = 0;
    async function callModel(initialMessages) {
      const conversation = structuredClone(initialMessages);
      for (let turn = 0; turn < 9; turn++) {
        controller.signal.throwIfAborted();
        const forced = tools.readCalls >= 6 || turn >= 7 || providerCalls >= 8 || initialMessages !== messages;
        const tokens = tokenUpperBound({ system, messages: conversation, tools: TOOL_DEFINITIONS }) + 512;
        if (tokens > 60000) throw Object.assign(new Error('Certifier input budget exceeded'), { code: 'CERTIFIER_INPUT_BUDGET' });
        const maxTokens = budget.allowance(tokens, mode === 'full' ? 8000 : 2000, model === PRIMARY);
        const estimate = Number((tokens * (model === PRIMARY ? 6.25 : 3.75) / 1e6 + maxTokens * 15 / 1e6).toFixed(9));
        const callId = randomUUID();
        const reserved = await session.reserve(callId, estimate);
        budget.spent = Number(reserved.spent);
        providerCalls++;
        let final; let usage;
        for await (const event of stream({ spec: { payload: { modelRouting: { primary: model, fallback: model === PRIMARY ? FALLBACK : undefined } } },
          system, messages: conversation, tools: TOOL_DEFINITIONS, tool_choice: forced ? { type: 'tool', name: 'submit_brief' } : { type: 'auto' }, maxTokens, signal: controller.signal })) {
          controller.signal.throwIfAborted();
          if (event.type === 'error') throw Object.assign(new Error(event.message), { status: 502 });
          if (event.type === 'usage') usage = event.usage;
          if (event.type === 'done') { final = event; usage = event.usage; }
        }
        if (!final) throw new Error('Model did not complete');
        model = 'anthropic/' + (usage?.model || model.split('/').pop());
        const measured = resolveCompletionCost(usage, null, model).cost_usd;
        if (!usage || !Number.isFinite(usage.prompt_tokens) || !Number.isFinite(usage.completion_tokens) || measured == null) throw new Error('Model usage unavailable');
        const failedInputReserve = usage?.fallback_from ? tokens * 2.5 / 1e6 : 0;
        const settled = await session.settle(callId, Number((measured + failedInputReserve).toFixed(9)));
        budget.spent = Number(settled.spent);
        const calls = (final.content || []).filter(block => block.type === 'tool_use');
        const results = []; let submitted;
        for (const call of calls) {
          const start = Date.now(); let result;
          if (call.name === 'submit_brief') { submitted = call.input; result = await tools.execute(call.name, call.input); }
          else if (forced && ['read_brand_core', 'read_source', 'search_sources'].includes(call.name)) result = { error: 'read_limit' };
          else result = await tools.execute(call.name, call.input);
          log.push({ name: call.name, args_hash: hash(call.input), latency_ms: Date.now() - start, bytes: tokenUpperBound(result),
            ...(result.error ? { code: result.error } : {}), ...(result.review ? { review: true } : {}) });
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) });
        }
        if (submitted !== undefined) return submitted;
        if (!calls.length) conversation.push({ role: 'assistant', content: final.content || [] }, { role: 'user', content: 'Use submit_brief to return the required JSON.' });
        else conversation.push({ role: 'assistant', content: final.content }, { role: 'user', content: results });
      }
      return emptyBriefFrom(ctx.ledger);
    }
    const result = await runWithRepair(callModel, { ...ctx, messages, costSoFar: () => budget.spent });
    const brief = enrich(result.out, ctx, { ...result, costUsd: budget.spent - startingCost, model, mode, claimId, previousBrief });
    for (const group of brief.question_groups) for (const question of group.questions) {
      if (mode === 'single_claim' && !question.claim_ids.includes(claimId) || question.draft_id) continue;
      const { question_id, draft_id, ...args } = question;
      const started = Date.now(); const saved = await tools.execute('draft_client_question', { ...args, section: group.section });
      log.push({ name: 'draft_client_question', args_hash: hash(args), latency_ms: Date.now() - started, bytes: tokenUpperBound(saved) });
      if (saved.error) throw new Error('Could not save validated question: ' + saved.error);
      // A repeated cluster returns its already saved draft. The CD sees the
      // exact persisted text, not a later model variant with the old draft id.
      Object.assign(question, saved.question);
      delete question.section;
      question.draft_id = saved.draft_id;
    }
    if (!checkFinalSchema(brief)) throw new Error('Saved brief failed schema');
    const completed = { brief, runId, log, costUsd: budget.spent - startingCost, model };
    await persistRun(completed);
    return completed;
  } catch (error) {
    // Provider errors/abort without usage cannot create a fresh spending allowance.
    // Reservation is already committed. Unknown usage retains its full estimate.
    error.certifierRun = { runId, log, costUsd: budget.spent - startingCost, model }; throw error;
  } finally {
    clearTimeout(timer); callerSignal?.removeEventListener('abort', abort); controller.abort();
    try { await session.release(); } catch (error) { console.error('[certifier] lease release failed', runId, error.code); }
  }
}
