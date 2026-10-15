import {displayText,previewValue} from './display-text.js';
import {simplifyCopy} from './simplify-copy.js';
import React from 'react';
import {useLocale} from '../lib/i18n.js';
import {brandBookPath} from '../lib/certify-routing.js';
import {useBrandFonts} from '../brand-fonts.jsx';
import {ClaimValue,ClaimEvidence,FixEditor,SectionExplanation} from './ClaimContent.jsx';
import {ClientThread} from './ClientThread.jsx';
import {sendQuestionNow} from './cert-chat-model.js';
import {reviewCopy,reviewFieldLabel,reviewText} from './review-copy.js';
import {frictionCopy} from './friction-copy.js';
import {useReviewProgress} from './use-review-progress.js';
import {orderForDirector,reviewGroup,nextUnresolved,isResolved,terminalReview,previewClaim,reviewConfirmationAvailable} from './friction-model.js';
import {claimState,reviewGate,reviewPatch} from '../../server/src/lib/claim-review.js';
import {evaluateCertification} from '../../server/src/lib/evaluate-certification.js';
import {scoreBioBreakdown} from '../../server/src/lib/score-bio.js';
import './friction.css';

export function ReviewDone({data,outcome,decisions={},onBack}){
 const {locale,t}=useLocale(),c=frictionCopy(locale),sc=simplifyCopy(locale),state=terminalReview(data.job,outcome);
 const title=state==='certified'?c.done:state==='submitted'?c.submitted:c[state]||c.changes_requested;
 const text=state==='certified'?c.doneText:state==='submitted'?c.submittedText:c.changesText;
 const changed=Object.keys(decisions).filter(id=>decisions[id].state==='fixed').map(id=>data.certify.claims.find(claim=>claim.claim_id===id)?.field_path).filter(Boolean);
 const recorded=data.copilot?.caseFile?.changes||[];
 return <section className="certify-done" data-review-state={state} dir={locale==='ar'?'rtl':'ltr'}>
  <span className="certify-done-mark" aria-hidden="true">{state==='certified'?'✓':'○'}</span><div className="eyebrow">Certify · {c.record}</div><h1>{title}</h1><p>{text}</p>
  <dl><div><dt>Brand Core</dt><dd>{displayText(data.job.brand?.name,locale)}</dd></div><div><dt>{c.version}</dt><dd>{outcome?.certifiedVersion||data.job.bio.version}</dd></div><div><dt>{c.reviewer}</dt><dd>{displayText(data.job.assigned_to===data.you?.id||outcome?data.you?.name:c.record,locale)}</dd></div><div><dt>{c.history}</dt><dd>{['certified','submitted'].includes(state)?data.certify.claims.length:Object.keys(decisions).length} {c.countSuffix}</dd></div></dl>
  <h2>{c.changed}</h2>{changed.length?<ul>{changed.map(path=><li key={path}><strong>{reviewFieldLabel(path,locale,t)}</strong><p>{sc.updated}</p></li>)}</ul>:recorded.length?<ul>{recorded.map((change,i)=><li key={i}><strong>{reviewFieldLabel(String(change.field||change.path||change.field_path||'strategy').split('.').slice(0,2).join('.'),locale,t)}</strong><p>{sc.updated}</p></li>)}</ul>:<p>{sc.unchanged}</p>}
  <p>{c.clientFeedback}</p><div className="certify-actions"><a className="btn btn--primary" href={`#/${brandBookPath(data.job.brand_id)}`}>{c.viewBook}</a><button className="btn btn--ghost" onClick={onBack}>{c.back}</button></div>
 </section>;
}
function frictionFieldLabel(path,locale,t){return path==='aspirations.notYetTrue'?frictionCopy(locale).evidenceNeeded:reviewFieldLabel(path,locale,t);}
function copyEvidenceLabel(locale){return {en:'View excerpt',es:'Ver extracto',ar:'عرض المقتطف'}[locale]||'View excerpt';}
function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function StrategyCopilot({assist,claim,claims,decisions,messages,locale,onOpen,onAsk,onSend,onConfirm,onFlag,busy,chatEnabled}){
 const {t}=useLocale();
 const c=frictionCopy(locale),a=assist?.claims?.find(row=>row.claim_id===claim.claim_id);
 const hard=(assist?.claims||[]).filter(row=>!/^visual\.|^voice\./.test(row.field_path)&&row.recommendation!=='accept'&&!isResolved(claims.find(x=>x.claim_id===row.claim_id)||{},decisions,messages));
 return <section className="certify-stewart certify-strategy-copilot" aria-label="Stewart"><header><h2>Stewart <small>· {simplifyCopy(locale).assistant}</small></h2><span>{c.human}</span></header><p>{c.explain}</p>
  {(a?<article className="certify-strategy-assessment" data-recommendation={a.recommendation}><h3>{c.current}</h3><p>{displayText(a.assessment[locale]||a.assessment.en,locale)}</p><strong>{c.recommendation}: {c[a.recommendation]}</strong>
   <div className="certify-assist-sources"><h4>{c.sources}</h4>{!(a.citations||[]).length&&<p className="certify-assist-empty">{c.emptyCitations}</p>}{(a.citations||[]).map((source,i)=>{const href=safeLink(source.url||source.asset_url),name=displayText(source.label,locale)||c.sources;return <div key={source.source_id||i}>{href?<a href={href} target="_blank" rel="noreferrer">{name} ↗</a>:<small>{name}</small>}{source.quote&&<details><summary>{copyEvidenceLabel(locale)}</summary><blockquote>{displayText(source.quote,locale)}</blockquote></details>}</div>;})}</div>
   <label>{c.draft}<textarea aria-label={c.draft} readOnly value={displayText(a.question[locale]||a.question.en,locale)} rows={4}/></label><div className="certify-actions"><button className="btn btn--primary" disabled={busy||!chatEnabled} onClick={()=>onSend(displayText(a.question[locale]||a.question.en,locale))}>{c.send}</button><button className="btn btn--ghost" disabled={busy} onClick={()=>onAsk(displayText(a.question[locale]||a.question.en,locale))}>{c.edit}</button></div>
   <div className="certify-actions"><button className="btn btn--ghost" disabled={busy||!!claim.open_questions} onClick={onConfirm}>{c.accept}</button><button className="btn btn--ghost" disabled={busy} onClick={onFlag}>{c.flag}</button></div>
  </article>:<p>{c.noAssist}</p>)}
  <details className="certify-strategy-summary"><summary>{c.hard} · {hard.length}</summary>{hard.length?<><p className="certify-strategy-summary-note">{c.hardSummary}</p><ul>{hard.map(row=><li key={row.claim_id}><button onClick={()=>onOpen(row.claim_id)}>{frictionFieldLabel(row.field_path,locale,t)}</button></li>)}</ul></>:<p>{c.noHard}</p>}</details>
 </section>;
}
function GraphicalEvidence({claim,sources,c}){
 if(claim.field_path==='visual.logo'){
  const ids=[...new Set([claim.value?.sourceId,...Object.values(claim.value?.variants||{}).map(v=>v?.sourceId)].filter(Boolean))];
  return <div className="certify-logo-lockups">{ids.map(id=>{const source=sources.find(s=>s.id===id);return source?.evidence_url?<React.Fragment key={id}><figure><img src={source.evidence_url} alt={c.light}/><figcaption>{c.light}</figcaption></figure><figure className="is-dark"><img src={source.evidence_url} alt={c.dark}/><figcaption>{c.dark}</figcaption></figure></React.Fragment>:null;})}</div>;
 }
 if(claim.field_path==='visual.imagery'||claim.field_path==='visual.references')return <div className="certify-reference-grid">{claim.evidence?.filter(e=>e.asset_url&&e.mime?.startsWith('image/')).map((e,i)=><figure key={i}><img src={e.asset_url} alt={displayText(e.label)}/><figcaption>{displayText(e.label)}</figcaption></figure>)}</div>;
 return null;
}
export function ConfirmationStep({data,autoScores,notes,onNotes,onBack,onSubmit,busy,ready,error}){
 const {locale}=useLocale(),c=frictionCopy(locale),sc=simplifyCopy(locale);
 return <section className="certify-simple-confirm" dir={locale==='ar'?'rtl':'ltr'} aria-label={c.confirmation}>
  <div className="eyebrow">Certify · {displayText(data.job.brand?.name,locale)} · {c.version} {data.job.bio.version}</div>
  <h1>{c.confirmation}</h1><p>{sc.intro}</p>
  <section aria-label={sc.measured} className="certify-measured"><h2>{sc.measured}</h2>{autoScores.map(row=><div key={row.id}><span>{row.id==='C1'?sc.coverage:sc.grounding}</span><strong>{row.score} / 4</strong></div>)}</section>
  <label>{sc.notes}<textarea aria-label={sc.notes} maxLength={1000} rows={3} value={displayText(notes,locale)} onChange={e=>onNotes(e.target.value)}/></label>
  {!ready&&<p role="status">{sc.blocked}</p>}{error&&<p role="alert">{displayText(error,locale)}</p>}
  <div className="certify-actions"><button className="btn btn--primary" disabled={busy||!ready} onClick={onSubmit}>{c.certify}</button><button className="btn btn--ghost" disabled={busy} onClick={onBack}>{sc.back}</button></div>
 </section>;
}
export function FrictionCertifyReview({data,thread={enabled:false,messages:[]},onReload,onSubmit,onBack}){
 const {job,certify,sources=[],rubric}=data,{locale,t}=useLocale(),c=frictionCopy(locale),sc=simplifyCopy(locale),copy=reviewCopy(locale),ct=text=>displayText(reviewText(text,locale),locale),label=path=>path==='aspirations.notYetTrue'?c.evidenceNeeded:reviewFieldLabel(path,locale,t);
 const claims=React.useMemo(()=>orderForDirector(certify.claims),[certify.claims]);
 const leadReview=job.status==='pending_lead_review'&&data.you?.roles?.includes('lead_steward')&&data.you.id!==job.assigned_to;
 const [outcome,setOutcome]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[showThread,setShowThread]=React.useState(false),[announcement,setAnnouncement]=React.useState('');
 const terminal=leadReview&&!outcome?null:terminalReview(job,outcome);
 const progress=useReviewProgress({job,reviewerId:data.you?.id,claims,enabled:!terminal});
 const {decisions,notes,question}=progress.draft,mode=progress.draft.mode;
 const patch=reviewPatch(claims,decisions),working={...job.bio.payload,...Object.fromEntries(Object.entries(patch).map(([section,values])=>[section,{...job.bio.payload[section],...values}]))};
 useBrandFonts(working.visual?.type||[],job.brand_id);
 const selected=claims.find(row=>row.claim_id===progress.draft.active_id)||claims[0];
 const face=working.visual?.type?.find(f=>/display|both/i.test(f.kind||''))||working.visual?.type?.[0];
 const extraRefs=(working.visual?.references||[]).map(ref=>{const source=sources.find(s=>s.id===ref.sourceId);return source?.evidence_url?{label:source.src,asset_url:source.evidence_url,mime:source.signals?.mime||'image/png',first_party:true}:null;}).filter(Boolean);
 const claim=selected?{...selected,fontFamily:face?.sourceId?`BrandFont-${face.sourceId}`:face?.family,evidence:[...(selected.evidence||[]),...(selected.field_path==='visual.imagery'?extraRefs:[])]}:null;
 const gate=reviewGate({claims,decisions,payload:working,logoRights:certify.logoRights,messages:thread.messages});
 const autoScores=evaluateCertification({autoSignals:scoreBioBreakdown(working,{logoRights:certify.logoRights}),rubricConfig:rubric}).breakdown.filter(row=>row.source==='auto');
 const measuredReady=autoScores.every(row=>!row.gateFailed),unresolved=claims.filter(row=>!isResolved(row,decisions,thread.messages));
 const open=id=>progress.update({active_id:id,mode:'review'});
 function decide(state,value){const next={...decisions,[claim.claim_id]:{state,evidence_token:claim.evidence_token,...(state==='fixed'?{value}:{})}};progress.update({decisions:next,active_id:nextUnresolved(claims,next,thread.messages,claim.claim_id),mode:'review'});setAnnouncement(state==='flagged'?c.flagged:`${label(claim.field_path)} · ${copy.confirm}`);}
 const confirm=()=>decide(decisions[claim.claim_id]?.state==='fixed'?'fixed':'confirmed',decisions[claim.claim_id]?.value);
 const ask=draft=>progress.update({mode:'ask',question:displayText(typeof draft==='string'?draft:`${copy.ask}: ${label(claim.field_path)}?`,locale)});
 async function send(draft=question){if(busy)return;setBusy(true);setError('');try{if(!thread.enabled)throw Error(copy.unavailable);await sendQuestionNow(thread,claim.field_path,displayText(draft,locale));setShowThread(true);decide('asked');setAnnouncement(copy.sent);await onReload?.();}catch(e){setError(displayText(e.message,locale));}finally{setBusy(false);}}
 async function submit(){if(!gate.ready||!measuredReady||busy)return;setBusy(true);setError('');try{if(!await progress.flush())throw Error(c.savedBlocked);const result=await onSubmit({...(leadReview?{leadApprove:true,leadNotes:notes||null}:{reviewMode:'simplified',decision:'approve'}),bioPatch:Object.keys(patch).length?patch:undefined,notes:notes||null,claimReview:{bio_version:certify.bio_version,decisions}});setOutcome(result);await onReload?.();}catch(e){setError(displayText(e.message,locale));}finally{setBusy(false);}}
 React.useEffect(()=>{if(progress.closed&&!terminal)onReload?.();},[progress.closed,progress.jobStatus,terminal]);
 if(progress.closed&&!terminal)return <div role="status">{c.loading}</div>;
 if(terminal)return <ReviewDone data={data} outcome={outcome} decisions={decisions} onBack={onBack}/>;
 if(!claim)return <p>{ct('No claims available for review.')}</p>;
 const blocked=busy||!progress.ready||progress.phase==='conflict';
 const saveState=<div className="certify-save-state" role="status">{progress.phase==='loading'?c.loading:progress.phase==='saving'?c.saving:progress.phase==='saved'?c.save:progress.phase==='conflict'?c.conflict:c.offline}{['offline','conflict'].includes(progress.phase)&&<button className="btn btn--ghost btn--sm" onClick={progress.phase==='conflict'?progress.useServer:progress.retry}>{progress.phase==='conflict'?c.useSaved:c.retry}</button>}{progress.invalidated.length>0&&<p>{c.stale}</p>}</div>;
 if(mode==='confirm')return <>{saveState}<ConfirmationStep data={data} autoScores={autoScores} notes={notes} onNotes={notes=>progress.update({notes})} onBack={()=>progress.update({mode:'review'})} onSubmit={submit} busy={blocked} ready={gate.ready&&measuredReady} error={error}/></>;
 return <section className="certify-view certify-view--ux certify-friction certify-simplify" dir={locale==='ar'?'rtl':'ltr'}>
  <header className="certify-header"><button className="btn btn--ghost" onClick={onBack}>{c.back}</button><strong>Certify · {displayText(job.brand?.name,locale)} · {c.version} {certify.bio_version}</strong><button className="btn btn--ghost" onClick={onReload} disabled={busy}>{ct('Refresh evidence')}</button></header>
  {saveState}<div className="certify-workspace">
   <nav className="certify-queue" aria-label={c.focus}><h2>{c.focus}</h2><p>{c.help}</p>{['visual','production','strategy'].map(group=>{const rows=claims.filter(row=>reviewGroup(row)===group),contents=<>{rows.map(row=><button disabled={blocked} key={row.claim_id} data-claim-id={row.claim_id} aria-current={row.claim_id===claim.claim_id?'step':undefined} className={row.claim_id===claim.claim_id?'is-active':''} onClick={()=>open(row.claim_id)}><strong>{label(row.field_path)}</strong><span>{isResolved(row,decisions,thread.messages)?'✓':decisions[row.claim_id]?.state==='flagged'?'!':claimState(row,decisions[row.claim_id],thread.messages)==='asked'?'?':'○'}</span></button>)}</>;return group==='strategy'?<details key={group}><summary>{c.strategy} · {rows.filter(row=>!isResolved(row,decisions,thread.messages)).length}</summary>{contents}</details>:<div key={group}><h3>{c[group]}</h3>{contents}</div>;})}</nav>
   <main className="certify-review-main"><div className="certify-progress"><span>{c[reviewGroup(claim)]}</span><span>{claims.length-unresolved.length} / {claims.length} {c.resolved}</span></div><article className="certify-claim-card" data-active-claim={claim.claim_id}><header><h1>{label(claim.field_path)}</h1><SectionExplanation path={claim.field_path} locale={locale}/></header><div className="certify-claim-value">{claim.field_path!=='visual.logo'&&<ClaimValue claim={claim} value={decisions[claim.claim_id]?.state==='fixed'?decisions[claim.claim_id].value:claim.value} sources={sources}/>}<GraphicalEvidence claim={claim} sources={sources} c={c}/></div><ClaimEvidence claim={claim}/>
    {mode==='fix'?<FixEditor key={claim.claim_id} claim={claim} sources={sources} onSave={value=>decide('fixed',value)} onCancel={()=>progress.update({mode:'review'})}/>:mode==='ask'?<div className="certify-question-popover" role="dialog" aria-label={copy.ask}><label>{c.draft}<textarea aria-label={c.draft} maxLength={4000} value={displayText(question,locale)} onChange={e=>progress.update({question:e.target.value})}/></label><button className="btn btn--primary" disabled={blocked||!question.trim()} onClick={()=>send()}>{c.send}</button><button className="btn btn--ghost" onClick={()=>progress.update({mode:'review'})}>{copy.cancel}</button></div>:<div className="certify-actions"><button className="btn btn--primary" disabled={blocked||!!claim.open_questions} onClick={confirm}>{copy.confirm}</button><button className="btn btn--ghost" disabled={blocked||leadReview} onClick={()=>progress.update({mode:'fix'})}>{copy.fix}</button><button className="btn btn--ghost" disabled={blocked} onClick={()=>ask()}>{copy.ask}</button></div>}
   </article></main>
   <aside className="certify-support"><StrategyCopilot assist={data.copilot?.strategyAssist} claim={claim} claims={claims} decisions={decisions} messages={thread.messages} locale={locale} onOpen={open} onAsk={ask} onSend={send} onConfirm={confirm} onFlag={()=>decide('flagged')} busy={blocked} chatEnabled={thread.enabled}/><section className="certify-client-chat"><button className="btn btn--ghost" onClick={()=>setShowThread(!showThread)}>{copy.openChat}</button>{showThread&&(thread.enabled?<ClientThread thread={thread} sources={sources} fields={[{field:claim.field_path,label:label(claim.field_path)}]}/>:<p>{copy.unavailable}</p>)}</section></aside>
  </div><footer className="certify-final-bar"><div><strong>Brand Core</strong><span>{unresolved.length} {c.left}</span></div><button className="btn btn--primary" disabled={!reviewConfirmationAvailable({unresolved,busy:blocked})} onClick={()=>progress.update({mode:'confirm'})}>{c.confirmation}</button></footer>
  <div className="certify-announcement" aria-live="polite">{announcement}</div>{error&&<p role="alert" className="certify-friction-error">{displayText(error,locale)}</p>}
 </section>;
}
