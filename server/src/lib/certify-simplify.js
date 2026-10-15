import {evaluateCertification,DEFAULT_RUBRIC} from './evaluate-certification.js';
export const certifySimplifyEnabled=()=>['1','true'].includes(String(process.env.CERTIFY_SIMPLIFY||'').toLowerCase());
// Explicit human approval replaces ratings. Only measured checks are recorded;
// no invented C3–C7 scores, composite or decision band enter the audit trail.
export function evaluateSimpleCertification({autoSignals={},rubricConfig=DEFAULT_RUBRIC}={}){
 const measured=evaluateCertification({autoSignals,rubricConfig});
 return {incomplete:false,composite:null,band:null,needsCalibration:false,breakdown:measured.breakdown.filter(c=>c.source==='auto'),gateFailures:measured.gateFailures,recommendedDecision:'approve'};
}
