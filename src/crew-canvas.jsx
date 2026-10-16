import {canInspectDelivery} from '../shared/grouped-deliverables.js';
import {deliveryCopy} from './locales/grouped-deliverables-copy.js';
import React from 'react';
import { useLocale } from './lib/i18n.js';
import { apiFetch } from './lib/supabase-browser.js';
import { requestedCrew, crewRoles, crewDeliverables, crewCopy } from './lib/crew-canvas.js';
import './crew-canvas.css';

function Artifact({item,type,onSelect,onComponentSelect,selected,copy}) {
 const box=React.useRef(null),frame=React.useRef(null),[scale,setScale]=React.useState(.3),[emailHeight,setEmailHeight]=React.useState(650);
 const measureEmail=React.useCallback(()=>{
  const document=frame.current?.contentDocument;
  if(type!=='email_sequence'||!document?.body)return;
  // The body's natural size can shrink on a wider card; root.scrollHeight
  // includes the current iframe viewport and would keep an obsolete height.
  const height=Math.max(320,Math.ceil(Math.max(document.body.scrollHeight,document.body.getBoundingClientRect().height)));
  setEmailHeight(current=>current===height?current:height);
 },[type]);
 React.useEffect(()=>{const observer=new ResizeObserver(entries=>{setScale(entries[0].contentRect.width/1080);measureEmail();});if(box.current)observer.observe(box.current);return()=>observer.disconnect();},[measureEmail]);
 const onEmailLoad=()=>{measureEmail();const document=frame.current?.contentDocument;document?.fonts?.ready.then(measureEmail).catch(()=>{});};
 return <article className={`crew-artifact${selected?' crew-artifact--selected':''}`}>
  <button className="crew-artifact__heading" onClick={onSelect}><span>{copy.artifact} {item.index+1}</span><span>{copy.edit} ↗</span></button>
  {type==='email_sequence'&&<div className="crew-envelope"><strong>{item.copy?.subject}</strong><p>{item.copy?.preheader}</p></div>}
  <div ref={box} className={type==='social_post'?'crew-social':'crew-email'}>
   <iframe ref={frame} title={`${copy[type]} ${item.index+1}`} sandbox={type==='email_sequence'?'allow-same-origin':''} onLoad={type==='email_sequence'?onEmailLoad:undefined} srcDoc={item.html} style={type==='social_post'?{width:1080,height:1350,transform:`scale(${scale})`,transformOrigin:'top left'}:{height:emailHeight}}/>
   {type==='social_post'&&<button className="crew-artifact__select" aria-label={`${copy.edit} ${copy.image}`} onClick={()=>onComponentSelect('image')}/>}
  </div>
  {type==='social_post'&&<button className="crew-caption" onClick={()=>onComponentSelect('caption')}>{item.copy?.caption}</button>}
 </article>;
}

