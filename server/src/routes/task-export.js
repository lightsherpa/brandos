import { quarantinedItem } from '../lib/output-quality.js';
// Exact saved output download: no model calls, asset renewal, or DB mutations.
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { hasPermission } from '../lib/permissions.js';
import { exportSocialPng } from '../harness/stable-export.js';
async function loadSavedOutput(id) {
 const {data,error}=await supabaseAdmin.from('outputs').select('id,body,brief:briefs(brand:brands(workspace_id))').eq('id',id).maybeSingle();
 return error?null:data;
}
async function renderSavedPng(html,options) {
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
 return exportSocialPng(html,{...options,chromium});
}
let activeExports=0;
export function createTaskExportRouter({authMiddleware=requireAuth,loadOutput=loadSavedOutput,authorize=(auth,workspaceId)=>hasPermission(auth,'brief.run',workspaceId),renderPng=renderSavedPng}={}) {
 const app=new Hono();
 app.get('/:outputId/items/:index/png',authMiddleware,async c=>{
  const output=await loadOutput(c.req.param('outputId'));
  if(!output)return c.json({error:'Output not found'},404);
  const workspaceId=output.brief?.brand?.workspace_id;
  if(!workspaceId||!authorize(c.get('auth'),workspaceId))return c.json({error:'Forbidden'},403);
  let saved;try{saved=typeof output.body==='string'?JSON.parse(output.body):output.body;}catch{return c.json({error:'Saved output is unavailable'},409);}
  const index=Number(c.req.param('index'));
  if(!/^\d+$/.test(c.req.param('index'))||!Number.isSafeInteger(index))return c.json({error:'Invalid item index'},400);
  const item=Array.isArray(saved?.items)?saved.items.find(it=>it.index===index):saved?.item?.index===index?saved.item:null;
  if(!item)return c.json({error:'Item not found'},404);
  if(quarantinedItem(item))return c.json({error:'This artifact has not passed quality review',code:'QUALITY_REVIEW_REQUIRED'},409);
  if(item.export?.stable!==true||typeof item.html!=='string'||Buffer.byteLength(item.html)>40*1024*1024)return c.json({error:'Stable HTML export unavailable',code:'EXPORT_UNAVAILABLE'},409);
  const width=Number(item.html.match(/data-width="(\d+)"/)?.[1]);
  const height=Number(item.html.match(/data-height="(\d+)"/)?.[1]);
  if(![width,height].every(n=>Number.isInteger(n)&&n>0&&n<=4096))return c.json({error:'PNG is only available for social composites'},409);
  if(activeExports>=2)return c.json({error:'Export capacity busy'},429);
  activeExports++;
  try {const bytes=await renderPng(item.html,{width,height});return new Response(bytes,{headers:{'Content-Type':'image/png','Content-Disposition':`attachment; filename="brandos-item-${index+1}.png"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  catch{return c.json({error:'PNG export unavailable',code:'EXPORT_RUNTIME_UNAVAILABLE'},503);}
  finally{activeExports--;}
 });
 return app;
}
export default createTaskExportRouter();
