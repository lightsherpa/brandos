// The ONLY model-accessible mutation. This helper cannot send or notify.
export async function saveQuestionDraft({ workspaceId, brandId, bioId, runId, version, question }, db) {
  if (!db) db = (await import('../supabase.js')).supabaseAdmin;
  const { data, error } = await db.from('certifier_question_drafts').insert({
    workspace_id: workspaceId, brand_id: brandId, bio_id: bioId, run_id: runId, version: Number(version),
    status: 'draft', section: question.section, claim_ids: question.claim_ids, text: question.text, why: question.why,
    answer_type: question.answer_type || 'free_text',
  }).select('id').single();
  if (error || !data) throw new Error(`Question draft save failed: ${error?.message || 'no row'}`);
  return data.id;
}
