import {foundationStatus} from "../server/src/lib/brand-foundation.js";
import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {CERTIFICATION_SECTIONS} from '../server/src/lib/certification-review.js';
import {computeFocus} from '../server/src/lib/bio-focus.js';
import {selfCertScoreReport} from '../server/src/lib/self-cert-floor.js';
import './bio-self-certification.css';

export function BioSelfCertification({brandId,brandName,bio,blocked,onDone,renderSection,initiallyOpen=false,onClose}){
 const {t}=useLocale();
 const [open,setOpen]=React.useState(initiallyOpen);
 const foundation=foundationStatus(bio.payload);
 if(!foundation.certifiable)return <span className="bio-cert-receipt" role="status">Foundation incomplete · add logo, primary colour and display font</span>;
 if(bio.self_certified&&!(bio.client_acceptance_required&&!bio.client_accepted_at))return <span className="bio-cert-receipt">{t('discovery.selfCert.attestedBold')} · Brand Core v{bio.version}</span>;
 return <>
  <button className="btn btn--primary btn--sm" disabled={blocked} title={blocked?t('discovery.certification.pending'):undefined} onClick={()=>setOpen(true)}>{t(bio.certified?'discovery.certification.acceptChanges':'discovery.certification.open')}</button>
  {open&&<CertificationDialog key={bio.id} {...{brandId,brandName,bio,renderSection,onDone}} onClose={()=>{setOpen(false);onClose?.();}}/>}
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
 const gate=selfCertScoreReport(bio.payload||{});
 const allReviewed=CERTIFICATION_SECTIONS.every(s=>reviewed.includes(s));
 const focusable=root=>[...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
 React.useEffect(()=>{
  const d=ref.current;
  const previous=document.activeElement;
  d.showModal();
  const items=focusable(d);
  (items.find(el=>!el.classList.contains('bio-cert-close'))||items[0]||d).focus();
  const onKey=e=>{
   if(e.key!=='Tab')return;
   const nodes=focusable(d);
   if(!nodes.length){e.preventDefault();return;}
   const first=nodes[0], last=nodes[nodes.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  d.addEventListener('keydown',onKey);
  return()=>{d.removeEventListener('keydown',onKey);d.close();previous?.focus?.();};
 },[]);
 React.useEffect(()=>{
  const d=ref.current;
  if(!d?.open)return;
  const nodes=focusable(d);
  (nodes.find(el=>el.getAttribute('aria-current')==='step')||nodes.find(el=>!el.classList.contains('bio-cert-close'))||d).focus();
 },[step,receipt]);
 const close=()=>{if(!busy)onClose();};
 const accepting=!!(bio.certified&&bio.client_acceptance_required&&!bio.client_accepted_at);
 const below=!accepting&&!gate.meetsFloor;
 const fieldName=field=>t(`discovery.field.${field.section}.${field.key}`);
 const submit=async()=>{
  if(busy||!allReviewed||!Object.values(statements).every(v=>v===true)||(!accepting&&(blocking.length||below)))return;
  setBusy(true);setError(null);
  try{
   const res=await apiFetch(`/api/bios/${brandId}/${accepting?"accept-changes":"self-certify"}`,{method:'POST',body:JSON.stringify({bioId:bio.id,version:bio.version,statements,reviewedSections:reviewed,statementVersion:'2'})});
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
 return <dialog ref={ref} className="bio-cert-dialog" role="dialog" aria-modal="true" aria-labelledby="bio-cert-title" tabIndex={-1} onCancel={e=>{e.preventDefault();close();}}>
  <header><div><span className="bio-cert-kicker">{t('discovery.certification.kicker')}</span><h2 id="bio-cert-title">{t(receipt?'discovery.certification.success':step?'discovery.certification.confirm':'discovery.certification.review')}</h2></div><button type="button" className="bio-cert-close" disabled={busy} aria-label={t('discovery.certification.close')} onClick={close}>×</button></header>
  <div className="bio-cert-meta"><strong>{brandName}</strong><span>Brand Core v{bio.version}</span></div>
  {receipt?<>
   <div className="bio-cert-body"><p>{t(accepting?'discovery.certification.acceptedText':'discovery.certification.successText')}</p>{receipt.reviewQueued===false&&<p role="status">{t('discovery.certification.queuePending')}</p>}<dl className="bio-cert-record"><dt>{t('discovery.certification.account')}</dt><dd>{window.CI_USER?.name||window.CI_USER?.email||t('discovery.certification.signedIn')}</dd><dt>{t('discovery.certification.recorded')}</dt><dd>{new Date(receipt.attestedAt).toLocaleString()}</dd></dl></div>
   <footer><button className="btn btn--primary" onClick={()=>{onClose();onDone?.();}}>{t('discovery.certification.done')}</button></footer>
  </>:<>
   <ol className="bio-cert-steps"><li aria-current={step===0?'step':undefined}>01 {t('discovery.certification.reviewStep')}</li><li aria-current={step===1?'step':undefined}>02 {t('discovery.certification.confirmStep')}</li></ol>
   <div className="bio-cert-body">
    <p className="bio-cert-intro">{t(step?'discovery.certification.confirmText':'discovery.certification.reviewText')}</p>
    {!accepting&&<section className="bio-cert-score" data-below={below?'true':'false'} data-score={gate.score} data-floor={gate.minScore}>
     <p><strong>{t('discovery.certification.scoreLine',{score:gate.score,minScore:gate.minScore})}</strong></p>
     {below&&<>
      <p role="alert">{t('discovery.certification.belowFloor',{score:gate.score,minScore:gate.minScore})}</p>
      {gate.sections.length>0&&<>
       <p>{t('discovery.certification.dragHeading')}</p>
       <ul>{gate.sections.map(s=><li key={s.section}><strong>{s.points>0?t('discovery.certification.sectionLift',{section:label(s.section),points:s.points}):label(s.section)}</strong>{s.answers.length>0&&<span> {t('discovery.certification.addAnswers',{fields:s.answers.map(fieldName).join(', ')})}</span>}{s.sources.length>0&&<span> {t('discovery.certification.addSources',{fields:s.sources.map(fieldName).join(', ')})}</span>}</li>)}</ul>
      </>}
     </>}
    </section>}
    {!step?<>
     <div className="bio-cert-review-grid"><nav aria-label={t('discovery.certification.sections')}>{CERTIFICATION_SECTIONS.map(s=><button type="button" key={s} aria-current={section===s?'page':undefined} onClick={()=>setSection(s)}><span>{label(s)}</span><span>{reviewed.includes(s)?'✓':'—'}</span></button>)}</nav>
      <section className="bio-cert-preview" aria-label={label(section)}><h3>{label(section)}</h3>{renderSection(section)}<label className="bio-cert-check"><input type="checkbox" checked={reviewed.includes(section)} onChange={e=>setReviewed(prev=>e.target.checked?[...prev,section]:prev.filter(s=>s!==section))}/><span>{t('discovery.certification.reviewed',{section:label(section)})}</span></label></section></div>
     {issues.length>0&&<details className="bio-cert-issues"><summary>{t('discovery.certification.issues',{count:issues.length})}</summary><p>{t('discovery.certification.issuesText')}</p><ul>{issues.map(i=><li key={i.field}>{i.label} · {i.status==='missing'?t('discovery.certification.missing'):t('discovery.certification.verify')}</li>)}</ul></details>}
     {blocking.length>0&&<p role="alert" className="bio-cert-error">{t('discovery.selfCert.fillBefore',{fields:blocking.map(i=>i.label).join(', ')})}</p>}
    </>:<>
     <div className="bio-cert-record"><span>{t('discovery.certification.account')}</span><strong>{window.CI_USER?.name||window.CI_USER?.email||t('discovery.certification.signedIn')}</strong><span>{t('discovery.certification.reviewCount',{count:reviewed.length,total:CERTIFICATION_SECTIONS.length})}</span></div>
     <fieldset className="bio-cert-declarations"><legend>{t('discovery.certification.declarations')}</legend>{[['authority','authority'],['reflects','reflects'],['aspirationalMarked','aspirational']].map(([key,msg])=><label className="bio-cert-check" key={key}><input type="checkbox" disabled={busy} checked={statements[key]} onChange={e=>setStatements(prev=>({...prev,[key]:e.target.checked}))}/><span>{t('discovery.statement.'+msg)}</span></label>)}</fieldset>
     <p className="bio-cert-consequence">{t(accepting?'discovery.certification.acceptConsequence':'discovery.certification.consequence')}</p>
    </>}
    {error&&<p role="alert" className="bio-cert-error">{error}</p>}
   </div>
   <footer><button className="btn btn--ghost" disabled={busy} onClick={()=>step?setStep(0):close()}>{t(step?'discovery.tour.back':'discovery.common.cancel')}</button>{!step?<button className="btn btn--primary" disabled={!allReviewed||(!accepting&&(blocking.length>0||below))} onClick={()=>setStep(1)}>{t('discovery.certification.continue',{count:reviewed.length,total:CERTIFICATION_SECTIONS.length})}</button>:<button className="btn btn--primary" disabled={busy||!Object.values(statements).every(v=>v===true)||below} onClick={submit}>{t(busy?'discovery.selfCert.submitting':accepting?'discovery.certification.acceptChanges':'discovery.certification.submit')}</button>}</footer>
  </>}
 </dialog>;
}
