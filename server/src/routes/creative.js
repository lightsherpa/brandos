import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { supabaseAdmin as db } from '../lib/supabase.js';
import { loadBioForRun } from '../lib/load-brand-bio.js';
import { CATALOG_VERSION, configuredCatalog, eligibleModels, qualityFirst, publicCatalog } from '../lib/models/catalog.js';
import { selectRoute } from '../lib/models/jev.js';
import { providerAvailable } from '../lib/creative/providers.js';
import { composeImagePrompt } from '../lib/compose-image-prompt.js';
import { assertCreditsAvailable, creditErrorResponse, estimateRunCredits } from '../lib/credits.js';
import { privateAssetUrl } from '../lib/creative/store.js';
import { recordUsage } from '../lib/creative/usage.js';
import { inngest } from '../lib/inngest.js';
import {creativeConfig,prepareMediaPlan} from '../lib/creative/plan.js';
import {getCanvas,prepareNode,inspectCanvasQuote} from '../lib/canvas-service.js';
const app = new Hono();
app.use('*',requireAuth);
export {creativeConfig} from '../lib/creative/plan.js';
app.get('/catalog',async c=>{
  const cfg=await creativeConfig(c.get('auth').workspaceId);
  let choices=publicCatalog(cfg.catalog,cfg.policy,providerAvailable);
  if(cfg.enabled){
    const {data:budget}=await db.from('api_budgets').select('per_request_ceiling_usd').eq('scope_type','workspace').eq('scope_key',c.get('auth').workspaceId).eq('active',true).maybeSingle();
    choices=choices.filter(choice=>choice.modality==='text'||eligibleModels({modality:choice.modality,settings:choice.settings||{},policy:cfg.policy,budgetUsd:Number(budget?.per_request_ceiling_usd||0),catalog:cfg.catalog.filter(m=>m.route===choice.route),available:providerAvailable}).some(m=>Number.isFinite(m.maxCostUsd)));
  }
  return c.json({version:CATALOG_VERSION,enabled:cfg.enabled,emailHtml:cfg.policy.emailHtml===true && process.env.CREATIVE_ROLLBACK!=='1',models:choices});
});
app.post('/jobs',requirePermission('brief.run'),async c=>{
  const auth=c.get('auth'); let workspaceId=auth.workspaceId;
  let body;try{body=await c.req.json();}catch{return c.json({error:'Invalid JSON'},400);}
  let canvasRequest=null;
  if(body?.canvasId){
    try{
      const canvas=await getCanvas(auth,body.canvasId,'brief.run',db);workspaceId=canvas.workspace_id;
      const {data:prior}=await db.from('creative_jobs').select('id,run_id').eq('workspace_id',workspaceId).eq('request_key',String(body.quoteId)).maybeSingle();
      if(prior)return c.json({jobId:prior.id,runId:prior.run_id},202);
      canvasRequest=await inspectCanvasQuote(auth,body,db);
      if(canvasRequest.snapshot.execution!=='media')return c.json({error:'Text nodes use the text run endpoint'},400);
      body={specialistId:canvasRequest.node.specialistId,briefText:canvasRequest.snapshot.briefText,brandId:canvas.brand_id,briefId:canvas.brief_id,requestKey:canvasRequest.requestId,modality:canvasRequest.node.outputType,settings:canvasRequest.node.settings.mediaSettings||{},referenceOutputId:canvasRequest.snapshot.reference?.outputId,modelOverride:canvasRequest.node.settings.mediaRoute||(canvasRequest.node.settings.tier==='auto'?null:canvasRequest.quote.route)};
    }catch(e){return c.json({error:e.message||'Unable to approve media',code:e.code},e.status||409);}
  }
  const {specialistId,briefText,brandId,briefId,modelOverride,requestKey,settings={},referenceOutputId,modality='image'}=body||{};
  if(!['image','video'].includes(modality)||!specialistId||typeof briefText!=='string'||!briefText.trim()||briefText.length>60000||typeof requestKey!=='string'||requestKey.length<8||requestKey.length>150)return c.json({error:'Valid brief, specialist and requestKey required'},400);
  const cfg=await creativeConfig(workspaceId);
  if(!cfg.enabled) return c.json({error:'Creative media rollout is disabled',code:'CREATIVE_DISABLED'},409);
  try {
    const brandBio=await loadBioForRun({workspaceId,brandId});
    const {data:spec,error}=await db.from('specs').select('*').eq('specialist_id',specialistId).eq('active',true).single();
    if(error||!spec) return c.json({error:'Active specialist required'},400);
    const hash=createHash('sha256').update(JSON.stringify({specialistId,briefText,brandId:brandBio.brand.id,briefId,modelOverride,settings,referenceOutputId,modality})).digest('hex');
    const {data:existing,error:existingError}=await db.from('creative_jobs').select('id,request_hash').eq('workspace_id',workspaceId).eq('request_key',requestKey).maybeSingle();
    if(existingError) throw existingError;
    if(existing) return existing.request_hash===hash ? c.json({jobId:existing.id},202) : c.json({error:'Idempotency key reused for another request'},409);
    let reference=null;
    if(referenceOutputId){
      const {data:o}=await db.from('outputs').select('id,status,workflow_status,body,brief:briefs(brand:brands(workspace_id))').eq('id',referenceOutputId).single();
      if(o?.brief?.brand?.workspace_id!==workspaceId||!['internally_approved','client_approved'].includes(o.workflow_status)||o.body?.kind!=='image'||!o.body.asset?.path) return c.json({error:'Approved workspace image required'},400);
      reference={outputId:o.id,path:o.body.asset.path,bucket:o.body.asset.bucket,url:await privateAssetUrl(o.body.asset)};
    }
    const plan=canvasRequest?.snapshot.mediaPlan || await prepareMediaPlan({workspaceId,spec,briefText,modality,settings,reference,override:modelOverride});
    const {model,routing,maxCost,credits}=plan;
    const check=await assertCreditsAvailable(workspaceId,credits);if(!check.ok)return creditErrorResponse(c,check);
    const prompt=composeImagePrompt({spec,brand:brandBio.brand,bio:brandBio.bio,refusals:brandBio.refusals,brief:briefText+(canvasRequest?.node.settings.revisionFeedback?`\nRevision note: ${canvasRequest.node.settings.revisionFeedback}`:'')+(canvasRequest?.snapshot.priorOutputs?.length?`\nSelected upstream outputs: ${JSON.stringify(canvasRequest.snapshot.priorOutputs.map(o=>({specialist_id:o.specialist_id,body:o.body})))}`:'')});
    const {data:job,error:err}=await db.rpc('create_creative_job',{
      p_workspace_id:workspaceId,p_brand_id:brandBio.brand.id,p_actor_id:auth.userId,p_brief_id:briefId||null,p_spec_id:specialistId,p_spec_version:spec.version,p_bio_version:brandBio.bio.version,p_credits:credits,
      p_request_key:requestKey,p_request_hash:hash,p_catalog_version:CATALOG_VERSION,p_model:model,p_routing:routing,p_input:{briefText,prompt,settings,reference,...(canvasRequest?{canvas:{id:canvasRequest.canvas.id,nodeId:canvasRequest.node.id,quoteId:canvasRequest.requestId,fingerprint:canvasRequest.fingerprint,snapshot:{...canvasRequest.snapshot,credits}}}:{})},p_bio:brandBio.bio,p_max_cost:maxCost,
    });
    if(err) throw err;
    
    try{await inngest.send({id:`creative:${job.id}`,name:'creative/media.requested',data:{jobId:job.id}});}catch{ /* outbox recovery will dispatch */ }
    return c.json({jobId:job.id,runId:job.run_id},202);
  }catch(e){console.error('[creative] submission failed',e.code||e.name);return c.json({error:'Media submission could not be confirmed. Reconnect using the same request.',code:'MEDIA_SUBMISSION_UNCONFIRMED'},409);}
});
app.get('/jobs/:id',requirePermission('output.read'),async c=>{
  const {data:job,error}=await db.from('creative_jobs').select('*').eq('id',c.req.param('id')).eq('workspace_id',c.get('auth').workspaceId).maybeSingle();
  if(error||!job)return c.json({error:'Not found'},404);
  let assetUrl=null;if(job.asset){try{assetUrl=await privateAssetUrl(job.asset);}catch{}}
  // Internal costs, prompts and provider task identifiers are not client data.
  return c.json({jobId:job.id,runId:job.run_id,state:job.state,progress:job.progress,error:job.error,outputId:job.output_id,
    output:job.asset?{kind:job.model.modality,asset_url:assetUrl,asset:job.asset,status:job.qa?.passed?'approved':'flagged'}:null,
    qa:job.qa?{passed:job.qa.passed,violations:job.qa.violations}:null});
});
app.get('/assets/:id',requirePermission('output.read'),async c=>{
  const {data:o}=await db.from('outputs').select('body,brief:briefs(brand:brands(workspace_id))').eq('id',c.req.param('id')).maybeSingle();
  if(o?.brief?.brand?.workspace_id!==c.get('auth').workspaceId||!o.body?.asset?.path)return c.json({error:'Not found'},404);
  try{return c.json({url:await privateAssetUrl(o.body.asset)});}catch{return c.json({error:'Stored asset temporarily unavailable'},503);}
});
app.post('/jobs/:id/resume',requirePermission('brief.run'),async c=>{
  const {data:j}=await db.from('creative_jobs').select('id,state,task').eq('id',c.req.param('id')).eq('workspace_id',c.get('auth').workspaceId).maybeSingle();
  if(!j)return c.json({error:'Not found'},404);
  if(j.state==='reconcile')return c.json({error:'Provider reconciliation is required before resuming'},409);
  await inngest.send({name:'creative/media.requested',data:{jobId:j.id}});return c.json({jobId:j.id},202);
});
export default app;
