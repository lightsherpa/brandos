import {claimState} from '../../server/src/lib/claim-review.js';
export const certifyFrictionEnabled=()=>['1','true'].includes(String(import.meta.env?.VITE_CERTIFY_FRICTION||'').toLowerCase());
const VISUAL=['visual.logo','visual.palette','visual.type','visual.typeScale','visual.imagery','visual.references','visual.avoid'];
export const reviewGroup=claim=>claim.field_path.startsWith('visual.')?'visual':claim.field_path.startsWith('voice.')?'production':'strategy';
export function orderForDirector(claims){return [...claims].sort((a,b)=>{
 const groups=['visual','production','strategy'];const group=groups.indexOf(reviewGroup(a))-groups.indexOf(reviewGroup(b));
 if(group)return group;
 if(reviewGroup(a)==='visual'){const rank=c=>{const n=VISUAL.indexOf(c.field_path);return n<0?99:n;};return rank(a)-rank(b);}
 return Number(b.importance||0)-Number(a.importance||0)||a.field_path.localeCompare(b.field_path);
});}
export const isResolved=(claim,decisions,messages=[])=>['confirmed','fixed'].includes(claimState(claim,decisions[claim.claim_id],messages));
export function nextUnresolved(claims,decisions,messages=[],activeId){
 const start=claims.findIndex(c=>c.claim_id===activeId);
 for(let n=1;n<=claims.length;n++){const claim=claims[(Math.max(-1,start)+n)%claims.length];if(!isResolved(claim,decisions,messages))return claim.claim_id;}
 return activeId||claims[0]?.claim_id||null;
}
export function validDecisions(decisions,claims){const byId=new Map(claims.map(c=>[c.claim_id,c]));return Object.fromEntries(Object.entries(decisions||{}).filter(([id,d])=>byId.get(id)?.evidence_token===d?.evidence_token&&['confirmed','fixed','asked','flagged'].includes(d.state)));}
export function terminalReview(job,outcome=null){
 const status=outcome?.status||job.status;
 if(status==='pending_lead_review')return'submitted';
 if(status==='completed'&&outcome?.decision!=='reject'&&(outcome?.action==='approved'||outcome?.decision==='approve'||job.bio?.certified||job.decision==='approve'))return'certified';
 if(outcome?.decision==='reject'||job.decision==='reject')return'rejected';
 if(['rejected','cancelled','decertified','changes_requested','completed'].includes(status))return status==='completed'?'changes_requested':status;
 return null;
}
export const previewClaim=value=>value==null?'':Array.isArray(value)?value.map(v=>typeof v==='object'?v.family||v.hex||v.name||'':v).filter(Boolean).join(' · '):typeof value==='object'?value.name||'':String(value);

export const reviewConfirmationAvailable=({unresolved,busy=false,ready=true})=>ready&&!busy&&unresolved.length===0;
