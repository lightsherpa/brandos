import {prepareTextSpend} from '../lib/text-spend.js';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { hasPermission } from '../lib/permissions.js';
import { assertCreditsAvailable } from '../lib/credits.js';
import { getBrand, getCanvas, enabledFor, canvasError, validateReferences, prepareNode } from '../lib/canvas-service.js';
import { seedDocument, isUuid, uuid, edgeFor, validateDocument } from '../../../src/canvas/document.js';
import {privateAssetUrl} from '../lib/creative/store.js';
import {creativeConfig,prepareMediaPlan} from '../lib/creative/plan.js';
import {publicCatalog} from '../lib/models/catalog.js';
import {providerAvailable} from '../lib/creative/providers.js';
import { loadBioForRun, loadBrandBio } from '../lib/load-brand-bio.js';
import { quoteSpecialist } from '../lib/canvas-tiers.js';
import { streamCompletion, BRANDOLPH_SYNTHETIC_SPEC } from '../lib/models/router.js';
const publicRunFields = 'id,brief_id,specialist_id,spec_version,bio_version,status,latency_ms,started_at,ended_at,canvas_node_id,outputs(id,kind,body,asset_url,status,workflow_status,submitted_by,rationale,created_at,qa_results(id,passed,evidence))';
const sanitizeRun = r => {
  const snapshot = r.canvas_snapshot;
  const {canvas_snapshot,...rest} = r;
  // Output JSON may include provider metadata; expose only user-facing fields.
  return {...rest, tier:snapshot?.settings?.tier || null, credits:snapshot?.credits || null, inputIds:snapshot?.priorOutputs?.map(o => o.id) || [], certifiedBy:snapshot?.bioCertifiedBy || null,
    outputs:(r.outputs || []).map(o => ({...o,body:{kind:o.body?.kind,subject:o.body?.subject,preheader:o.body?.preheader,plainText:o.body?.plainText,text:o.body?.text,edited_text:o.body?.edited_text,asset_url:o.body?.asset_url,deliverables:o.body?.deliverables?.map(d=>({title:d.title,body:d.body,platform:d.platform,asset_url:d.asset_url,status:d.status,qa:d.qa?{passed:d.qa.passed,voice_match:d.qa.voice_match,violations:d.qa.violations}:undefined})),workflow_notes:o.body?.workflow_notes,qa:o.body?.qa?{passed:o.body.qa.passed,violations:o.body.qa.violations}:undefined}}))};
};
export function createCanvasesApp({db = supabaseAdmin, authMiddleware = requireAuth, quoteCheck = assertCreditsAvailable, bioLoader = loadBioForRun,mediaPlanner=prepareMediaPlan} = {}) {
  const app = new Hono();
  app.use('*',authMiddleware);
  app.onError((err,c) => c.json({error:err.status ? err.message : err.code==='BIO_NOT_CERTIFIED'?'Certify the BIO before running work.':err.code==='NO_BIO'?'Create this brand’s BIO first.':'Canvas request failed. Please try again.',code:err.code || 'CANVAS_ERROR'},err.status || (err.code === 'BIO_NOT_CERTIFIED' || err.code === 'NO_BIO' ? 409 : 400)));
  app.get('/access',async c => {
    const brand = await getBrand(c.get('auth'),c.req.query('brandId'),'brief.read',db);
    return c.json({enabled:enabledFor(brand.workspace)});
  });
  app.post('/',async c => {
    const auth = c.get('auth'), body = await c.req.json();
    let brief, brand;
    if (body.briefId) {
      if (!isUuid(body.briefId)) throw canvasError('Invalid brief.');
      const {data} = await db.from('briefs').select('id,title,brand_id,payload').eq('id',body.briefId).maybeSingle();
      if (!data) throw canvasError('Brief not found.',404);
      brief = data; brand = await getBrand(auth,brief.brand_id,'brief.read',db);
    } else {
      brand = await getBrand(auth,body.brandId,'brief.write',db);
    }
    if (!enabledFor(brand.workspace)) throw canvasError('Canvas v2 is not enabled.',403,'CANVAS_DISABLED');
    let existing = db.from('canvas_layouts').select('*');
    if (brief) existing = existing.eq('brief_id',brief.id);
    else {
      if (!isUuid(body.creationKey)) throw canvasError('A creation key is required.');
      existing = existing.eq('creation_key',body.creationKey);
    }
    const {data: prior,error:lookupError} = await existing.maybeSingle();
    if (lookupError) throw canvasError('Apply the canvas migration before enabling this workspace.',503,'CANVAS_STORAGE_UNAVAILABLE');
    if (prior) { await getCanvas(auth,prior.id,'brief.read',db); return c.json({canvas:prior,brief:brief || (await db.from('briefs').select('*').eq('id',prior.brief_id).single()).data}); }
    if (!hasPermission(auth,'brief.write',brand.workspace_id)) throw canvasError('Canvas creation requires brief editing access.',403);
    const {data: specs,error:specError} = await db.from('specs').select('specialist_id,payload').eq('active',true);
    if (specError) throw canvasError('Specialists are unavailable.',503);
    const specialists = (specs || []).flatMap(s => {
      try { return [{id:s.specialist_id,name:s.payload?.name || s.specialist_id,outputType:quoteSpecialist(s).kind}]; } catch {return [];}
    });
    let runs = [];
    if (brief) runs = (await db.from('runs').select(publicRunFields+',canvas_id').eq('brief_id',brief.id).order('started_at',{ascending:true})).data || [];
    const wanted = body.context?.specialistIds || [...new Set(runs.map(r => r.specialist_id))];
    const chosen = specialists.filter(s => wanted.includes(s.id)).map(s => ({...s,settings:body.context?.deliverableSettings?.[s.id]}));
    // Validate the new document before inserting its brief.
    const document = seedDocument({title:brief?.title || body.context?.title,specialists:chosen,runs});
    if (!brief) {
      const ctx = body.context || {};
      const {data,error} = await db.from('briefs').insert({brand_id:brand.id,title:String(ctx.title || ctx.rawBrief || 'Brief').slice(0,160),type:'one_off',mode:'manual',status:'active',payload:{request:String(ctx.rawBrief || '').slice(0,30000),composedBrief:String(ctx.composedBrief || '').slice(0,60000),sharpenedBrief:String(ctx.sharpenedBrief || '').slice(0,30000),tension:String(ctx.tension || '').slice(0,1000),refusals:Array.isArray(ctx.refusals) ? ctx.refusals.slice(0,50) : [],deliveryPlan:ctx.deliveryPlan || null}}).select('*').single();
      if (error) throw canvasError('Could not create the brief.',503);
      brief = data;
    }
    const row = {workspace_id:brand.workspace_id,brand_id:brand.id,brief_id:brief.id,creation_key:body.briefId ? null : body.creationKey,document,created_by:auth.userId};
    await validateReferences(row,document,db);
    const {data,error} = await db.from('canvas_layouts').insert(row).select('*').single();
    if (error?.code === '23505') {
      const {data: winner} = await db.from('canvas_layouts').select('*').eq(body.briefId ? 'brief_id' : 'creation_key',body.briefId || body.creationKey).single();
      if (winner) { await getCanvas(auth,winner.id,'brief.read',db); if (!body.briefId) await db.from('briefs').delete().eq('id',brief.id); return c.json({canvas:winner,brief:(await db.from('briefs').select('*').eq('id',winner.brief_id).single()).data}); }
    }
    if (error) throw canvasError('Could not save the canvas.',503);
    return c.json({canvas:data,brief},201);
  });
  app.get('/:id',async c => {
    const canvas = await getCanvas(c.get('auth'),c.req.param('id'),'brief.read',db);
    const {data:brief} = await db.from('briefs').select('*').eq('id',canvas.brief_id).single();
    const {data:bio} = await db.from('bios').select('version,certified,certified_by,cert_kind,certified_at,cert_valid_until').eq('brand_id',canvas.brand_id).eq('certified',true).or(`cert_valid_until.is.null,cert_valid_until.gt.${new Date().toISOString()}`).order('version',{ascending:false}).limit(1).maybeSingle();
    const {data:specs} = await db.from('specs').select('specialist_id,payload').eq('active',true);
    const specialists = (specs || []).flatMap(s => {try { const q=quoteSpecialist(s); return [{id:s.specialist_id,name:s.payload?.name || s.specialist_id,outputType:q.kind}]; } catch {return [];}});
    const mediaConfig=await creativeConfig(canvas.workspace_id,db);
    const mediaProfiles=mediaConfig.enabled?publicCatalog(mediaConfig.catalog,mediaConfig.policy,providerAvailable).filter(m=>['image','video'].includes(m.modality)).map((m,i)=>({id:m.route,modality:m.modality,settings:m.settings||{},label:`${m.modality==='video'?'Video':'Image'} profile ${i+1}`})):[];
    return c.json({canvas,brief,bio,specialists,mediaProfiles,emailHtml:mediaConfig.policy.emailHtml===true&&process.env.CREATIVE_ROLLBACK!=='1',permissions:[...c.get('auth').permissions],userId:c.get('auth').userId});
  });
  app.put('/:id',async c => {
    const canvas = await getCanvas(c.get('auth'),c.req.param('id'),'brief.write',db), body = await c.req.json();
    if (!Number.isInteger(body.revision) || body.revision !== canvas.revision) throw canvasError('The canvas changed in another session. Reload it or download your edits.',409,'CANVAS_CONFLICT');
    await validateReferences(canvas,body.document,db);
    const {data,error} = await db.from('canvas_layouts').update({document:body.document,revision:canvas.revision+1,updated_at:new Date().toISOString()}).eq('id',canvas.id).eq('revision',body.revision).select('*').maybeSingle();
    if (error) throw canvasError('Could not save the canvas.',503);
    if (!data) throw canvasError('The canvas changed in another session.',409,'CANVAS_CONFLICT');
    return c.json({canvas:data});
  });
  app.get('/:id/runs',async c => {
    const canvas = await getCanvas(c.get('auth'),c.req.param('id'),'output.read',db);
    const {data,error} = await db.from('runs').select(publicRunFields+',canvas_snapshot').eq('brief_id',canvas.brief_id).order('started_at',{ascending:true});
    if (error) throw canvasError('Could not load versions.',503);
    const runs=await Promise.all((data||[]).map(async r=>{const result=sanitizeRun(r);for(const o of result.outputs){const original=r.outputs.find(p=>p.id===o.id);if(original?.body?.asset?.path){try{o.body.asset_url=await privateAssetUrl(original.body.asset);}catch{o.assetUnavailable=true;}}}return result;}));
    if(runs.length){const {data:evidence,error:evidenceError}=await db.from('text_execution_evidence').select('run_id,phase').eq('workspace_id',canvas.workspace_id).in('run_id',runs.map(r=>r.id));if(evidenceError)return c.json({error:'Run state unavailable'},503);for(const run of runs){const text=evidence?.find(e=>e.run_id===run.id);if(text)run.textState=text.phase;}}
    if(runs.length){const {data:jobs}=await db.from('creative_jobs').select('id,run_id,state,progress').eq('workspace_id',canvas.workspace_id).in('run_id',runs.map(r=>r.id));for(const run of runs){const job=jobs?.find(j=>j.run_id===run.id);if(job)Object.assign(run,{jobId:job.id,mediaState:job.state,progress:job.progress});}}
    return c.json({runs});
  });
  app.get('/:id/estimates',async c => {
    const canvas = await getCanvas(c.get('auth'),c.req.param('id'),'brief.read',db);
    const node=canvas.document.nodes.find(n=>n.id===c.req.query('nodeId')&&n.type==='specialist');
    if(!node)throw canvasError('Choose a specialist node.');
    const {data:spec}=await db.from('specs').select('payload').eq('specialist_id',node.specialistId).eq('active',true).maybeSingle();
    if(!spec)throw canvasError('Specialist is unavailable.');
    const estimates={},unavailable={};
    for(const tier of ['auto','premium','balanced','fast']){try{if(['image','video'].includes(node.outputType)){const document={...canvas.document,nodes:canvas.document.nodes.map(n=>n.id===node.id?{...n,settings:{...n.settings,tier}}:n)};estimates[tier]=(await prepareNode({...canvas,document},node.id,db,bioLoader,mediaPlanner)).quote.credits;}else {await prepareTextSpend({workspaceId:canvas.workspace_id,spec,settings:{...node.settings,tier},route:quoteSpecialist(spec,{...node.settings,tier}).route},db);estimates[tier]=quoteSpecialist(spec,{...node.settings,tier}).credits;}}catch(e){estimates[tier]=null;unavailable[tier]=e.message;}}
    return c.json({estimates,unavailable});
  });
  app.post('/:id/quotes',async c => {
    const auth = c.get('auth'),canvas = await getCanvas(auth,c.req.param('id'),'brief.run',db), body = await c.req.json();
    const ids = [...new Set(body.nodeIds || [])];
    if (!ids.length || ids.length > 30) throw canvasError('Choose between 1 and 30 nodes.');
    const prepared = [];
    for (const id of ids) prepared.push(await prepareNode(canvas,id,db,bioLoader,mediaPlanner));
    const total = prepared.reduce((sum,p) => sum+p.quote.credits,0);
    for (const p of prepared) { const check = await quoteCheck(canvas.workspace_id,p.quote.credits); if (!check.ok) throw canvasError(check.message,409,check.code); }
    const check = await quoteCheck(canvas.workspace_id,total,{runCap:0});
    if (!check.ok) throw canvasError(check.message,409,check.code);
    const expiresAt = new Date(Date.now()+5*60000).toISOString();
    const {data,error} = await db.from('canvas_quotes').insert(prepared.map(p => ({canvas_id:canvas.id,node_id:p.node.id,created_by:auth.userId,fingerprint:p.fingerprint,credits:p.quote.credits,expires_at:expiresAt,request:{route:p.quote.route,snapshot:p.snapshot}}))).select('id,node_id,credits,expires_at');
    if (error) throw canvasError('Could not prepare the credit quote.',503);
    return c.json({quotes:data.map(q=>({id:q.id,node_id:q.node_id,credits:q.credits,expires_at:q.expires_at,execution:prepared.find(p=>p.node.id===q.node_id)?.snapshot.execution})),total,balance:check.balance,expiresAt});
  });
  app.post('/:id/proposals',async c => {
    const auth=c.get('auth'),canvas=await getCanvas(auth,c.req.param('id'),'brief.write',db),body=await c.req.json();
    if (typeof body.prompt !== 'string' || body.prompt.trim().length < 3 || body.prompt.length>4000) throw canvasError('Describe the work in 3–4000 characters.');
    const {data:specs}=await db.from('specs').select('specialist_id,payload').eq('active',true);
    const catalog=(specs || []).flatMap(s=>{try{return [{id:s.specialist_id,name:s.payload?.name,outputType:quoteSpecialist(s).kind}];}catch{return [];}});
    const brandBio=await loadBrandBio({workspaceId:canvas.workspace_id,brandId:canvas.brand_id});
    const {data:brief}=await db.from('briefs').select('payload,title').eq('id',canvas.brief_id).maybeSingle();
    let raw='';
    for await (const ev of streamCompletion({spec:BRANDOLPH_SYNTHETIC_SPEC,system:'Suggest a small creative crew for the request. Return only JSON: {"summary":"plain sentence","specialistIds":["catalog IDs"]}. At most 8 distinct IDs from the supplied catalog. Do not claim to have run or produced anything. Adding nodes does not authorize generation.',messages:[{role:'user',content:JSON.stringify({request:body.prompt,bio:brandBio.bio,refusals:brandBio.refusals,brief,catalog,existing:canvas.document.nodes.map(n=>({title:n.title,specialistId:n.specialistId}))})}],maxTokens:1600})) {if(ev.type==='token')raw+=ev.text; if(ev.type==='error')throw canvasError('Brandolph could not prepare a proposal.',503);}
    let result; try {result=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw canvasError('Brandolph returned an invalid proposal. Please try again.',502);}
    if (!Array.isArray(result.specialistIds) || !result.specialistIds.length || result.specialistIds.length>8 || new Set(result.specialistIds).size!==result.specialistIds.length || typeof result.summary!=='string') throw canvasError('Invalid proposal.',502);
    const document=structuredClone(canvas.document),briefNode=document.nodes.find(n=>n.type==='brief');
    const y=Math.max(...document.nodes.map(n=>n.y))+312;
    const nodeIds=[];
    for (const [i,id] of result.specialistIds.entries()) {
      const spec=catalog.find(s=>s.id===id); if(!spec)throw canvasError('The proposal included an unavailable specialist.',502);
      const node={id:uuid(),type:'specialist',specialistId:id,title:spec.name || id,outputType:spec.outputType,x:740,y:y+i*312,settings:{tier:'auto'}};
      document.nodes.push(node);document.edges.push(edgeFor(document,briefNode.id,node.id));nodeIds.push(node.id);
    }
    validateDocument(document);
    const {data,error}=await db.from('canvas_proposals').insert({canvas_id:canvas.id,base_revision:canvas.revision,document,summary:result.summary.slice(0,1000),created_by:auth.userId}).select('id,summary,base_revision').single();
    if(error)throw canvasError('Could not save the proposal.',503);
    return c.json({proposal:{...data,nodeIds,titles:document.nodes.filter(n=>nodeIds.includes(n.id)).map(n=>n.title)}});
  });
  app.post('/:id/proposals/:proposalId/apply',async c=>{
    const auth=c.get('auth'),canvas=await getCanvas(auth,c.req.param('id'),'brief.write',db);
    if(!isUuid(c.req.param('proposalId')))throw canvasError('Invalid proposal.');
    const {data:proposal}=await db.from('canvas_proposals').select('*').eq('id',c.req.param('proposalId')).eq('canvas_id',canvas.id).eq('created_by',auth.userId).maybeSingle();
    if(!proposal)throw canvasError('Proposal not found.',404);
    await validateReferences(canvas,proposal.document,db);
    const {data,error}=await db.rpc('apply_canvas_proposal',{p_canvas:canvas.id,p_proposal:proposal.id,p_user:auth.userId});
    if(error)throw canvasError('The canvas changed. Request a new proposal.',409,'CANVAS_CONFLICT');
    return c.json({canvas:data[0]});
  });
  return app;
}
export default createCanvasesApp();
