import {foundationStatus} from "../server/src/lib/brand-foundation.js";
import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch,supabase} from './lib/supabase-browser.js';
import {CERTIFICATION_SECTIONS} from '../server/src/lib/certification-review.js';
import {computeFocus} from '../server/src/lib/bio-focus.js';
import {selfCertScoreReport} from '../server/src/lib/self-cert-floor.js';
import './bio-self-certification.css';
import { reviewCopy,reviewText,reviewFieldLabel } from './certify/review-copy.js';
import { ClaimValue, ClaimEvidence, SectionExplanation } from './certify/CertifyView.jsx';
import { BIO_FIELDS } from '../server/src/lib/bio-schema.js';
import { certifyUxEnabled } from './certify/ux-flags.js';
import { ownerCertifyPath } from './lib/certify-routing.js';
import { useBrandFonts } from './brand-fonts.jsx';
import {bookCopy} from './locales/brand-book-copy.js';

export function BioSelfCertification({brandId,brandName,bio,blocked,onDone,renderSection,initiallyOpen=false,onClose,go}){
 const {t}=useLocale();
 const [open,setOpen]=React.useState(initiallyOpen);
 if(certifyUxEnabled()&&go)return <button className="btn btn--primary btn--sm" disabled={blocked} onClick={()=>go(ownerCertifyPath(brandId))}>Certify · Brand Core</button>;
 const foundation=foundationStatus(bio.payload,{logoRights:bio.logoRights});
 if(!foundation.certifiable)return <span className="bio-cert-receipt foundation-incomplete" role="status">{foundation.logoStatus==='needs_rights'&&foundation.missing.length===1?'Foundation incomplete · confirm rights to use the logo':'Foundation incomplete · add logo, primary colour and display font'}</span>;
 if(bio.self_certified&&!(bio.client_acceptance_required&&!bio.client_accepted_at))return <span className="bio-cert-receipt">{t('discovery.selfCert.attestedBold')} · Brand Core v{bio.version}</span>;
 return <>
  <button className="btn btn--primary btn--sm" disabled={blocked} title={blocked?t('discovery.certification.pending'):undefined} onClick={()=>setOpen(true)}>{t(bio.certified?'discovery.certification.acceptChanges':'discovery.certification.open')}</button>
  {open&&<CertificationDialog key={bio.id} {...{brandId,brandName,bio,renderSection,onDone}} onClose={()=>{setOpen(false);onClose?.();}}/>}
 </>;
}
export function CertificationDialog({brandId,brandName,bio,onDone,onClose,renderSection,embedded=false}){
 const {t,locale}=useLocale();const copy=reviewCopy(locale),actionCopy=bookCopy[locale]||bookCopy.en;
 const modern=certifyUxEnabled();
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
 const gate=selfCertScoreReport(bio.payload||{},undefined,{logoRights:bio.logoRights});
 const allReviewed=CERTIFICATION_SECTIONS.every(s=>reviewed.includes(s));
 const focusable=root=>[...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
 React.useEffect(()=>{
  const d=ref.current;
  if(embedded)return;
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
 const confirmCurrent=()=>{setReviewed(prev=>prev.includes(section)?prev:[...prev,section]);const next=CERTIFICATION_SECTIONS.find(s=>s!==section&&!reviewed.includes(s));if(next)setSection(next);};
 const label=s=>t('discovery.tab.'+(s==='positioning'?'competitive':s));
 const Container=embedded?'section':'dialog';
 return <Container ref={ref} className={embedded?'bio-cert-dialog bio-cert-inline':'bio-cert-dialog'} role={embedded?'region':'dialog'} aria-modal={embedded?undefined:'true'} aria-labelledby="bio-cert-title" tabIndex={-1} onCancel={e=>{e.preventDefault();close();}}>
  <header><div><span className="bio-cert-kicker">{t('discovery.certification.kicker')}</span><h2 id="bio-cert-title">{embedded&&!receipt?(step?copy.certify:'Certify · Brand Core'):t(receipt?'discovery.certification.success':step?'discovery.certification.confirm':'discovery.certification.review')}</h2></div><button type="button" className="bio-cert-close" disabled={busy} aria-label={t('discovery.certification.close')} onClick={close}>×</button></header>
  <div className="bio-cert-meta"><strong>{brandName}</strong><span>Brand Core v{bio.version}</span></div>
  {receipt?<>
   <div className="bio-cert-body"><p>{embedded?reviewText('Your confirmation is recorded. You can now use this Brand Core and request changes from here.',locale):t(accepting?'discovery.certification.acceptedText':'discovery.certification.successText')}</p>{receipt.reviewQueued===false&&<p role="status">{t('discovery.certification.queuePending')}</p>}<dl className="bio-cert-record"><dt>{t('discovery.certification.account')}</dt><dd>{window.CI_USER?.name||window.CI_USER?.email||t('discovery.certification.signedIn')}</dd><dt>{t('discovery.certification.recorded')}</dt><dd>{new Date(receipt.attestedAt).toLocaleString()}</dd></dl></div>
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
      <section className="bio-cert-preview" aria-label={label(section)}><h3>{label(section)}</h3>{modern&&<div className="bio-cert-section-action"><div><strong>{label(section)}</strong><small>{reviewed.length} / {CERTIFICATION_SECTIONS.length} {actionCopy.progress}</small></div><button className="btn btn--primary" onClick={confirmCurrent}>{reviewed.includes(section)?actionCopy.recorded:actionCopy.next} {reviewed.includes(section)?"✓":"→"}</button>{reviewed.includes(section)&&<button className="btn btn--ghost" onClick={()=>setReviewed(prev=>prev.filter(s=>s!==section))}>{actionCopy.unconfirm}</button>}</div>}{renderSection(section)}{!modern&&<label className="bio-cert-check"><input type="checkbox" checked={reviewed.includes(section)} onChange={e=>setReviewed(prev=>e.target.checked?[...prev,section]:prev.filter(s=>s!==section))}/><span>{t('discovery.certification.reviewed',{section:label(section)})}</span></label>}</section></div>
     {issues.length>0&&<details className="bio-cert-issues"><summary>{t('discovery.certification.issues',{count:issues.length})}</summary><p>{t('discovery.certification.issuesText')}</p><ul>{issues.map(i=><li key={i.field}>{i.label} · {i.status==='missing'?t('discovery.certification.missing'):t('discovery.certification.verify')}</li>)}</ul></details>}
     {blocking.length>0&&<p role="alert" className="bio-cert-error">{t('discovery.selfCert.fillBefore',{fields:blocking.map(i=>i.label).join(', ')})}</p>}
    </>:<>
     <div className="bio-cert-record"><span>{t('discovery.certification.account')}</span><strong>{window.CI_USER?.name||window.CI_USER?.email||t('discovery.certification.signedIn')}</strong><span>{t('discovery.certification.reviewCount',{count:reviewed.length,total:CERTIFICATION_SECTIONS.length})}</span></div>
     <fieldset className="bio-cert-declarations"><legend>{t('discovery.certification.declarations')}</legend>{[['authority','authority'],['reflects','reflects'],['aspirationalMarked','aspirational']].map(([key,msg])=><label className="bio-cert-check" key={key}><input type="checkbox" disabled={busy} checked={statements[key]} onChange={e=>setStatements(prev=>({...prev,[key]:e.target.checked}))}/><span>{t('discovery.statement.'+msg)}</span></label>)}</fieldset>
     <p className="bio-cert-consequence">{embedded?reviewText('This confirms the version you reviewed. Future changes create a new version.',locale):t(accepting?'discovery.certification.acceptConsequence':'discovery.certification.consequence')}</p>
    </>}
    {error&&<p role="alert" className="bio-cert-error">{error}</p>}
   </div>
   <footer className={modern?"bio-cert-primary-footer":undefined}><button className="btn btn--ghost" disabled={busy} onClick={()=>step?setStep(0):close()}>{t(step?'discovery.tour.back':'discovery.common.cancel')}</button>{!step?<button className="btn btn--primary" disabled={!allReviewed||(!accepting&&(blocking.length>0||below))} onClick={()=>setStep(1)}>{modern?actionCopy.finish:t('discovery.certification.continue',{count:reviewed.length,total:CERTIFICATION_SECTIONS.length})}</button>:<button className="btn btn--primary" disabled={busy||!Object.values(statements).every(v=>v===true)||below} onClick={submit}>{embedded&&!busy?copy.certify:t(busy?'discovery.selfCert.submitting':accepting?'discovery.certification.acceptChanges':'discovery.certification.submit')}</button>}</footer>
  </>}
 </Container>;
}


export function OwnerCertifyView({brandId,go}){
 const {locale,t}=useLocale(),copy=reviewCopy(locale);
 const [data,setData]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
 const [section,setSection]=React.useState('strategy'),[kind,setKind]=React.useState('comment'),[body,setBody]=React.useState('');
 const reload=React.useCallback(async()=>{try{const res=await apiFetch(`/api/bios/${brandId}`);const json=await res.json();if(!res.ok)throw Error(json.error||'Brand Core unavailable');setData(json);setError('');}catch(e){setError(e.message);}},[brandId]);
 React.useEffect(()=>{reload();},[reload]);
 useBrandFonts(data?.bio?.payload?.visual?.type||[],brandId);
 const bio=data?.bio,payload=bio?.payload||{};
 const [sources,setSources]=React.useState([]);
 React.useEffect(()=>{let active=true;if(!supabase||!brandId)return;supabase.from('bio_sources').select('id,src,kind,signals').eq('brand_id',brandId).then(async({data:rows,error})=>{if(error)return;const signed=await Promise.all((rows||[]).map(async source=>{if(source.kind!=='file_upload')return source;try{const res=await apiFetch(`/api/bios/${brandId}/sources/${source.id}/url`);const j=await res.json();return {...source,evidence_url:j.url};}catch{return source;}}));if(active)setSources(signed);});return()=>{active=false;};},[brandId,bio?.id]);
 const specimenFont=(payload.visual?.type||[]).find(font=>/^(display|both)$/i.test(font.kind||''))||payload.visual?.type?.[0];
 const displayFont=specimenFont?.sourceId?`BrandFont-${specimenFont.sourceId}`:specimenFont?.family;
 const ledger={claims:BIO_FIELDS.map(field=>{const path=field.path.join('.'),value=payload[field.path[0]]?.[field.path[1]],confidence=payload.confidence?.[path];const ids=new Set();const collect=v=>{if(v&&typeof v==='object'){if(v.sourceId)ids.add(v.sourceId);Object.values(v).forEach(collect);}};collect(value);if(path==='visual.imagery')collect(payload.visual?.references);const evidence=sources.filter(source=>ids.has(source.id)||source.src===confidence?.source).map(source=>({label:source.src,url:/^https?:/.test(source.src)?source.src:undefined,asset_url:source.evidence_url,mime:source.signals?.mime,screenshot:source.signals?.screenshotUrl,quote:typeof payload.evidence?.[path]==='string'?payload.evidence[path]:payload.evidence?.[path]?.quote||''}));if(!evidence.length&&confidence?.source)evidence.push({label:confidence.source,url:/^https?:/.test(confidence.source)?confidence.source:undefined,quote:typeof payload.evidence?.[path]==='string'?payload.evidence[path]:payload.evidence?.[path]?.quote||''});return{claim_id:path,field_path:path,value,evidence};})};
 const feedback=async()=>{if(!body.trim()||busy)return;setBusy(true);setError('');try{const res=await apiFetch(`/api/bios/${brandId}`,{method:'PATCH',body:JSON.stringify({expectedVersion:bio.version,payload:{...payload,owner_feedback:{section,kind,body:body.trim(),base_version:bio.version}}})});const json=await res.json();if(!res.ok)throw Error(json.error||'Could not create version');setBody('');await reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const renderSection=key=><div><SectionExplanation path={key} locale={locale}/>{ledger.claims.filter(c=>c.field_path.startsWith(key+'.')).map(c=><article key={c.claim_id} className="certify-owner-claim"><h4>{reviewFieldLabel(c.field_path,locale,t)}</h4><ClaimValue claim={{...c,fontFamily:displayFont}} sources={sources}/><ClaimEvidence claim={c}/></article>)}</div>;
 return <section className="certify-view certify-view--ux" dir={locale==='ar'?'rtl':'ltr'}><header className="certify-header"><h1>Certify · Brand Core</h1><button className="btn btn--ghost" onClick={()=>go('bio')}>{copy.close}</button></header>{error&&<div role="alert">{error}<button className="btn btn--ghost" onClick={reload}>{copy.retry}</button></div>}{!bio?<p>{t('brandBook.loading')}</p>:<div className="certify-owner-layout"><main>{payload.owner_feedback&&<section className="certify-seal"><h3>{copy.feedback} · {copy[payload.owner_feedback.section]}</h3><p>{payload.owner_feedback.body}</p></section>}{(bio.self_certified||bio.certified)&&!(bio.client_acceptance_required&&!bio.client_accepted_at)?<section className="certify-seal"><h2>{data.brand?.name} · Brand Core v{bio.version} ✓</h2>{renderSection('identity')}{renderSection('visual')}{renderSection('voice')}<h2>{copy.owner}</h2><p>{copy.ownerText}</p><label>{copy.detail}<select aria-label={copy.detail} value={section} onChange={e=>setSection(e.target.value)}>{['strategy','visual','voice'].map(s=><option key={s} value={s}>{copy[s]}</option>)}</select></label><label>{copy.owner}<select aria-label={copy.owner} value={kind} onChange={e=>setKind(e.target.value)}><option value="comment">{copy.comment}</option><option value="change_request">{copy.request}</option></select></label><label>{copy.feedback}<textarea aria-label={copy.feedback} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label><button className="btn btn--primary" disabled={busy||!body.trim()} onClick={feedback}>{copy.create}</button></section>:<CertificationDialog key={bio.id} embedded brandId={brandId} brandName={data.brand?.name} bio={bio} onDone={reload} onClose={()=>go('bio')} renderSection={renderSection}/>}</main><aside className="certify-support"><section className="certify-focus"><h2>{copy.focus}</h2><p>{copy.guidance}</p>{computeFocus(payload).slice(0,4).map(i=><p key={i.field}>{reviewFieldLabel(i.field,locale,t)}</p>)}</section><section className="certify-stewart"><h2>{copy.support}</h2><p>{copy.supportText}</p></section></aside></div>}</section>;
}
