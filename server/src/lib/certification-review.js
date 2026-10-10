export const CERTIFICATION_SECTIONS=Object.freeze(['identity','audience','positioning','voice','visual','goals','strategic']);
export function validateCertificationReview({body={},bio}){
 if(body.bioId!==bio.id||body.version!==bio.version)return {ok:false,code:'STALE_BIO',error:'The BIO changed. Review the current version before confirming.'};
 if(body.statementVersion!=='2')return {ok:false,code:'REVIEW_REQUIRED',error:'Use the current review and confirmation flow.'};
 if(!CERTIFICATION_SECTIONS.every(s=>Array.isArray(body.reviewedSections)&&body.reviewedSections.includes(s)))return {ok:false,code:'REVIEW_REQUIRED',error:'Review every BIO section before confirming.'};
 if(!['authority','reflects','aspirationalMarked'].every(k=>body.statements?.[k]===true))return {ok:false,code:'STATEMENTS_REQUIRED',error:'Confirm all three declarations.'};
 return {ok:true,review:{reviewedSections:[...CERTIFICATION_SECTIONS],statements:{authority:true,reflects:true,aspirationalMarked:true}}};
}
