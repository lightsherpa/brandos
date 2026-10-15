import React from 'react';
import {brandCoreInputsCopy} from '../locales/brand-core-inputs-copy.js';
import {LOGO_USES} from '../lib/brand-core-inputs.js';
import { apiFetch } from '../lib/supabase-browser.js';
import { useCertThread, ClientThread } from './ClientThread.jsx';
import { useBrandFonts } from '../brand-fonts.jsx';
import { foundationStatus, COLOUR_ROLES, GOOGLE_FONTS, validateFoundationVisual } from '../../server/src/lib/brand-foundation.js';
import { claimState, confirmSection, eligibleForBulk, reviewGate, reviewPatch, writeField } from '../../server/src/lib/claim-review.js';
import { evaluateCertification } from '../../server/src/lib/evaluate-certification.js';
import { scoreBioBreakdown } from '../../server/src/lib/score-bio.js';
import './certify.css';
import { useLocale } from '../lib/i18n.js';
import { reviewCopy, sectionExplanation, reviewFieldLabels, reviewText, reviewFieldLabel } from './review-copy.js';
import { sendQuestionNow } from './cert-chat-model.js';
import { certifyUxEnabled } from './ux-flags.js';
import { CertifyReview as LegacyCertifyReview } from './LegacyCertifyView.jsx';
const LABEL = { to_confirm: 'To confirm', conflicting: 'Conflicting', guessed: 'Guessed', low: 'Low', medium: 'Medium', high: 'High', confirmed: 'Confirmed', fixed: 'Fixed', asked: 'Asked', new_evidence: 'New evidence' };
const SECTION = { foundation: 'Foundation', guidelines: 'Guidelines', strategy: 'Strategy' };
const display = value => value == null || value === '' || (Array.isArray(value) && !value.length) ? 'No value recorded' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const sourceAsset = (sources, id) => sources.find(s => s.id === id)?.evidence_url;
const isImage = e => e.mime?.startsWith('image/') || /\.(png|jpe?g|webp)(\?|$)/i.test(e.asset_url || e.label || '');
const valuePreview = value => Array.isArray(value) ? value.map(v => typeof v === 'object' ? v.family || v.hex || v.name || '' : v).filter(Boolean).join(' · ') : value?.sourceId ? 'Uploaded logo' : typeof value === 'object' ? 'Recorded settings' : display(value);
const fieldLabel = path => path.split('.').at(-1).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

