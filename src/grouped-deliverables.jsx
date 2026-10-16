import {deliveryArchiveName} from '../shared/delivery-filenames.js';
import {canEnterCertify} from './lib/certify-routing.js';
import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {deliveryDocument,groupDeliverables} from '../shared/grouped-deliverables.js';
import {deliveryCopy} from './locales/grouped-deliverables-copy.js';
import {groupedDeliveryGraph} from './lib/grouped-delivery-canvas.js';
import './grouped-deliverables.css';
const ready=piece=>piece.complete&&['review','delivered'].includes(piece.status);
export function runsFromCanvas(nodes=[]) {
 return nodes.filter(n=>n.kind==='specialist').map(n=>({id:n.done?.runId||n.id,specialist_id:n.specId,status:n.state==='failed'?'failed':n.state==='running'?'running':n.state==='queued'?'queued':'completed',credits:n.done?.credits_debited,
  outputs:n.done?.output||(!['running','queued'].includes(n.state)&&(n.outputText||n.assetUrl))?[{id:n.done?.outputId,kind:n.done?.output?.kind||'copy',status:n.done?.output?.status||'needs_review',body:n.done?.output||{text:n.outputText,asset_url:n.assetUrl}}]:[]}));
}
export function DeliveryBoard({brief={},deliverables=[],canInspect=false,onRun,running=false,finished=false,onRefresh,go,Canvas,fetcher=apiFetch,embedded=false,productionTools,onOpenArtifact,canOpenArtifact,onOpenSource,helper,toolbarExtra,exportName}) {
 const {locale}=useLocale(),c=deliveryCopy(locale),[opened,setOpened]=React.useState(null),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(''),[error,setError]=React.useState('');
 const [expanded,setExpanded]=React.useState(false);
 const closeRef=React.useRef(null),originRef=React.useRef(null);
 const active=deliverables.find(p=>p.id===opened);
 React.useEffect(()=>{setExpanded(false);if(opened)closeRef.current?.focus();else originRef.current?.focus();},[opened]);
 const name=p=>`${c[p.type]||c.legacy}${deliverables.filter(d=>d.type===p.type).length>1?` ${p.index+1}`:''}`;
 async function download(piece){setBusy(true);setError('');try{
  if(!brief.id)throw Error();
  const query=new URLSearchParams({locale});if(piece)query.set('delivery',piece.id);const r=await fetcher(`/api/deliveries/${encodeURIComponent(brief.id)}/download?${query}`);if(!r.ok)throw Error();
  const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=deliveryArchiveName(brief,piece,locale,deliverables);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch{setError(c.failedAction);}finally{setBusy(false);}}
 async function approve(piece){setBusy(true);setError('');try{const r=await fetcher(`/api/deliveries/${encodeURIComponent(brief.id)}/${piece.id}/approve`,{method:'POST'});if(!r.ok)throw Error();setNotice(c.approvalSaved);await onRefresh?.();}catch{setError(c.failedAction);await onRefresh?.();}finally{setBusy(false);}}
 async function share(){try{await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/canvas/${encodeURIComponent(brief.id)}`);setNotice(c.copied);}catch{setError(c.failedAction);}}
 function action(piece){return <button className="btn btn--primary" disabled={busy||!brief.id||!ready(piece)} onClick={()=>piece.canApprove?approve(piece):download(piece)}>{piece.canApprove?c.approve:c.download}</button>;}
 const allReady=deliverables.length>0&&deliverables.every(ready);
 const graph=React.useMemo(()=>groupedDeliveryGraph(brief,deliverables,c),[brief.title,deliverables,c]);
 const source=opened==='bio'||opened==='brief';
 const openPiece=(piece,element)=>{originRef.current=element||document.activeElement;setOpened(piece.id);setError('');setNotice('');};
 const card=piece=><article className="gd-card gd-node-card" data-deliverable-card={piece.type}>
  <div className="gd-card__top"><span className={`gd-status gd-status--${piece.status}`}>{c[piece.status]}</span><span>{piece.credits??0} {c.credits}</span></div>
  <h2>{name(piece)}</h2>
  <div className="gd-card__preview">{ready(piece)&&(piece.html||piece.type==='email')?<div className="gd-html-thumb"><iframe title={`${name(piece)} · ${c.preview}`} sandbox="" tabIndex={-1} referrerPolicy="no-referrer" srcDoc={piece.html||deliveryDocument(piece,{title:name(piece),lang:locale})}/></div>:piece.assetUrl?<img src={piece.assetUrl} alt={name(piece)} referrerPolicy="no-referrer"/>:<span>{piece.status==='attention'?c.unavailable:c.preparing}</span>}</div>
  {piece.type==='social_post'&&piece.text&&!piece.html&&<p className="gd-caption-thumb">{piece.text}</p>}
  <button className="btn btn--ghost" onPointerDown={e=>e.stopPropagation()} onClick={e=>openPiece(piece,e.currentTarget)}>{c.open} <span aria-hidden="true">↗</span></button>
 </article>;
 const renderNode=node=>node.piece?card(node.piece):<article className={`gd-source gd-source--${node.id}`}>
  <p className="eyebrow">{node.id==='brief'?'Brandolph':node.title}</p>
  <h2>{node.title}</h2>
  {node.id==='delivery'?<p>{deliverables.filter(ready).length} / {deliverables.length} · {c.finished}</p>:<p>{node.id==='bio'?c.foundation:c.briefContext}</p>}
  <button className="btn btn--ghost" onPointerDown={e=>e.stopPropagation()} onClick={e=>{originRef.current=e.currentTarget;if(node.id==='delivery')document.getElementById('gd-delivery')?.scrollIntoView({behavior:'smooth'});else if(onOpenSource)onOpenSource(node.id);else setOpened(node.id);}}>{node.id==='delivery'?c.delivery:c.view}</button>
 </article>;
 return <section className="gd-page" dir={locale==='ar'?'rtl':'ltr'}>
  {!embedded&&<header className="gd-heading"><div><p className="eyebrow">{c.canvas}</p><h1>{brief.title||c.brief}</h1><p>{c.intro}</p></div>{go&&<button className="btn btn--ghost" onClick={()=>go('briefs')}>{c.back}</button>}</header>}
  {!opened&&(error||notice)&&<p role={error?'alert':'status'}>{error||notice}</p>}
  <div className="gd-canvas">{Canvas&&<Canvas nodeData={graph.nodes} edges={graph.edges} renderNode={renderNode} onNodeClick={node=>{if(node.piece)openPiece(node.piece);else if(node.id==='delivery')document.getElementById('gd-delivery')?.scrollIntoView({behavior:'smooth'});else if(onOpenSource)onOpenSource(node.id);else setOpened(node.id);}} helper={helper} toolbarExtra={toolbarExtra} initialFit height="max(500px, calc(100vh - 215px))" exportName={exportName||brief.id||'deliverables'} />}</div>
  {!deliverables.length&&<p role="status">{c.empty}</p>}
  {onRun&&!finished&&!embedded&&<button className="btn btn--primary" disabled={running} onClick={onRun}>{running?c.working:c.start}</button>}
  <section id="gd-delivery" className="gd-delivery"><div><p className="eyebrow">{c.delivery}</p><h2>{c.finished}</h2></div><ul>{deliverables.filter(ready).map(piece=><li key={piece.id}><span>{name(piece)}</span><span className={`gd-status gd-status--${piece.status}`}>{c[piece.status]}</span></li>)}</ul>{!deliverables.some(ready)&&<p>{c.empty}</p>}{!allReady&&<p>{c.deliveryPending}</p>}<div className="gd-actions"><button className="btn btn--primary" disabled={!allReady||busy||!brief.id} onClick={()=>download()}>{c.downloadAll}</button><button className="btn btn--ghost" disabled={!brief.id} onClick={share}>{c.share}</button></div></section>
  {(active||source)&&<div className="gd-overlay" onKeyDown={event=>{if(event.key==='Escape')setOpened(null);if(event.key==='Tab'){const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled),summary,a[href]')];const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}><section className={`gd-detail${expanded?' gd-detail--expanded':''}`} role="dialog" aria-modal="true" aria-labelledby="gd-detail-title"><header><div>{active&&<p className={`gd-status gd-status--${active.status}`}>{c[active.status]}</p>}<h2 id="gd-detail-title">{active?name(active):opened==='bio'?'Brand Core':c.brief}</h2></div><div className="gd-actions">{active&&action(active)}{active&&<button className="btn btn--ghost" onClick={()=>setExpanded(v=>!v)}>{expanded?c.restore:c.expand}</button>}<button ref={closeRef} className="btn btn--ghost" onClick={()=>setOpened(null)}>{c.close}</button></div></header>
   {(error||notice)&&<p role={error?'alert':'status'}>{error||notice}</p>}
   {source?<div className="gd-piece"><h3>{opened==='brief'?brief.title:'Brand Core'}</h3><p>{opened==='brief'?c.briefContext:c.foundation}</p></div>:<>
   {!ready(active)&&<p className="gd-warning" role="status">{c.incomplete}</p>}
   {active.html?<iframe title={c.preview} sandbox="" referrerPolicy="no-referrer" srcDoc={active.html}/>:active.type==='email'?<iframe title={c.preview} sandbox="" referrerPolicy="no-referrer" srcDoc={deliveryDocument(active,{title:name(active),lang:locale})}/>:<div className="gd-piece">{!active.assetUrl&&['social_post','hero_kv'].includes(active.type)&&<p className="gd-missing">{c.missingImage}</p>}{active.assetUrl&&<img src={active.assetUrl} alt={name(active)} referrerPolicy="no-referrer"/>}{active.text?<p>{active.text}</p>:<p>{c.unavailable}</p>}</div>}
   {onOpenArtifact&&(!canOpenArtifact||canOpenArtifact(active))&&<button className="btn btn--ghost" onClick={()=>{setOpened(null);onOpenArtifact(active);}}>{c.reviewPiece}</button>}
   {canInspect&&(active.production||productionTools)&&<details className="gd-production"><summary>{c.made}</summary><ul>{(active.production||[]).map((p,i)=><li key={i}><span>{p.agentId}</span> · <span>{p.part||c.source}</span> · <span>{p.status}</span></li>)}</ul>{productionTools?.(()=>setOpened(null),active)}</details>}
   <footer>{action(active)}</footer></>}
  </section></div>}
 </section>;
}
export function SavedDeliveryCanvas({briefId,go,Canvas,fetcher=apiFetch,...surfaceProps}) {
 const {locale}=useLocale(),c=deliveryCopy(locale),[data,setData]=React.useState(null),[error,setError]=React.useState(false);
 const reload=React.useCallback(async()=>{const [id,query='']=briefId.split('?');const response=await fetcher(`/api/deliveries/${encodeURIComponent(id)}?${new URLSearchParams(query)}`);if(!response.ok)throw Error();return response.json();},[briefId,fetcher]);
 React.useEffect(()=>{let alive=true;setData(null);setError(false);const tick=async()=>{try{const value=await reload();if(alive){setData(value);setError(false);}}catch{if(alive)setError(true);}};tick();const timer=setInterval(tick,15000);return()=>{alive=false;clearInterval(timer);};},[reload]);
 const refresh=async()=>{try{setData(await reload());setError(false);}catch{setError(true);}};
 if(error&&!data)return <section className="gd-page" role="alert"><p>{c.error}</p><button className="btn btn--primary" onClick={refresh}>{c.retry}</button></section>;
 if(!data)return <p className="gd-page" role="status">{c.loading}</p>;
 return <>{error&&<p role="alert">{c.error} <button className="btn btn--ghost" onClick={refresh}>{c.retry}</button></p>}<DeliveryBoard {...data} {...surfaceProps} Canvas={Canvas} go={go} onRefresh={refresh}/></>;
}
export function LiveDeliveryCanvas({context,nodes,briefId,running,completed,onRun,go,Canvas,...surfaceProps}) {
 const session=window.useSession?.(),inspect=session?.scope==='platform'||canEnterCertify(session);
 const deliverables=groupDeliverables({runs:runsFromCanvas(nodes),plan:context.deliveryPlan,expectedSpecialists:context.specialistIds,creditsByAgent:Object.fromEntries((window.CI_AGENTS||[]).map(a=>[a.id,a.cr])),finished:completed,internal:inspect});
 if(completed&&briefId)return <SavedDeliveryCanvas {...surfaceProps} briefId={briefId} Canvas={Canvas} go={go}/>;
 return <DeliveryBoard {...surfaceProps} Canvas={Canvas} brief={{id:briefId,title:context.title||context.rawBrief}} deliverables={deliverables} canInspect={inspect} running={running} finished={completed} onRun={onRun} go={go}/>;
}
