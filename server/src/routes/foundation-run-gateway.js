// Read-only gate around the pipeline-owned legacy run router.
import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.js';
import {supabaseAdmin} from '../lib/supabase.js';
import {hasPermission} from '../lib/permissions.js';
import {loadBioForImage} from '../lib/load-brand-bio.js';
import {isImageRoute} from '../lib/models/fal-image.js';
import {foundationError} from '../lib/brand-foundation.js';
import {validateFoundationAssets} from '../lib/foundation-assets.js';
import runs from './runs.js';

export async function imageFoundationPreflight(c,next) {
  let body;try{body=await c.req.json();}catch{return next();}
  if(!body?.specialistId || !body.briefText)return next();
  const auth=c.get('auth');
  let workspaceId=auth.workspaceId || auth.memberships?.[0]?.workspace_id || null;
  let brandId=body.brandId || null;
  if(body.briefId){
    const {data,error}=await supabaseAdmin.from('briefs').select('brand_id,brand:brands(workspace_id)').eq('id',body.briefId).maybeSingle();
    if(error || !data?.brand || (brandId&&brandId!==data.brand_id))return next();
    brandId=data.brand_id;workspaceId=data.brand.workspace_id;
  }
  if(brandId){
    const {data,error}=await supabaseAdmin.from('brands').select('id,workspace_id').eq('id',brandId).maybeSingle();
    if(error || !data)return next();workspaceId=data.workspace_id;
  }
  if(!workspaceId || !hasPermission(auth,'brief.run',workspaceId))return next();
  const {data:spec,error}=await supabaseAdmin.from('specs').select('payload').eq('specialist_id',body.specialistId).eq('active',true).maybeSingle();
  if(error || !spec || !isImageRoute(body.modelOverride || spec.payload?.modelRouting?.primary || ''))return next();
  try{
    const active=await loadBioForImage({workspaceId,brandId});
    const pinned=foundationError(active.bio);if(pinned)return c.json(pinned,409);
    const invalid=await validateFoundationAssets(active.brand.id,active.bio.visual,active.bio.visual);
    if(invalid)return c.json({code:'FOUNDATION_INCOMPLETE',state:'foundation_incomplete',error:invalid,credits:0},409);
  }catch(error){
    if(error.code==='FOUNDATION_INCOMPLETE')return c.json({code:error.code,state:'foundation_incomplete',error:error.message,missing:error.missing || [],credits:0},409);
    // The original router owns its existing certification/scope error contract.
    if(['BIO_NOT_CERTIFIED','NO_BIO'].includes(error.code))return next();
    return c.json({code:error.code || 'BIO_UNAVAILABLE',error:error.message,credits:0},error.status || 409);
  }
  return next();
}
const app=new Hono();
app.post('/stream',requireAuth,imageFoundationPreflight);
app.route('/',runs);
export default app;
