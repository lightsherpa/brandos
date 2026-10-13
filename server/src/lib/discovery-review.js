import {supabaseAdmin} from './supabase.js';
import {loadLogoRights} from './foundation-assets.js';
import {assignSteward} from './assign-steward.js';
import {selfCertScoreReport} from './self-cert-floor.js';
import {scoreBioBreakdown} from './score-bio.js';

export function discoveryReviewReport(payload, logoRights) {
 const report=selfCertScoreReport(payload,undefined,{logoRights});
 const reasons=[];
 if(report.logoStatus==='needs_rights')reasons.push({code:'LOGO_RIGHTS_UNCONFIRMED',message:'confirm logo rights'});
 else if(!report.logo)reasons.push({code:'LOGO_REQUIRED',message:'add an approved logo'});
 if(!report.primary)reasons.push({code:'PRIMARY_COLOUR_REQUIRED',message:'choose a primary colour'});
 if(!report.display)reasons.push({code:'DISPLAY_FONT_REQUIRED',message:'add a licensed display font'});
 // A rights cap at 79 is not an evidence gap when the uncapped score already passes.
 if(scoreBioBreakdown(payload,{logoRights}).rawScore<report.minScore)reasons.push({code:'BELOW_MIN_SCORE',message:`raise confidence to ${report.minScore}`});
 return {score:report.score,minScore:report.minScore,meetsFloor:report.meetsFloor,reasons};
}

// The RPC atomically records the gate and creates at most one automatic job
// for this BIO version, even across concurrent triggers and completed reviews.
export async function reconcileDiscoveryReview({brandId,bioId,payload,kind='onboarding',logoRights,db=supabaseAdmin,assign=assignSteward}) {
 const rights=logoRights ?? await loadLogoRights(brandId,payload);
 const report=discoveryReviewReport(payload,rights);
 const {data,error}=await db.rpc('reconcile_bio_review',{p_bio_id:bioId,p_report:report,p_kind:kind});
 if(error||!data)throw new Error(`Could not reconcile Brand Core review: ${error?.message||'no gate record'}`);
 if(data.created && data.job_id){
  try{await assign(data.job_id);}catch{ /* durable queued job is available for operations */ }
 }
 return data;
}

export async function reconcileLatestDiscoveryReview(brandId, options={}) {
 const db=options.db||supabaseAdmin;
 const {data:bio,error}=await db.from('bios').select('id,payload').eq('brand_id',brandId).order('version',{ascending:false}).limit(1).maybeSingle();
 if(error)throw new Error('Could not load Brand Core for review');
 if(!bio)return null;
 return reconcileDiscoveryReview({...options,brandId,bioId:bio.id,payload:bio.payload});
}
