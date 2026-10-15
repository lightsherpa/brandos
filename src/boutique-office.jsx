import React,{useEffect,useMemo,useRef,useState} from 'react';
import {studioEvents,studioPosition} from './lib/studio-state.js';
import {agencyAvatarSource} from './lib/agency-avatars.js';
import {GeneratedAgencyScene} from './generated-agency-scene.jsx';
import {generatedOfficeRoute} from './lib/generated-office-layout.js';
import assets from './lib/agency-office-assets.json';
import {OfficeCustomizer} from './office-customizer.jsx';
import {emptyCustomization,readOfficeCustomization,officeStorageKey,composeOfficePieces,moveOfficePiece} from './lib/office-customization.js';
import {OFFICE_STATIONS} from './lib/generated-office-layout.js';
import './boutique-office.css';
export function BoutiqueOffice({crew,selectedId,onSelect,onBrief,reduced,copy,scope="preview"}) {
 const previous=useRef(null),timers=useRef([]),currentCrew=useRef(crew);currentCrew.current=crew;
 const [movement,setMovement]=useState(null),[eventText,setEventText]=useState('');
 const [config,setConfig]=useState(()=>{try{return readOfficeCustomization(window.localStorage,scope);}catch{return emptyCustomization();}});
 const [editing,setEditing]=useState(false),[selectedPiece,setSelectedPiece]=useState(''),[saveStatus,setSaveStatus]=useState('Saved on this browser');
 const history=useRef([]),lastEdit=useRef(null),configRef=useRef(config);configRef.current=config;
 const pieces=useMemo(()=>composeOfficePieces(config,assets),[config]);
 const piecesRef=useRef(pieces);piecesRef.current=pieces;
 const update=(next,group)=>{
  const now=Date.now();
  if(!group||lastEdit.current?.group!==group||now-lastEdit.current.time>500)history.current=[...history.current.slice(-29),configRef.current];
  lastEdit.current={group,time:now};configRef.current=next;setConfig(next);
 };
 const move=(id,x,y)=>{const piece=piecesRef.current.find(p=>p.id===id);if(piece)update(moveOfficePiece(configRef.current,piece,x,y,assets,piecesRef.current),'move-'+id);};
 useEffect(()=>{setSaveStatus('Saving…');const timer=setTimeout(()=>{try{window.localStorage.setItem(officeStorageKey(scope),JSON.stringify(config));setSaveStatus('Saved on this browser');}catch{setSaveStatus("We couldn't save in this browser");}},400);return()=>clearTimeout(timer);},[config,scope]);
 const positionFor=(agent,current)=>{
  const base=studioPosition(agent,current),station=OFFICE_STATIONS.find(s=>s.id===agent.room);
  if(station){const desk=piecesRef.current.find(p=>p.id===station.id+'-desk');if(desk)return [base[0]+desk.x-station.x,base[1]+desk.y-station.y];}
  return base;
 };
 const add=(prop,parent)=>{
  const id='custom-'+crypto.randomUUID(),count=configRef.current.extras.length;if(count>=80)return;
  const piece={...prop,id,x:46+(count%4)*4,y:74+Math.floor(count%8/4)*4};
  if(prop.kind==='wall'){piece.x=30;piece.y=20;}
  if(prop.kind==='surface'){piece.parent=parent;piece.u=.5;piece.v=.15;piece.ratio=prop.width;}
  update({...configRef.current,extras:[...configRef.current.extras,piece]});setSelectedPiece(id);
 };
 const remove=id=>{const current=configRef.current;update({...current,hidden:[...current.hidden,id],extras:current.extras.filter(p=>p.id!==id&&p.parent!==id)});setSelectedPiece('');};
 const scale=(id,value)=>{const piece=piecesRef.current.find(p=>p.id===id);if(piece)update({...configRef.current,overrides:{...configRef.current.overrides,[id]:{x:piece.x,y:piece.y,scale:value}}},'scale-'+id);};
 const undo=()=>{const before=history.current.pop();if(before){lastEdit.current=null;configRef.current=before;setConfig(before);}};

 const signature=crew.map(a=>a.node.id+':'+a.state+':'+(a.node.inputFrom||'')).join('|');
 useEffect(()=>{
  const current=currentCrew.current;
  const events=studioEvents(previous.current,current);
  previous.current=new Map(current.map(a=>[a.node.id,a.state]));
  if(!events.length){if(current.every(a=>a.state==="queued")){timers.current.forEach(clearTimeout);timers.current=[];setMovement(null);setEventText("");}return;}
  timers.current.forEach(clearTimeout);timers.current=[];
  const event=events.find(e=>e.kind==='handoff')||events.find(e=>e.kind==='assignment')||events[0];
  const sender=current.find(a=>a.node.id===event.from),recipient=current.find(a=>a.node.id===event.to);
  setEventText(`${sender?.name||'Brandolph'} → ${recipient?.name||copy.outputs}`);
  const actor=event.kind==='handoff'?event.from:event.kind==='assignment'?event.to:event.from;
  const agent=current.find(a=>a.node.id===actor);
  if(!agent||reduced||matchMedia('(prefers-reduced-motion: reduce)').matches){setMovement(null);return;}
  const origin=positionFor(agent,current);
  const destination=event.to==='gallery'?[87,53]:event.kind==='assignment'?[19,24]:positionFor(recipient||agent,current);
  const route=generatedOfficeRoute(origin,destination);
  const points=[...route,...route.slice(0,-1).reverse(),origin];
  points.forEach((point,index)=>timers.current.push(setTimeout(()=>setMovement({id:actor,point}),index*800)));
  timers.current.push(setTimeout(()=>setMovement(null),points.length*800));
 },[signature,reduced,copy.outputs]);
 useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
 const brandolphState=crew.some(a=>a.state==='running')?'running':crew.some(a=>a.state==='failed')?'failed':crew.some(a=>a.state==='flagged')?'flagged':crew.length&&crew.every(a=>a.state==='done')?'done':'queued';
 const chars=[{node:{id:'brandolph'},name:'Brandolph',state:brandolphState},...crew];
 return <div className="bs-office"><div className="bs-room-options"><span>{copy.office}</span><label>Desks <select aria-label="Desk finish" value={config.deskStyle} onChange={event=>update({...config,deskStyle:event.target.value})}><option value="oak">Warm oak</option><option value="cream">Cream</option></select></label><label><input type="checkbox" checked={config.showArt} onChange={event=>update({...config,showArt:event.target.checked})}/> Artwork</label><button aria-pressed={editing} onClick={()=>setEditing(!editing)}>{editing?'Done customizing':'Customize office'}</button></div>
 {editing&&<OfficeCustomizer pieces={pieces} selectedPiece={selectedPiece} selectedScale={config.overrides[selectedPiece]?.scale||1} onSelect={setSelectedPiece} onAdd={add} onRemove={remove} onMove={move} onScale={scale} onUndo={undo} onReset={()=>{update(emptyCustomization());setSelectedPiece('');}} canUndo={history.current.length>0} extraCount={config.extras.length} saveStatus={saveStatus}/>}
 <div className={`bs-stage ${editing?'is-customizing':''}`} aria-label={copy.office}>
  <GeneratedAgencyScene pieces={pieces} editing={editing} selectedPiece={selectedPiece} onPick={setSelectedPiece} onMove={move}/>
  {chars.map((a,index)=>{const moving=movement?.id===a.node.id;const position=moving?movement.point:index?positionFor(a,crew):[19,24];
   return <button key={a.node.id} className={`bs-person ${moving?'is-delivering':''} ${a.state==='running'?'is-working':''}`} style={{left:position[0]+'%',top:position[1]+'%',zIndex:Math.round(position[1])+5}} aria-pressed={selectedId===a.node.id} aria-label={`${a.name} — ${a.state==='running'?copy.running:a.state==='done'?copy.done:a.state==='flagged'?copy.flagged:a.state==='failed'?copy.failed:copy.queued}`} onClick={()=>index?onSelect(a.node.id):onBrief?.()}>
    <img className="bs-avatar" src={agencyAvatarSource(a)} alt="" draggable={false} />
    <span className="bs-caption"><strong>{a.name}</strong><small>{!index?(crew.some(a=>a.state==='running')?copy.coordinating:crew.some(a=>a.state==='failed')?copy.failed:crew.some(a=>a.state==='flagged')?copy.flagged:crew.length&&crew.every(a=>a.state==='done')?copy.complete:copy.ready):a.state==='running'?copy.running:a.state==='done'?copy.done:a.state==='flagged'?copy.flagged:a.state==='failed'?copy.failed:copy.queued}</small></span>{moving&&<span className="bs-parcel">↗</span>}
   </button>;
  })}
 </div><div className="bs-events" role="status">{eventText||copy.inspect}</div></div>;
}
