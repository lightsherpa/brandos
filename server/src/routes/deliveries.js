import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.js';
import {requireHumanActor} from '../middleware/human-actor.js';
import {supabaseAdmin} from '../lib/supabase.js';
import {hasPermission} from '../lib/permissions.js';
import {sanitizeOutput} from '../lib/output-quality.js';
import {groupDeliverables,canInspectDelivery,deliveryDocument} from '../../../shared/grouped-deliverables.js';
import {deliveryZip} from '../lib/delivery-zip.js';
import outputRoutes from './outputs.js';
const available = piece => piece.complete && ['review','delivered'].includes(piece.status);
// The existing workflow reviews an output row as a whole. Never let approval of
// one slot silently approve sibling deliverables stored in that same row.
const sharedReviewOutput=(group,groups)=>groups.some(other=>other.id!==group.id&&other.outputIds.some(id=>group.outputIds.includes(id)));
function approvalFor(actor,outputs,workspaceId) {
 if(!outputs.length)return null;
 const transitions=[
  {action:'client_approve',from:'client_review',done:'client_approved',permission:'output.client_approve'},
  ...(canInspectDelivery(actor)?[{action:'internal_approve',from:'submitted_internal',done:'internally_approved',permission:'output.internal_approve'}]:[]),
 ];
 return transitions.find(t=>hasPermission(actor,t.permission,workspaceId)
  &&outputs.some(o=>o.workflow_status===t.from)
  &&outputs.every(o=>[t.from,t.done].includes(o.workflow_status))
  &&(t.action!=='internal_approve'||outputs.filter(o=>o.workflow_status===t.from).every(o=>o.submitted_by!==actor.userId)))||null;
}
export function createDeliveryRoutes({db=supabaseAdmin,auth=requireAuth,human=requireHumanActor,approveOutput=(id,action,header)=>outputRoutes.request(`/${id}/workflow`,{method:'POST',headers:{Authorization:header,'Content-Type':'application/json'},body:JSON.stringify({action})}),fetchAsset=fetch}={}){
 const app=new Hono();app.use('*',auth);app.use('*',async(c,next)=>{c.header('Cache-Control','private, no-store');return next();});
 async function load(c,briefId=c.req.param('briefId')){
  const actor=c.get('auth'),id=briefId;
  const {data:brief,error}=await db.from('briefs').select('id,title,payload,brand_id,brand:brands(workspace_id)').eq('id',id).maybeSingle();
  if(error)throw Object.assign(Error('Delivery is temporarily unavailable'),{status:503});
  if(!brief)throw Object.assign(Error('Brief not found'),{status:404});
  if(!hasPermission(actor,'brief.read',brief.brand?.workspace_id))throw Object.assign(Error('Forbidden'),{status:403});
  const {data:runs,error:re}=await db.from('runs').select('id,specialist_id,status,created_at,started_at,ended_at,outputs(*)').eq('brief_id',id);
  if(re)throw Object.assign(Error('Delivery is temporarily unavailable'),{status:503});
  const ids=(runs||[]).map(r=>r.id);
  const {data:ledger,error:le}=ids.length?await db.from('ledger').select('run_id,credits').in('run_id',ids):{data:[]};
  if(le)throw Object.assign(Error('Delivery credits are temporarily unavailable'),{status:503});
  const safeRuns=(runs||[]).map(r=>({...r,credits:(ledger||[]).filter(l=>l.run_id===r.id).reduce((s,l)=>s+Number(l.credits||0),0),outputs:(r.outputs||[]).map(sanitizeOutput)}));
  const plan=brief.payload?.deliveryPlan;
  const groups=groupDeliverables({runs:safeRuns,plan,finished:!safeRuns.some(r=>['queued','running'].includes(r.status)),internal:true});
  return {actor,brief,runs:safeRuns,groups};
 }
 const wrap=handler=>async c=>{try{return await handler(c);}catch(e){return c.json({error:e.status?e.message:'Delivery is temporarily unavailable'},e.status||503);}};
 app.get('/',wrap(async c=>{
  const brandId=c.req.query('brandId');if(!brandId)return c.json({error:'Choose a brand'},400);
  const {data:brand}=await db.from('brands').select('id,workspace_id').eq('id',brandId).maybeSingle();
  if(!brand||!hasPermission(c.get('auth'),'brief.read',brand.workspace_id))return c.json({error:'Forbidden'},403);
  const {data:briefs,error}=await db.from('briefs').select('id,title,created_at').eq('brand_id',brandId).order('created_at',{ascending:false}).limit(50);
  if(error)return c.json({error:'Deliveries are temporarily unavailable'},503);
  return c.json({briefs:briefs||[]});
 }));
 app.get('/:briefId',wrap(async c=>{
  const {actor,brief,groups,runs}=await load(c),inspect=canInspectDelivery(actor);
  const deliverables=groups.map(g=>{
   const outputs=runs.flatMap(r=>r.outputs||[]).filter(o=>g.outputIds.includes(o.id));
   const approvalAction=approvalFor(actor,outputs,brief.brand.workspace_id);
   const {outputIds,production,...piece}=g;
   return {...piece,canDownload:available(g),canApprove:available(g)&&!!approvalAction&&!sharedReviewOutput(g,groups),...(inspect?{production}: {})};
  });
  return c.json({brief:{id:brief.id,title:brief.title,brandId:brief.brand_id},deliverables,canInspect:inspect,sharePath:`#/canvas/${brief.id}`});
 }));
 app.post('/:briefId/:deliveryId/approve',human,wrap(async c=>{
  const {actor,brief,groups,runs}=await load(c),group=groups.find(g=>g.id===c.req.param('deliveryId'));
  if(!group)return c.json({error:'Deliverable not found'},404);
  if(!available(group))return c.json({error:'This deliverable is not ready for approval'},409);
  if(sharedReviewOutput(group,groups))return c.json({error:'These deliverables share a review record. Review them together in the review desk.'},409);
  const outputs=runs.flatMap(r=>r.outputs||[]).filter(o=>group.outputIds.includes(o.id));
  const transition=approvalFor(actor,outputs,brief.brand.workspace_id);
  if(!transition)return c.json({error:'Approval is not available at this review stage'},403);
  for(const output of outputs.filter(o=>o.workflow_status===transition.from)){const response=await approveOutput(output.id,transition.action,c.req.header('Authorization'));if(!response.ok)return c.json({error:'Approval did not finish. Reload to see the current review state.'},response.status);}
  return c.json({approved:true});
 }));
 app.get('/:briefId/download',wrap(async c=>{
  const {brief,groups}=await load(c),selected=c.req.query('delivery'),pieces=groups.filter(g=>!selected||g.id===selected);
  if(!pieces.length)return c.json({error:'Deliverable not found'},404);
  // No partial delivery masquerading as a completed handoff.
  if(pieces.some(g=>!available(g)))return c.json({error:'Finish and review the deliverables before downloading'},409);
  let total=0;const files=[];
  for(const piece of pieces){
   let assetUrl=piece.assetUrl;
   if(assetUrl&&!piece.html&&!assetUrl.startsWith('data:')){
    const url=new URL(assetUrl),base=new URL(process.env.SUPABASE_URL||'http://localhost:54321');
    if(url.origin!==base.origin||!url.pathname.startsWith('/storage/v1/object/'))throw Object.assign(Error('The saved asset is unavailable for offline export'),{status:409});
    const response=await fetchAsset(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
    const mime=response.headers.get('Content-Type')?.split(';')[0];
    if(!response.ok||!['image/png','image/jpeg','image/webp'].includes(mime))throw Object.assign(Error('The saved asset could not be downloaded'),{status:503});
    if(Number(response.headers.get('Content-Length'))>20*1024*1024)throw Object.assign(Error('The saved asset is too large'),{status:413});
    const bytes=Buffer.from(await response.arrayBuffer());total+=bytes.length;if(total>48*1024*1024)throw Object.assign(Error('The download is too large'),{status:413});assetUrl=`data:${mime};base64,${bytes.toString('base64')}`;
   }
   const html=deliveryDocument({...piece,assetUrl},{title:brief.title,lang:['en','es','ar'].includes(c.req.query('locale'))?c.req.query('locale'):'en'});
   total+=Buffer.byteLength(html);if(total>64*1024*1024)throw Object.assign(Error('The download is too large'),{status:413});
   files.push({name:`${piece.id}.html`,data:html});
  }
  return c.body(new Uint8Array(deliveryZip(files)),200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="brandolph-delivery.zip"'});
 }));
 return app;
}
