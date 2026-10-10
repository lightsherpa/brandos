import { supabaseAdmin as db } from '../supabase.js';
import { mediaAdapter } from './providers.js';
import { recordUsage } from './usage.js';
import { visionQa } from '../qa-vision.js';
import { failRunAndReleaseCredits } from '../credits.js';
import { selectRoute } from '../models/jev.js';
import { tickJob } from './engine.js';
export const store = {
  async get(id) { const { data, error } = await db.from('creative_jobs').select('*').eq('id',id).single(); if (error) throw error; return data; },
  async patch(id, patch) { const { data, error } = await db.from('creative_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id',id).select().single(); if (error) throw error; return data; },
  async cas(id, state, patch) { const { data, error } = await db.from('creative_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id',id).eq('state',state).select('id'); if (error) throw error; return data.length === 1; },
};
export async function privateAssetUrl(asset) {
  const { data, error } = await db.storage.from(asset.bucket||'bio-sources').createSignedUrl(asset.path, 3600);
  if (error || !data?.signedUrl) throw new Error('Asset access failed'); return data.signedUrl;
}
async function persist(job, adapter) {
  const r = job.result;
  const types = { 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4' };
  if (!types[r.contentType]) throw new Error('Unsupported asset content type');
  let bytes;
  if (r.base64) bytes = Buffer.from(r.base64,'base64');
  else {
    const url = new URL(r.assetUrl);
    const allowed = ['openrouter.ai','fal.media','fal.run','apimart.ai'];
    if (url.protocol !== 'https:' || !allowed.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))) throw new Error('Untrusted provider asset host');
    const response = await fetch(url, { headers: adapter.downloadHeaders(url.href), signal: AbortSignal.timeout(60000), redirect: 'error' });
    if (!response.ok) throw new Error(`Asset download HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > 200 * 1024 * 1024) throw new Error('Asset too large');
    const chunks=[]; let size=0;
    for await (const chunk of response.body) { size += chunk.length; if(size>200*1024*1024) throw new Error('Asset too large'); chunks.push(chunk); }
    bytes=Buffer.concat(chunks);
  }
  const path = `${job.workspace_id}/${job.brand_id}/outputs/${job.run_id}.${types[r.contentType]}`;
  const { error } = await db.storage.from('creative-outputs').upload(path,bytes,{contentType:r.contentType,upsert:true});
  if(error) throw error;
  return { bucket:'creative-outputs',path, contentType:r.contentType, width:r.width, height:r.height, publishable:false };
}
async function settle(job) {
  const evidence = job.qa?.violations?.join('; ') || null;
  const generation = job.result.usage?.cost ?? job.result.usage?.cost_usd ?? null;
  const qaCost = job.qa?.usage?.cost ?? job.qa?.usage?.cost_usd ?? null;
  const jevCost = job.routing?.attempted ? job.routing.usage?.cost ?? job.routing.usage?.cost_usd ?? null : 0;
  const totalCost = generation == null || jevCost == null || (job.model.modality==='image' && qaCost==null) ? null : Number(generation)+Number(qaCost||0)+Number(jevCost);
  const {data,error}=await db.rpc('finalize_run_atomic',{
    p_workspace_id:job.workspace_id,p_run_id:job.run_id,p_reservation_key:job.reservation_key,p_model_used:job.model.route,
    p_prompt_tokens:0,p_completion_tokens:0,p_cached_tokens:0,p_cost_usd:totalCost,
    p_latency_ms:Date.now()-Date.parse(job.created_at),p_output_kind:job.model.modality,
    p_output_body:{kind:job.model.modality,asset:job.asset,model:job.model,reference:job.input.reference||null,prompt_used:job.input.prompt,settings:job.input.settings,review_required:!job.qa.passed},
    p_asset_url:null,p_output_status:job.qa.passed?'approved':'flagged',p_rationale:evidence,p_qa_passed:!!job.qa.passed,p_qa_evidence:evidence,p_ledger_kind:job.qa.passed?'run':'run_flagged',
  });
  if(error) throw error;return data.output_id;
}
export const advanceJob = id => tickJob(id,{store,adapterFor:mediaAdapter,persist,settle,
  route:async job=>{
    const {data:rollout,error:rolloutError}=await db.from('creative_workspace_policy').select('enabled,policy').eq('workspace_id',job.workspace_id).single();
    if(rolloutError||!rollout?.enabled||process.env.CREATIVE_ROLLBACK==='1'||rollout.policy?.providers?.[job.model.gateway]===false)throw new Error('Media rollout paused before submission');
    const r=job.routing;
    const policy={...r.workspacePolicy,jevMode:r.requestedMode};
    // No configured JEV ceiling means no paid classification, including shadow.
    if(!Number.isFinite(policy.jevMaxCostUsd)||policy.jevMaxCostUsd<=0)policy.jevMode='off';
    const routing=await selectRoute({candidates:r.eligibleCandidates,fallback:r.fallbackRoute,override:r.override,requirements:r.requirements,policy});
    const model=r.eligibleCandidates.find(m=>m.route===routing.chosenRoute);
    const input={...job.input};
    if(input.reference)input.reference={...input.reference,url:await privateAssetUrl({path:input.reference.path,bucket:input.reference.bucket})};
    const updated=await store.patch(job.id,{routing,model,input});
    if(routing.attempted)await recordUsage(db,updated,'jev',{...routing.usage,model:routing.model||process.env.JEV_MODEL||'jev-latest'},routing.recommendation?'succeeded':'failed');
    return updated;
  },
  qa:async job=>{
    const reported=job.result.usage?.cost??job.result.usage?.cost_usd;
    if(Number.isFinite(reported)&&reported>job.model.maxCostUsd)return {passed:false,violations:['Provider charge exceeded configured bound; review billing before further work']};
    return visionQa({assetUrl:await privateAssetUrl(job.asset),bio:job.bio});
  },
  fail:job=>failRunAndReleaseCredits({workspaceId:job.workspace_id,runId:job.run_id,reservationKey:job.reservation_key,releaseKey:`${job.reservation_key}:refund`}),
  meter:(job,op,usage,status)=>recordUsage(db,job,op,usage,status),
});
