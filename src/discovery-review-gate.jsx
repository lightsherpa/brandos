import React from 'react';
import {useLocale} from './lib/i18n.js';
export function ReviewGateNotice({gate}) {
 const {t}=useLocale();
 if(gate?.status!=='gated')return null;
 const reasons=(gate.reasons||[]).map(reason=>t(`discovery.reviewGate.${reason.code}`,{minScore:gate.min_score}));
 return <div className="card" role="status" style={{padding:16,marginBottom:18,borderLeft:'3px solid var(--status-warning)'}}>
  <strong>{t('discovery.reviewGate.waiting',{reasons:reasons.join(' · ')})}</strong>
  <p style={{margin:'6px 0 0'}}>{t('discovery.reviewGate.score',{score:gate.score,minScore:gate.min_score})}</p>
 </div>;
}
