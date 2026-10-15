import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {uiFixtureEnabled} from './lib/ui-fixture.js';
import {withUploadType} from './lib/upload-type.js';
import {useBrandFonts} from './brand-fonts.jsx';
import {brandCoreInputsCopy} from './locales/brand-core-inputs-copy.js';
import {LOGO_USES,REFERENCE_TAGS,PALETTE_GROUPS,MAX_REFERENCE_BATCH,fileIssue,fontDescriptors,appendUploadedAsset,uploadMetadata} from './lib/brand-core-inputs.js';
import './brand-core-inputs.css';

export function BrandCoreInputs({brandId,payload,onSave,disabled=false,onRightsConfirmed,logoRights=[]}) {
 const {locale}=useLocale(), c=brandCoreInputsCopy[locale]||brandCoreInputsCopy.en;
 const visual=payload?.visual||{};
 const [draft,setDraft]=React.useState(visual),[editing,setEditing]=React.useState(false),[queue,setQueue]=React.useState([]),[notices,setNotices]=React.useState([]),[saving,setSaving]=React.useState(false),[images,setImages]=React.useState({}),[rights,setRights]=React.useState(false),[fontRights,setFontRights]=React.useState(false),[family,setFamily]=React.useState(''),[usage,setUsage]=React.useState('Display'),[previewRetry,setPreviewRetry]=React.useState(0),[referenceRights,setReferenceRights]=React.useState({authority:false,ownsOrLicensed:false,generationAllowed:false});
 const baseline=React.useRef(visual), savingRef=React.useRef(false), requestId=React.useRef(null),referenceBatch=React.useRef(null);
 React.useEffect(()=>{if(!editing){setDraft(visual);baseline.current=visual;}},[brandId,JSON.stringify(visual),editing]);
 const shown=editing?draft:visual,fonts=useBrandFonts(shown.type||[],brandId,previewRetry);
 const notify=(message,retry)=>setNotices(rows=>[...rows,{id:crypto.randomUUID(),message,retry}]);
 const failure=(error)=>/failed to fetch|network|load failed/i.test(error?.message||'')?c.network:error?.message||c.generic;
 const requestError=(json,status)=>Error(({TOO_LARGE:c.size,EMPTY:c.empty,EXT:c.format,MIME:c.format,SVG_UNSUPPORTED:c.format,LOGO_EXT:c.format,FONT_INVALID:c.invalidFont,LOGO_INVALID:c.invalidLogo,STALE_BIO_VERSION:c.stale,STORAGE_REJECTED:c.format}[json.code]) || (status===401?c.auth:status===403?c.permission:status>=500?c.service:json.error||c.generic));
 const readAsset=async item=>{
   if((uiFixtureEnabled||item.pendingRights)&&item.previewUrl)return item.previewUrl;
   if(!item.sourceId)return item.url||item.previewUrl||null;
   const res=await apiFetch(`/api/bios/${brandId}/sources/${item.sourceId}/url`), json=await res.json();
   if(!res.ok)throw Error(json.error||c.read);
   return json.url;
 };
 const logos=Object.values(shown.logo?.variants||{});
 if(shown.logo?.sourceId&&!logos.some(row=>row.sourceId===shown.logo.sourceId))logos.unshift(shown.logo);
 const refs=(shown.references||[]).filter(ref=>ref.status!=='superseded');
 React.useEffect(()=>{
  let alive=true;
  [...logos,...refs].forEach(item=>{if(!item.sourceId)return;readAsset(item).then(url=>{if(alive)setImages(rows=>({...rows,[item.sourceId]:url}));}).catch(()=>{});});
  return ()=>{alive=false;};
 },[brandId,JSON.stringify(shown.logo),JSON.stringify(shown.references)]);
 const updateQueue=(id,patch)=>setQueue(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));
 const addFiles=(files,kind)=>{
  if(kind==='reference'&&files.length>MAX_REFERENCE_BATCH){notify(c.batch);return;}
  const items=files.map(file=>({id:crypto.randomUUID(),file,kind,tag:kind==='logo'?'primary':'product',family:family.trim(),usage,descriptors:fontDescriptors(file.name),status:'pending'}));
  setQueue(rows=>[...rows,...items]);
 };
 const upload=async item=>{
  const issue=fileIssue(item.file,item.kind);
  if(issue){updateQueue(item.id,{status:'failed'});notify(`${item.file.name}: ${c[issue]}`,()=>upload(item));return;}
  updateQueue(item.id,{status:'uploading'});
  try{
   let source,previewUrl;
   if(uiFixtureEnabled){previewUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error(c.read));reader.readAsDataURL(item.file);});source={id:`fixture-${crypto.randomUUID()}`};}
   else{
    const form=new FormData();form.append('file',withUploadType(item.file));form.append('bucket','visual');
    for(const [key,value] of Object.entries(uploadMetadata(item)))form.append(key,String(value));
    const res=await apiFetch(`/api/bios/${brandId}/sources/upload`,{method:'POST',body:form,headers:{}}),json=await res.json().catch(()=>({}));
    if(!res.ok)throw requestError(json,res.status);source=json.source;previewUrl=json.signedUrl||json.url;
   }
   setDraft(current=>appendUploadedAsset(current,item,source,previewUrl));
   updateQueue(item.id,{status:'uploaded'});
  }catch(error){updateQueue(item.id,{status:'failed'});notify(`${item.file.name}: ${failure(error)}`,()=>upload(item));}
 };
 const edit=()=>{baseline.current=visual;setDraft(visual);setEditing(true);setQueue([]);requestId.current=crypto.randomUUID();referenceBatch.current=null;};
 const pendingRefs=(draft.references||[]).filter(row=>row.pendingRights);
 const save=async()=>{
  if(savingRef.current)return;
  if(pendingRefs.length&&!Object.values(referenceRights).every(Boolean)){notify(c.rights);return;}
  savingRef.current=true;setSaving(true);
  try{
   let currentVisual={...draft,references:baseline.current.references||[]};
   if(JSON.stringify(currentVisual)!==JSON.stringify(baseline.current))await onSave(currentVisual);
   baseline.current=currentVisual;
   if(pendingRefs.length){
    if(uiFixtureEnabled){await onSave({...draft,references:(draft.references||[]).map(({pendingRights,...ref})=>ref)});}
    else{
     // Each intake is at most ten images; prior batches stay active and in history.
     for(let start=0;start<pendingRefs.length;start+=MAX_REFERENCE_BATCH){
      const batch=pendingRefs.slice(start,start+MAX_REFERENCE_BATCH);
      if(!referenceBatch.current){const latest=await apiFetch(`/api/bios/${brandId}`),snapshot=await latest.json();if(!latest.ok)throw requestError(snapshot,latest.status);referenceBatch.current={expectedVersion:snapshot.bio?.version??snapshot.version,requestId:requestId.current};}
      const response=await apiFetch(`/api/bios/${brandId}/references/confirm`,{method:'POST',body:JSON.stringify({...referenceBatch.current,sourceIds:batch.map(ref=>ref.sourceId),rights:referenceRights})}),json=await response.json();
      if(!response.ok)throw requestError(json,response.status);
      currentVisual=json.bio?.payload?.visual||currentVisual;baseline.current=currentVisual;
      setDraft(current=>({...current,references:[...(currentVisual.references||[]),...current.references.filter(ref=>ref.pendingRights&&!batch.some(done=>done.sourceId===ref.sourceId))]}));
      requestId.current=crypto.randomUUID();referenceBatch.current=null;
     }
     await onRightsConfirmed?.();
    }
   }
   setEditing(false);setQueue([]);notify(c.saved);
  }catch(error){notify(failure(error),save);}finally{savingRef.current=false;setSaving(false);}
 };
 const picker=(kind,label,accept,blocked=false)=><label className="bci-picker">{label}<input type="file" multiple accept={accept} disabled={disabled||blocked||saving} onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';addFiles(files,kind);}}/></label>;
 const pending=(kind)=>queue.filter(row=>row.kind===kind).map(item=><div className="bci-upload" key={item.id}>
  <strong>{item.file.name}</strong>
  {kind!=='font'?<select aria-label={`${item.file.name} ${kind==='logo'?c.logo:c.references}`} value={item.tag} disabled={['uploading','uploaded'].includes(item.status)} onChange={e=>updateQueue(item.id,{tag:e.target.value})}>{(kind==='logo'?LOGO_USES:REFERENCE_TAGS).map((tag,i)=><option key={tag} value={tag}>{(kind==='logo'?c.uses:c.tags)[i]}</option>)}</select>:<><span>{item.family}</span><label>{c.weight}<select value={item.descriptors.weight} disabled={['uploading','uploaded'].includes(item.status)} onChange={e=>updateQueue(item.id,{descriptors:{...item.descriptors,weight:e.target.value}})}>{['100','200','300','400','500','600','700','800','900'].map(w=><option key={w}>{w}</option>)}</select></label><label>{c.style}<select value={item.descriptors.style} disabled={['uploading','uploaded'].includes(item.status)} onChange={e=>updateQueue(item.id,{descriptors:{...item.descriptors,style:e.target.value}})}><option value="normal">{c.normal}</option><option value="italic">{c.italic}</option></select></label></>}
  <span role="status">{c[item.status==='pending'?'pending':item.status==='uploading'?'uploading':item.status==='uploaded'?'uploaded':'failed']}</span>
  {['pending','failed'].includes(item.status)&&<><button className="btn btn--sm" onClick={()=>upload(item)}>{item.status==='failed'?c.retry:c.upload}</button><button className="btn btn--ghost btn--sm" onClick={()=>setQueue(rows=>rows.filter(row=>row.id!==item.id))}>{c.remove}</button></>}
 </div>);
 const thumb=(item,label)=><figure key={item.sourceId} className={`bci-asset ${item.use==='dark'?'bci-asset--dark':''}`}>
  {images[item.sourceId]?<img src={images[item.sourceId]} alt={item.name||item.source||label} onError={()=>setImages(rows=>({...rows,[item.sourceId]:null}))}/>:<button className="btn btn--link" title={c.read} onClick={()=>readAsset(item).then(url=>setImages(rows=>({...rows,[item.sourceId]:url}))).catch(error=>notify(failure(error),()=>readAsset(item).then(url=>setImages(rows=>({...rows,[item.sourceId]:url})))))}>{c.retry}</button>}
  <figcaption>{item.name||item.source}<span>{label}</span></figcaption>
 </figure>;
 return <section className="foundation-strip bci" dir={locale==='ar'?'rtl':'ltr'} aria-label={c.title}>
  <div className="foundation-heading"><div><span className="eyebrow">{c.title}</span><p>{c.intro}</p></div><button className="btn btn--ghost btn--sm" disabled={disabled||saving||queue.some(row=>row.status==='uploading')} onClick={editing?()=>setEditing(false):edit}>{editing?c.cancel:c.edit}</button></div>
  <div className="bci-sections">
   <article className="bci-section"><h3>{c.logo}</h3><p>{c.logoHelp}</p><div className="bci-gallery">{logos.map(item=>thumb(item,c.uses[LOGO_USES.indexOf(item.use)]||c.logo))}</div>{!editing&&logos.some(item=>item.sourceId&&!logoRights.includes(item.sourceId))&&<><label className="bci-check"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/>{c.logoRights}</label><button className="btn btn--sm" disabled={!rights||disabled} onClick={async()=>{try{for(const item of logos.filter(row=>!logoRights.includes(row.sourceId))){const res=await apiFetch(`/api/bios/${brandId}/sources/${item.sourceId}/confirm-rights`,{method:'POST',body:JSON.stringify({rightsConfirmed:true})});const json=await res.json();if(!res.ok)throw requestError(json,res.status);}await onRightsConfirmed?.();}catch(error){notify(failure(error));}}}>{c.confirmRights}</button></>}{editing&&<><label className="bci-check"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/>{c.logoRights}</label>{picker('logo',c.logo,'.png,image/png',!rights)}<small>{c.logoFormats}</small>{pending('logo')}</>}</article>
   <article className="bci-section"><h3>{c.references}</h3><p>{c.referencesHelp}</p><div className="bci-gallery">{refs.map(item=>thumb(item,c.tags[REFERENCE_TAGS.indexOf(item.tag)]||c.tags[0]))}</div>{editing&&<>{picker('reference',c.references,'.png,.jpg,.jpeg,.webp')}<small>{c.imageFormats}</small>{pending('reference')}{pendingRefs.length>0&&<fieldset><legend>{c.pendingRights}</legend>{Object.keys(referenceRights).map(key=><label className="bci-check" key={key}><input type="checkbox" checked={referenceRights[key]} onChange={e=>setReferenceRights(current=>({...current,[key]:e.target.checked}))}/>{c[key]}</label>)}</fieldset>}</>}</article>
   <article className="bci-section bci-section--wide"><h3>{c.palette}</h3><div className="bci-palette">{PALETTE_GROUPS.map((group,index)=><div key={group}><h4>{c.groups[index]}</h4>{(shown.palette||[]).map((colour,i)=>({colour,i})).filter(({colour})=>(colour.group||(PALETTE_GROUPS.includes(colour.role)?colour.role:'neutral'))===group).map(({colour,i})=><div className="bci-colour" key={i}><span style={{background:colour.hex}}/>{editing?<><input type="color" aria-label={`${c.groups[index]} ${c.hex}`} value={colour.hex} onChange={e=>setDraft(current=>({...current,palette:current.palette.map((row,n)=>n===i?{...row,hex:e.target.value}:row)}))}/><input aria-label={c.colourName} value={colour.name||''} placeholder={c.colourName} onChange={e=>setDraft(current=>({...current,palette:current.palette.map((row,n)=>n===i?{...row,name:e.target.value}:row)}))}/><button className="btn btn--link" onClick={()=>setDraft(current=>({...current,palette:current.palette.filter((_,n)=>n!==i)}))}>{c.remove}</button></>:<><strong>{colour.name}</strong><code>{colour.hex}</code></>}</div>)}{editing&&<button className="btn btn--link" onClick={()=>setDraft(current=>({...current,palette:[...(current.palette||[]),{role:group,group,name:'',hex:'#888888',roleStatus:'confirmed'}]}))}>+ {c.addColour}</button>}</div>)}</div></article>
   <article className="bci-section bci-section--wide"><h3>{c.fonts}</h3>{(shown.type||[]).map(font=>{const state=fonts[font.sourceId||font.family];return <div className="bci-font-preview" key={font.sourceId||font.family}><strong>{font.family} · {font.weight||'400'} · {font.style==='italic'?c.italic:c.normal}</strong>{state?.status==='loaded'?<p style={{'--brand-specimen-font':`"${state.family}"`,fontFamily:`"${state.family}"`,fontWeight:font.weight,fontStyle:font.style}}>{c.sample}</p>:<div><p>{state?.status==='failed'?c.fontFailed:c.fontLoading}</p>{state?.status==='failed'&&<button className="btn btn--link" onClick={()=>setPreviewRetry(value=>value+1)}>{c.retry}</button>}</div>}</div>;})}{editing&&<><h4>{c.fontPath}</h4><p>{c.fontHelp}</p><label>{c.family}<input value={family} onChange={e=>setFamily(e.target.value)}/></label><label>{c.usage}<select value={usage} onChange={e=>setUsage(e.target.value)}><option value="Display">{c.display}</option><option value="Body">{c.body}</option><option value="Both">{c.both}</option></select></label><label className="bci-check"><input type="checkbox" checked={fontRights} onChange={e=>setFontRights(e.target.checked)}/>{c.fontRights}</label>{picker('font',c.fontPath,'.ttf,.otf,.woff,.woff2',!family.trim()||!fontRights)}{pending('font')}</>}</article>
  </div>
  {editing&&<button className="btn btn--primary" disabled={disabled||saving||queue.some(row=>row.status!=='uploaded')||(pendingRefs.length>0&&!Object.values(referenceRights).every(Boolean))} onClick={save}>{saving?c.saving:c.save}</button>}
  <div className="bci-notices" aria-live="polite">{notices.map(notice=><div key={notice.id} className="bci-toast" role="status"><span>{notice.message}</span>{notice.retry&&<button className="btn btn--sm" onClick={()=>{setNotices(rows=>rows.filter(row=>row.id!==notice.id));notice.retry();}}>{c.retry}</button>}<button className="btn btn--ghost btn--sm" aria-label={c.dismiss} onClick={()=>setNotices(rows=>rows.filter(row=>row.id!==notice.id))}>×</button></div>)}</div>
 </section>;
}
