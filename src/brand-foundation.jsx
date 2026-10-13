import React from 'react';
import { withUploadType } from './lib/upload-type.js';
export { withUploadType };
import {apiFetch} from './lib/supabase-browser.js';
import {uiFixtureEnabled} from './lib/ui-fixture.js';
import {foundationStatus,suggestColourRoles,COLOUR_ROLES,DEFAULT_TYPE_SCALE,usableDisplayFont} from '../server/src/lib/brand-foundation.js';
import {BrandFontControls,useBrandFonts} from './brand-fonts.jsx';
import './brand-foundation.css';

/* `logoVariant` (server, bio_sources.signals.logo_variant) names the LOGO's
   colour: "light" = a light logo, used on dark backgrounds; "dark" = a dark
   logo, used on light backgrounds (same as portal-discovery's picker). The
   cards here are organised by BACKGROUND, so map through this one helper. */
export const SVG_LOGO_MESSAGE = "SVG files aren't supported. Export the logo as a PNG (transparent background works best) and upload that.";
export const isSvgFile = (file) => /\.svg$/i.test(file?.name || '') || file?.type === 'image/svg+xml';
export const logoVariantForBackground = (background) => (background === "light" ? "dark" : "light");

async function sourceUrl(brandId,item) {
  if(!item)return null;
  if(uiFixtureEnabled)return item.previewUrl || item.url || null;
  if(!item.sourceId)return item.url || null;
  const res=await apiFetch(`/api/bios/${brandId}/sources/${item.sourceId}/url`);
  if(!res.ok)throw Error('Asset unavailable');return (await res.json()).url;
}
export const LOGO_RIGHTS_MESSAGE='Confirm the brand has rights to use this logo before certification';
export function foundationIncompleteMessage(status){
  if(status?.logoStatus==='needs_rights'&&status.missing?.length===1)return 'Foundation incomplete · confirm rights to use the logo';
  return 'Foundation incomplete · add logo, primary colour and display font';
}
export async function confirmLogoRights(brandId,sourceIds){
  for(const id of sourceIds){
    const res=await apiFetch(`/api/bios/${brandId}/sources/${id}/confirm-rights`,{method:'POST',body:JSON.stringify({rightsConfirmed:true})});
    if(!res.ok){const json=await res.json().catch(()=>({}));throw Error(json.error||'Could not confirm logo rights');}
  }
}
function LogoRightsPrompt({brandId,sourceIds,disabled,onConfirmed}){
  const [checked,setChecked]=React.useState(false);const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');
  return <div className="foundation-rights-prompt" role="group" aria-label="Confirm logo rights"><small>{LOGO_RIGHTS_MESSAGE}</small>
    <label><input type="checkbox" checked={checked} disabled={disabled||busy} onChange={e=>setChecked(e.target.checked)}/> The brand has rights to use this logo</label>
    <button className="btn btn--sm" disabled={!checked||disabled||busy} onClick={async()=>{setBusy(true);setError('');try{await confirmLogoRights(brandId,sourceIds);await onConfirmed?.();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Confirm rights</button>
    {error&&<small role="alert">{error}</small>}</div>;
}
export function FoundationStrip({brandId,payload,onSave,disabled=false,logoRights=[],onRightsConfirmed}) {
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
  const status=foundationStatus({visual:displayed},{logoRights});
  React.useEffect(()=>{
    let alive=true;setImages({});
    const logo=displayed.logo;
    const items=[...['light','dark'].map(variant=>[variant,logo?.variants?.[logoVariantForBackground(variant)] || (!logo?.variants ? logo : null)]),...(displayed.references || []).map((ref,i)=>[`ref-${i}`,ref])];
    Promise.all(items.map(async([key,item])=>{try{return [key,await sourceUrl(brandId,item)];}catch{return [key,null];}})).then(entries=>{if(alive)setImages(Object.fromEntries(entries));});
    return ()=>{alive=false;};
  },[brandId,JSON.stringify(displayed.logo),JSON.stringify(displayed.references)]);
  const edit=()=>{setDraft({...visual,palette:suggestColourRoles(visual.palette || [])});setEditing(true);setError('');};
  const upload=async(file,metadata)=>{
    setBusy(true);setError('');
    try{
      let source,previewUrl;
      if(uiFixtureEnabled){
        previewUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        source={id:`fixture-${crypto.randomUUID()}`,src:file.name};
      }else{
        const form=new FormData();form.append('file',withUploadType(file));form.append('bucket','visual');
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
    <div className="foundation-heading"><div><span className="eyebrow">Brand Core · Foundation</span><p>{status.certifiable?'Foundation ready for certification':status.logoStatus==='needs_rights'&&status.missing.length===1?'Confirm logo rights to enable certification':'Add logo, primary colour and display font to enable certification'}</p></div><button className="btn btn--ghost btn--sm" disabled={disabled||busy} onClick={editing?()=>setEditing(false):edit}>{editing?'Cancel':'Edit foundation'}</button></div>
    <div className="foundation-grid">
      <article className="foundation-card"><h3>Logo</h3><div className="foundation-logos">{['light','dark'].map(variant=><div key={variant} className={`foundation-logo foundation-logo--${variant}`}><span>{variant === 'light'?'On light background':'On dark background'}</span>{images[variant]?<img alt={`${logoVariantForBackground(variant)} brand logo on ${variant} background`} src={images[variant]} onError={()=>setImages(state=>({...state,[variant]:null}))}/>:<>{missing}<button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload logo for {variant} background</button></>}</div>)}</div>{visual.logo?.conf<60&&<small>Site icon found · upload the brand logo</small>}{status.logoStatus==='needs_rights'&&!editing&&<LogoRightsPrompt brandId={brandId} sourceIds={status.needsRights} disabled={disabled} onConfirmed={onRightsConfirmed}/>}</article>
      <article className="foundation-card"><h3>Colour roles</h3><div className="foundation-swatches">{['primary','ink','surface'].map(role=>{const colour=(displayed.palette || []).find(c=>c.role===role);return <div key={role}><span className="foundation-swatch" style={colour?{background:colour.hex}:undefined}/><strong>{role}</strong>{colour?<code>{colour.hex}</code>:<>{missing}<button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload / set colour</button></>}</div>;})}</div></article>
      <article className="foundation-card"><h3>Typography</h3>{font&&fontState?.status==='loaded'?<><div className="foundation-specimen" style={{"--brand-specimen-font":`"${fontState.family}"`,fontSize:Math.min(displayed.typeScale?.h1 || 48,56)}}>Aa · Brand in focus</div><small>{font.family} · Display</small></>:<>{missing}<div className="foundation-specimen" style={{"--brand-specimen-font":'FoundationFallbackInstrument',fontSize:48}}>Aa · Headline</div><small className="foundation-fallback" role="status">Instrument Sans · flagged fallback</small><p>{font?(fontState?.status==='failed'?'Brand font could not load':'Loading brand font…'):'No display font selected'}</p><button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload / choose font</button></>}<div className="foundation-body-font">Body: {(displayed.type || []).find(f=>/^(Body|Both)$/i.test(f.kind))?.family || <><span className="foundation-missing">Missing</span><button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload / choose body font</button></>}</div></article>
      <article className="foundation-card"><h3>Reference images</h3><div className="foundation-references">{(displayed.references || []).filter(ref=>ref.role!=='avoid').slice(0,3).map(ref=>{const index=displayed.references.indexOf(ref);return images[`ref-${index}`]?<img key={ref.sourceId || index} alt={ref.name || 'Brand reference'} src={images[`ref-${index}`]} onError={()=>setImages(state=>({...state,[`ref-${index}`]:null}))}/>:<span key={index}>{missing}</span>;})}</div>{!(displayed.references || []).some(ref=>ref.role!=='avoid')&&missing}<button className="btn btn--link" disabled={disabled||busy} onClick={edit}>Upload reference</button></article>
    </div>
    {editing&&<div className="foundation-editor">
      <fieldset disabled={busy}><legend>Logo &amp; references</legend><label><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> I confirm the brand has rights to use these images</label><div className="foundation-upload-row">{['light','dark'].map(variant=><label key={variant}>Logo for {variant} background ({logoVariantForBackground(variant)} logo)<input aria-label={`Upload logo for ${variant} background`} type="file" accept=".png,image/png" disabled={!rights} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file&&isSvgFile(file))return setError(SVG_LOGO_MESSAGE);if(file)await upload(file,{assetRole:'logo',logoVariant:logoVariantForBackground(variant),rightsConfirmed:true});}}/></label>)}</div><label>Reference role<select value={referenceRole} onChange={e=>setReferenceRole(e.target.value)}>{['canonical','inspiration'].map(role=><option key={role}>{role}</option>)}</select></label><label>Upload reference<input aria-label="Upload reference" type="file" accept=".png,.jpg,.jpeg,.webp" disabled={!rights} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await upload(file,{assetRole:referenceRole,rightsConfirmed:true});}}/></label></fieldset>
      <fieldset disabled={busy}><legend>Colour roles</legend>{COLOUR_ROLES.map(role=>{const colour=(draft.palette || []).find(c=>c.role===role);return <label key={role}>{role}<input aria-label={`${role} colour`} type="color" value={/^#[\da-f]{6}$/i.test(colour?.hex || '')?colour.hex:'#888888'} onChange={e=>setDraft(current=>({...current,palette:[...(current.palette||[]).filter(c=>c.role!==role),{hex:e.target.value,name:role,role,roleStatus:'confirmed'}]}))}/><input aria-label={`${role} hex`} placeholder="#rrggbb" value={colour?.hex || ''} onChange={e=>setDraft(current=>({...current,palette:[...(current.palette||[]).filter(c=>c.role!==role),{hex:e.target.value,name:role,role,roleStatus:'confirmed'}]}))}/>{!colour&&<><span>Missing</span><button type="button" className="btn btn--link" onClick={()=>setDraft(current=>({...current,palette:[...(current.palette||[]),{hex:'#888888',name:role,role,roleStatus:'confirmed'}]}))}>Set colour</button></>}</label>;})}</fieldset>
      <BrandFontControls visual={draft} onChange={setDraft} onUpload={upload} disabled={busy}/>
      <button className="btn btn--primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save foundation'}</button><p>Saving creates a new Brand Core version for review.</p>
    </div>}
    {error&&<p role="alert" className="foundation-error">{error}</p>}
  </section>;
}
