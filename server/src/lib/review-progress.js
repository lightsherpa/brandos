// Draft review state only. Certification continues through the existing human gates.
import {createHash} from 'node:crypto';
export const certifyFrictionEnabled=()=>['1','true'].includes(String(process.env.CERTIFY_SIMPLIFY||process.env.CERTIFY_FRICTION||'').toLowerCase());
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const invalid=(message,code='PROGRESS_INVALID',status=400)=>Object.assign(new Error(message),{code,status});
export const reviewClosed=(job,steward)=>!(['queued','in_review','changes_requested'].includes(job.status)||(job.status==='pending_lead_review'&&steward?.roles?.includes('lead_steward')&&job.assigned_to!==steward.id));
const terminalMode=job=>job.status==='pending_lead_review'?'submitted':job.status==='rejected'?'rejected':job.status==='changes_requested'?'changes_requested':'done';
const stable=value=>Array.isArray(value)?value.map(stable):object(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export function normalizeProgressWrite(body,ledger){
 if(!object(body)||body.bio_version!==ledger.bio_version)throw invalid('Review the current Brand Core version.','STALE_PROGRESS_VERSION',409);
 if(!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0)throw invalid('A valid progress revision is required.');
 if(typeof body.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))throw invalid('A request identifier is required.');
 const claims=new Map(ledger.claims.map(c=>[c.claim_id,c]));
 if(!object(body.decisions)||Object.keys(body.decisions).length>ledger.claims.length)throw invalid('Review decisions must match this Brand Core.');
 const decisions={};
 for(const [id,d]of Object.entries(body.decisions)){
  if(!claims.has(id)||!object(d)||!['confirmed','fixed','asked','flagged','to_confirm'].includes(d.state)||typeof d.evidence_token!=='string'||d.evidence_token.length>128)throw invalid('Unknown or invalid claim decision.');
  if(d.state==='fixed'&&!Object.hasOwn(d,'value'))throw invalid('A corrected claim value is required.');
  decisions[id]={state:d.state,evidence_token:d.evidence_token,...(d.state==='fixed'?{value:d.value}:{})};
 }
 if(body.active_id!=null&&!claims.has(body.active_id))throw invalid('The active claim is not part of this review.');
 const scores=body.scores??{};
 if(!object(scores)||Object.keys(scores).some(id=>!/^C[1-7]$/.test(id)))throw invalid('Invalid rubric scores.');
 for(const score of Object.values(scores))if(!object(score)||(score.score!=null&&(!Number.isFinite(score.score)||score.score<0||score.score>4))||(score.confidence!=null&&(!Number.isFinite(score.confidence)||score.confidence<0||score.confidence>2)))throw invalid('Invalid rubric score.');
 if(typeof(body.notes??'')!=='string'||(body.notes||'').length>20000)throw invalid('Review notes are too long.');
 if(!['review','fix','ask','confirm','confirmation'].includes(body.mode||'review'))throw invalid('Invalid review mode.');
 if(typeof(body.question??'')!=='string'||(body.question||'').length>4000)throw invalid('Review question is too long.');
 const state={question:body.question||'',decisions,active_id:body.active_id??null,scores,notes:body.notes||'',mode:body.mode||'review'};
 if(Buffer.byteLength(JSON.stringify(state))>128*1024)throw invalid('Review progress is too large.');
 return {state,requestHash:createHash('sha256').update(JSON.stringify(stable({bio_version:body.bio_version,expected_revision:body.expected_revision,...state}))).digest('hex')};
}
export function projectReviewProgress(row,ledger,job,steward){
 const state=row?.state||{};const decisions={};const invalidated=[];
 const claims=new Map(ledger.claims.map(c=>[c.claim_id,c]));
 for(const [id,d]of Object.entries(state.decisions||{})){
  if(claims.get(id)?.evidence_token===d.evidence_token)decisions[id]=d;else invalidated.push(id);
 }
 return {progress:{bio_version:ledger.bio_version,revision:row?.revision||0,decisions,active_id:claims.has(state.active_id)?state.active_id:null,scores:state.scores||{},notes:state.notes||'',question:state.question||'',mode:reviewClosed(job,steward)?terminalMode(job):(state.mode||'review'),updated_at:row?.updated_at||null},invalidated_claim_ids:invalidated,job_status:job.status,closed:reviewClosed(job,steward)};
}
