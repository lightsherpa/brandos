import {ct,useCanvasCopy} from './copy.js';
import {fmtNumber,fmtDate,getDir} from '../lib/i18n.js';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {IconButton as Button} from '../design-system/primitives.jsx';
import {useCanvas} from './CanvasProvider.jsx';
import {uuid,edgeFor,canConnect,NODE_WIDTH,NODE_HEIGHT,pointInGraph,fitViewport} from './document.js';
import {request,runNode,runMediaNode,downloadDocument} from './api.js';
import {pickedVersion,versionsFor,outputText,outputImages,statusLabel,statusCode} from './view-model.js';
import {Inspector,Review,BrandolphPanel,Dialog} from './panels.jsx';
import {AgencyOffice,useOfficeCopy} from '../agency-office.jsx';
import {readWorkspaceSurface,writeWorkspaceSurface} from '../lib/workspace-surface.js';
import {canvasOfficeNodes} from './office-adapter.js';
import '../office-integration.css';
import {afterSubmissionError} from './submission-state.js';
const Icon=props=>window.Icon ? <window.Icon {...props}/> : null;
export function CanvasWorkspace({onBack,go}) {
  useCanvasCopy();
  const officeCopy=useOfficeCopy();
  const [surface,setSurface]=useState(()=>readWorkspaceSurface(window.localStorage));
  const chooseSurface=value=>{setSurface(value);writeWorkspaceSurface(window.localStorage,value);};
  const c=useCanvas(),selected=c.document.nodes.find(n=>n.id===c.selectedId);
  const [viewport,setViewport]=useState({x:40,y:40,zoom:.75}),[gesture,setGesture]=useState(null),[picker,setPicker]=useState(null),[search,setSearch]=useState(''),[menu,setMenu]=useState(null),[panel,setPanel]=useState(null),[reviewId,setReviewId]=useState(null),[approval,setApproval]=useState(null),[help,setHelp]=useState(false),[expanded,setExpanded]=useState(false),[minimap,setMinimap]=useState(true),[quoteLoading,setQuoteLoading]=useState(false);
  const root=useRef(null),stage=useRef(null),viewRef=useRef(viewport),gestureRef=useRef(null),frame=useRef(null),approvalLock=useRef(false),initialized=useRef(false),returnFocus=useRef(null);
  viewRef.current=viewport;
  const busyNodes=c.runs.filter(r=>['running','queued'].includes(r.status));
  const fit=useCallback((ids=null)=>{const box=stage.current?.getBoundingClientRect();if(box?.width>0)setViewport(fitViewport(ids?c.docRef.current.nodes.filter(n=>ids.includes(n.id)):c.docRef.current.nodes,box.width-(minimap?156:0),box.height));},[c.docRef,minimap]);
  useEffect(()=>{const box=stage.current;if(!box)return;const observer=new ResizeObserver(()=>{if(initialized.current||box.getBoundingClientRect().width===0)return;initialized.current=true;try{const saved=JSON.parse(localStorage.getItem(`canvas-view:${c.userId}:${c.canvas.id}`));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.zoom>=.15&&saved.zoom<=2)setViewport(saved);else fit();}catch{fit();}});observer.observe(box);return()=>observer.disconnect();},[fit,c.canvas.id,c.userId]);
  useEffect(()=>{if(initialized.current)fit();},[panel,expanded,minimap,fit,surface]);
  useEffect(()=>{const timer=setTimeout(()=>{try{localStorage.setItem(`canvas-view:${c.userId}:${c.canvas.id}`,JSON.stringify(viewport));}catch{}},300);return()=>clearTimeout(timer);},[viewport,c.canvas.id,c.userId]);
  useEffect(()=>{
    const el=stage.current;if(!el)return;
    const wheel=e=>{if(e.target.closest('button,input,textarea,select'))return;e.preventDefault();const v=viewRef.current,rect=el.getBoundingClientRect();const zoom=Math.max(.15,Math.min(2,v.zoom*Math.exp(-e.deltaY*.0015)));const x=e.clientX-rect.left,y=e.clientY-rect.top;setViewport({zoom,x:x-(x-v.x)*zoom/v.zoom,y:y-(y-v.y)*zoom/v.zoom});};
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[]);
  useEffect(()=>()=>{if(frame.current)cancelAnimationFrame(frame.current);},[]);
  useEffect(()=>{if(!c.notice)return;const timer=setTimeout(()=>c.setNotice(''),6000);return()=>clearTimeout(timer);},[c.notice,c.setNotice]);
  const onNodeClick=node=>{c.setSelectedId(node.id);setPanel('inspector');};
  const openPicker=(point,source=null)=>{setSearch('');setMenu(null);setPicker({point,source});};
  const graphCenter=()=>{const r=stage.current.getBoundingClientRect();return pointInGraph({x:r.left+r.width/2,y:r.top+r.height/2},r,viewRef.current);};
  const connect=(from,to)=>{
    const reason=canConnect(c.docRef.current,from,to);if(reason){c.setError(ct(reason));return;}
    c.command({type:'connect',edge:edgeFor(c.docRef.current,from,to)});
  };
  const startWire=(e,id)=>{e.stopPropagation();e.preventDefault();if(!c.canWrite)return;const point=pointInGraph({x:e.clientX,y:e.clientY},stage.current.getBoundingClientRect(),viewRef.current);const g={type:'wire',id,point};gestureRef.current=g;setGesture(g);};
  useEffect(()=>{
    const move=e=>{
      const g=gestureRef.current;if(!g)return;
      if(g.type==='wire'){g.point=pointInGraph({x:e.clientX,y:e.clientY},stage.current.getBoundingClientRect(),viewRef.current);}
      else {const dx=e.clientX-g.start.x,dy=e.clientY-g.start.y;g.moved=g.moved || Math.hypot(dx,dy)>4;if(g.type==='pan')setViewport({...g.viewport,x:g.viewport.x+dx,y:g.viewport.y+dy});else{g.x=g.node.x+dx/g.viewport.zoom;g.y=g.node.y+dy/g.viewport.zoom;}}
      if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=null;setGesture({...gestureRef.current});});
    };
    const end=e=>{
      const g=gestureRef.current;if(!g)return;
      gestureRef.current=null;setGesture(null);
      if(g.type==='node'){if(g.moved)c.command({type:'move',id:g.id,x:g.x??g.node.x,y:g.y??g.node.y});else onNodeClick(g.node);}
      if(g.type==='wire'){
        const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-canvas-node]')?.dataset.canvasNode;
        if(target)connect(g.id,target);
        else if(stage.current?.contains(document.elementFromPoint(e.clientX,e.clientY)))openPicker(g.point,g.id);
      }
    };
    const cancel=()=>{gestureRef.current=null;setGesture(null);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);};
  },[c.command]);
  const pointerDown=e=>{
    if(e.button!==0&&e.button!==1)return;
    if(e.target.closest('button,input,textarea,select,a'))return;
    root.current.focus({preventScroll:true});setMenu(null);
    const node=c.docRef.current.nodes.find(n=>n.id===e.target.closest('[data-canvas-node]')?.dataset.canvasNode);
    if(node&&e.button===0&&!c.canWrite){onNodeClick(node);return;}
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current={type:node&&e.button===0?'node':'pan',id:node?.id,node,viewport:viewRef.current,start:{x:e.clientX,y:e.clientY},moved:false};
    if(!node)c.setSelectedId(null);
  };
  const duplicate=node=>{
    if(!node||node.type!=='specialist')return;
    const {pickedRunId,pickedOutputId,legacyRunIds,...copy}=node;
    const next={...copy,id:uuid(),title:node.title.slice(0,150)+' '+ct('Copy'),x:node.x+56,y:node.y+56,stale:false};
    const brief=c.document.nodes.find(n=>n.type==='brief');c.command({type:'add',node:next,edges:[edgeFor({...c.document,nodes:[...c.document.nodes,next]},brief.id,next.id)]});c.setSelectedId(next.id);
  };
  const createVideo=node=>{const profile=c.mediaProfiles.find(p=>p.modality==='video');if(!profile){c.setError(ct("No qualified video profile is available for this workspace."));return;}const next={id:uuid(),type:'specialist',title:node.title.slice(0,140)+' '+ct('Video'),specialistId:node.specialistId,outputType:'video',x:node.x+344,y:node.y,settings:{tier:'auto',mediaRoute:profile.id,mediaSettings:profile.settings}};const doc={...c.document,nodes:[...c.document.nodes,next]},brief=doc.nodes.find(n=>n.type==='brief');c.command({type:'add',node:next,edges:[edgeFor(doc,brief.id,next.id),edgeFor(doc,node.id,next.id)]});c.setSelectedId(next.id);};
  const stepVersion=(node,delta)=>{
    const versions=versionsFor(node,c.runs).filter(r=>r.status==='completed'&&r.outputs?.length);
    const index=versions.findIndex(r=>r.id===node.pickedRunId),next=versions[index+delta];
    if(next)c.command({type:'update',id:node.id,patch:{pickedRunId:next.id,pickedOutputId:next.outputs[0].id,stale:false}});
  };
  const add=s=>{
    const node={id:uuid(),type:'specialist',title:s.name,specialistId:s.id,outputType:s.outputType,x:picker.point.x,y:picker.point.y,settings:{tier:'auto'}};
    const doc={...c.document,nodes:[...c.document.nodes,node]},brief=doc.nodes.find(n=>n.type==='brief');
    const edges=[edgeFor(doc,brief.id,node.id)];
    if(picker.source && picker.source!==brief.id){const reason=canConnect({...doc,edges:[...doc.edges,...edges]},picker.source,node.id);if(reason){c.setError(ct(reason));return;}edges.push(edgeFor(doc,picker.source,node.id));}
    c.command({type:'add',node,edges});c.setSelectedId(node.id);setPicker(null);setPanel('inspector');
  };
  const quote=async(ids)=>{
    if(!ids.length||!c.canRun||quoteLoading)return;
    if(ids.some(id=>busyNodes.some(r=>r.canvas_node_id===id)||['running','reconciling'].includes(c.busy[id]?.phase))){c.setError(ct("A selected node is already running."));return;}
    setQuoteLoading(true);c.setError(null);
    try{await c.flush();const data=await request(`/api/canvases/${c.canvas.id}/quotes`,{nodeIds:ids});setApproval({...data,titles:ids.map(id=>c.docRef.current.nodes.find(n=>n.id===id)?.title)});}catch(e){c.setError(e.message);}finally{setQuoteLoading(false);}
  };
  const execute=async()=>{
    if(approvalLock.current||!approval)return;approvalLock.current=true;const approved=approval;setApproval(null);
    try {
      for(const q of approved.quotes){
        const node=c.docRef.current.nodes.find(n=>n.id===q.node_id);if(!node)continue;
        let finished=false,failed=false,accepted=false;
        c.setBusy(b=>({...b,[node.id]:{phase:'running',text:'',stage:ct("Starting"),runId:q.id}}));
        try{
          await (q.execution==='media'?runMediaNode:runNode)(c.canvas.id,node.id,q.id,(event,data)=>{
            if(['started','token','progress','done'].includes(event))accepted=true;
            if(event==='token')c.setBusy(b=>({...b,[node.id]:{...b[node.id],text:(b[node.id]?.text||'')+data.text}}));
            if(event==='progress')c.setBusy(b=>({...b,[node.id]:{...b[node.id],stage:data.stage || ct("Generating")}}));
            if(event==='error'){failed=true;c.setError(data.code==='TEXT_RECONCILIATION_REQUIRED'?ct('This run needs operator reconciliation. Credits remain held.'):data.message);}
            if(event==='done')finished=true;
          });
          const runs=await c.reloadRuns();const run=runs.find(r=>r.id===q.id);
          if(run?.outputs?.length&&run.status==='completed'){
            c.command({type:'update',id:node.id,patch:{pickedRunId:run.id,pickedOutputId:run.outputs[0].id,stale:false}});c.setNotice(ct("{name} is ready",{name:node.title}));
          }
          c.setBusy(b=>({...b,[node.id]:{phase:run?.status==='completed'?'done':run?.status==='failed'||failed?'failed':'reconciling',runId:q.id}}));
          if(!finished&&!failed)c.setError(ct("The stream ended. Check the run status before submitting another run."));
          if(failed)break;
        }catch(e){
          c.setBusy(b=>afterSubmissionError(b,node.id,q.id,e,accepted));c.setError(e.message);await c.reloadRuns().catch(()=>{});break;
        }
      }
    }finally{approvalLock.current=false;}
  };
  useEffect(()=>{
    for(const [id,job] of Object.entries(c.busy)){
      if(!['reconciling','running'].includes(job.phase))continue;
      const run=c.runs.find(r=>r.id===job.runId);
      if(['completed','failed'].includes(run?.status)){if(run.status==='completed'&&run.outputs?.length)c.command({type:'update',id,patch:{pickedRunId:run.id,pickedOutputId:run.outputs[0].id,stale:false}});c.setBusy(b=>({...b,[id]:{...b[id],phase:run.status==='completed'?'done':'failed'}}));}
    }
  },[c.runs]);
  const review=(id)=>{if(document.activeElement!==document.body)returnFocus.current=document.activeElement;setReviewId(id);};
  const closeReview=()=>{setReviewId(null);returnFocus.current?.focus?.();};
  const keyDown=e=>{
    if(e.isComposing||e.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;
    if(e.key==='Escape'){if(!gestureRef.current&&!picker&&!menu&&!help&&!panel&&!approval)c.setSelectedId(null);gestureRef.current=null;setGesture(null);setPicker(null);setMenu(null);setHelp(false);setPanel(null);setApproval(null);return;}
    if(surface==='office'||picker||reviewId||approval||help)return;
    const mod=e.metaKey||e.ctrlKey;
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();c.command({type:e.shiftKey?'redo':'undo'});return;}
    if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate(selected);return;}
    if(mod&&e.key==='Enter'){e.preventDefault();if(selected?.type==='specialist')quote([selected.id]);return;}
    if(e.key.toLowerCase()==='n'&&!mod&&c.canWrite){e.preventDefault();openPicker(graphCenter());}
    if(e.key==='/'&&!mod){e.preventDefault();setPanel('brandolph');}
    if(e.key==='?'||(mod&&e.key==='/')){e.preventDefault();setHelp(true);}
    if(e.shiftKey&&(e.key==='!'||e.code==='Digit1')){e.preventDefault();fit();}
    if((e.key==='Backspace'||e.key==='Delete')&&selected?.type==='specialist'&&c.canWrite){e.preventDefault();c.command({type:'remove',id:selected.id});c.setSelectedId(null);}
    if((e.key===' '||e.key==='Enter')&&selected){e.preventDefault();review(selected.id);}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected&&c.canWrite){e.preventDefault();const step=e.shiftKey?40:8;c.command({type:'move',id:selected.id,x:selected.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:selected.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});}
  };
  const getPosition=n=>gesture?.type==='node'&&gesture.id===n.id&&gesture.moved?{x:gesture.x,y:gesture.y}:n;
  const path=(source,target)=>{const a=getPosition(source),b=getPosition(target);const x=a.x+NODE_WIDTH,y=a.y+NODE_HEIGHT/2,end=b.x,ey=b.y+NODE_HEIGHT/2,dx=Math.max(72,Math.abs(end-x)*.45);return `M ${x} ${y} C ${x+dx} ${y}, ${end-dx} ${ey}, ${end} ${ey}`;};
  const departments=[...new Set(c.document.nodes.filter(n=>n.type==='specialist').map(n=>window.CI_AGENTS?.find(a=>a.id===n.specialistId)?.dept).filter(Boolean))];
  const canReview=pickedVersion(selected,c.runs).output;
  return <section ref={root} className="cvs-workspace" data-workspace-surface={surface} tabIndex={0} aria-label={ct("Creative canvas")} onPointerDownCapture={e=>{const button=e.target.closest("button");if(button)returnFocus.current=button;}} onKeyDown={keyDown}>
    <header className="cvs-header">
      <Button icon="arrowLeft" label={ct("Back to briefs")} className="cvs-icon-button" onClick={async()=>{try{await c.flush();onBack();}catch(e){c.setError(e.message);}}}/>
      <h1>{c.brief.payload?.title || c.brief.title}</h1>
      <div className="cvs-departments">{departments.map(d=><span key={d}>{d}</span>)}</div>
      <span className="cvs-save" role="status">{{saved:ct("Saved"),saving:ct("Saving…"),unsaved:ct("Unsaved"),error:ct("Save failed"),conflict:ct("Save conflict")}[c.saveState]}</span>
      <button className="btn btn--ghost btn--sm" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{ct("Overview")} <Icon name="chev" size={12}/></button>
    </header>
    {expanded&&<div className="cvs-overview"><div>{c.brief.payload?.tension&&<p className="cvs-tension">{c.brief.payload.tension}</p>}<p>{c.brief.payload?.sharpenedBrief || c.brief.payload?.request || ct("No brief text available.")}</p></div>{c.brief.payload?.refusals?.length>0&&<div><h2>{ct("Hard refusals")}</h2><ul>{c.brief.payload.refusals.map((r,i)=><li key={i}>{typeof r==='string'?r:JSON.stringify(r)}</li>)}</ul></div>}</div>}
    {c.error&&<div className="cvs-error" role="alert"><span>{ct(c.error)}</span>{['error','conflict'].includes(c.saveState)&&<><button onClick={()=>downloadDocument(c.document)}>{ct("Download edits")}</button>{c.saveState==='conflict'?<button onClick={()=>request(`/api/canvases/${c.canvas.id}`).then(d=>c.hydrate(d.canvas)).catch(e=>c.setError(e.message))}>{ct("Load saved canvas")}</button>:<button onClick={()=>c.flush().catch(()=>{})}>{ct("Retry save")}</button>}</>}<Button icon="close" label={ct("Dismiss error")} onClick={()=>c.setError(null)}/></div>}
    <div className="ao-surface-switch" role="group" aria-label={officeCopy.office}>
      <button aria-pressed={surface==='office'} onClick={()=>chooseSurface('office')}>{officeCopy.office}</button>
      <button aria-pressed={surface==='canvas'} onClick={()=>chooseSurface('canvas')}>{officeCopy.canvas}</button>
    </div>
    <div className="cvs-body">
      {surface==='office'&&<div className="cvs-office">{c.runsLoaded?<AgencyOffice
        selectedNodeId={c.selectedId}
        officeScope={c.canvas.brand_id || c.brief.brand_id}
        nodeData={canvasOfficeNodes(c.document,c.runs,c.busy,c.brief)}
        onSelectionChange={item=>c.setSelectedId(item?.canvasNodeId||null)}
        onNodeClick={item=>{const node=c.document.nodes.find(n=>n.id===item?.canvasNodeId);if(!node)return;c.setSelectedId(node.id);if(item.kind==='deliverable')review(node.id);else onNodeClick(node);}}
        toolbarExtra={<>{c.canRun&&selected?.type==='specialist'&&<button className="ao-button" disabled={quoteLoading} onClick={()=>quote([selected.id])}>{ct('Quote a run')}</button>}<button className="ao-button" onClick={()=>setPanel(panel==='brandolph'?null:'brandolph')}>Brandolph</button></>}
      />:<p role="status">{ct("Loading…")}</p>}</div>}

      <div ref={stage} className="cvs-desk" dir="ltr" onPointerDown={pointerDown} onContextMenu={e=>{e.preventDefault();root.current.focus();const n=c.document.nodes.find(n=>n.id===e.target.closest('[data-canvas-node]')?.dataset.canvasNode);if(n){c.setSelectedId(n.id);setMenu({node:n,x:e.clientX,y:e.clientY});}else if(c.canWrite)openPicker(pointInGraph({x:e.clientX,y:e.clientY},stage.current.getBoundingClientRect(),viewport));}}>
        <div className="cvs-world" style={{transform:`translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`}}>
          <svg className="cvs-edges" aria-hidden="true">{c.document.edges.map(edge=>{const from=c.document.nodes.find(n=>n.id===edge.from),to=c.document.nodes.find(n=>n.id===edge.to);return from&&to?<path key={edge.id} d={path(from,to)} data-port={edge.fromPort} className={selected&&edge.to===selected.id?'cvs-edge-selected':''}/>:null;})}{gesture?.type==='wire'&&(()=>{const source=c.document.nodes.find(n=>n.id===gesture.id);return <path className="cvs-edge-selected" d={path(source,{x:gesture.point.x,y:gesture.point.y-NODE_HEIGHT/2})}/>;})()}</svg>
          {c.document.nodes.map(node=>{
            const p=getPosition(node),{run,output,versions}=pickedVersion(node,c.runs),images=outputImages(output),isSelected=node.id===c.selectedId;
            const job=c.busy[node.id],status=node.type==='bio'?(!c.bio?ct("Needs certification"):c.bio.cert_valid_until&&Date.parse(c.bio.cert_valid_until)<Date.now()?ct("Certification expired"):ct("Certified")):statusLabel(node,c.runs,job);
            return <article key={node.id} tabIndex={0} onFocus={e=>{if(e.target===e.currentTarget)c.setSelectedId(node.id);}} onDoubleClick={()=>review(node.id)} data-canvas-node={node.id} data-selected={isSelected} className="cvs-node" style={{transform:`translate(${p.x}px,${p.y}px)`}} aria-label={`${node.title}, ${status}`}>
              <div className="cvs-node-caption"><span>{node.type==='specialist'?(window.CI_AGENTS?.find(a=>a.id===node.specialistId)?.dept || node.outputType):node.type==='bio'?'BIO':'Brandolph'}</span><span data-state={statusCode(node,c.runs,job)}>{status}</span></div>
              <h2>{node.title}</h2>
              <div className="cvs-node-preview" data-unavailable-label={ct("Image unavailable")}>
                {node.type==='bio'?<><p>{ct("The source for every specialist.")}</p><p>{c.bio?`BIO v${c.bio.version} · ${c.bio.cert_kind || 'certified'}`:ct("Certify this brand’s BIO before running work.")}</p></>:node.type==='brief'?<p>{c.brief.payload?.tension || c.brief.payload?.sharpenedBrief || c.brief.payload?.request}</p>:output?.kind==='video'&&images.length?<video src={images[0]} muted preload="metadata"/>:images.length?<img src={images[0]} alt={node.title} loading="lazy" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.dataset.imageMissing='true';}}/>:job?.phase==='running'?<p>{job.text || job.stage || ct("Generating…")}</p>:output?.kind==='video'&&images[0]?<video src={images[0]} muted preload="metadata"/>:output?<p>{outputText(output)}</p>:<p className="cvs-placeholder">{node.outputType==='image'?ct("An image will appear here."):ct("The specialist’s output will appear here.")}</p>}
              </div>
              <footer><span className="cvs-provenance">{run?`BIO v${run.bio_version}`:node.type==='specialist'?node.settings.tier:ct("Certified brand context")}</span>{node.type==='specialist'&&<>
                {versions.length>0&&<div className="cvs-version-stepper" onPointerDown={e=>e.stopPropagation()}><button aria-label={ct("Previous version")} disabled={!c.canWrite||versions.findIndex(r=>r.id===node.pickedRunId)<=0} onClick={()=>stepVersion(node,-1)}>‹</button><button aria-label={ct("Review versions")} onClick={()=>review(node.id)}>{Math.max(0,versions.findIndex(r=>r.id===node.pickedRunId)+1)}/{versions.length}</button><button aria-label={ct("Next version")} disabled={!c.canWrite||versions.findIndex(r=>r.id===node.pickedRunId)>=versions.length-1} onClick={()=>stepVersion(node,1)}>›</button></div>}
                <button className="cvs-run-button" disabled={!c.canRun||busyNodes.some(r=>r.canvas_node_id===node.id)||['running','reconciling'].includes(job?.phase)||quoteLoading} onPointerDown={e=>e.stopPropagation()} onClick={()=>quote([node.id])}>{ct("Run")} <Icon name="arrow" size={14}/></button>
              </>}</footer>
              {c.canWrite&&<>{node.type!=='bio'&&<button className="cvs-port cvs-port-in" title={ct("Input")} aria-label={ct("Select {name} input",{name:node.title})} onPointerDown={e=>e.stopPropagation()} onClick={()=>{onNodeClick(node);c.setNotice(ct("Use Connect from in the inspector to choose an input."));}}/>}<button className="cvs-port cvs-port-out" data-port={node.type==='specialist'?node.outputType:node.type} title={ct("Drag to connect")} aria-label={ct("Connect from {name}",{name:node.title})} onPointerDown={e=>startWire(e,node.id)} onClick={()=>{onNodeClick(node);c.setNotice(ct("Choose a downstream node in the inspector."));}}/></>}
            </article>;
          })}
        </div>
        <nav className="cvs-dock" aria-label={ct("Canvas tools")} dir={document.documentElement.dir||'ltr'} onPointerDown={e=>e.stopPropagation()}>
          {c.canWrite&&<button className="cvs-add" onClick={()=>openPicker(graphCenter())}><Icon name="plus" size={16}/> {ct("Add specialist")}</button>}
          <Button icon="arrowLeft" label={ct("Undo")} disabled={!c.past.length||!c.canWrite} onClick={()=>c.command({type:'undo'})}/>
          <Button icon="arrowRight" label={ct("Redo")} disabled={!c.future.length||!c.canWrite} onClick={()=>c.command({type:'redo'})}/>
          <button data-active={panel==='brandolph'} onClick={()=>setPanel(panel==='brandolph'?null:'brandolph')}>Brandolph</button>
          <button data-active={minimap} onClick={()=>setMinimap(!minimap)}>{ct("Map")}</button>
          <button className="cvs-zoom" onClick={()=>fit()} title={ct("Fit canvas")}>{Math.round(viewport.zoom*100)}%</button>
          <button onClick={()=>setHelp(true)} aria-label={ct("Keyboard shortcuts")}>?</button>
        </nav>
        {minimap&&<MiniMap nodes={c.document.nodes} viewport={viewport} stage={stage} setViewport={setViewport}/>}
        {(busyNodes.length>0||Object.values(c.busy).some(b=>['running','reconciling'].includes(b.phase)))&&<div className="cvs-running" role="status">{Math.max(busyNodes.length,Object.values(c.busy).filter(b=>['running','reconciling'].includes(b.phase)).length)} {ct("run(s) active · closing this page does not cancel generation")}</div>}
        {c.notice&&<div className="cvs-toast" role="status"><span>{c.notice}</span></div>}
        <div className="cvs-mobile-list" dir={getDir()} aria-label={ct("Canvas nodes")}><div className="cvs-mobile-actions">{c.canWrite&&<button onClick={()=>openPicker(graphCenter())}>{ct("Add specialist")}</button>}<button onClick={()=>setPanel('brandolph')}>Brandolph</button></div>{c.document.nodes.map(n=><button key={n.id} onClick={()=>onNodeClick(n)}>{n.title}<span>{statusLabel(n,c.runs,c.busy[n.id])}</span></button>)}</div>
      </div>
      {panel==='inspector'&&selected&&<Inspector node={selected} onClose={()=>setPanel(null)} onReview={()=>review(selected.id)} onRun={()=>quote([selected.id])} onDuplicate={()=>duplicate(selected)} onVideo={()=>createVideo(selected)} onConnect={connect} go={go}/>}
      {panel==='brandolph'&&<BrandolphPanel onClose={()=>setPanel(null)} onView={ids=>{if(surface==='office'){c.setSelectedId(ids[0]||null);setPanel('inspector');}else fit(ids);}} onQuote={quote}/>}
    </div>
    {menu&&<Dialog restoreFocusTo={returnFocus.current} label={ct("Node actions")} onClose={()=>setMenu(null)} compact><div className="cvs-menu">{[
      [ct("Open review"),()=>review(menu.node.id),!!pickedVersion(menu.node,c.runs).output],[ct("Inspect"),()=>setPanel('inspector'),true],[ct("Ask Brandolph"),()=>setPanel('brandolph'),true],[ct("Run"),()=>quote([menu.node.id]),c.canRun&&menu.node.type==='specialist'],[ct("Duplicate"),()=>duplicate(menu.node),c.canWrite&&menu.node.type==='specialist'],[ct("Remove from canvas"),()=>{c.command({type:'remove',id:menu.node.id});c.setSelectedId(null);},c.canWrite&&menu.node.type==='specialist']
    ].filter(([, ,show])=>show).map(([label,action])=><button key={label} onClick={()=>{action();setMenu(null);}}>{label}</button>)}</div></Dialog>}
    {picker&&<Dialog restoreFocusTo={returnFocus.current} label={ct("Add a specialist")} onClose={()=>setPicker(null)}><div className="cvs-picker"><input autoFocus type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={ct("Search specialists…")} aria-label={ct("Search specialists")}/><div>{c.specialists.filter(s=>(s.name+' '+(window.CI_AGENTS?.find(a=>a.id===s.id)?.dept||'')).toLowerCase().includes(search.toLowerCase())).map(s=><button key={s.id} onClick={()=>add(s)}><span>{s.name}</span><small>{window.CI_AGENTS?.find(a=>a.id===s.id)?.dept || s.outputType}</small></button>)}</div><p>{ct("Motion and sound are coming soon.")}</p></div></Dialog>}
    {approval&&<Dialog restoreFocusTo={returnFocus.current} label={ct("Approve generation")} onClose={()=>setApproval(null)}><div className="cvs-approval"><h2>{ct(approval.quotes.length===1?"Run this specialist?":"Run these specialists?")}</h2><p>{approval.titles.join(', ')}</p><p className="cvs-quote-total">{fmtNumber(approval.total)} {ct("credits")}</p><p>{ct("Estimated total. The server checks your balance and limits again before each run. This quote expires at")} {fmtDate(approval.expiresAt,{hour:'2-digit',minute:'2-digit'})}.</p><div><button className="btn btn--primary" onClick={execute}>{ct("Approve and run")}</button><button className="btn btn--ghost" onClick={()=>setApproval(null)}>{ct("Deny")}</button></div></div></Dialog>}
    {help&&<Dialog restoreFocusTo={returnFocus.current} label={ct("Keyboard shortcuts")} onClose={()=>setHelp(false)}><dl className="cvs-shortcuts">{[['N',ct("Add specialist")],['/',ct("Ask Brandolph")],['⌘ / Ctrl + Enter',ct("Quote a run")],['Space / Enter',ct("Review selection")],['⌘ / Ctrl + D',ct("Duplicate selection")],[ct("Delete"),ct("Remove selected node")],['⌘ / Ctrl + Z',ct("Undo")],['Shift + ⌘ / Ctrl + Z',ct("Redo")],['Shift + 1',ct("Fit canvas")],[ct("Arrow keys"),ct("Move selection")],['Esc',ct("Close or cancel gesture")]].map(([key,label])=><React.Fragment key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></React.Fragment>)}</dl></Dialog>}
    {reviewId&&<Review restoreFocusTo={returnFocus.current} node={c.document.nodes.find(n=>n.id===reviewId)} onClose={closeReview}/>}
  </section>;
}
function MiniMap({nodes,viewport,stage,setViewport}) {
  const left=Math.min(...nodes.map(n=>n.x))-48,top=Math.min(...nodes.map(n=>n.y))-48,right=Math.max(...nodes.map(n=>n.x+NODE_WIDTH))+48,bottom=Math.max(...nodes.map(n=>n.y+NODE_HEIGHT))+48;
  const w=right-left,h=bottom-top,box=stage.current?.getBoundingClientRect();
  const click=e=>{const r=e.currentTarget.getBoundingClientRect();const x=left+(e.clientX-r.left)*w/r.width,y=top+(e.clientY-r.top)*h/r.height;setViewport({...viewport,x:(box?.width||800)/2-x*viewport.zoom,y:(box?.height||600)/2-y*viewport.zoom});};
  return <button className="cvs-minimap" aria-label={ct("Recenter canvas map")} onPointerDown={e=>e.stopPropagation()} onClick={click}><svg viewBox={`${left} ${top} ${w} ${h}`} preserveAspectRatio="none">{nodes.map(n=><rect key={n.id} x={n.x} y={n.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="12"/>)}{box&&<rect className="cvs-map-view" x={-viewport.x/viewport.zoom} y={-viewport.y/viewport.zoom} width={box.width/viewport.zoom} height={box.height/viewport.zoom}/>}</svg></button>;
}
