import {Hono} from 'hono';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {requireAuth} from '../middleware/auth.js';
import {requireHumanActor} from '../middleware/human-actor.js';
import {supabaseAdmin} from '../lib/supabase.js';
import {hasPermission} from '../lib/permissions.js';
import {validateUpload,contentTypeForExt,IMAGE_UPLOAD_EXTS} from '../lib/ingest-guards.js';
export function createBriefReferenceRoutes({db=supabaseAdmin,auth=requireAuth,human=requireHumanActor}={}) {
 const app=new Hono();app.post('/references',auth,human,async c=>{
  if(Number(c.req.header('Content-Length'))>5*1024*1024+65536)return c.json({error:'Photo exceeds 5 MB'},413);
  const form=await c.req.formData().catch(()=>null),brandId=form?.get('brandId'),file=form?.get('file');
  const actor=c.get('auth');
  const {data:brand,error:be}=await db.from('brands').select('id,workspace_id').eq('id',brandId).maybeSingle();
  if(be)return c.json({error:'Brand unavailable'},503);
  if(!brand||!hasPermission(actor,'brief.write',brand.workspace_id))return c.json({error:'Forbidden'},403);
  if(!file||typeof file.arrayBuffer!=='function')return c.json({error:'Choose a photo'},400);
  const guard=validateUpload({filename:file.name,mime:file.type,size:file.size,kind:'reference'});
  if(!guard.ok||!IMAGE_UPLOAD_EXTS.has(guard.ext))return c.json({error:guard.message||'Choose PNG, JPEG or WebP'},400);
  const bytes=Buffer.from(await file.arrayBuffer());
  try{const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();if(!['png','jpeg','webp'].includes(metadata.format))throw Error();}catch{return c.json({error:'Invalid photo'},400);}
  const id=crypto.randomUUID(),path=`${brand.workspace_id}/${brand.id}/${id}.${guard.ext}`;
  const {error:uploadError}=await db.storage.from('brief-references').upload(path,bytes,{contentType:contentTypeForExt(guard.ext),upsert:false});
  if(uploadError)return c.json({error:'Reference upload failed'},503);
  const {data:row,error}=await db.from('brief_references').insert({id,brand_id:brand.id,owner_id:actor.userId,storage_path:path,name:file.name.slice(0,160)}).select('id,name').single();
  if(error){await db.storage.from('brief-references').remove([path]);return c.json({error:'Reference could not be saved'},503);}
  return c.json({reference:row,scope:'brief'},201);
 });
 app.get('/:briefId/references',auth,async c=>{
  const {data:brief,error:be}=await db.from('briefs').select('id,brand_id,brand:brands(workspace_id)').eq('id',c.req.param('briefId')).maybeSingle();
  if(be)return c.json({error:'Brief unavailable'},503);
  if(!brief||!hasPermission(c.get('auth'),'brief.read',brief.brand?.workspace_id))return c.json({error:'Forbidden'},403);
  const {data:rows,error}=await db.from('brief_references').select('id,name,storage_path').eq('brief_id',brief.id).eq('brand_id',brief.brand_id);
  if(error)return c.json({error:'References unavailable'},503);
  const references=[];for(const row of rows||[]){const {data:signed,error:se}=await db.storage.from('brief-references').createSignedUrl(row.storage_path,3600);if(se)return c.json({error:'Reference preview unavailable'},503);references.push({id:row.id,name:row.name,url:signed?.signedUrl});}
  c.header('Cache-Control','private, no-store');return c.json({references,scope:'brief'});
 });return app;
}
