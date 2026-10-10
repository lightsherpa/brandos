import {ct,useCanvasCopy} from './copy.js';
import {fmtNumber,fmtDate} from '../lib/i18n.js';
import EmailPreview from '../email-preview.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {Dialog,PanelHeader} from '../design-system/primitives.jsx';
export {Dialog} from '../design-system/primitives.jsx';
import {useCanvas} from './CanvasProvider.jsx';
import {canConnect} from './document.js';
import {request,askBrandolph} from './api.js';
import {pickedVersion,versionsFor,outputText,outputImages,workflowActions,runStatusLabel,tierLabel,workflowLabel} from './view-model.js';
const Icon=props=>window.Icon?<window.Icon {...props}/>:null;
export function Inspector({node,onClose,onReview,onRun,onDuplicate,onVideo,onConnect,go}) {
  useCanvasCopy();
  const c=useCanvas(),{run,output}=pickedVersion(node,c.runs),[estimates,setEstimates]=useState(null),[estimateError,setEstimateError]=useState(null);
  useEffect(()=>{
    setEstimates(null);setEstimateError(null);if(node.type!=='specialist')return;
    let active=true;
    const timer=setTimeout(()=>c.flush().then(()=>request(`/api/canvases/${c.canvas.id}/estimates?nodeId=${node.id}`)).then(d=>{if(active){setEstimates(d.estimates);setEstimateError(d.unavailable?.[node.settings.tier]||null);}}).catch(e=>{if(active)setEstimateError(e.message);}),300);
    return()=>{active=false;clearTimeout(timer);};
  },[node.id,node.settings,c.flush,c.canvas.id]);
  const updateSettings=patch=>c.command({type:'update',id:node.id,patch:{settings:{...node.settings,...patch},stale:!!output}});
  const incoming=c.document.edges.filter(e=>e.to===node.id),outgoing=c.document.edges.filter(e=>e.from===node.id);
  return <aside className="cvs-panel"><PanelHeader title={ct("Inspector")} onClose={onClose}/><div className="cvs-panel-content">
    <label className="cvs-field">{ct("Name")}<input maxLength={160} value={node.title} disabled={!c.canWrite} onChange={e=>c.command({type:'update',id:node.id,patch:{title:e.target.value}})}/></label>
    {node.type==='bio'?<><h3>{ct("Brand intelligence")}</h3>{c.bio?<><p>BIO v{c.bio.version} · {c.bio.cert_kind || 'certified'}</p><p>{ct("Certified")} {c.bio.certified_at?fmtDate(c.bio.certified_at):ct('Unavailable')}</p></>:<p>{ct("This brand needs a certified BIO before specialists can run.")}</p>}<button className="btn btn--ghost" onClick={()=>go('discovery')}>{ct("Open BIO")}</button></>:node.type==='brief'?<><h3>{ct("Brief")}</h3><p className="cvs-tension">{c.brief.payload?.tension}</p><p>{c.brief.payload?.sharpenedBrief || c.brief.payload?.request}</p></>:<>
      <fieldset className="cvs-tiers" disabled={!c.canWrite}><legend>{ct("Quality tier")}</legend>{[['auto',ct("Auto"),ct("Use the configured specialist route")],['premium',ct("Premium"),ct("For detailed creative work")],['balanced',ct("Balanced"),ct("For most deliverables")],['fast',ct("Fast"),ct("For drafts and volume")]].map(([value,label,description])=><label key={value} data-selected={node.settings.tier===value}><input type="radio" name={`tier-${node.id}`} value={value} disabled={['image','video'].includes(node.outputType)&&estimates?.[value]===null} checked={node.settings.tier===value} onChange={()=>updateSettings({tier:value})}/><span><strong>{label}</strong><small>{description}</small></span><span className="cvs-tier-credit">{estimates?.[value]!=null?`${fmtNumber(estimates[value])} ${ct("credits")}`:''}</span></label>)}</fieldset>
      {['image','video'].includes(node.outputType)&&c.mediaProfiles.some(p=>p.modality===node.outputType)&&<label className="cvs-field">{ct("Media profile")}<select value={node.settings.mediaRoute||''} onChange={e=>{const profile=c.mediaProfiles.find(p=>p.id===e.target.value);updateSettings({mediaRoute:profile?.id,mediaSettings:profile?.settings||{}});}}><option value="">{ct("Workspace default")}</option>{c.mediaProfiles.filter(p=>p.modality===node.outputType).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
      {estimateError&&<p className="cvs-muted">{estimateError}</p>}
      {node.specialistId==='a13'&&c.emailHtml&&<label className="cvs-field">{ct("Output format")}<select disabled={!c.canWrite} value={node.settings.deliverableSpec?.type==='email_html'?'email_html':'text'} onChange={e=>updateSettings({deliverableSpec:e.target.value==='email_html'?{type:'email_html',count:1}:null})}><option value="text">{ct("Text")}</option><option value="email_html">{ct("HTML email")}</option></select></label>}
      {node.outputType==='text'&&node.settings.deliverableSpec&&node.settings.deliverableSpec.type!=='email_html'&&<label className="cvs-field">{ct("Deliverable count")}<input type="number" min={1} max={30} value={node.settings.deliverableSpec.count} disabled={!c.canWrite} onChange={e=>{const count=Number(e.target.value);if(Number.isInteger(count)&&count>=1&&count<=30)updateSettings({deliverableSpec:{...node.settings.deliverableSpec,count}});}}/></label>}
      <label className="cvs-field">{ct("Revision note")}<textarea rows={4} maxLength={4000} value={node.settings.revisionFeedback||''} disabled={!c.canWrite} placeholder={ct("What should the next run change?")} onChange={e=>updateSettings({revisionFeedback:e.target.value})}/></label>
      <button className="btn btn--primary cvs-full" disabled={!c.canRun||c.runs.some(r=>r.canvas_node_id===node.id&&['queued','running'].includes(r.status))||['running','reconciling'].includes(c.busy[node.id]?.phase)} onClick={onRun}>{ct("Run ·")} {estimates?.[node.settings.tier]!=null?`≈ ${fmtNumber(estimates[node.settings.tier])} ${ct("credits")}`:ct("review credits")}</button>
      {output&&<button className="btn btn--ghost cvs-full" onClick={onReview}>{ct("Open versions and review")}</button>}
      {c.canWrite&&<button className="btn btn--ghost cvs-full" onClick={onDuplicate}>{ct("Duplicate specialist")}</button>}{node.outputType==='image'&&c.canWrite&&c.mediaProfiles.some(p=>p.modality==='video')&&<button className="btn btn--ghost cvs-full" onClick={onVideo}>{ct("Create video node")}</button>}
    </>}
    <h3>{ct("Inputs")}</h3>{node.type==='specialist'&&<p className="cvs-muted">{ct("Certified BIO and the brief are included in every run.")}</p>}{incoming.map(e=><div className="cvs-connection" key={e.id}><span>{c.document.nodes.find(n=>n.id===e.from)?.title}</span>{c.canWrite&&<button aria-label={ct("Disconnect input")} onClick={()=>c.command({type:'disconnect',id:e.id})}><Icon name="close" size={12}/></button>}</div>)}
    {node.type==='specialist'&&c.canWrite&&<label className="cvs-field">{ct("Connect from")}<select aria-label={ct("Connect from")} value="" onChange={e=>{if(e.target.value)onConnect(e.target.value,node.id);}}><option value="">{ct("Choose an input…")}</option>{c.document.nodes.filter(n=>!canConnect(c.document,n.id,node.id)).map(n=><option value={n.id} key={n.id}>{n.title}</option>)}</select></label>}
    <h3>{ct("Outputs")}</h3>{outgoing.map(e=><div className="cvs-connection" key={e.id}><span>{c.document.nodes.find(n=>n.id===e.to)?.title}</span>{c.canWrite&&<button aria-label={ct("Disconnect output")} onClick={()=>c.command({type:'disconnect',id:e.id})}><Icon name="close" size={12}/></button>}</div>)}
    {c.canWrite&&<label className="cvs-field">{ct("Connect to")}<select aria-label={ct("Connect to")} value="" onChange={e=>{if(e.target.value)onConnect(node.id,e.target.value);}}><option value="">{ct("Choose a downstream node…")}</option>{c.document.nodes.filter(n=>!canConnect(c.document,node.id,n.id)).map(n=><option value={n.id} key={n.id}>{n.title}</option>)}</select></label>}
    {['image','video'].includes(node.outputType)&&<p className="cvs-muted">{ct("Media references require an approved, stored image. Runs use durable jobs and must fit the workspace budget.")}</p>}
    {run&&<><h3>{ct("Provenance")}</h3><p>BIO v{run.bio_version} · {ct("Specialist")} · {ct("Specification")} v{fmtNumber(run.spec_version)}</p>{run.credits!=null&&<p>{fmtNumber(run.credits)} {ct("credits")}</p>}{run.latency_ms!=null&&<p>{fmtNumber(run.latency_ms/1000,{maximumFractionDigits:1})} {ct("seconds")}</p>}</>}
  </div></aside>;
}
export function Review({node,onClose,restoreFocusTo}) {
  useCanvasCopy();
  const c=useCanvas(),versions=versionsFor(node,c.runs),[localRunId,setLocalRunId]=useState(node?.pickedRunId||versions.at(-1)?.id),[outputId,setOutputId]=useState(node?.pickedOutputId),[editing,setEditing]=useState(false),[text,setText]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(null),[confirmAction,setConfirmAction]=useState(null);
  const run=versions.find(r=>r.id===localRunId)||versions.at(-1),output=run?.outputs?.find(o=>o.id===outputId)||run?.outputs?.[0],images=outputImages(output);
  if(!node)return null;
  const useVersion=()=>{if(!run||!output)return;c.command({type:'update',id:node.id,patch:{pickedRunId:run.id,pickedOutputId:output.id,stale:false}});c.setNotice(ct("Selected output will be used in the next downstream run."));};
  const act=async action=>{
    if(busy)return;
    setBusy(true);setError(null);
    try{await request(`/api/outputs/${output.id}/workflow`,{action,reason});await c.reloadRuns();setConfirmAction(null);setReason('');}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const save=async()=>{if(busy)return;setBusy(true);setError(null);try{await request(`/api/outputs/${output.id}`,{text},'PATCH');await c.reloadRuns();if(node.pickedOutputId===output.id)c.command({type:"update",id:node.id,patch:{pickedRunId:node.pickedRunId,pickedOutputId:output.id}});setEditing(false);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <Dialog label={node.title} onClose={onClose} restoreFocusTo={restoreFocusTo} wide><div className="cvs-review">
    <nav className="cvs-version-rail" aria-label={ct("Versions")}><h3>{ct("Versions")}</h3>{versions.map((r,i)=><button key={r.id} data-active={r.id===run?.id} onClick={()=>{setLocalRunId(r.id);setOutputId(r.outputs?.[0]?.id);setEditing(false);setError(null);setConfirmAction(null);}}><strong>{ct("Version")} {fmtNumber(i+1)}</strong><span>{tierLabel(r.tier) || ct("Historical run")} · {runStatusLabel(r.status)}</span><small>{r.started_at?fmtDate(r.started_at,{dateStyle:"medium",timeStyle:"short"}):''}</small></button>)}</nav>
    <div className={`cvs-review-content${images.length?' cvs-review-image':''}`}>
      {error&&<p role="alert" className="cvs-error">{error}</p>}
      {editing?<><textarea className="cvs-edit-output" aria-label={ct("Edit output")} value={text} onChange={e=>setText(e.target.value)}/><div className="cvs-review-edit-actions"><button className="btn btn--primary" disabled={busy} onClick={save}>{ct("Save changes")}</button><button className="btn btn--ghost" onClick={()=>setEditing(false)}>{ct("Cancel")}</button></div></>:output?.kind==='email_html'||output?.body?.kind==='email_html'?<EmailPreview outputId={output.id} email={output.body}/>:output?.kind==='video'&&images.length?<video controls src={images[0]}/>:images.length?images.map((url,i)=><img src={url} key={url} alt={ct("{name}, output {count}",{name:node.title,count:fmtNumber(i+1)})}/>):output?<pre>{outputText(output)}</pre>:<p>{node.type==='bio'?ct("Open the BIO from the inspector to review certification."):node.type==='brief'?c.brief.payload?.sharpenedBrief||c.brief.payload?.request:ct("No completed output for this version.")}</p>}
    </div>
    <aside className="cvs-review-meta">
      {run&&<><h3>{ct("Provenance")}</h3><dl><dt>BIO</dt><dd>v{run.bio_version}</dd><dt>{ct("Specialist")}</dt><dd>{window.CI_AGENTS?.find(a=>a.id===run.specialist_id)?.name||run.specialist_id}</dd><dt>{ct("Specification")}</dt><dd>v{run.spec_version}</dd>{run.tier&&<><dt>{ct("Tier")}</dt><dd>{tierLabel(run.tier)}</dd></>}{run.credits!=null&&<><dt>{ct("Credits")}</dt><dd>{fmtNumber(run.credits)}</dd></>}{run.latency_ms!=null&&<><dt>{ct("Duration")}</dt><dd>{fmtNumber(run.latency_ms/1000,{maximumFractionDigits:1})}s</dd></>}<dt>{ct("Created")}</dt><dd>{run.started_at?fmtDate(run.started_at,{dateStyle:"medium",timeStyle:"short"}):ct("Unavailable")}</dd></dl>{!run.canvas_node_id&&<p className="cvs-muted">{ct("Historical run. Exact upstream inputs were not recorded.")}</p>}</>}
      {run?.outputs?.length>1&&<label className="cvs-field">{ct("Output")}<select value={output?.id||''} onChange={e=>{setOutputId(e.target.value);setEditing(false);}}>{run.outputs.map((o,i)=><option key={o.id} value={o.id}>{ct("Output")} {fmtNumber(i+1)}</option>)}</select></label>}
      {output&&<><h3>{ct("Quality gate")}</h3><p>{output.status==='flagged'?ct("Flagged by QA"):output.status==='approved'?ct("Passed QA"):ct("QA pending")}</p>{output.qa_results?.map(q=><p key={q.id}>{q.evidence}</p>)}<p>{ct("Review:")} {workflowLabel(output.workflow_status||'draft')}</p>
        {c.canWrite&&run.status==='completed'&&<button className="btn btn--primary cvs-full" onClick={useVersion} disabled={node.pickedRunId===run.id&&node.pickedOutputId===output.id&&!node.stale}>{ct("Use this output")}</button>}
        {workflowActions(output,c.permissions,c.userId).map(([action,label])=><button key={action} className="btn btn--ghost cvs-full" disabled={busy} onClick={()=>{if(action.endsWith('_changes'))setConfirmAction(action);else act(action);}}>{label}</button>)}
        {confirmAction&&<><label className="cvs-field">{ct("Requested changes")}<textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} minLength={3}/></label><button className="btn btn--primary cvs-full" disabled={busy||reason.trim().length<3} onClick={()=>act(confirmAction)}>{ct("Send change request")}</button></>}
        {c.permissions.includes('output.write')&&output.workflow_status==='draft'&&!images.length&&<button className="btn btn--ghost cvs-full" onClick={()=>{setText(outputText(output));setEditing(true);}}>{ct("Edit text")}</button>}
        <button className="btn btn--ghost cvs-full" onClick={()=>navigator.clipboard.writeText(outputText(output)).then(()=>c.setNotice(ct("Output copied"))).catch(()=>setError(ct("Could not copy the output.")))}>{ct("Copy text")}</button>
        {images.length>0&&<a href={images[0]} target="_blank" rel="noopener noreferrer" className="btn btn--ghost cvs-full">{ct(output.kind==='video'?"Open original video":"Open original image")}</a>}
        {output.body?.workflow_notes?.length>0&&<><h3>{ct("Steward notes")}</h3>{output.body.workflow_notes.map((n,i)=><p key={i}>{n.reason}</p>)}</>}
      </>}
    </aside>
  </div></Dialog>;
}
export function BrandolphPanel({onClose,onView,onQuote}) {
  useCanvasCopy();
  const c=useCanvas(),[messages,setMessages]=useState([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[proposal,setProposal]=useState(null),[applied,setApplied]=useState(false),[error,setError]=useState(null),[clock,setClock]=useState(Date.now()),lock=useRef(false),scroll=useRef(null);
  const selected=c.document.nodes.find(n=>n.id===c.selectedId);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(`canvas-chat:${c.userId}:${c.canvas.id}`));if(Array.isArray(saved))setMessages(saved.slice(-20));}catch{}},[c.canvas.id,c.userId]);
  useEffect(()=>{try{sessionStorage.setItem(`canvas-chat:${c.userId}:${c.canvas.id}`,JSON.stringify(messages.slice(-20)));}catch{}scroll.current?.scrollIntoView({block:'nearest'});},[messages,c.canvas.id,c.userId]);
  const ask=async(e)=>{
    e.preventDefault();if(lock.current||input.trim().length<1)return;lock.current=true;setBusy(true);setError(null);
    const message={role:'user',content:input.trim()},next=[...messages,message];setInput('');setMessages([...next,{role:'assistant',content:''}]);
    try{await askBrandolph(c.canvas.brand_id,next.slice(-20),(event,data)=>{if(event==='token')setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:(m.at(-1)?.content||'')+data.text}]);if(event==='error')throw new Error(ct("Brandolph could not complete the reply. Please try again."));},{canvasId:c.canvas.id,nodeId:selected?.id});}catch(e){setError(ct("Brandolph could not complete the reply. Please try again."));}finally{lock.current=false;setBusy(false);}
  };
  const propose=async()=>{
    if(lock.current||input.trim().length<3||!c.canWrite)return;lock.current=true;setBusy(true);setError(null);setApplied(false);
    try{await c.flush();const {proposal}=await request(`/api/canvases/${c.canvas.id}/proposals`,{prompt:input.trim()});setProposal(proposal);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
  };
  const apply=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError(null);
    try{await c.flush();const data=await request(`/api/canvases/${c.canvas.id}/proposals/${proposal.id}/apply`,{});c.hydrate(data.canvas);setApplied(true);c.setNotice(ct("Specialists added. Review credits before generation."));}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
  };
  return <aside className="cvs-panel cvs-brandolph"><PanelHeader title="Brandolph" onClose={onClose}/><div className="cvs-chat-scroll">
    {!messages.length&&<div className="cvs-chat-intro">{window.BrandolphAvatar&&<window.BrandolphAvatar size={34}/>}<p>{ct("Ask about the brief or selected output. Describe new work to propose a crew.")}</p></div>}
    {messages.map((m,i)=><div className={`cvs-chat-message cvs-chat-${m.role}`} key={i}><span>{m.role==='user'?ct("You"):'Brandolph'}</span><p>{m.content||ct("Thinking…")}</p></div>)}
    {c.runs.length>0&&<details className="cvs-run-log"><summary>{ct("Run history ·")} {c.runs.length}</summary><ol>{c.runs.slice(-20).map(run=><li key={run.id}><span>{c.document.nodes.find(n=>n.id===run.canvas_node_id)?.title || window.CI_AGENTS?.find(a=>a.id===run.specialist_id)?.name || run.specialist_id}</span><small>{runStatusLabel(run.status)}{run.status==='running'&&run.started_at?` · ${Math.max(0,Math.floor((clock-Date.parse(run.started_at))/1000))}s`:run.latency_ms!=null?` · ${fmtNumber(run.latency_ms/1000,{maximumFractionDigits:1})}s`:''}{run.credits!=null?` · ${fmtNumber(run.credits)} cr`:''}</small></li>)}</ol></details>}
    {proposal&&<div className="cvs-proposal"><h3>{applied?ct("Crew added"):ct("Proposed crew")}</h3><p>{proposal.summary}</p><ul>{proposal.titles.map((title,i)=><li key={i}>{title}</li>)}</ul>{!applied?<><button className="btn btn--primary" disabled={busy} onClick={apply}>{ct("Add nodes")}</button><button className="btn btn--ghost" onClick={()=>setProposal(null)}>{ct("Dismiss")}</button><p className="cvs-muted">{ct("Adding nodes does not start generation.")}</p></>:<><button className="btn btn--ghost" onClick={()=>onView(proposal.nodeIds)}>{ct("View")} {proposal.nodeIds.length} {ct("nodes")}</button><button className="btn btn--primary" disabled={!c.canRun||busy} onClick={()=>onQuote(proposal.nodeIds)}>{ct("Review credits and run")}</button></>}</div>}
    {error&&<p role="alert" className="cvs-error">{error}</p>}<div ref={scroll}/>
  </div><form className="cvs-chat-composer" onSubmit={ask}>{selected&&<div className="cvs-selection-chip">{ct("Selected:")} {selected.title}</div>}<label className="cvs-field"><span className="cvs-sr-only">{ct("Ask Brandolph")}</span><textarea rows={3} value={input} maxLength={4000} onChange={e=>setInput(e.target.value)} placeholder={ct("Ask about this work…")}/></label><div><button className="btn btn--primary" disabled={busy||!input.trim()} type="submit">{busy?ct("Working…"):ct("Send")}</button>{c.canWrite&&<button className="btn btn--ghost" type="button" disabled={busy||input.trim().length<3} onClick={propose}>{ct("Propose crew")}</button>}</div></form></aside>;
}
