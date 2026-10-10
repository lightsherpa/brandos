import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {CERTIFICATION_SECTIONS} from '../server/src/lib/certification-review.js';
import {computeFocus} from '../server/src/lib/bio-focus.js';
import './bio-self-certification.css';

export function BioSelfCertification({brandId,brandName,bio,blocked,onDone,renderSection}){
 const {t}=useLocale();
 const [open,setOpen]=React.useState(false);
 if(bio.self_certified)return <span className="bio-cert-receipt">{t('discovery.selfCert.attestedBold')} · BIO v{bio.version}</span>;
 return <>
  <button className="btn btn--primary btn--sm" disabled={blocked} title={blocked?t('discovery.certification.pending'):undefined} onClick={()=>setOpen(true)}>{t('discovery.certification.open')}</button>
  {open&&<CertificationDialog key={bio.id} {...{brandId,brandName,bio,renderSection,onDone}} onClose={()=>setOpen(false)}/>}
 </>;
}
function CertificationDialog({brandId,brandName,bio,onDone,onClose,renderSection}){
 const {t}=useLocale();
 const ref=React.useRef(null);
 const [step,setStep]=React.useState(0);
 const [section,setSection]=React.useState('identity');
 const [reviewed,setReviewed]=React.useState([]);
 const [statements,setStatements]=React.useState({authority:false,reflects:false,aspirationalMarked:false});
 const [busy,setBusy]=React.useState(false);
 const [error,setError]=React.useState(null);
 const [receipt,setReceipt]=React.useState(null);
 const issues=computeFocus(bio.payload||{});
 const blocking=issues.filter(i=>i.status==='missing'&&i.importance>=1);
 const allReviewed=CERTIFICATION_SECTIONS.every(s=>reviewed.includes(s));
 React.useEffect(()=>{const d=ref.current;d.showModal();return()=>d.close();},[]);
 const close=()=>{if(!busy)onClose();};
 const submit=async()=>{
  if(busy||!allReviewed||!Object.values(statements).every(v=>v===true)||blocking.length)return;
  setBusy(true);setError(null);
  try{
   const res=await apiFetch(`/api/bios/${brandId}/self-certify`,{method:'POST',body:JSON.stringify({bioId:bio.id,version:bio.version,statements,reviewedSections:reviewed,statementVersion:'2'})});
   const j=await res.json().catch(()=>({}));
   if(!res.ok){
    if(j.code==='STALE_BIO')throw new Error(t('discovery.certification.stale'));
    if(j.code==='HIGH_IMPORTANCE_GAPS')throw new Error(t('discovery.selfCert.fillBefore',{fields:(j.fields||[]).join(', ')}));
    if(j.code==='BELOW_MIN_SCORE')throw new Error(t('discovery.selfCert.belowScore',{score:j.score,minScore:j.minScore}));
    throw new Error(j.error||`HTTP ${res.status}`);
   }
   setReceipt(j);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const label=s=>t('discovery.tab.'+(s==='positioning'?'competitive':s));
 return <dialog ref={ref} className="bio-cert-dialog" aria-labelledby="bio-cert-title" onCancel={e=>{e.preventDefault();close();}}>
  <header><div><span className="bio-cert-kicker">{t('discovery.certification.kicker')}</span><h2 id="bio-cert-title">{t(receipt?'discovery.certification.success':step?'discovery.certification.confirm':'discovery.certification.review')}</h2></div><button type="button" className="bio-cert-close" disabled={busy} aria-label={t('discovery.certification.close')} onClick={close}>×</button></header>
  <div className="bio-cert-meta"><strong>{brandName}</strong><span>BIO v{bio.version}</span></div>
  {receipt?<>
   <div className="bio-cert-body"><p>{t('discovery.certification.successText')}</p><dl className="bio-cert-record"><dt>{t('discovery.certification.account')}</dt><dd>{window.CI_USER?.name||window.CI_USER?.email||t('discovery.certification.signedIn')}</dd><dt>{t('discovery.certification.recorded')}</dt><dd>{new Date(receipt.attestedAt).toLocaleString()}</dd></dl></div>
   <footer><button className="btn btn--primary" onClick={()=>{onClose();onDone?.();}}>{t('discovery.certification.done')}</button></footer>
  </>:<>
   <ol className="bio-cert-steps"><li aria-current={step===0?'step':undefined}>01 {t('discovery.certification.reviewStep')}</li><li aria-current={step===1?'step':undefined}>02 {t('discovery.certification.confirmStep')}</li></ol>
   <div className="bio-cert-body">
    <p className="bio-cert-intro">{t(step?'discovery.certification.confirmText':'discovery.certification.reviewText')}</p>
    {!step?<>
     <div className="bio-cert-review-grid"><nav aria-label={t('discovery.certification.sections')}>{CERTIFICATION_SECTIONS.map(s=><button type="button" key={s} aria-current={section===s?'page':undefined} onClick={()=>setSection(s)}><span>{label(s)}</span><span>{reviewed.includes(s)?'✓':'—'}</span></button>)}</nav>
      <section className="bio-cert-preview" aria-label={label(section)}><h3>{label(section)}</h3>{renderSection(section)}<label className="bio-cert-check"><input type="checkbox" checked={reviewed.includes(section)} onChange={e=>setReviewed(prev=>e.target.checked?[...prev,section]:prev.filter(s=>s!==section))}/><span>{t('discovery.certification.reviewed',{section:label(section)})}</span></label></section></div>
     {issues.length>0&&<details className="bio-cert-issues"><summary>{t('discovery.certification.issues',{count:issues.length})}</summary><p>{t('discovery.certification.issuesText')}</p><ul>{issues.map(i=><li key={i.field}>{i.label} · {i.status==='missing'?t('discovery.certification.missing'):t('discovery.certification.verify')}</li>)}</ul></details>}
     {blocking.length>0&&<p role="alert" className="bio-cert-error">{t('discovery.selfCert.fillBefore',{fields:blocking.map(i=>i.label).join(', ')})}</p>}
    </>:<>
     <div className="bio-cert-record"><span>{t('discovery.certification.account')}</span><strong>{window.CI_USER?.name||window.CI_USER?.email||t('discovery.certification.signedIn')}</strong><span>{t('discovery.certification.reviewCount',{count:reviewed.length,total:CERTIFICATION_SECTIONS.length})}</span></div>
     <fieldset className="bio-cert-declarations"><legend>{t('discovery.certification.declarations')}</legend>{[['authority','authority'],['reflects','reflects'],['aspirationalMarked','aspirational']].map(([key,msg])=><label className="bio-cert-check" key={key}><input type="checkbox" disabled={busy} checked={statements[key]} onChange={e=>setStatements(prev=>({...prev,[key]:e.target.checked}))}/><span>{t('discovery.statement.'+msg)}</span></label>)}</fieldset>
     <p className="bio-cert-consequence">{t('discovery.certification.consequence')}</p>
    </>}
    {error&&<p role="alert" className="bio-cert-error">{error}</p>}
   </div>
   <footer><button className="btn btn--ghost" disabled={busy} onClick={()=>step?setStep(0):close()}>{t(step?'discovery.tour.back':'discovery.common.cancel')}</button>{!step?<button className="btn btn--primary" disabled={!allReviewed||blocking.length>0} onClick={()=>setStep(1)}>{t('discovery.certification.continue',{count:reviewed.length,total:CERTIFICATION_SECTIONS.length})}</button>:<button className="btn btn--primary" disabled={busy||!Object.values(statements).every(v=>v===true)} onClick={submit}>{t(busy?'discovery.selfCert.submitting':'discovery.certification.submit')}</button>}</footer>
  </>}
 </dialog>;
}
