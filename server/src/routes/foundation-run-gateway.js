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

// Fail closed: a lookup *error* (DB down, timeout) must never fall through to
// the run router, because the run would then skip the foundation check.
// Not-found / mismatch still defers to runs.js, which owns those 4xx contracts.
const lookupUnavailable=(c,what,error)=>{
  console.error(`[foundation-gateway] ${what} lookup failed: ${error?.message || error}`);
  return c.json({code:'FOUNDATION_CHECK_UNAVAILABLE',error:`Could not verify the Brand Core foundation (${what} lookup failed). Nothing was charged.`,credits:0},503);
};

export async function imageFoundationPreflight(c,next) {
  let body;try{body=await c.req.json();}catch{return next();}
  if(!body?.specialistId || !body.briefText)return next();
  const auth=c.get('auth');
  let workspaceId=auth.workspaceId || auth.memberships?.[0]?.workspace_id || null;
  let brandId=body.brandId || null;
  if(body.briefId){
    const {data,error}=await supabaseAdmin.from('briefs').select('brand_id,brand:brands(workspace_id)').eq('id',body.briefId).maybeSingle();
    if(error)return lookupUnavailable(c,'brief',error);
    if(!data?.brand || (brandId&&brandId!==data.brand_id))return next();
    brandId=data.brand_id;workspaceId=data.brand.workspace_id;
  }
  if(brandId){
    const {data,error}=await supabaseAdmin.from('brands').select('id,workspace_id').eq('id',brandId).maybeSingle();
    if(error)return lookupUnavailable(c,'brand',error);
    if(!data)return next();workspaceId=data.workspace_id;
  }
  if(!workspaceId || !hasPermission(auth,'brief.run',workspaceId))return next();
  const {data:spec,error}=await supabaseAdmin.from('specs').select('payload').eq('specialist_id',body.specialistId).eq('active',true).maybeSingle();
  if(error)return lookupUnavailable(c,'spec',error);
  if(!spec || !isImageRoute(body.modelOverride || spec.payload?.modelRouting?.primary || ''))return next();
  try{
    const active=await loadBioForImage({workspaceId,brandId});
    const pinned=foundationError(active.bio,{logoRights:active.bio?.logoRights});if(pinned)return c.json(pinned,409);
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
