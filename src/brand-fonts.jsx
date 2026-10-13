import React from 'react';
import {uiFixtureEnabled} from './lib/ui-fixture.js';
import {apiFetch} from './lib/supabase-browser.js';
import {GOOGLE_FONTS,googleFontCssUrl,TYPE_SCALE_KEYS,DEFAULT_TYPE_SCALE} from '../server/src/lib/brand-foundation.js';

export function useBrandFonts(type = [], brandId) {
  const [state,setState]=React.useState({});
  React.useEffect(()=>{
    let alive=true;const faces=[];const links=[];
    setState({});
    Promise.all(type.filter(f=>f.family).map(async font=>{
      const key=font.sourceId || font.family;
      try {
        let family=font.family;
        if(font.sourceId){
          let url=uiFixtureEnabled?font.previewUrl:null;
          if(!url){const res=await apiFetch(`/api/bios/${brandId}/sources/${font.sourceId}/url`);if(!res.ok)throw Error('Font source unavailable');url=(await res.json()).url;}
          family=`BrandFont-${font.sourceId}`;
          const face=new FontFace(family,`url(${JSON.stringify(url)})`);await face.load();
          if(!alive)return null;document.fonts.add(face);faces.push(face);
        }else if(font.provider==='google'&&GOOGLE_FONTS.includes(family)){
          const link=document.createElement('link');link.rel='stylesheet';link.href=googleFontCssUrl(family);links.push(link);
          await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;document.head.appendChild(link);});
          const loaded=await document.fonts.load(`16px "${family}"`);
          if(!loaded.length||!document.fonts.check(`16px "${family}"`))throw Error('Font unavailable');
        }else return [key,{status:'missing'}];
        return [key,{family,status:'loaded'}];
      }catch{return [key,{status:'failed'}];}
    })).then(entries=>{if(alive)setState(Object.fromEntries(entries.filter(Boolean)));});
    return ()=>{alive=false;faces.forEach(face=>document.fonts.delete(face));links.forEach(link=>link.remove());};
  },[brandId,JSON.stringify(type.map(f=>[f.sourceId,f.family,f.provider]))]);
  return state;
}
export function BrandFontControls({visual,onChange,onUpload,disabled=false}) {
  const [usage,setUsage]=React.useState('Display');
  const [family,setFamily]=React.useState('');
  const [license,setLicense]=React.useState('commercial');
  const [reference,setReference]=React.useState('');
  const [rights,setRights]=React.useState(false);
  const setFont=(kind,value)=>{
    const type=(visual.type||[]).filter(font=>!new RegExp(`^(${kind}|Both)$`,'i').test(font.kind||''));
    if(value)type.push({kind,family:value,provider:'google',license:'open_source'});
    onChange({...visual,type});
  };
  return <fieldset disabled={disabled} className="foundation-font-controls">
    <legend>Typography</legend>
    {['Display','Body'].map(kind=><label key={kind}>{kind} Google Font<select aria-label={`${kind} Google Font`} value={(visual.type||[]).find(f=>f.kind===kind&&f.provider==='google')?.family||''} onChange={e=>setFont(kind,e.target.value)}><option value="">Choose a font</option>{GOOGLE_FONTS.map(name=><option key={name}>{name}</option>)}</select></label>)}
    <div className="foundation-font-upload">
      <label>Licensed font family<input aria-label="Licensed font family" value={family} onChange={e=>setFamily(e.target.value)}/></label>
      <label>Usage<select value={usage} onChange={e=>setUsage(e.target.value)}>{['Display','Body','Both'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Licence<select value={license} onChange={e=>setLicense(e.target.value)}>{['commercial','open_source','custom','system'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Licence reference<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> I confirm the brand has rights to use this font</label>
      <label>Upload licensed font<input aria-label="Upload licensed font" type="file" accept=".woff2,.woff,.otf,.ttf" disabled={!family.trim()||!rights} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await onUpload(file,{fontFamily:family.trim(),fontUsage:usage,licenseType:license,licenseReference:reference,rightsConfirmed:true});}}/></label>
    </div>
    <div className="foundation-type-scale">{TYPE_SCALE_KEYS.map(key=><label key={key}>{key.toUpperCase()} px<input aria-label={`${key.toUpperCase()} px`} type="number" min="8" max="200" value={visual.typeScale?.[key]??DEFAULT_TYPE_SCALE[key]} onChange={e=>onChange({...visual,typeScale:{...DEFAULT_TYPE_SCALE,...visual.typeScale,[key]:Number(e.target.value)}})}/></label>)}</div>
  </fieldset>;
}