export function CrewCanvas({context,onClear,go}) {
 const {locale}=useLocale(),c=crewCopy(locale),dc=deliveryCopy(locale),inspect=canInspectDelivery(window.useSession?.());
 const [type,setType]=React.useState(requestedCrew(context)||'social_post');
 const [heroes,setHeroes]=React.useState(true),[task,setTask]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [selected,setSelected]=React.useState(null),[component,setComponent]=React.useState(null),[value,setValue]=React.useState(''),[feedback,setFeedback]=React.useState('');
 const [count,setCount]=React.useState(Math.min(3,Math.max(1,context.deliveryPlan?.deliverableGroups?.[0]?.count||3)));
 const [enabled,setEnabled]=React.useState(null);
 const brandId=context.brandId;
 const key=`brandos.crew.${brandId}.${context.ts||context.sourceDraftId||'canvas'}`;
 React.useEffect(()=>{let stop=false;apiFetch('/api/tasks/enabled').then(r=>r.json()).then(j=>{if(!stop)setEnabled(j.enabled&&j.crew_canvas);}).catch(()=>{if(!stop)setEnabled(false);});return()=>{stop=true;};},[]);
 React.useEffect(()=>{let stop=false,timer;const id=task?.id||context.taskId||sessionStorage.getItem(key);if(!id)return;const poll=async()=>{try{const r=await apiFetch(`/api/tasks/${id}`);if(!r.ok)throw new Error();const j=await r.json();if(stop)return;setTask(j);setType(j.type);setHeroes(!!j.heroes);if(j.status==='running')timer=setTimeout(poll,1500);}catch{if(!stop)setError(c.error);}};poll();return()=>{stop=true;clearTimeout(timer);};},[task?.id,key,c.error]);
 const deliverables=crewDeliverables(task),roles=crewRoles(task?.type||type,task?task.heroes:heroes),running=task?.status==='running';
 const active=deliverables.find(it=>it.index===selected)||deliverables[0];
 const fields=type==='social_post'?['caption','overlay_line','cta','image']:['subject','preheader','headline','body_blocks','cta.label','cta.url',...(heroes?['image']:[])];
 const read=(item,field)=>field==='image'?item.image?.asset_url||'':field==='body_blocks'?(item.copy?.body_blocks||[]).join('\n\n'):field.split('.').reduce((obj,k)=>obj?.[k],item.copy)||'';
 async function run(){if(busy||running)return;setBusy(true);setError('');try{const r=await apiFetch('/api/tasks',{method:'POST',body:JSON.stringify({brandId,type,brief:context.composedBrief||context.sharpenedBrief||context.rawBrief,count,heroes:type==='email_sequence'&&heroes})});const j=await r.json();if(!r.ok)throw new Error(j.code==='FOUNDATION_INCOMPLETE'||j.code==='BIO_NOT_CERTIFIED'?j.error:c.failed);sessionStorage.setItem(key,j.id);setTask({id:j.id,type,heroes,status:'running',stage:j.stage,items:[]});}catch(e){setError(e.message||c.failed);}finally{setBusy(false);}}
 async function change(action){if(!active||!component||busy)return;setBusy(true);setNotice(c.redo);setError('');try{const r=await apiFetch(`/api/tasks/${task.id}/items/${active.index}/component`,{method:'POST',body:JSON.stringify({component,action,value,feedback})});const j=await r.json();if(!r.ok)throw new Error();if(j.item.status!=='ready'){setError(c.failed);setNotice('');return;}setTask(old=>({...old,items:old.items.map(it=>it.index===active.index?j.item:it)}));setComponent(null);setNotice(c.saved);}catch{setError(c.error);setNotice('');}finally{setBusy(false);}}
 async function retryRender(){if(busy)return;setBusy(true);setError('');setNotice(c.redo);try{const items=[...(task?.items||[])];for(const item of items.filter(it=>it.can_retry_render)){const r=await apiFetch(`/api/tasks/${task.id}/items/${item.index}/component`,{method:'POST',body:JSON.stringify({component:'composition',action:'regenerate'})});const j=await r.json();if(!r.ok)throw new Error();items[item.index]=j.item;}setTask(old=>({...old,items,status:items.every(it=>['ready','approved'].includes(it.status))?'ready':'flagged'}));setNotice(c.saved);}catch{setNotice('');setError(c.error);}finally{setBusy(false);}}
 function download(){if(!active)return;const url=URL.createObjectURL(new Blob([active.html],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download=`${type}-${active.index+1}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="crew-canvas" dir={locale==='ar'?'rtl':undefined}>
  <header className="crew-header"><div><span className="eyebrow">{c.canvas} · Brand Core</span><h1>{context.title||c[type]}</h1><p>{c.intro}</p></div><button className="btn btn--ghost" onClick={()=>{onClear();go('brandolph');}}>{c.back}</button></header>
  <div className="crew-layout"><main className="crew-main">
   <details className="crew-brief"><summary>{c.brief}</summary><p>{context.composedBrief||context.sharpenedBrief||context.rawBrief}</p></details>
   {!task&&<section className="crew-setup"><h2>{c.choose}</h2><div className="crew-types">{['social_post','email_sequence'].map(id=><button className={type===id?'active':''} key={id} onClick={()=>setType(id)}>{id==='social_post'?'▧':'✉'} {c[id]}</button>)}</div><div className="crew-controls"><label>{c.count} <select value={count} onChange={e=>setCount(Number(e.target.value))}>{[1,2,3].map(n=><option key={n}>{n}</option>)}</select></label>{type==='email_sequence'&&<label><input type="checkbox" checked={heroes} onChange={e=>setHeroes(e.target.checked)}/>{c.heroes}</label>}<button className="btn btn--primary" disabled={busy||enabled!==true} onClick={run}>{busy?c.running:c.run}</button></div>{enabled===false&&<p role="alert">{c.unavailable}</p>}</section>}
   {inspect&&<details className="gd-production"><summary>{dc.made}</summary><section className="crew-production" aria-label={c.progress}><div className="crew-production__title"><h2>{c.crew}</h2><span>{running?c.running:deliverables.length?c.ready:''}</span></div><ol>{roles.map((role,i)=><li key={role}><span>{i+1}</span>{c[role]}</li>)}</ol></section></details>}
   {running&&<div role="status" className="crew-wait">{task.stage==='Fixing'?c.redo:c.checking}</div>}
   {!!(error||notice)&&<div role={error?'alert':'status'} className="crew-notice">{error||notice}{error&&!task&&<button className="btn btn--ghost btn--sm" onClick={run}>{c.retry}</button>}</div>}
   {!deliverables.length&&<div className="crew-empty"><span aria-hidden="true">✦</span><p>{task?.status==='failed'||task?.status==='flagged'?c.failed:c.waiting}</p><small>{c.safe}</small>{task&&['flagged','failed'].includes(task.status)&&<button className="btn btn--primary" disabled={busy} onClick={(task.items||[]).some(it=>it.can_retry_render)?retryRender:run}>{(task.items||[]).some(it=>it.can_retry_render)?c.renderRetry:c.retry}</button>}</div>}
   <div className={`crew-artifacts crew-artifacts--${type}`}>{deliverables.map(item=><Artifact key={item.index} item={item} type={type} selected={active?.index===item.index} copy={c} onComponentSelect={field=>{setSelected(item.index);setComponent(field);setValue(read(item,field));setFeedback('');setNotice('');}} onSelect={()=>{setSelected(item.index);setComponent(null);}}/>)}</div>
  </main><aside className="crew-rail"><h2>{c.project}</h2>{!deliverables.length?<p className="crew-muted">{c.none}</p>:deliverables.map(item=><button className="crew-delivery-link" key={item.index} onClick={()=>{setSelected(item.index);setComponent(null);}}>{type==='social_post'?'▧':'✉'} {c[type]} {item.index+1}<span>↗</span></button>)}
   {active&&<section className="crew-inspector"><h3>{c.edit}</h3><p className="crew-muted">{c.artifact} {active.index+1}</p>{fields.map(field=><button className={`crew-component${component===field?' active':''}`} disabled={busy} key={field} onClick={()=>{setComponent(field);setValue(read(active,field));setFeedback('');setNotice('');}}><strong>{c[field]}</strong><span>{field==='image'?c.replace:String(read(active,field)).slice(0,100)}</span></button>)}<button className="btn btn--ghost btn--sm" onClick={download}>{c.download}</button></section>}
   {component&&<form className="crew-editor" onSubmit={e=>{e.preventDefault();change('replace');}}><h3>{c[component]}</h3><label>{c.value}{component==='image'?<input required type="url" value={value} onChange={e=>setValue(e.target.value)} disabled={busy}/>:<textarea rows={5} required value={value} onChange={e=>setValue(e.target.value)} disabled={busy}/>}</label><button className="btn btn--primary btn--sm" disabled={busy||!value.trim()}>{c.save}</button><label>{c.feedback}<textarea rows={3} value={feedback} placeholder={c.feedbackHint} onChange={e=>setFeedback(e.target.value)} disabled={busy}/></label><button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={()=>change('regenerate')}>{c.regenerate}</button><button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={()=>setComponent(null)}>{c.cancel}</button></form>}
  </aside></div>
 </div>;
}
