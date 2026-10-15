import React from 'react';
import { apiFetch } from '../lib/supabase-browser.js';
import { useLocale } from '../lib/i18n.js';
import { distinctQuote, sourceLine } from '../lib/provenance-copy.js';
import { safeHref } from './display-text.js';
import { useCertThread, ClientThread } from './ClientThread.jsx';
import { useBrandFonts } from '../brand-fonts.jsx';
import { foundationStatus, COLOUR_ROLES, GOOGLE_FONTS, validateFoundationVisual } from '../../server/src/lib/brand-foundation.js';
import { claimState, confirmSection, eligibleForBulk, reviewGate, reviewPatch, writeField } from '../../server/src/lib/claim-review.js';
import { evaluateCertification } from '../../server/src/lib/evaluate-certification.js';
import { scoreBioBreakdown } from '../../server/src/lib/score-bio.js';
import './certify.css';
const LABEL = { to_confirm: 'Likely', conflicting: 'Conflicting', guessed: 'Our best guess', low: 'Needs your input', medium: 'Medium', high: 'High', confirmed: 'Confirmed', fixed: 'Fixed', asked: 'Asked', new_evidence: 'New evidence' };
const SECTION = { foundation: 'Foundation', guidelines: 'Guidelines', strategy: 'Strategy' };
const display = value => value == null || value === '' || (Array.isArray(value) && !value.length) ? 'No value recorded' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const sourceAsset = (sources, id) => sources.find(s => s.id === id)?.evidence_url;
const isImage = e => e.mime?.startsWith('image/') || /\.(png|jpe?g|webp)(\?|$)/i.test(e.asset_url || e.label || '');
const valuePreview = value => Array.isArray(value) ? value.map(v => typeof v === 'object' ? v.family || v.hex || v.name || '' : v).filter(Boolean).join(' · ') : value?.sourceId ? 'Uploaded logo' : typeof value === 'object' ? 'Recorded settings' : display(value);
const fieldLabel = path => path.split('.').at(-1).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

