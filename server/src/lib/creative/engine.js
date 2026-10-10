// Each tick is replayable. CAS before POST closes the duplicate-submission window.
// A process dying after the CAS requires reconciliation, never another POST.
export async function tickJob(id, { store, adapterFor, persist, qa, settle, fail, meter, route = async j => j }) {
  let job = await store.get(id);
  if (!job || ['completed','failed','reconcile','cancel_requested'].includes(job.state)) return job;
  let adapter = adapterFor(job.model);
  if (job.state === 'queued') {
    if (!await store.cas(id, 'queued', { state: 'submitting', submitted_at: new Date().toISOString() })) return store.get(id);
    try { job = await route(job); }
    catch(e) { return store.patch(id,{state:'reconcile',error:`Pre-submission routing interrupted: ${e.message}`}); }
    adapter = adapterFor(job.model);
    let task;
    try { task = await adapter.submit(job.input); }
    catch (e) {
      if (!e.definite) return store.patch(id, { state: 'reconcile', error: 'Submission outcome uncertain; provider reconciliation required' });
      await fail(job);
      return store.patch(id, { state: 'failed', error: e.message });
    }
    // Persist provider ID/result BEFORE the first poll. Failed DB writes leave
    // submitting intact, which is deliberately not eligible for re-submission.
    job = await store.patch(id, { task, state: task.result ? 'generated' : 'polling', result: task.result || null });
  }
  if (job.state === 'submitting') return store.patch(id, { state: 'reconcile', error: 'Interrupted submission requires provider reconciliation' });
  if (['polling','retrieval_failed'].includes(job.state)) {
    try {
      let result = await adapter.status(job.task);
      if (result.state === 'ready') result = await adapter.result(job.task);
      if (result.state === 'failed') {
        await meter(job, 'generation', result.usage, 'failed');
        await fail(job);
        return store.patch(id, { state: 'failed', error: 'Provider generation failed' });
      }
      if (result.state !== 'generated') return store.patch(id, { state: 'polling', progress: result.progress || 25 });
      job = await store.patch(id, { state: 'generated', result });
    } catch (e) { return store.patch(id, { state: 'retrieval_failed', error: e.message }); }
  }
  if (['generated','persistence_failed'].includes(job.state)) {
    await meter(job, 'generation', job.result.usage, 'succeeded');
    try { const asset = await persist(job, adapter); job = await store.patch(id, { state: 'stored', asset, error: null, progress: 90 }); }
    catch (e) { return store.patch(id, { state: 'persistence_failed', error: e.message }); }
  }
  if (job.state === 'stored') {
    // A durable QA claim prevents paid QA repeats after worker interruption.
    if (!await store.cas(id, 'stored', { state: 'qa_running' })) return store.get(id);
    let verdict;
    try { verdict = job.model.modality === 'video' ? { passed: false, violations: ['Human video review required'] } : await qa(job); }
    catch (e) { verdict = { passed: false, violations: [`QA unavailable: ${e.message}`] }; }
    job = await store.patch(id, { state: 'settling', qa: verdict });
  } else if (job.state === 'qa_running') {
    job = await store.patch(id, { state: 'settling', qa: { passed: false, violations: ['QA interrupted; human review required'] } });
  }
  if (job.state === 'settling') {
    if (job.model.modality === 'image') await meter(job, 'qa', job.qa?.usage, 'succeeded');
    const outputId = await settle(job); // Existing atomic, idempotent DB settlement.
    return store.patch(id, { state: 'completed', output_id: outputId, progress: 100, error: null });
  }
  return job;
}
