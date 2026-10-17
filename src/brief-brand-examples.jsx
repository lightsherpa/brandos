import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {deliveryCopy} from './locales/grouped-deliverables-copy.js';
import {deliveryDocument} from '../shared/grouped-deliverables.js';
import './brief-brand-examples.css';
export const briefExampleCopy=locale=>({
 en:{reference:'Photo reference · this brief only',scope:'This photo guides this brief only. It is never added to Brand Core automatically.',upload:'Attach photo',remove:'Remove',add:'Add to Brand Core',adding:'Adding…',pending:'Pending addition',saved:'Output added as a pending Brand Core example. The certified Brand Core is unchanged.',examples:'Approved work',explain:'Accepted outputs proposed as brand examples. Pending additions do not change the certified Brand Core.',open:'Open brief',error:'Could not complete this action. Try again.',busy:'Uploading…',limit:'Up to three photos, 5 MB each. PNG, JPEG or WebP.'},
 es:{reference:'Foto de referencia · solo este brief',scope:'La foto guía solo este brief. Nunca se añade automáticamente al Brand Core.',upload:'Adjuntar foto',remove:'Quitar',add:'Añadir al Brand Core',adding:'Añadiendo…',pending:'Adición pendiente',saved:'Output añadido como ejemplo pendiente. El Brand Core certificado no ha cambiado.',examples:'Trabajo aprobado',explain:'Outputs aceptados propuestos como ejemplos de marca. Las adiciones pendientes no cambian el Brand Core certificado.',open:'Abrir brief',error:'No se pudo completar la acción. Inténtalo de nuevo.',busy:'Subiendo…',limit:'Hasta tres fotos, 5 MB cada una. PNG, JPEG o WebP.'},
 ar:{reference:'صورة مرجعية · لهذا الموجز فقط',scope:'توجّه الصورة هذا الموجز فقط. لا تُضاف تلقائياً إلى Brand Core.',upload:'إرفاق صورة',remove:'إزالة',add:'إضافة إلى Brand Core',adding:'جارٍ الإضافة…',pending:'إضافة قيد المراجعة',saved:'أُضيف المخرج كمثال قيد المراجعة. لم يتغير Brand Core المعتمد.',examples:'الأعمال المعتمدة',explain:'مخرجات مقبولة مقترحة كأمثلة للعلامة. الإضافات المعلقة لا تغير Brand Core المعتمد.',open:'فتح الموجز',error:'تعذر إكمال الإجراء. حاول مجدداً.',busy:'جارٍ الرفع…',limit:'حتى ثلاث صور، 5 ميغابايت لكل صورة. PNG أو JPEG أو WebP.'},
}[locale]||briefExampleCopy('en'));
export function BriefPhotoReferences({brandId,references=[],onChange,disabled=false,onBusyChange=()=>{}}) {
 const {locale}=useLocale(),c=briefExampleCopy(locale),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const input=React.useRef(null),scope=React.useRef(brandId),alive=React.useRef(true);scope.current=brandId;
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;onBusyChange(false);};},[]);
 async function upload(file){if(!file)return;setError('');if(file.size>5*1024*1024){setError(c.limit);return;}const brand=brandId;setBusy(true);onBusyChange(true);try{const form=new FormData();form.set('brandId',brand);form.set('file',file);const r=await apiFetch('/api/briefs/references',{method:'POST',body:form}),json=await r.json();if(!r.ok)throw Error();if(alive.current&&scope.current===brand)onChange([...references,json.reference]);}catch{if(alive.current&&scope.current===brand)setError(c.error);}finally{if(alive.current){setBusy(false);onBusyChange(false);}if(input.current)input.current.value='';}}
 return <section className="brief-photos"><label>{c.reference}<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled||busy||references.length>=3||!brandId} onChange={e=>upload(e.target.files?.[0])}/></label><p>{c.scope}</p><small>{busy?c.busy:c.limit}</small><ul>{references.map(ref=><li key={ref.id}>{ref.name}<button className="btn btn--ghost btn--sm" disabled={disabled||busy} onClick={()=>onChange(references.filter(r=>r.id!==ref.id))}>{c.remove}</button></li>)}</ul>{error&&<p role="alert">{error}</p>}</section>;
}
export function AddToBrandCore({briefId,piece,fetcher=apiFetch}) {
 const {locale}=useLocale(),c=briefExampleCopy(locale),[busy,setBusy]=React.useState(false),[saved,setSaved]=React.useState(false),[error,setError]=React.useState(false);
 if(!piece?.canAddToBrandCore||piece.status!=='delivered')return null;
 async function add(){setBusy(true);setError(false);try{const r=await fetcher(`/api/deliveries/${encodeURIComponent(briefId)}/${encodeURIComponent(piece.id)}/brand-core`,{method:'POST'});if(!r.ok)throw Error();setSaved(true);}catch{setError(true);}finally{setBusy(false);}}
 return <div className="brand-example-action">{saved?<p role="status">{c.saved}</p>:<button className="btn btn--primary" disabled={busy} onClick={add}>{busy?c.adding:c.add}</button>}{error&&<p role="alert">{c.error}</p>}</div>;
}
export function BrandOutputExamples({brandId,go}) {
 const {locale}=useLocale(),c=briefExampleCopy(locale),dc=deliveryCopy(locale),[data,setData]=React.useState([]),[error,setError]=React.useState(false);
 React.useEffect(()=>{let alive=true;setData([]);setError(false);apiFetch(`/api/bios/${brandId}/examples`).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(j=>{if(alive)setData(j.examples||[]);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[brandId]);
 return <section className="brand-examples"><h2>{c.examples}</h2><p>{c.explain}</p>{error&&<p role="alert">{c.error}</p>}<div className="brand-examples__grid">{data.map(example=><article key={example.id}><h3>{dc[example.snapshot.type]||dc.legacy}</h3><p>{example.addition_status==='pending'?c.pending:dc.delivered}</p><iframe sandbox="" referrerPolicy="no-referrer" title={dc[example.snapshot.type]||dc.legacy} srcDoc={deliveryDocument(example.snapshot,{lang:locale})}/><button className="btn btn--ghost" onClick={()=>go(`canvas/${example.brief_id}`)}>{c.open}</button></article>)}</div></section>;
}

export function TaskBrandCoreAction({briefId,index,type}) {
 const [piece,setPiece]=React.useState(null);
 React.useEffect(()=>{let alive=true;setPiece(null);if(!briefId)return;const poll=async()=>{try{const r=await apiFetch(`/api/deliveries/${briefId}`);if(!r.ok)return;const j=await r.json();if(alive)setPiece(j.deliverables?.find(p=>p.index===index&&p.type===(type==='email_sequence'?'email':type))||null);}catch{}};poll();const timer=setInterval(poll,15000);return()=>{alive=false;clearInterval(timer);};},[briefId,index,type]);
 return <AddToBrandCore briefId={briefId} piece={piece}/>;
}

export function BriefReferenceGallery({briefId}) {
 const {locale}=useLocale(),c=briefExampleCopy(locale),[references,setReferences]=React.useState([]);
 React.useEffect(()=>{let alive=true;setReferences([]);if(briefId)apiFetch(`/api/briefs/${briefId}/references`).then(async r=>{if(!r.ok)return;const j=await r.json();if(alive)setReferences(j.references||[]);}).catch(()=>{});return()=>{alive=false;};},[briefId]);
 if(!references.length)return null;
 return <section className="brief-photos"><h3>{c.reference}</h3><p>{c.scope}</p><div className="brief-photo-gallery">{references.map(ref=><figure key={ref.id}><img src={ref.url} alt={ref.name} referrerPolicy="no-referrer"/><figcaption>{ref.name}</figcaption></figure>)}</div></section>;
}