export function ClaimValue({ claim, value = claim.value, sources = [] }) {
  if (claim.field_path === 'visual.logo' && value?.sourceId) {
    const url = sourceAsset(sources, value.sourceId);
    return url ? <img className="certify-logo" src={url} alt="Brand logo" /> : <p>Logo preview unavailable · inspect the source evidence.</p>;
  }
  if (claim.field_path === 'visual.palette' && value?.length) return <div className="certify-swatches">{value.map((c,i) => <div key={i}><span style={{backgroundColor: /^#[\da-f]{6}$/i.test(c.hex) ? c.hex : 'transparent'}} /><strong>{c.role || 'Unassigned'}</strong><small>{c.hex}</small></div>)}</div>;
  if (claim.field_path === 'visual.type' && value?.length) return <div>{value.map((f,i) => <p className="certify-specimen" key={i} style={{fontFamily: `"${f.family}", serif`}}>Aa · {f.family}<small>{f.kind || 'Unassigned'}</small></p>)}</div>;
  if (Array.isArray(value)) return <ul className="certify-values">{value.map((v,i) => <li key={i}>{typeof v === 'object' ? Object.entries(v).filter(([,x]) => typeof x === 'string').map(([k,x]) => `${fieldLabel(k)}: ${x}`).join(' · ') : String(v)}</li>)}</ul>;
  return <p className="certify-value">{typeof value === 'object' && value ? Object.entries(value).filter(([,v]) => typeof v !== 'object').map(([k,v]) => `${fieldLabel(k)}: ${v}`).join(' · ') : display(value)}</p>;
}
export function ClaimEvidence({ claim }) {
  const { t } = useLocale();
  const [tab, setTab] = React.useState(0);
  React.useEffect(() => setTab(0), [claim.claim_id]);
  const evidence = claim.evidence?.[tab] || claim.evidence?.[0];
  const line = evidence ? sourceLine(evidence.source_kind?.length ? evidence.source_kind : evidence.label ? [evidence.label] : ['guess'], t) : '';
  const quote = evidence ? distinctQuote(evidence.quote, line) : '';
  const href = evidence ? safeHref(evidence.url || evidence.asset_url) : null;
  const pageSuffix = evidence && Number.isFinite(Number(evidence.page)) && String(evidence.page).trim() !== '' ? ` · Page ${evidence.page}` : '';
  return <div className="certify-evidence">
    <div className="eyebrow">{t('provenance.where')}</div>
    {(claim.evidence||[]).length > 1 && <div className="certify-tabs" role="tablist" aria-label={t('provenance.where')}>{claim.evidence.map((e,i) => <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{Number.isFinite(Number(e.page)) ? e.page : i+1}</button>)}</div>}
    {!evidence ? <p className="certify-empty">{t('provenance.missingNotFound')}</p> : <>
      {quote && <blockquote>{quote}</blockquote>}
      {evidence.screenshot && <img className="certify-source-image" src={evidence.screenshot} alt={line} />}
      {evidence.asset_url && isImage(evidence) && <img className="certify-source-image" src={evidence.asset_url} alt={line} />}
      {evidence.asset_url && (evidence.mime === 'application/pdf' || /\.pdf$/i.test(evidence.asset_url || '')) && <iframe className="certify-pdf" title={line} src={`${evidence.asset_url}#page=${evidence.page || 1}`} />}
      {href ? <a href={href} target="_blank" rel="noreferrer">{line}{pageSuffix} ↗</a> : <p className="certify-provenance">{line}{pageSuffix}</p>}
    </>}
  </div>;
}
function FixEditor({ claim, sources, onSave, onCancel }) {
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
    <h3>Fix {fieldLabel(claim.field_path)}</h3>
    {claim.field_path === 'visual.logo' ? <label>Brand logo<select aria-label="Brand logo" value={value?.sourceId || ''} onChange={e => setValue({...value,sourceId:e.target.value, conf:100})}><option value="">Choose an uploaded logo</option>{sources.filter(s => s.signals?.asset_role === 'logo' && s.signals?.ext === 'png' && s.signals?.rights_confirmed).map(s => <option key={s.id} value={s.id}>{s.src}</option>)}</select></label>
      : claim.field_path === 'visual.palette' ? <>{rows.map((c,i) => <div className="certify-edit-row" key={i}><label>Role<select value={c.role || ''} onChange={e => setRow(i,{role:e.target.value})}><option value="">Unassigned</option>{COLOUR_ROLES.map(r => <option key={r}>{r}</option>)}</select></label><label>Colour<input aria-label={`Colour ${i+1}`} value={c.hex || ''} onChange={e => setRow(i,{hex:e.target.value})} /></label><button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>Remove</button></div>)}<button type="button" onClick={() => setValue([...rows,{role:'accent',hex:'#ffffff'}])}>Add colour</button></>
      : claim.field_path === 'visual.type' ? <>{rows.map((f,i) => <div className="certify-edit-row" key={i}><label>Usage<select value={f.kind || 'Display'} onChange={e => setRow(i,{kind:e.target.value})}>{['Display','Body','Both'].map(k => <option key={k}>{k}</option>)}</select></label><label>Typeface<select value={f.sourceId || f.family || ''} onChange={e => { const source = sources.find(s => s.id === e.target.value); setValue(rows.map((r,j) => j === i ? source ? {kind:f.kind || 'Display',family:source.signals.font_family,sourceId:source.id} : {kind:f.kind || 'Display',family:e.target.value,provider:'google'} : r)); }}><option value="">Choose typeface</option>{GOOGLE_FONTS.map(name => <option key={name}>{name}</option>)}{sources.filter(s => s.signals?.asset_kind === 'font' && s.signals?.rights_confirmed).map(s => <option key={s.id} value={s.id}>{s.signals.font_family} · uploaded</option>)}</select></label><button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>Remove</button></div>)}<button type="button" onClick={() => setValue([...rows,{kind:'Display',family:'Instrument Sans',provider:'google'}])}>Add typeface</button></>
      : claim.kind === 'scalar' ? <label>Value<textarea aria-label="Value" autoFocus value={value ?? ''} onChange={e => setValue(e.target.value)} /></label>
      : claim.kind === 'list' ? <label>One item per line<textarea autoFocus value={rows.join('\n')} onChange={e => setValue(e.target.value.split('\n').filter(Boolean))} /></label>
      : claim.kind === 'object' ? <>{Object.entries(value || {h1:64,h2:48,h3:36,h4:28,h5:22,h6:18,body:16}).filter(([,v]) => typeof v !== 'object').map(([k,v]) => <label key={k}>{fieldLabel(k)}<input value={v} type={typeof v === 'number' ? 'number' : 'text'} onChange={e => setValue({...value,[k]:typeof v === 'number' ? Number(e.target.value) : e.target.value})} /></label>)}</>
      : <>{rows.map((row,i) => <fieldset key={i}><legend>Item {i+1}</legend>{Object.entries(row).filter(([,v]) => typeof v !== 'object').map(([k,v]) => <label key={k}>{fieldLabel(k)}<input value={v ?? ''} onChange={e => setRow(i,{[k]:e.target.value})} /></label>)}<button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>Remove</button></fieldset>)}<button type="button" onClick={() => setValue([...rows,{name:'',url:''}])}>Add item</button></>}
    <div className="certify-diff"><small>Before</small><p>{display(claim.value)}</p><small>After</small><p>{display(value)}</p></div>
    {error && <p role="alert">{error}</p>}
    <div className="certify-actions"><button className="btn btn--primary" type="submit">Save fix</button><button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button></div>
  </form>;
}
function BrandIntro({ data, onStart }) {
  const { job, sources, certify } = data;
  const visual = job.bio.payload.visual || {};
  const logo = sourceAsset(sources, visual.logo?.sourceId);
  return <div className="certify-intro">
    <div className="eyebrow">Brand in 60 seconds</div><h1>{job.brand?.name || 'Brand Core'}</h1>
    <p className="certify-positioning">{job.bio.payload.identity?.positioning || 'Positioning to confirm'}</p>
    <div className="certify-intro-foundation">{logo ? <img className="certify-logo" src={logo} alt="Brand logo" /> : <p>● Logo to confirm</p>}<ClaimValue claim={{field_path:'visual.palette'}} value={COLOUR_ROLES.map(role => visual.palette?.find(c => c.role === role) || {role,hex:'—'})} sources={sources} /><ClaimValue claim={{field_path:'visual.type'}} value={visual.type || []} sources={sources} /></div>
    <p>{certify.claims.length} claims · {certify.claims.filter(c => c.level === 'to_confirm').length} likely · {certify.claims.filter(c => c.level === 'conflicting').length} conflicting</p>
    <div className="certify-source-thumbs">{sources.slice(0,3).map(s => <a key={s.id} href={s.evidence_url || (/^https?:/.test(s.src) ? s.src : undefined)} target="_blank" rel="noreferrer">{s.signals?.screenshotUrl ? <img src={s.signals.screenshotUrl} alt="Source screenshot" /> : s.signals?.mime?.startsWith('image/') && s.evidence_url ? <img src={s.evidence_url} alt="Source thumbnail" /> : <span>{s.kind === 'file_upload' ? 'File' : 'Website'}</span>}<small>{s.src}</small></a>)}</div>
    <button className="btn btn--primary" onClick={onStart}>Start review</button>
  </div>;
}
export function CertifyReview({ data, thread = {enabled:false,messages:[]}, onReload, onSubmit, onBack }) {
  const { job, certify, sources = [], rubric } = data;
  const [started, setStarted] = React.useState(false);
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
  const claim = claims.find(c => c.claim_id === activeId) || claims[0];
  const index = claims.indexOf(claim);
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
    setAnnouncement(`${fieldLabel(claim.field_path)} ${LABEL[state].toLowerCase()}`);
    move(1);
  };
  const confirm = () => decisions[claim.claim_id]?.state === 'fixed' ? decide('fixed',decisions[claim.claim_id].value) : decide('confirmed');
  const ask = () => { setMode('ask'); setQuestion(`Please clarify ${fieldLabel(claim.field_path).toLowerCase()} and share the source we should use.`); };
  React.useEffect(() => { queueRef.current?.querySelector('.is-active')?.scrollIntoView({block:'nearest'}); }, [activeId,started]);
  React.useEffect(() => { if (started && mode === 'review') cardRef.current?.focus(); }, [activeId,started,mode]);
  React.useEffect(() => {
    const handler = e => {
      if (!started || closed || busy) return;
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
      if (thread.enabled) {await thread.addDraft([claim.field_path],question);setShowThread(true);}
      else await navigator.clipboard.writeText(question);
      setDecisions(prev => ({...prev,[claim.claim_id]:{state:'asked',evidence_token:claim.evidence_token}}));
      setAnnouncement(thread.enabled ? 'Question added to section drafts' : 'Question copied for the client');setMode('review');
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  };
  const submit = async () => {
    if (mode !== 'review' || !gate.ready || (!leadReview && !allScored) || closed) return;
    setBusy(true);setError('');
    try { const result = await onSubmit({...(leadReview ? {leadApprove:true,leadNotes:notes || null} : {}),reviewerScores:scores, bioPatch:Object.keys(patch).length ? patch : undefined, notes:notes || null, claimReview:{bio_version:certify.bio_version,decisions}});setAnnouncement(result.status === 'pending_lead_review' ? 'Submitted for a second human review' : `Review submitted · ${result.decision || result.status}`); await onReload?.(); }
    catch(e) {setError(e.message);} finally {setBusy(false);}
  };
  if (!claims.length) return <p>No claims available for review.</p>;
  return <section className="certify-view">
    <header className="certify-header"><button className="btn btn--ghost" onClick={onBack}>← Job</button><span>Certify · {job.brand?.name} · Version {certify.bio_version}{job.status === 'pending_lead_review' ? ' · ● Waiting for a second human reviewer' : job.bio.certified ? ' · ● Certified' : ''}</span><button className="btn btn--ghost" onClick={onReload} disabled={busy}>Refresh evidence</button></header>
    {!started ? <BrandIntro data={data} onStart={() => setStarted(true)} /> : <div className="certify-workspace">
      <nav ref={queueRef} className="certify-queue" aria-label="Claims ordered by risk">
        <h2>Review queue</h2><small>Highest risk first in each section</small>
        {Object.entries(SECTION).map(([section,label]) => <div key={section}><h3>{label}</h3>{claims.filter(c => c.section === section).map(c => <button key={c.claim_id} data-claim-id={c.claim_id} className={c.claim_id === activeId ? 'is-active' : ''} onClick={() => {setActiveId(c.claim_id);setMode('review');setBulk(false);}} aria-current={c.claim_id === activeId ? 'step' : undefined}><strong>{fieldLabel(c.field_path)}</strong><small className="certify-queue-preview">{valuePreview(c.value)}</small><span className={`certify-status certify-status--${claimState(c,decisions[c.claim_id],thread.messages)}`}>● {LABEL[claimState(c,decisions[c.claim_id],thread.messages)]}</span><small>● {LABEL[c.level]}</small></button>)}</div>)}
      </nav>
      <div className="certify-review-main">
        <div className="certify-progress"><span>{index+1} / {claims.length} · {SECTION[claim.section]}</span><span>{claims.length-gate.unresolved.length} resolved</span></div>
        <article className="certify-claim-card" tabIndex={-1} ref={cardRef} aria-label={`Review ${claim.field_path}`}>
          <header><h2>{fieldLabel(claim.field_path)}</h2><span>● {LABEL[claim.level]}</span></header>
          <div className="certify-claim-columns"><div className="certify-claim-value"><div className="eyebrow">Brand Core claim</div><ClaimValue claim={claim} value={decisions[claim.claim_id]?.state === 'fixed' ? decisions[claim.claim_id].value : claim.value} sources={sources} /><p className="certify-why">{claim.why}</p>{decisions[claim.claim_id]?.state === 'fixed' && <div className="certify-diff"><small>Before → after</small><p>{display(claim.value)} → {display(decisions[claim.claim_id].value)}</p></div>}</div><ClaimEvidence claim={claim} /></div>
          {!closed && (mode === 'fix' ? <FixEditor key={claim.claim_id} claim={claim} sources={sources} onSave={v => decide('fixed',v)} onCancel={() => setMode('review')} /> : mode === 'ask' ? <div className="certify-editor"><h3>Ask client · {fieldLabel(claim.field_path)}</h3><label>Question<textarea aria-label="Question" autoFocus value={question} onChange={e => setQuestion(e.target.value)} maxLength={4000} /></label><div className="certify-actions"><button className="btn btn--primary" disabled={busy || !question.trim()} onClick={saveQuestion}>{thread.enabled ? 'Add to S3 drafts' : 'Copy question'}</button><button className="btn btn--ghost" onClick={() => setMode('review')}>Cancel</button></div></div> : <div className="certify-actions"><button className="btn btn--primary" onClick={confirm}>Confirm ↵</button><button className="btn btn--ghost" disabled={leadReview} onClick={() => setMode('fix')}>Fix <kbd>F</kbd></button><button className="btn btn--ghost" onClick={ask}>Ask client <kbd>A</kbd></button><button className="btn btn--ghost" onClick={() => move(1)}>Skip <kbd>S</kbd></button></div>)}
        </article>
        {!closed && <div className="certify-bulk"><button className="btn btn--ghost" onClick={() => setBulk(true)}>Confirm all eligible in {SECTION[claim.section]}</button>{bulk && <div role="group" aria-label="Confirm section"><p>Confirm {claims.filter(c => c.section === claim.section && eligibleForBulk(c) && !decisions[c.claim_id]).length} medium or high claims? Low, guessed, conflicting and asked claims need individual review.</p><button className="btn btn--ghost" onClick={() => {setDecisions(prev => confirmSection(claims,prev,claim.section));setBulk(false);setAnnouncement('Eligible section claims confirmed');}}>Confirm section</button><button className="btn btn--ghost" onClick={() => setBulk(false)}>Cancel</button></div>}</div>}
        <section className="certify-seal" aria-label="Certification seal"><h2>Human certification seal</h2><p>● Foundation {foundationGate.ready ? 'reviewed' : 'locked'} · {foundationGate.unresolved.length} claims to resolve</p>{!gate.foundation.certifiable && <p role="status">Foundation incomplete · logo rights, primary colour and display font are required.</p>}<p>{gate.waiting ? `● Waiting on client / evidence review (${gate.waiting})` : `● ${gate.unresolved.length} claims left to resolve`}</p>
          <p className="certify-why">The existing seven-criterion rubric decides the outcome. A second reviewer is required when your review enters calibration.</p>
          {autoScores.map(c => <p className="certify-auto-score" key={c.id}>{c.id} · {c.label}<span>{c.score} / 4 · computed</span></p>)}
          {!leadReview && human.map(c => <label className="certify-score" key={c.id}>{c.id} · {c.label || c.name || c.id}<select aria-label={`Score ${c.id}`} disabled={!gate.ready || closed} value={scores[c.id]?.score ?? ''} onChange={e => setScores(prev => ({...prev,[c.id]:{score:Number(e.target.value),confidence:2}}))}><option value="">Review and score</option>{[0,1,2,3,4].map(n => <option key={n} value={n}>{n} · {['Not met','Weak','Partial','Strong','Exemplary'][n]}</option>)}</select></label>)}
          <label>Review notes<textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={closed} /></label><button className="btn btn--ghost certify-seal-button" disabled={mode !== 'review' || !gate.ready || (!leadReview && !allScored) || busy || closed} onClick={submit}>{leadReview ? 'Approve after second human review' : 'Submit human review'}</button>
        </section>
        {thread.enabled && <section className="certify-thread"><button className="btn btn--ghost" onClick={() => setShowThread(!showThread)}>{showThread ? 'Hide' : 'Open'} client thread</button>{showThread && <ClientThread thread={thread} sources={sources} fields={[{field:claim.field_path,label:fieldLabel(claim.field_path)}]} />}</section>}
      </div>
    </div>}
    <div className="certify-announcement" aria-live="polite">{announcement}</div>{error && <p role="alert">{error}</p>}
  </section>;
}
export function CertifyView({ id, go }) {
  const [data,setData] = React.useState(null);
  const [error,setError] = React.useState('');
  const thread = useCertThread(id);
  const reload = React.useCallback(async () => {
    try {const res=await apiFetch(`/api/steward/jobs/${id}`);const json=await res.json();if(!res.ok)throw Error(json.error || 'Review unavailable');setData(json);setError('');await thread.reload();}
    catch(e){setError(e.message);}
  },[id]);
  React.useEffect(() => {reload();},[reload]);
  React.useEffect(() => {if(data && !data.certify?.enabled) go(`team-job/${id}`);},[data,id,go]);
  if(error)return <p role="alert">{error}</p>;
  if(!data?.certify?.enabled)return null;
  const submit = async body => {const res=await apiFetch(`/api/steward/jobs/${id}`,{method:'PATCH',body:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw Error(json.error || 'Review failed');return json;};
  return <CertifyReview key={data.job.bio.id} data={data} thread={thread} onReload={reload} onSubmit={submit} onBack={() => go(`team-job/${id}`)} />;
}
