import {groupDeliverables} from '../../../shared/grouped-deliverables.js';
import {sanitizeOutput} from '../lib/output-quality.js';
import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.js';
import {supabaseAdmin} from '../lib/supabase.js';
import {hasPermission} from '../lib/permissions.js';
export function createBrandExampleRoutes({db=supabaseAdmin,auth=requireAuth}={}) {
 const app=new Hono();app.get('/:brandId/examples',auth,async c=>{
  const {data:brand,error:be}=await db.from('brands').select('id,workspace_id').eq('id',c.req.param('brandId')).maybeSingle();
  if(be)return c.json({error:'Brand unavailable'},503);
  if(!brand||!hasPermission(c.get('auth'),'bio.read',brand.workspace_id))return c.json({error:'Forbidden'},403);
  const {data,error}=await db.from('brand_output_examples').select('id,brief_id,deliverable_key,output_ids,snapshot,addition_status,created_at,candidate:bios!candidate_bio_id(certified)').eq('brand_id',brand.id).order('created_at',{ascending:false});
  if(error)return c.json({error:'Examples unavailable'},503);
  c.header('Cache-Control','private, no-store');const examples=[];
  let certifiedIds=new Set();
  if(data?.length){const {data:certified,error:ce}=await db.from('bios').select('payload').eq('brand_id',brand.id).eq('certified',true).order('version',{ascending:false}).limit(1).maybeSingle();if(ce)return c.json({error:'Example review state unavailable'},503);certifiedIds=new Set(Array.isArray(certified?.payload?.approved_output_examples)?certified.payload.approved_output_examples:[]);}

  for(const row of data||[]){const {data:runs,error:re}=await db.from('runs').select('id,specialist_id,status,outputs(*)').eq('brief_id',row.brief_id);
   if(re)return c.json({error:'Example output unavailable'},503);
   const selectedRuns=(runs||[]).map(run=>({...run,outputs:(run.outputs||[]).filter(output=>row.output_ids.includes(output.id)).map(sanitizeOutput)}));
   const piece=groupDeliverables({runs:selectedRuns,finished:true}).find(piece=>piece.id===row.deliverable_key);
   if(!piece)return c.json({error:'Example output unavailable'},503);
   const snapshot={type:piece.type,index:piece.index,text:piece.text,subject:piece.subject,html:piece.html,assetRef:row.snapshot.assetRef};if(snapshot.assetRef){const {data:signed,error:se}=await db.storage.from(snapshot.assetRef.bucket).createSignedUrl(snapshot.assetRef.path,3600);if(se)return c.json({error:'Example preview unavailable'},503);snapshot.assetUrl=signed?.signedUrl||null;}delete snapshot.assetRef;const {candidate,output_ids,...item}=row;examples.push({...item,snapshot,addition_status:candidate?.certified||certifiedIds.has(row.id)?'approved':row.addition_status});}
  return c.json({examples});
 });return app;
}
