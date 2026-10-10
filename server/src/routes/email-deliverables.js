import { Hono } from 'hono';
import { requireAuth,requirePermission } from '../middleware/auth.js';
import { supabaseAdmin as db } from '../lib/supabase.js';
import { renderEmail,durablePublicUrl } from '../lib/creative/email-html.js';
import { privateAssetUrl } from '../lib/creative/store.js';
const app=new Hono();
app.use('*',requireAuth,requirePermission('output.read'));
// Explicit attestation of an already published asset, never an automatic upload.
app.post('/assets/:id/publication',requirePermission('output.client_approve'),async c=>{
  const auth=c.get('auth');let body;try{body=await c.req.json();}catch{return c.json({error:'Invalid JSON'},400);}
  if(body.confirmPublishable!==true||!durablePublicUrl(body.url))return c.json({error:'Confirm a durable, public HTTPS asset URL'},400);
  const {data:o}=await db.from('outputs').select('body,workflow_status,brief:briefs(brand:brands(workspace_id))').eq('id',c.req.param('id')).maybeSingle();
  if(o?.brief?.brand?.workspace_id!==auth.workspaceId||o.body?.kind!=='image'||!['internally_approved','client_approved'].includes(o.workflow_status))return c.json({error:'Reviewed workspace image required'},403);
  const {data:p}=await db.from('creative_workspace_policy').select('policy').eq('workspace_id',auth.workspaceId).maybeSingle();
  if(!p?.policy?.publishableAssetOrigins?.includes(new URL(body.url).origin))return c.json({error:'Asset origin is not approved for public email exports'},400);
  const {error}=await db.from('creative_asset_publications').upsert({output_id:c.req.param('id'),workspace_id:auth.workspaceId,public_url:body.url,approved_by:auth.userId,approved_at:new Date().toISOString(),revoked_at:null});
  if(error)return c.json({error:'Publication record failed'},500);return c.json({publishable:true});
});
app.get('/:id/:format',async c=>{
  const format=c.req.param('format');if(!['preview','html','text','manifest'].includes(format))return c.json({error:'Unknown format'},400);
  const workspaceId=c.get('auth').workspaceId;
  const {data:o}=await db.from('outputs').select('body,brief:briefs(brand:brands(workspace_id,name))').eq('id',c.req.param('id')).maybeSingle();
  if(o?.brief?.brand?.workspace_id!==workspaceId||o.body?.kind!=='email_html')return c.json({error:'Not found'},404);
  const ids=o.body.content.blocks.filter(b=>b.type==='image').map(b=>b.assetId);
  const assets=[];
  for(const id of new Set(ids)){
    const {data:a}=await db.from('outputs').select('id,body,brief:briefs(brand:brands(workspace_id))').eq('id',id).maybeSingle();
    if(a?.brief?.brand?.workspace_id!==workspaceId)continue;
    const {data:pub}=await db.from('creative_asset_publications').select('public_url').eq('output_id',id).eq('workspace_id',workspaceId).is('revoked_at',null).maybeSingle();
    assets.push({id,url:pub?.public_url||(format==='preview'&&a.body?.asset?await privateAssetUrl(a.body.asset):null),publishable:!!pub});
  }
  try{
    const email=renderEmail(o.body.content,{assets,requiredContent:o.body.requiredContent||[o.brief.brand.name],forExport:format!=='preview'});
    if(format==='preview')return c.json(email);
    c.header('Content-Disposition',`attachment; filename="email.${format==='manifest'?'assets.json':format==='text'?'txt':'html'}"`);
    if(format==='manifest')return c.json(email.assets);
    c.header('Content-Type',format==='html'?'text/html; charset=utf-8':'text/plain; charset=utf-8');
    return c.body(format==='html'?email.html:email.plainText);
  }catch(e){return c.json({error:e.message},422);}
});
export default app;
