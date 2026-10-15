import React from 'react';
import {reviewComponents} from './review-output.js';
import {reviewDeskCopy} from './review-desk-copy.js';
import {apiFetch} from './supabase-browser.js';
export function ReviewOutputPreview({output,locale,editable,onSaved}) {
 const copy=reviewDeskCopy(locale),[editing,setEditing]=React.useState(null),[value,setValue]=React.useState(''),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(''),[failed,setFailed]=React.useState(false);
 React.useEffect(()=>{setEditing(null);setNotice('');setFailed(false);},[output.id]);
 async function save(){
  setBusy(true);setNotice('');setFailed(false);
  try {
   const response=await apiFetch(`/api/outputs/${output.id}`,{method:'PATCH',body:JSON.stringify({component:{path:editing.path,value}})});
   if(!response.ok)throw new Error();
   setEditing(null);setNotice(copy.saved);await onSaved?.();
  }catch{setNotice(copy.error);setFailed(true);}finally{setBusy(false);}
 }
 const components=reviewComponents(output.body);
 return <div dir={locale==='ar'?'rtl':undefined}>
  {!components.length && <p>{copy.empty}</p>}
  {components.map((component,i)=><article key={JSON.stringify(component.path)} style={{marginBottom:18,border:'1px solid var(--c-line)',borderRadius:10,overflow:'hidden'}}>
   <header style={{padding:'9px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--c-bg)'}}><strong>{copy[component.type]} {i+1}</strong>{editable&&<button className="btn btn--ghost btn--sm" onClick={()=>{setEditing(component);setValue(component.value);setNotice('');}}>{copy.replace}</button>}</header>
   {component.type==='image'?<img src={component.value} alt={copy.image} style={{display:'block',width:'100%',maxHeight:500,objectFit:'contain'}}/>:component.type==='email'?<iframe title={`${copy.email} ${i+1}`} sandbox="" referrerPolicy="no-referrer" srcDoc={component.value} style={{width:'100%',height:520,border:0,background:'#fff'}}/>:<div style={{padding:18,whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:16,lineHeight:1.65}}>{component.value}</div>}
   {editing?.path.join('.')===component.path.join('.')&&<form onSubmit={e=>{e.preventDefault();save();}} style={{padding:14,background:'var(--c-bg)'}}><label style={{display:'block'}}>{component.type==='image'?copy.url:copy.value}{component.type==='image'?<input required type="url" value={value} onChange={e=>setValue(e.target.value)} style={{width:'100%',boxSizing:'border-box'}}/>:<textarea required rows={8} value={value} onChange={e=>setValue(e.target.value)} style={{width:'100%',boxSizing:'border-box'}}/>}</label><div style={{display:'flex',gap:8,marginTop:10}}><button disabled={busy} className="btn btn--primary btn--sm">{copy.save}</button><button disabled={busy} type="button" className="btn btn--ghost btn--sm" onClick={()=>setEditing(null)}>{copy.cancel}</button></div></form>}
  </article>)}
  {!editable&&components.length>0&&<p style={{fontSize:12,color:'var(--c-dim)'}}>{copy.locked}</p>}
  {notice&&<div role="status" style={{padding:12}}>{notice}{failed&&editing&&<button className="btn btn--ghost btn--sm" disabled={busy} onClick={save}>{copy.retry}</button>}</div>}
 </div>;
}
