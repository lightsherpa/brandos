import React from 'react';
import {apiFetch} from './lib/supabase-browser.js';
import {uiFixtureEnabled} from './lib/ui-fixture.js';
import {foundationStatus,COLOUR_ROLES,DEFAULT_TYPE_SCALE,usableDisplayFont} from '../server/src/lib/brand-foundation.js';
import {BrandFontControls,useBrandFonts} from './brand-fonts.jsx';
import './brand-foundation.css';

async function sourceUrl(brandId,item) {
  if(!item)return null;
  if(uiFixtureEnabled)return item.previewUrl || item.url || null;
  if(!item.sourceId)return item.url || null;
  const res=await apiFetch(`/api/bios/${brandId}/sources/${item.sourceId}/url`);
  if(!res.ok)throw Error('Asset unavailable');return (await res.json()).url;
}
export function FoundationStrip({brandId,payload,onSave,disabled=false}) {
  const visual=payload?.visual || {};
  const [draft,setDraft]=React.useState(visual);
  const [editing,setEditing]=React.useState(false);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [rights,setRights]=React.useState(false);
  const [referenceRole,setReferenceRole]=React.useState('inspiration');
  const [images,setImages]=React.useState({});
  React.useEffect(()=>{setDraft(visual);setEditing(false);setError('');},[brandId,JSON.stringify(visual)]);
  const displayed=editing?draft:visual;
  const fonts=useBrandFonts(displayed.type || [],brandId);
  const font=(displayed.type || []).find(usableDisplayFont);
  const fontState=fonts[font?.sourceId || font?.family];
  const status=foundationStatus({visual:displayed});
  React.useEffect(()=>{
    let alive=true;setImages({});
    const logo=displayed.logo;
    const items=[...['light','dark'].map(variant=>[variant,logo?.variants?.[variant === "light" ? "dark" : "light"] || (!logo?.variants ? logo : null)]),...(displayed.references || []).map((ref,i)=>[`ref-${i}`,ref])];
    Promise.all(items.map(async([key,item])=>{try{return [key,await sourceUrl(brandId,item)];}catch{return [key,null];}})).then(entries=>{if(alive)setImages(Object.fromEntries(entries));});
    return ()=>{alive=false;};
  },[brandId,JSON.stringify(displayed.logo),JSON.stringify(displayed.references)]);
  const edit=()=>{setDraft(visual);setEditing(true);setError('');};
  const upload=async(file,metadata)=>{
    setBusy(true);setError('');
    try{
      let source,previewUrl;
      if(uiFixtureEnabled){
        previewUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        source={id:`fixture-${crypto.randomUUID()}`,src:file.name};
      }else{
        const form=new FormData();form.append('file',file);form.append('bucket','visual');
        for(const [key,value] of Object.entries(metadata))form.append(key,String(value));
        const res=await apiFetch(`/api/bios/${brandId}/sources/upload`,{method:'POST',body:form,headers:{}});
        const json=await res.json();if(!res.ok)throw Error(json.error || 'Upload failed');source=json.source;
      }
      setDraft(current=>{
        if(metadata.fontFamily){
          const kind=metadata.fontUsage;
          return {...current,type:[...(current.type || []).filter(f=>kind==='Both'?false:!new RegExp(`^(${kind}|Both)$`,'i').test(f.kind||'')),{kind,family:metadata.fontFamily,sourceId:source.id,license:metadata.licenseType, ...(previewUrl?{previewUrl}:{})}]};
        }
        if(metadata.assetRole==='logo'){
          const entry={sourceId:source.id,source:file.name,conf:100,...(previewUrl?{previewUrl}:{})};
          return {...current,logo:{...entry,variants:{...current.logo?.variants,[metadata.logoVariant]:entry}}};
        }
        return {...current,references:[...(current.references || []),{sourceId:source.id,name:file.name,role:metadata.assetRole,...(previewUrl?{previewUrl}:{})}]};
      });
    }catch(e){setError(e.message || String(e));}finally{setBusy(false);}
  };
  const save=async()=>{setBusy(true);setError('');try{await onSave({...draft,typeScale:{...DEFAULT_TYPE_SCALE,...draft.typeScale}});setEditing(false);}catch(e){setError(e.message || String(e));}finally{setBusy(false);}};
  const missing=<span className="foundation-missing">Missing</span>;
  return <section className="foundation-strip" aria-label="Brand Core foundation">
    <div className="foundation-heading"><div><span className="eyebrow">Brand Core · Foundation</span><p>{status.certifiable?'Foundation ready for certification':'Add logo, primary colour and display font to enable certification'}</p></div><button className="btn btn--ghost btn--sm" disabled={disabled||busy} onClick={editing?()=>setEditing(false):edit}>{editing?'Cancel':'Edit foundation'}</button></div>
    <div className="foundation-grid">
      <article className="foundation-card"><h3>Logo</h3><div className="foundation-logos">{['light','dark'].map(variant=><div key={variant} className={`foundation-logo foundation-logo--${variant}`}><span>{variant === 'light'?'On light':'On dark'}</span>{images[variant]?<img alt={`Brand logo on ${variant}`} src={images[variant]} onError={()=>setImages(state=>({...state,[variant]:null}))}/>:<>{missing}<button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload {variant} logo</button></>}</div>)}</div>{visual.logo?.conf<60&&<small>Site icon found · upload the brand logo</small>}</article>
      <article className="foundation-card"><h3>Colour roles</h3><div className="foundation-swatches">{['primary','ink','surface'].map(role=>{const colour=(displayed.palette || []).find(c=>c.role===role);return <div key={role}><span className="foundation-swatch" style={colour?{background:colour.hex}:undefined}/><strong>{role}</strong>{colour?<code>{colour.hex}</code>:<>{missing}<button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload / set colour</button></>}</div>;})}</div></article>
      <article className="foundation-card"><h3>Typography</h3>{font&&fontState?.status==='loaded'?<><div className="foundation-specimen" style={{"--brand-specimen-font":`"${fontState.family}"`,fontSize:Math.min(displayed.typeScale?.h1 || 48,56)}}>Aa · Brand in focus</div><small>{font.family} · Display</small></>:<>{missing}<p>{font?(fontState?.status==='failed'?'Brand font could not load':'Loading brand font…'):'No display font selected'}</p><button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload / choose font</button></>}<div className="foundation-body-font">Body: {(displayed.type || []).find(f=>/^(Body|Both)$/i.test(f.kind))?.family || 'Missing'}</div></article>
      <article className="foundation-card"><h3>Reference images</h3><div className="foundation-references">{(displayed.references || []).filter(ref=>ref.role!=='avoid').slice(0,3).map(ref=>{const index=displayed.references.indexOf(ref);return images[`ref-${index}`]?<img key={ref.sourceId || index} alt={ref.name || 'Brand reference'} src={images[`ref-${index}`]}/>:<span key={index}>{missing}</span>;})}</div>{!(displayed.references || []).some(ref=>ref.role!=='avoid')&&missing}<button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload reference</button></article>
    </div>
    {editing&&<div className="foundation-editor">
      <fieldset disabled={busy}><legend>Logo &amp; references</legend><label><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> I confirm the brand has rights to use these images</label><div className="foundation-upload-row">{['light','dark'].map(variant=><label key={variant}>Logo on {variant}<input aria-label={`Upload ${variant} logo`} type="file" accept=".svg,.png" disabled={!rights} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await upload(file,{assetRole:'logo',logoVariant:variant === 'light' ? 'dark' : 'light',rightsConfirmed:true});}}/></label>)}</div><label>Reference role<select value={referenceRole} onChange={e=>setReferenceRole(e.target.value)}>{['canonical','inspiration','avoid'].map(role=><option key={role}>{role}</option>)}</select></label><label>Upload reference<input aria-label="Upload reference" type="file" accept=".png,.jpg,.jpeg,.webp,.gif" disabled={!rights} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await upload(file,{assetRole:referenceRole,rightsConfirmed:true});}}/></label></fieldset>
      <fieldset disabled={busy}><legend>Colour roles</legend>{COLOUR_ROLES.map(role=>{const colour=(draft.palette || []).find(c=>c.role===role);return <label key={role}>{role}<input aria-label={`${role} colour`} type="color" value={/^#[\da-f]{6}$/i.test(colour?.hex || '')?colour.hex:'#888888'} onChange={e=>setDraft(current=>({...current,palette:[...(current.palette||[]).filter(c=>c.role!==role),{hex:e.target.value,name:role,role,roleStatus:'confirmed'}]}))}/><input aria-label={`${role} hex`} placeholder="#rrggbb" value={colour?.hex || ''} onChange={e=>setDraft(current=>({...current,palette:[...(current.palette||[]).filter(c=>c.role!==role),{hex:e.target.value,name:role,role,roleStatus:'confirmed'}]}))}/>{!colour&&<><span>Missing</span><button type="button" className="btn btn--link" onClick={()=>setDraft(current=>({...current,palette:[...(current.palette||[]),{hex:'#888888',name:role,role,roleStatus:'confirmed'}]}))}>Set colour</button></>}</label>;})}</fieldset>
      <BrandFontControls visual={draft} onChange={setDraft} onUpload={upload} disabled={busy}/>
      <button className="btn btn--primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save foundation'}</button><p>Saving creates a new Brand Core version for review.</p>
    </div>}
    {error&&<p role="alert" className="foundation-error">{error}</p>}
  </section>;
}
