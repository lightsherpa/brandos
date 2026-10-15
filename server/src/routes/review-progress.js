import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.js';
import {requireHumanActor} from '../middleware/human-actor.js';
import {supabaseAdmin} from '../lib/supabase.js';
import {buildClaimLedger} from '../lib/claim-ledger.js';
import {certifyFrictionEnabled,normalizeProgressWrite,projectReviewProgress,reviewClosed} from '../lib/review-progress.js';
export function createReviewProgressRoutes(requireSteward,{db=supabaseAdmin,auth=requireAuth,human=requireHumanActor,enabled=certifyFrictionEnabled}={}){
 const app=new Hono();
 app.use('/jobs/:id/progress',async(c,next)=>enabled()?next():c.json({error:'Not found'},404));
 app.use('/jobs/:id/progress',auth,requireSteward);
 const load=async c=>{
  const {data:job,error}=await db.from('steward_jobs').select('id,bio_id,brand_id,status,assigned_to,bio:bios(id,version,payload),brand:brands(url)').eq('id',c.req.param('id')).maybeSingle();
  if(error)throw Object.assign(Error('Could not load review.'),{status:503});
  if(!job?.bio)throw Object.assign(Error('Review not found.'),{status:404});
  const steward=c.get('steward');if(job.assigned_to&&job.assigned_to!==steward.id&&!(steward.roles||[]).includes('lead_steward'))throw Object.assign(Error('Job assigned to another Creative Director'),{status:403});
  const [{data:sources,error:sourceError},{data:messages,error:messageError}]=await Promise.all([
   db.from('bio_sources').select('id,kind,src,signals').eq('brand_id',job.brand_id),
   ['1','true'].includes(String(process.env.CERTIFIER_V2_S3||'').toLowerCase())?db.from('cert_messages').select('id,bio_version,claim_ids,author_role,reply_to,body,source_id,sent_at').eq('brand_id',job.brand_id).eq('job_id',job.id):Promise.resolve({data:[]}),
  ]);
  if(sourceError||messageError)throw Object.assign(Error('Could not load current review evidence.'),{status:503});
  const ledger=buildClaimLedger({brandId:job.brand_id,bioVersion:job.bio.version,payload:job.bio.payload,sources:sources||[],messages:messages||[],brandUrl:job.brand?.url});
  return {job,ledger,steward,userId:c.get('auth').userId};
 };
 const respondError=(c,error)=>c.json({error:error.message||'Review progress unavailable.',...(error.code?{code:error.code}:{})},error.status||503);
 app.get('/jobs/:id/progress',async c=>{try{
  const {job,ledger,userId,steward}=await load(c);
  const {data,error}=await db.from('certify_review_progress').select('revision,state,updated_at').eq('job_id',job.id).eq('actor_user_id',userId).eq('bio_version',ledger.bio_version).maybeSingle();
  if(error)throw Object.assign(Error('Could not restore saved review progress.'),{status:503});
  return c.json(projectReviewProgress(data,ledger,job,steward));
 }catch(error){return respondError(c,error);}});
 app.put('/jobs/:id/progress',human,async c=>{try{
  const {job,ledger,userId,steward}=await load(c);if(reviewClosed(job,steward))return c.json({error:'This review is closed.',code:'JOB_CLOSED'},409);
  let body;try{body=await c.req.json();}catch{return c.json({error:'Invalid review progress.'},400);}
  const {state,requestHash}=normalizeProgressWrite(body,ledger);
  const projection=projectReviewProgress({state},ledger,job,steward);
  const {data,error}=await db.rpc('save_certify_review_progress',{p_job_id:job.id,p_actor_user_id:userId,p_bio_version:ledger.bio_version,p_expected_revision:body.expected_revision,p_request_id:body.request_id,p_request_hash:requestHash,p_state:{...state,decisions:projection.progress.decisions}});
  if(error)throw Object.assign(Error('Could not save review progress.'),{status:503});
  if(!data?.ok)return c.json({error:data?.error||'Could not save review progress.',code:data?.code||'PROGRESS_UNAVAILABLE'},data?.status||503);
  const out=projectReviewProgress(data.progress,ledger,job,steward);out.invalidated_claim_ids=[...new Set([...projection.invalidated_claim_ids,...out.invalidated_claim_ids])];
  return c.json(out);
 }catch(error){return respondError(c,error);}});
 return app;
}
