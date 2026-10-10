import {supabaseAdmin} from '../supabase.js';
import {CATALOG_VERSION,configuredCatalog,eligibleModels,qualityFirst} from '../models/catalog.js';
import {providerAvailable} from './providers.js';
import {estimateRunCredits} from '../credits.js';
export async function creativeConfig(workspaceId,db=supabaseAdmin) {
  const [{data:p,error:pe},{data:q,error:qe}]=await Promise.all([
    db.from('creative_workspace_policy').select('*').eq('workspace_id',workspaceId).maybeSingle(),
    db.from('creative_model_qualifications').select('*'),
  ]);
  if(pe||qe)return {enabled:false,policy:{},catalog:configuredCatalog()};
  return {enabled:p?.enabled===true&&process.env.CREATIVE_ROLLBACK!=='1',policy:p?.policy||{},catalog:configuredCatalog(Object.fromEntries((q||[]).map(r=>[r.route,r.qualification])))};
}
export async function prepareMediaPlan({workspaceId,spec,briefText,modality='image',settings={},reference=null,override=null},db=supabaseAdmin,available=providerAvailable) {
  const cfg=await creativeConfig(workspaceId,db);
  if(!cfg.enabled)throw new Error('Creative media is disabled for this workspace.');
  if(!['image','video'].includes(modality))throw new Error('Unsupported media modality.');
  const features=reference?[modality==='video'?'image_to_video':'image_edit']:[];
  const {data:budget,error}=await db.from('api_budgets').select('*').eq('scope_type','workspace').eq('scope_key',workspaceId).eq('active',true).maybeSingle();
  if(error||!Number.isFinite(Number(budget?.per_request_ceiling_usd))||Number(budget.per_request_ceiling_usd)<=0||Number(budget.monthly_budget_usd)<=0)throw new Error('Configure workspace spend ceilings before media generation.');
  const candidates=eligibleModels({modality,features,settings,policy:cfg.policy,budgetUsd:Number(budget.per_request_ceiling_usd),catalog:cfg.catalog,available}).filter(m=>Number.isFinite(m.maxCostUsd)&&m.maxCostUsd>0);
  if(override&&!candidates.some(m=>m.route===override))throw new Error('This quality tier is unavailable under the workspace media policy.');
  const fallback=override||qualityFirst(candidates,cfg.policy.defaults?.[modality]||spec.payload?.modelRouting?.primary)?.route;
  const model=candidates.find(m=>m.route===fallback);
  if(!model)throw new Error('No qualified media route fits the required capabilities and budget.');
  const qaCeiling=modality==='image'?cfg.policy.qaMaxCostUsd:0;
  if(modality==='image'&&(!Number.isFinite(qaCeiling)||qaCeiling<=0))throw new Error('Configure an image QA spend ceiling.');
  const jevCeiling=Number.isFinite(cfg.policy.jevMaxCostUsd)&&cfg.policy.jevMaxCostUsd>0?cfg.policy.jevMaxCostUsd:0;
  const maxCost=Math.max(...(override?[model]:candidates).map(m=>m.maxCostUsd))+qaCeiling+jevCeiling;
  if(maxCost>Number(budget.per_request_ceiling_usd))throw new Error('Generation, routing and QA exceed the per-request spend ceiling.');
  // JEV may choose a different candidate. Approval covers the highest eligible credit class.
  const credits=Math.max(1,Math.ceil(estimateRunCredits({specPayload:spec.payload})*Math.max(...(override?[model]:candidates).map(m=>m.credits))));
  const routing={policy:'quality-first-v1',mode:'off',chosenRoute:fallback,requestedMode:jevCeiling?(cfg.policy.jevMode||'shadow'):'off',fallbackRoute:fallback,override:override||null,requirements:{brief:briefText,modality,features,settings},eligibleCandidates:override?[model]:candidates,workspacePolicy:cfg.policy};
  return {model,routing,credits,maxCost,catalogVersion:CATALOG_VERSION,settings};
}
