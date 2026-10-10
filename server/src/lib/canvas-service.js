import {prepareTextSpend} from './text-spend.js';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from './supabase.js';
import { hasPermission } from './permissions.js';
import { loadBioForRun } from './load-brand-bio.js';
import {prepareMediaPlan} from './creative/plan.js';
import { quoteSpecialist } from './canvas-tiers.js';
import { validateDocument, isUuid } from '../../../src/canvas/document.js';
export function canvasError(message, status = 400, code = 'CANVAS_INVALID') { return Object.assign(new Error(message), {status, code}); }
export function fingerprint(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export const enabledFor = workspace => workspace?.canvas_v2_enabled === true || (process.env.NODE_ENV !== 'production' && process.env.CANVAS_V2_DEV === 'true');
export async function getBrand(auth, brandId, permission = 'brief.read', db = supabaseAdmin) {
  if (!isUuid(brandId)) throw canvasError('Choose a brand.');
  const {data, error} = await db.from('brands').select('id,name,workspace_id').eq('id',brandId).maybeSingle();
  if (error) throw canvasError('Canvas storage is unavailable.',503,'CANVAS_STORAGE_UNAVAILABLE');
  if (!data || !hasPermission(auth,permission,data.workspace_id)) throw canvasError('Brand not found or access denied.',403,'FORBIDDEN');
  const {data:workspace,error:flagError} = await db.from('workspaces').select('canvas_v2_enabled').eq('id',data.workspace_id).maybeSingle();
  if (flagError && !['42703','PGRST204'].includes(flagError.code)) throw canvasError('Workspace settings are unavailable.',503);
  return {...data,workspace};
}
export async function getCanvas(auth, id, permission = 'brief.read', db = supabaseAdmin) {
  if (!isUuid(id)) throw canvasError('Invalid canvas.');
  const {data, error} = await db.from('canvas_layouts').select('*').eq('id',id).maybeSingle();
  if (error) throw canvasError('Canvas storage is unavailable. Apply the canvas migration first.',503,'CANVAS_STORAGE_UNAVAILABLE');
  if (!data || !hasPermission(auth,permission,data.workspace_id)) throw canvasError('Canvas not found or access denied.',403,'FORBIDDEN');
  const brand = await getBrand(auth,data.brand_id,permission,db);
  if (brand.workspace_id !== data.workspace_id || !enabledFor(brand.workspace)) throw canvasError('Canvas v2 is not enabled for this workspace.',403,'CANVAS_DISABLED');
  return data;
}
export async function validateReferences(canvas, document, db = supabaseAdmin) {
  validateDocument(document);
  const specIds = [...new Set(document.nodes.filter(n => n.type === 'specialist').map(n => n.specialistId))];
  if (specIds.length) {
    const {data: specs, error} = await db.from('specs').select('specialist_id,payload').eq('active',true).in('specialist_id',specIds);
    if (error) throw canvasError('Specialists are unavailable.',503);
    for (const node of document.nodes.filter(n => n.type === 'specialist')) {
      const spec = specs?.find(s => s.specialist_id === node.specialistId);
      if (!spec || quoteSpecialist(spec,node.settings).kind !== (node.outputType==='video'?'image':node.outputType)) throw canvasError('Choose an active specialist with a matching output type.');
    }
  }
  const ids = [...new Set(document.nodes.flatMap(n => [n.pickedRunId, ...(n.legacyRunIds || [])]).filter(Boolean))];
  if (ids.some(id => !isUuid(id))) throw canvasError('Invalid historical run.');
  if (!ids.length) return;
  const {data: runs, error} = await db.from('runs').select('id,brief_id,specialist_id,canvas_id,canvas_node_id,outputs(id)').in('id',ids);
  if (error) throw canvasError('Versions are unavailable.',503);
  for (const n of document.nodes) {
    for (const id of [n.pickedRunId,...(n.legacyRunIds || [])].filter(Boolean)) {
      const r = runs?.find(r => r.id === id);
      if (!r || r.brief_id !== canvas.brief_id || r.specialist_id !== n.specialistId || (r.canvas_node_id && (r.canvas_id !== canvas.id || r.canvas_node_id !== n.id))) throw canvasError('A selected version does not belong to this node.',403);
      if (id === n.pickedRunId && !r.outputs?.some(o => o.id === n.pickedOutputId)) throw canvasError('The selected output is no longer available.',409,'OUTPUT_MISSING');
    }
  }
  const legacyIds = document.nodes.flatMap(n => n.legacyRunIds || []);
  if (new Set(legacyIds).size !== legacyIds.length) throw canvasError('Historical runs cannot belong to two nodes.');
}
export async function prepareNode(canvas, nodeId, db = supabaseAdmin, bioLoader = loadBioForRun,mediaPlanner=prepareMediaPlan) {
  const node = canvas.document.nodes.find(n => n.id === nodeId && n.type === 'specialist');
  if (!node) throw canvasError('Choose a specialist node.');
  const {data: spec, error} = await db.from('specs').select('id,specialist_id,version,payload').eq('specialist_id',node.specialistId).eq('active',true).maybeSingle();
  if (error || !spec) throw canvasError('This specialist is not available.');
  let quote = quoteSpecialist(spec,node.settings);
  const bio = await bioLoader({workspaceId: canvas.workspace_id,brandId: canvas.brand_id});
  const {data: brief} = await db.from('briefs').select('id,title,brand_id,payload').eq('id',canvas.brief_id).maybeSingle();
  if (!brief || brief.brand_id !== canvas.brand_id) throw canvasError('Brief does not belong to this canvas.',403);
  const sources = canvas.document.edges.filter(e => e.to === node.id).map(e => canvas.document.nodes.find(n => n.id === e.from)).filter(n => n?.type === 'specialist');
  const priorOutputs = [];let reference=null;
  for (const source of sources) {
    if (!source.pickedOutputId || source.stale) throw canvasError(`Run and select a current output from ${source.title} first.`,409,'INPUT_NOT_READY');
    const {data: out} = await db.from('outputs').select('id,run_id,brief_id,body,kind,status,workflow_status,run:runs(id,specialist_id,status)').eq('id',source.pickedOutputId).maybeSingle();
    if (!out || out.brief_id !== canvas.brief_id || out.run_id !== source.pickedRunId || out.run?.status !== 'completed') throw canvasError('An input is missing or unfinished.',409,'INPUT_NOT_READY');
    if(source.outputType==='image'){if(!['image','video'].includes(node.outputType)||reference||!['internally_approved','client_approved'].includes(out.workflow_status)||out.body?.kind!=='image'||!out.body.asset?.path)throw canvasError('Select one approved, stored image as the media reference.',409,'IMAGE_REFERENCE_NOT_APPROVED');reference={outputId:out.id,path:out.body.asset.path,bucket:out.body.asset.bucket};continue;}
    priorOutputs.push({id: out.id, run_id: out.run_id, specialist_id: out.run.specialist_id, body: out.body, kind: out.kind, status: out.status});
  }
  const briefText = brief.payload?.composedBrief || brief.payload?.sharpenedBrief || brief.payload?.request || brief.title;
  let mediaPlan=null;
  if(['image','video'].includes(node.outputType)){try{mediaPlan=await mediaPlanner({workspaceId:canvas.workspace_id,spec,briefText,modality:node.outputType,settings:node.settings.mediaSettings||{},reference,override:node.settings.mediaRoute||(node.settings.tier==='auto'?null:quote.route)},db);}catch(e){throw canvasError(e.message,409,'MEDIA_UNAVAILABLE');}quote={...quote,credits:mediaPlan.credits,route:mediaPlan.model.route,kind:node.outputType};}
  const snapshot = {canvasRevision:canvas.revision,execution:mediaPlan?'media':'text',textSpend:mediaPlan?null:await prepareTextSpend({workspaceId:canvas.workspace_id,spec,settings:node.settings,route:quote.route},db),reference,mediaPlan,nodeId, specialistId: node.specialistId, specVersion: spec.version, bioVersion: bio.bio.version, bioCertifiedBy: bio.bio.certified_by, settings: node.settings, briefText, priorOutputs};
  return {node, spec, bio, quote, snapshot, fingerprint: fingerprint(snapshot), brief};
}
export async function claimCanvasQuote(auth, body, db = supabaseAdmin, bioLoader = loadBioForRun) {
  const canvas = await getCanvas(auth,body.canvasId,'brief.run',db);
  const prepared = await prepareNode(canvas,body.nodeId,db,bioLoader);
  if (!isUuid(body.quoteId)) throw canvasError('Approve a current credit quote first.',409,'QUOTE_REQUIRED');
  const {data: quote} = await db.from('canvas_quotes').select('*').eq('id',body.quoteId).eq('canvas_id',canvas.id).eq('node_id',body.nodeId).eq('created_by',auth.userId).maybeSingle();
  if (!quote) throw canvasError('Quote not found.',409,'QUOTE_REQUIRED');
  validateQuote(quote,prepared);
  const {data: claimed,error} = await db.from('canvas_quotes').update({state:'claimed'}).eq('id',quote.id).eq('state','pending').select('id').maybeSingle();
  if (error || !claimed) throw canvasError('This request was already submitted.',409,'RUN_ALREADY_SUBMITTED');
  return {...prepared,canvas,requestId:quote.id};
}

function validateQuote(quote,prepared){
  if(quote.state!=='pending')throw canvasError('This request was already submitted. Check its run before trying again.',409,'RUN_ALREADY_SUBMITTED');
  if(Date.parse(quote.expires_at)<=Date.now()||quote.fingerprint!==prepared.fingerprint||quote.credits!==prepared.quote.credits||quote.request.route!==prepared.quote.route)throw canvasError('The inputs or quote changed. Review a new quote.',409,'QUOTE_CHANGED');
}
export async function inspectCanvasQuote(auth,body,db=supabaseAdmin){
  const canvas=await getCanvas(auth,body.canvasId,'brief.run',db),prepared=await prepareNode(canvas,body.nodeId,db);
  if(!isUuid(body.quoteId))throw canvasError('Approve a current credit quote first.',409,'QUOTE_REQUIRED');
  const {data:quote}=await db.from('canvas_quotes').select('*').eq('id',body.quoteId).eq('canvas_id',canvas.id).eq('node_id',body.nodeId).eq('created_by',auth.userId).maybeSingle();
  if(!quote)throw canvasError('Quote not found.',409,'QUOTE_REQUIRED');validateQuote(quote,prepared);
  return {...prepared,canvas,requestId:quote.id};
}