export function ClaimValue({ claim, value = claim.value, sources = [] }) {
  const {locale}=useLocale();const ct=text=>reviewText(text,locale);
  if(value==null||value===''||(Array.isArray(value)&&!value.length))return <p className="certify-value">{ct('No value recorded')}</p>;
  if (/competitors|pointsOfDifference/.test(claim.field_path)&&Array.isArray(value))return <div className="certify-competitors">{value.map((item,i)=><article key={i}><h3>{item.name||item.claim||String(item)}</h3>{Object.entries(item).filter(([key,v])=>!['name','claim','url','source','id'].includes(key)&&typeof v==='string').map(([key,v])=><p key={key}>{v}</p>)}{['url','source'].map(key=>{let url;try{const parsed=new URL(item[key]);if(['https:','http:'].includes(parsed.protocol))url=parsed.href;}catch{}return url?<a key={key} href={url} target="_blank" rel="noreferrer">{item[key]} ↗</a>:item[key]?<p key={key}>{item[key]}</p>:null;})}</article>)}</div>;
  if (claim.field_path==='visual.logo'&&value?.variants){
    const logos=new Map();
    if(value.sourceId)logos.set(value.sourceId,{...value,use:value.use||'primary'});
    Object.entries(value.variants).forEach(([legacyUse,logo])=>{if(!logo?.sourceId)return;const previous=logos.get(logo.sourceId);logos.set(logo.sourceId,{...previous,...logo,use:logo.use||(LOGO_USES.includes(legacyUse)?legacyUse:previous?.use)||'primary'});});
    const copy=brandCoreInputsCopy[locale]||brandCoreInputsCopy.en;
    return logos.size?<div>{[...logos.values()].map(logo=>{const url=sourceAsset(sources,logo.sourceId),use=copy.uses[LOGO_USES.indexOf(logo.use)]||copy.logo;return <figure key={logo.sourceId}><figcaption>{use}{logo.name&&<small> · {logo.name}</small>}</figcaption>{url?<img className="certify-logo" src={url} alt={`${use}${logo.name?' · '+logo.name:''}`}/>:<p>{ct('Logo preview unavailable · inspect the source evidence.')}</p>}</figure>;})}</div>:<p className="certify-value">{ct('No value recorded')}</p>;
  }
  if (claim.field_path === 'visual.logo' && value?.sourceId) {
    const url = sourceAsset(sources, value.sourceId);
    return url ? <img className="certify-logo" src={url} alt="Brand logo" /> : <p>{ct('Logo preview unavailable · inspect the source evidence.')}</p>;
  }
  if (claim.field_path === 'visual.palette' && value?.length) return <div className="certify-swatches">{value.map((c,i) => <div key={i}><span style={{backgroundColor: /^#[\da-f]{6}$/i.test(c.hex) ? c.hex : 'transparent'}} /><strong>{ct(c.role || 'Unassigned')}</strong><small>{c.hex}</small></div>)}</div>;
  if (claim.field_path === 'visual.type' && value?.length) return <div>{value.map((f,i) => <FontSpecimen key={i} family={f.family}/>)}</div>;
  if (claim.field_path === 'visual.typeScale') return <FontSpecimen family={claim.fontFamily||'inherit'} scale={value}/>;
  if (Array.isArray(value)) return <ul className="certify-values">{value.map((v,i) => <li key={i}>{typeof v === 'object' ? Object.entries(v).filter(([,x]) => typeof x === 'string').map(([k,x]) => `${fieldLabel(k)}: ${x}`).join(' · ') : String(v)}</li>)}</ul>;
  return <p className="certify-value">{typeof value === 'object' && value ? Object.entries(value).filter(([,v]) => typeof v !== 'object').map(([k,v]) => `${fieldLabel(k)}: ${v}`).join(' · ') : ct(display(value))}</p>;
}
export function FontSpecimen({family,scale={}}){return <div className="certify-font-samples" style={{fontFamily:`"${family}",sans-serif`}}><strong>{family}</strong>{['h1','h2','h3','h4','h5','h6','body'].map((tag,i)=><div key={tag}><small>{tag.toUpperCase()}</small><p style={{fontFamily:'inherit',fontSize:Math.min(48,Number(scale?.[tag])||[40,34,28,24,20,18,16][i]),lineHeight:1.3}}>The quick brown fox jumps over the lazy dog.</p></div>)}</div>;}
export function ClaimEvidence({ claim }) {
  const {locale}=useLocale();const copy=reviewCopy(locale);const ct=text=>reviewText(text,locale);
  const [tab, setTab] = React.useState(0);
  React.useEffect(() => setTab(0), [claim.claim_id]);
  const evidence = claim.evidence?.[tab] || claim.evidence?.[0];
  return <div className="certify-evidence">
    <div className="eyebrow">{copy.evidence}</div>
    {(claim.evidence||[]).length > 1 && <div className="certify-tabs" role="tablist" aria-label="Evidence sources">{claim.evidence.map((e,i) => <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{e.page ? `${ct('Page')} ${e.page}` : `${ct('Source')} ${i+1}`}</button>)}</div>}
    {!evidence ? <p className="certify-empty">{ct('● To confirm · No evidence yet')}</p> : <>
      <p className="certify-provenance">● {ct(evidence.first_party ? 'First-party' : 'Recorded / inferred')}{evidence.page ? ` · ${ct('Page')} ${evidence.page}` : ''}</p>
      {evidence.quote && <blockquote>{evidence.quote}</blockquote>}
      {evidence.screenshot && <img className="certify-source-image" src={evidence.screenshot} alt={`Screenshot of ${evidence.label}`} />}
      {evidence.asset_url && isImage(evidence) && <img className="certify-source-image" src={evidence.asset_url} alt={`Source: ${evidence.label}`} />}
      {evidence.asset_url && (evidence.mime === 'application/pdf' || /\.pdf$/i.test(evidence.label || '')) && <iframe className="certify-pdf" title={`Source PDF ${evidence.label}`} src={`${evidence.asset_url}#page=${evidence.page || 1}`} />}
      {(evidence.url || evidence.asset_url) ? <a href={evidence.url || evidence.asset_url} target="_blank" rel="noreferrer">{evidence.label || ct('Open source')} ↗</a> : <small>{evidence.label}</small>}
      {!evidence.quote && !evidence.asset_url && !evidence.screenshot && <p>{ct('No excerpt captured · inspect the source link.')}</p>}
    </>}
  </div>;
}
function FixEditor({ claim, sources, onSave, onCancel }) {
  const {locale}=useLocale();const ct=text=>reviewText(text,locale);
  const [value, setValue] = React.useState(() => structuredClone(claim.value));
  const [error, setError] = React.useState('');
  const rows = Array.isArray(value) ? value : [];
  const setRow = (i, patch) => setValue(rows.map((row,j) => j === i ? { ...row, ...patch } : row));
  const save = e => {
    e.preventDefault();
    const patch = writeField({}, claim.field_path, value);
    const invalid = patch.visual && validateFoundationVisual(patch.visual);
    if (invalid) { setError(invalid); return; }
    onSave(value);
  };
  return <form className="certify-editor" onSubmit={save}>
    <h3>{ct('Fix')} {reviewFieldLabels[locale]?.[claim.field_path.split('.').at(-1)]||fieldLabel(claim.field_path)}</h3>
    {claim.field_path === 'visual.logo' ? <label>{ct('Brand logo')}<select aria-label="Brand logo" value={value?.sourceId || ''} onChange={e => setValue({...value,sourceId:e.target.value, conf:100})}><option value="">{ct('Choose an uploaded logo')}</option>{sources.filter(s => s.signals?.asset_role === 'logo' && s.signals?.ext === 'png' && s.signals?.rights_confirmed).map(s => <option key={s.id} value={s.id}>{s.src}</option>)}</select></label>
      : claim.field_path === 'visual.palette' ? <>{rows.map((c,i) => <div className="certify-edit-row" key={i}><label>{ct('Role')}<select value={c.role || ''} onChange={e => setRow(i,{role:e.target.value})}><option value="">{ct('Unassigned')}</option>{COLOUR_ROLES.map(r => <option key={r}>{r}</option>)}</select></label><label>{ct('Colour')}<input aria-label={`Colour ${i+1}`} value={c.hex || ''} onChange={e => setRow(i,{hex:e.target.value})} /></label><button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>{ct('Remove')}</button></div>)}<button type="button" onClick={() => setValue([...rows,{role:'accent',hex:'#ffffff'}])}>{ct('Add colour')}</button></>
      : claim.field_path === 'visual.type' ? <>{rows.map((f,i) => <div className="certify-edit-row" key={i}><label>{ct('Usage')}<select value={f.kind || 'Display'} onChange={e => setRow(i,{kind:e.target.value})}>{['Display','Body','Both'].map(k => <option key={k} value={k}>{ct(k)}</option>)}</select></label><label>{ct('Typeface')}<select value={f.sourceId || f.family || ''} onChange={e => { const source = sources.find(s => s.id === e.target.value); setValue(rows.map((r,j) => j === i ? source ? {kind:f.kind || 'Display',family:source.signals.font_family,sourceId:source.id} : {kind:f.kind || 'Display',family:e.target.value,provider:'google'} : r)); }}><option value="">{ct('Choose typeface')}</option>{GOOGLE_FONTS.map(name => <option key={name}>{name}</option>)}{sources.filter(s => s.signals?.asset_kind === 'font' && s.signals?.rights_confirmed).map(s => <option key={s.id} value={s.id}>{s.signals.font_family} · {ct('uploaded')}</option>)}</select></label><button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>{ct('Remove')}</button></div>)}<button type="button" onClick={() => setValue([...rows,{kind:'Display',family:'Instrument Sans',provider:'google'}])}>{ct('Add typeface')}</button></>
      : claim.kind === 'scalar' ? <label>{ct('Value')}<textarea aria-label="Value" autoFocus value={value ?? ''} onChange={e => setValue(e.target.value)} /></label>
      : claim.kind === 'list' ? <label>{ct('One item per line')}<textarea autoFocus value={rows.join('\n')} onChange={e => setValue(e.target.value.split('\n').filter(Boolean))} /></label>
      : claim.kind === 'object' ? <>{Object.entries(value || {h1:64,h2:48,h3:36,h4:28,h5:22,h6:18,body:16}).filter(([,v]) => typeof v !== 'object').map(([k,v]) => <label key={k}>{fieldLabel(k)}<input value={v} type={typeof v === 'number' ? 'number' : 'text'} onChange={e => setValue({...value,[k]:typeof v === 'number' ? Number(e.target.value) : e.target.value})} /></label>)}</>
      : <>{rows.map((row,i) => <fieldset key={i}><legend>{ct('Item')} {i+1}</legend>{Object.entries(row).filter(([,v]) => typeof v !== 'object').map(([k,v]) => <label key={k}>{fieldLabel(k)}<input value={v ?? ''} onChange={e => setRow(i,{[k]:e.target.value})} /></label>)}<button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>{ct('Remove')}</button></fieldset>)}<button type="button" onClick={() => setValue([...rows,{name:'',url:''}])}>{ct('Add item')}</button></>}
    <div className="certify-diff"><small>{ct('Before')}</small><ClaimValue claim={claim} value={claim.value} sources={sources}/><small>{ct('After')}</small><ClaimValue claim={claim} value={value} sources={sources}/></div>
    {error && <p role="alert">{error}</p>}
    <div className="certify-actions"><button className="btn btn--primary" type="submit">{ct('Save fix')}</button><button type="button" className="btn btn--ghost" onClick={onCancel}>{ct('Cancel')}</button></div>
  </form>;
}

export function StewartSupport({copilot,claim,locale,localLabel,onInspect,onFix,onAsk,onConfirm,closed=false}){
 const copy=reviewCopy(locale),ct=text=>reviewText(text,locale);
 const [dismissed,setDismissed]=React.useState([]);
 const file=copilot?.caseFile;
 const risks=(file?.risks||[]).filter(r=>r.field===claim.field_path);
 const suggestions=(copilot?.suggestions||[]).filter(s=>s.field===claim.field_path&&!dismissed.includes(s.id));
 const changes=(file?.changes||[]).filter(change=>(change.field||change.path||change.field_path)===claim.field_path);
 const readiness={'draft':'Draft','steward-ready':'Ready for review','usable-for-briefing':'Ready for briefing','strong-draft':'Strong draft','production-certified':'Production certified'};
 return <section className="certify-stewart" aria-label={copy.support}><h2>{copy.support}</h2><p>{copy.supportText}</p>{file&&<><p><strong>{ct(readiness[file.readiness?.level]||'Ready for review')}</strong></p><dl className="certify-assistant-stats" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{[[ct('Risks'),file.risks?.length||0],[ct('Changes'),file.changes?.length||0],[ct('Sources'),file.sourceSummary?.count||0],[ct('Source-backed'),file.claims?.sourceBacked?.length||0]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}<h3>{ct('Current item')} · {localLabel(claim.field_path)}</h3><p>{sectionExplanation(claim.field_path,locale).info}</p>{risks.map((risk,i)=><div key={i} className="certify-assistant-risk"><strong>{ct(risk.reason)}</strong><p>{ct(risk.action)}</p></div>)}{changes.length>0&&<p>{ct('Changes')} · {changes.length}</p>}{(claim.evidence||[]).slice(0,3).map((e,i)=>{const raw=e.url||e.asset_url;let url;try{const parsed=new URL(raw);if(['http:','https:'].includes(parsed.protocol))url=parsed.href;}catch{}return url?<a key={i} href={url} target="_blank" rel="noreferrer">{e.label||ct('Open source')} ↗</a>:e.quote?<blockquote key={i}>{e.quote}</blockquote>:null;})}{suggestions.length>0&&<h3>{ct('Suggested actions')}</h3>}{suggestions.map(suggestion=><article key={suggestion.id} className="certify-assistant-suggestion"><strong>{suggestion.type==='ask_client'?copy.ask:ct('Review evidence')} · {localLabel(suggestion.field)}</strong><p>{ct(suggestion.reason)}</p><div className="certify-actions"><button className="btn btn--ghost" onClick={onInspect}>{ct('Review evidence')}</button>{!closed&&<><button className="btn btn--ghost" onClick={onAsk}>{copy.ask}</button>{suggestion.type==='certify_field'?<button className="btn btn--ghost" onClick={onConfirm}>{copy.confirm}</button>:<button className="btn btn--ghost" onClick={onFix}>{copy.fix}</button>}</>}<button className="btn btn--ghost" onClick={()=>setDismissed(ids=>[...ids,suggestion.id])}>{ct('Dismiss suggestion')}</button></div></article>)}<button className="btn btn--ghost" onClick={onInspect}>{ct('Review evidence')}</button>{!closed&&<button className="btn btn--ghost" onClick={onAsk}>{copy.ask}</button>}</section>;
}
export function ModernCertifyReview({ data, thread = {enabled:false,messages:[]}, onReload, onSubmit, onBack }) {
  const { job, certify, sources = [], rubric } = data;
  const {locale,t}=useLocale();const copy=reviewCopy(locale);const ct=text=>reviewText(text,locale);
  const localLabel=path=>reviewFieldLabel(path,locale,t);
  const [drawer,setDrawer]=React.useState(false);
  const drawerRef=React.useRef(null);
  React.useEffect(()=>{if(!drawer)return;const previous=document.activeElement;drawerRef.current?.querySelector('button')?.focus();const handler=e=>{if(e.key==='Escape'){setDrawer(false);e.preventDefault();}if(e.key==='Tab'){const nodes=[...drawerRef.current.querySelectorAll('button:not([disabled]),a[href],input,textarea,select')];if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus?.();};},[drawer]);
  const [finalConfirm,setFinalConfirm]=React.useState(false);
  const started=true;
  const [activeId, setActiveId] = React.useState(certify.claims[0]?.claim_id);
  const [decisions, setDecisions] = React.useState({});
  const [mode, setMode] = React.useState('review');
  const [question, setQuestion] = React.useState('');
  const [announcement, setAnnouncement] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [scores, setScores] = React.useState({});
  const [notes, setNotes] = React.useState('');
  const [showThread, setShowThread] = React.useState(false);
  const [bulk, setBulk] = React.useState(false);
  const cardRef = React.useRef(null);
  const queueRef = React.useRef(null);
  const claims = certify.claims;
  const selectedClaim=claims.find(c=>c.claim_id===activeId)||claims[0];
  const displayEvidence=selectedClaim?.field_path==='visual.imagery'?(job.bio.payload.visual?.references||[]).map(ref=>{const source=sources.find(s=>s.id===ref.sourceId);return source?.evidence_url?{label:source.src||ref.name,asset_url:source.evidence_url,mime:source.signals?.mime||'image/png',first_party:true}:null;}).filter(Boolean):[];
  const claim=selectedClaim?{...selectedClaim,fontFamily:job.bio.payload.visual?.type?.[0]?.family,evidence:[...(selectedClaim.evidence||[]),...displayEvidence]}:selectedClaim;
  const index = claims.findIndex(c=>c.claim_id===claim?.claim_id);
  const patch = reviewPatch(claims, decisions);
  const working = { ...job.bio.payload, ...Object.fromEntries(Object.entries(patch).map(([s,v]) => [s,{...job.bio.payload[s],...v}])) };
  useBrandFonts(working.visual?.type || [], job.brand_id);
  const gate = reviewGate({claims,decisions,payload:working,logoRights:certify.logoRights,messages:thread.messages});
  const foundationGate = reviewGate({claims,decisions,payload:working,logoRights:certify.logoRights,messages:thread.messages,section:'foundation'});
  const human = rubric?.criteria?.filter(c => c.source === 'human') || [];
  const autoScores = evaluateCertification({ autoSignals:scoreBioBreakdown(working,{logoRights:certify.logoRights}), reviewerScores:scores, rubricConfig:rubric }).breakdown.filter(c => c.source === 'auto');
  const allScored = human.length > 0 && human.every(c => scores[c.id]?.score != null);
  const leadReview = job.status === 'pending_lead_review' && data.you?.roles?.includes('lead_steward') && data.you.id !== job.assigned_to;
  const closed = ['completed','cancelled','rejected','decertified'].includes(job.status) || job.bio.certified || (job.status === 'pending_lead_review' && !leadReview);
  const move = direction => { setActiveId(claims[(index+direction+claims.length)%claims.length].claim_id); setMode('review'); setBulk(false); };
  const decide = (state, value) => {
    setDecisions(prev => ({...prev,[claim.claim_id]:{state,evidence_token:claim.evidence_token,...(state === 'fixed' ? {value} : {})}}));
    setAnnouncement(`${localLabel(claim.field_path)} · ${ct(LABEL[state])}`);
    move(1);
  };
  const confirm = () => decisions[claim.claim_id]?.state === 'fixed' ? decide('fixed',decisions[claim.claim_id].value) : decide('confirmed');
  const ask = () => { setMode('ask'); setQuestion(locale==='es'?`Aclara ${localLabel(claim.field_path).toLowerCase()} y comparte la fuente que debemos usar.`:locale==='ar'?`يرجى توضيح ${localLabel(claim.field_path)} ومشاركة المصدر الذي ينبغي استخدامه.`:`Please clarify ${localLabel(claim.field_path).toLowerCase()} and share the source we should use.`); };
  React.useEffect(() => { queueRef.current?.querySelector('.is-active')?.scrollIntoView({block:'nearest'}); }, [activeId,started]);
  React.useEffect(() => { if (started && mode === 'review') cardRef.current?.focus(); }, [activeId,started,mode]);
  React.useEffect(() => {
    const handler = e => {
      if (!started || closed || busy || drawer) return;
      if (e.key === 'Escape' && mode !== 'review') {setMode('review');e.preventDefault();return;}
      if (e.key === 'Enter' && /^(BUTTON|A)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (mode !== 'review') {if(e.key === 'Escape') {setMode('review');e.preventDefault();} return;}
      if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();confirm();}
      else if (!leadReview && e.key.toLowerCase() === 'f') {e.preventDefault();setMode('fix');}
      else if (e.key.toLowerCase() === 'a') {e.preventDefault();ask();}
      else if (['j','ArrowDown','s'].includes(e.key)) {e.preventDefault();move(1);}
      else if (['k','ArrowUp'].includes(e.key)) {e.preventDefault();move(-1);}
      else if(e.key === 'Enter' && e.shiftKey) {e.preventDefault();setBulk(true);}
    };
    window.addEventListener('keydown',handler);return () => window.removeEventListener('keydown',handler);
  });
  const saveQuestion = async () => {
    setBusy(true);setError('');
    try {
      if (!thread.enabled) throw Error(copy.unavailable);
      await sendQuestionNow(thread,claim.field_path,question);setShowThread(true);
      setDecisions(prev => ({...prev,[claim.claim_id]:{state:'asked',evidence_token:claim.evidence_token}}));
      setAnnouncement(copy.sent);move(1);
    } catch(e) {setError(e.message==='Failed to fetch'?ct('A network connection could not be established. Check your connection and retry.'):e.message);} finally {setBusy(false);}
  };
  const submit = async () => {
    if (mode !== 'review' || !gate.ready || (!leadReview && !allScored) || closed) return;
    setBusy(true);setError('');
    try { const result = await onSubmit({...(leadReview ? {leadApprove:true,leadNotes:notes || null} : {}),reviewerScores:scores, bioPatch:Object.keys(patch).length ? patch : undefined, notes:notes || null, claimReview:{bio_version:certify.bio_version,decisions}});setAnnouncement(result.status === 'pending_lead_review' ? ct('Submitted for a second human review') : ct('Review submitted')); setFinalConfirm(false);await onReload?.(); }
    catch(e) {setError(e.message==='Failed to fetch'?ct('A network connection could not be established. Check your connection and retry.'):e.message);} finally {setBusy(false);}
  };
  if (!claims.length) return <p>{ct('No claims available for review.')}</p>;
  return <section className="certify-view certify-view--ux" dir={locale==='ar'?'rtl':'ltr'}>
    <header className="certify-header"><button className="btn btn--ghost" onClick={onBack}>{ct('← Queue')}</button><span>Certify · {job.brand?.name} · {ct('Version')} {certify.bio_version}{job.status === 'pending_lead_review' ? ` · ● ${ct('Waiting for a second human reviewer')}` : job.bio.certified ? ` · ● ${ct('Certified')}` : ''}</span><button className="btn btn--ghost" onClick={onReload} disabled={busy}>{ct('Refresh evidence')}</button></header>
    <div className="certify-workspace">
      <nav ref={queueRef} className="certify-queue" aria-label="Claims ordered by risk">
        <h2>{copy.queue}</h2><small>{ct('Highest risk first in each section')}</small>
        {Object.entries(SECTION).map(([section,label]) => <div key={section}><h3>{ct(label)}</h3>{claims.filter(c => c.section === section).map(c => <button key={c.claim_id} data-claim-id={c.claim_id} className={c.claim_id === activeId ? 'is-active' : ''} onClick={() => {setActiveId(c.claim_id);setMode('review');setBulk(false);setDrawer(true);}} aria-current={c.claim_id === activeId ? 'step' : undefined}><strong>{localLabel(c.field_path)}</strong><small className="certify-queue-preview">{ct(valuePreview(c.value))}</small><span className={`certify-status certify-status--${claimState(c,decisions[c.claim_id],thread.messages)}`}>● {ct(LABEL[claimState(c,decisions[c.claim_id],thread.messages)])}</span><small>● {ct(LABEL[c.level])}</small></button>)}</div>)}
      </nav>
      <div className="certify-review-main">
        <div className="certify-progress"><span>{index+1} / {claims.length} · {ct(SECTION[claim.section])}</span><span>{claims.length-gate.unresolved.length} {ct('resolved')}</span></div>
        <article className="certify-claim-card" tabIndex={-1} ref={cardRef} aria-label={`Review ${claim.field_path}`}>
          <header><div><h2>{localLabel(claim.field_path)}</h2><SectionExplanation path={claim.field_path} locale={locale}/></div><span>● {ct(LABEL[claim.level])}</span></header>
          <div className="certify-claim-columns"><div className="certify-claim-value"><div className="eyebrow">{ct('Brand Core claim')}</div><ClaimValue claim={claim} value={decisions[claim.claim_id]?.state === 'fixed' ? decisions[claim.claim_id].value : claim.value} sources={sources} /><p className="certify-why">{sectionExplanation(claim.field_path,locale).info}</p>{decisions[claim.claim_id]?.state === 'fixed' && <div className="certify-diff"><small>{ct('Before → after')}</small><ClaimValue claim={claim} value={claim.value} sources={sources}/><ClaimValue claim={claim} value={decisions[claim.claim_id].value} sources={sources}/></div>}</div><ClaimEvidence claim={claim} /></div>
          {!closed && (mode === 'fix' ? <FixEditor key={claim.claim_id} claim={claim} sources={sources} onSave={v => decide('fixed',v)} onCancel={() => setMode('review')} /> : mode === 'ask' ? <div className="certify-editor certify-question-popover" role="dialog" aria-label={copy.ask}><h3>{copy.ask} · {localLabel(claim.field_path)}</h3><label>{ct('Question')}<textarea aria-label="Question" autoFocus value={question} onChange={e => setQuestion(e.target.value)} maxLength={4000} /></label><div className="certify-actions"><button className="btn btn--primary" disabled={busy || !question.trim()} onClick={saveQuestion}>{copy.send}</button><button className="btn btn--ghost" onClick={() => setMode('review')}>{ct('Cancel')}</button></div></div> : <div className="certify-actions"><button className="btn btn--primary" onClick={confirm}>{copy.confirm} ↵</button><button className="btn btn--ghost" disabled={leadReview} onClick={() => setMode('fix')}>{copy.fix} <kbd>F</kbd></button><button className="btn btn--ghost" onClick={ask}>{copy.ask} <kbd>A</kbd></button><button className="btn btn--ghost" onClick={() => move(1)}>{copy.skip} <kbd>S</kbd></button></div>)}
        </article>
        {!closed && <div className="certify-bulk"><button className="btn btn--ghost" onClick={() => setBulk(true)}>{ct('Confirm all eligible in')} {ct(SECTION[claim.section])}</button>{bulk && <div role="group" aria-label="Confirm section"><p>{ct('Confirm eligible claims? Low, guessed, conflicting and asked claims need individual review.')}</p><button className="btn btn--ghost" onClick={() => {setDecisions(prev => confirmSection(claims,prev,claim.section));setBulk(false);setAnnouncement('Eligible section claims confirmed');}}>{ct('Confirm section')}</button><button className="btn btn--ghost" onClick={() => setBulk(false)}>{ct('Cancel')}</button></div>}</div>}
        <section className="certify-seal" aria-label="Certification seal"><h2>Brand Core</h2><p>{copy.guidance}</p><p>● {ct('Foundation')} {ct(foundationGate.ready?'reviewed':'locked')} · {foundationGate.unresolved.length} {ct('claims to resolve')}</p>{!gate.foundation.certifiable && <p role="status">{ct('Foundation incomplete · logo rights, primary colour and display font are required.')}</p>}<p>{gate.waiting ? `● ${ct('Waiting on client / evidence review')} (${gate.waiting})` : `● ${gate.unresolved.length} ${ct('claims left to resolve')}`}</p>
          <p className="certify-why">{ct('Score the criteria after reviewing the evidence. A second reviewer may be required.')}</p>
          {autoScores.map(c => <p className="certify-auto-score" key={c.id}>{c.id} · {ct(c.label)}<span>{c.score} / 4 · {ct('computed')}</span></p>)}
          {!leadReview && human.map(c => <label className="certify-score" key={c.id}>{c.id} · {ct(c.label || c.name || c.id)}<select aria-label={`Score ${c.id}`} disabled={!gate.ready || closed} value={scores[c.id]?.score ?? ''} onChange={e => setScores(prev => ({...prev,[c.id]:{score:Number(e.target.value),confidence:2}}))}><option value="">{ct('Review and score')}</option>{[0,1,2,3,4].map(n => <option key={n} value={n}>{n} · {ct(['Not met','Weak','Partial','Strong','Exemplary'][n])}</option>)}</select></label>)}
          <label>{copy.reviewNotes}<textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={closed} /></label><button className="btn btn--ghost certify-seal-button" disabled={mode !== 'review' || !gate.ready || (!leadReview && !allScored) || busy || closed} onClick={()=>setFinalConfirm(true)}>{ct('Review confirmation')}</button>{finalConfirm&&<div className="certify-confirmation" role="dialog" aria-label={copy.certify}><p>{copy.confirmation}</p><button className="btn btn--primary" disabled={busy} onClick={submit}>{copy.certify}</button><button className="btn btn--ghost" onClick={()=>setFinalConfirm(false)}>{copy.cancel}</button></div>}
        </section>

      </div>
      <aside className="certify-support"><section className="certify-focus"><h2>{copy.focus}</h2>{(data.focus||claims.filter(c=>['to_confirm','conflicting','guessed','low'].includes(c.level)).map(c=>({field:c.field_path,label:localLabel(c.field_path),reason:c.why}))).slice(0,4).map((f,i)=><button key={i} onClick={()=>{const target=claims.find(c=>c.field_path===f.field);if(target){setActiveId(target.claim_id);setDrawer(true);}}}><strong>{f.field?localLabel(f.field):f.label}</strong><small>{f.field?sectionExplanation(f.field,locale).line:copy.guidance}</small></button>)}</section><StewartSupport copilot={data.copilot} claim={claim} locale={locale} localLabel={localLabel} closed={closed} onInspect={()=>setDrawer(true)} onAsk={ask} onFix={()=>setMode('fix')} onConfirm={confirm}/><section className="certify-client-chat"><button className="btn btn--ghost" onClick={()=>setShowThread(!showThread)}>{copy.openChat}</button>{showThread&&(thread.enabled?<ClientThread thread={thread} sources={sources} fields={[{field:claim.field_path,label:localLabel(claim.field_path)}]}/>:<p>{copy.unavailable}</p>)}</section></aside>
    </div>
    {drawer&&<div className="certify-drawer-backdrop" onClick={()=>setDrawer(false)}><aside ref={drawerRef} className="certify-detail-drawer" role="dialog" aria-modal="true" aria-label={copy.detail} onClick={e=>e.stopPropagation()}><button className="btn btn--ghost" onClick={()=>setDrawer(false)}>{copy.close}</button><h2>{localLabel(claim.field_path)}</h2><SectionExplanation path={claim.field_path} locale={locale}/><ClaimValue claim={claim} sources={sources}/><ClaimEvidence claim={claim}/><h3>{copy.changed}</h3>{decisions[claim.claim_id]?.state==='fixed'?<div><p>{copy.before}: {valuePreview(claim.value)}</p><p>{copy.after}: {valuePreview(decisions[claim.claim_id].value)}</p></div>:<p>{copy.unchanged}</p>}{!closed&&<div className="certify-actions"><button className="btn btn--primary" onClick={()=>{confirm();setDrawer(false);}}>{copy.confirm}</button><button className="btn btn--ghost" onClick={()=>{setMode('fix');setDrawer(false);}}>{copy.fix}</button><button className="btn btn--ghost" onClick={()=>{ask();setDrawer(false);}}>{copy.ask}</button></div>}</aside></div>}
    <div className="certify-announcement" aria-live="polite">{announcement}</div>{error && <p role="alert">{error}</p>}
  </section>;
}
export function SectionExplanation({path,locale='en'}){const e=sectionExplanation(path,locale);return <div className="certify-explanation"><p>{e.line}</p><details><summary aria-label={e.title}>ⓘ</summary><p>{e.info}</p></details></div>;}
export function CertifyReview(props){return certifyUxEnabled()?<ModernCertifyReview {...props}/>:<LegacyCertifyReview {...props}/>;}
export function CertifyView({ id, go }) {
  const {locale}=useLocale(),copy=reviewCopy(locale);
  const [data,setData] = React.useState(null);
  const [error,setError] = React.useState('');
  const thread = useCertThread(id);
  const reload = React.useCallback(async () => {
    try {const res=await apiFetch(`/api/steward/jobs/${id}`);const json=await res.json();if(!res.ok)throw Error(json.error || 'Review unavailable');setData(json);setError('');await thread.reload();}
    catch(e){setError(e.message==='Failed to fetch'?reviewText('A network connection could not be established. Check your connection and retry.',locale):e.message);}
  },[id,locale]);
  React.useEffect(() => {reload();},[reload]);
  React.useEffect(() => {if(data && !data.certify?.enabled && !certifyUxEnabled()) go(`team-job/${id}`);},[data,id,go]);
  if(error || (data && !data.certify?.enabled && certifyUxEnabled()))return <div role="alert"><p>{error || reviewText('Review unavailable. Retry to reconnect.',locale)}</p><button className="btn btn--ghost" onClick={reload}>{copy.retry}</button></div>;
  if(!data?.certify?.enabled)return null;
  const submit = async body => {const res=await apiFetch(`/api/steward/jobs/${id}`,{method:'PATCH',body:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw Error(json.error || 'Review failed');return json;};
  return <CertifyReview key={data.job.bio.id} data={data} thread={thread} onReload={reload} onSubmit={submit} onBack={() => go('team')} />;
}
