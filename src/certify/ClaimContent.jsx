import React from 'react';
import {brandCoreInputsCopy} from '../locales/brand-core-inputs-copy.js';
import {LOGO_USES} from '../lib/brand-core-inputs.js';
import {useLocale} from '../lib/i18n.js';
import {reviewCopy,reviewText,reviewFieldLabels,sectionExplanation} from './review-copy.js';
import {COLOUR_ROLES,GOOGLE_FONTS,validateFoundationVisual} from '../../server/src/lib/brand-foundation.js';
import {writeField} from '../../server/src/lib/claim-review.js';
const display=value=>value==null||value===''||(Array.isArray(value)&&!value.length)?'No value recorded':typeof value==='object'?JSON.stringify(value):String(value);
const sourceAsset=(sources,id)=>sources.find(s=>s.id===id)?.evidence_url;
const isImage=e=>e.mime?.startsWith('image/')||/\.(png|jpe?g|webp)(\?|$)/i.test(e.asset_url||e.label||'');
const fieldLabel=path=>path.split('.').at(-1).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
export function ClaimValue({ claim, value = claim.value, sources = [] }) {
  const {locale}=useLocale();const ct=text=>reviewText(text,locale);
  if(value==null||value===''||(Array.isArray(value)&&!value.length))return <p className="certify-value">{ct('No value recorded')}</p>;
  if (/competitors|pointsOfDifference/.test(claim.field_path)&&Array.isArray(value))return <div className="certify-competitors">{value.map((item,i)=><article key={i}><h3>{item.name||item.claim||String(item)}</h3>{Object.entries(item).filter(([key,v])=>!['name','claim','url','source','id'].includes(key)&&typeof v==='string').map(([key,v])=><p key={key}>{v}</p>)}{['url','source'].map(key=>{let url;try{const parsed=new URL(item[key]);if(['https:','http:'].includes(parsed.protocol))url=parsed.href;}catch{}return url?<a key={key} href={url} target="_blank" rel="noreferrer">{item[key]} ↗</a>:item[key]?<p key={key}>{item[key]}</p>:null;})}</article>)}</div>;
  if (claim.field_path==='visual.logo'&&value?.variants){
    const logos=new Map();
    if(value.sourceId)logos.set(value.sourceId,{...value,use:value.use||'primary'});
    Object.entries(value.variants).forEach(([legacyUse,logo])=>{if(!logo?.sourceId)return;const previous=logos.get(logo.sourceId);logos.set(logo.sourceId,{...previous,...logo,use:logo.use||(LOGO_USES.includes(legacyUse)?legacyUse:previous?.use)||'primary'});});
    const copy=brandCoreInputsCopy[locale]||brandCoreInputsCopy.en;
    return logos.size?<div>{[...logos.values()].map(logo=>{const url=sourceAsset(sources,logo.sourceId),use=copy.uses[LOGO_USES.indexOf(logo.use)]||copy.logo;return <figure key={logo.sourceId}><figcaption>{use}{logo.name&&<small> · {logo.name}</small>}</figcaption>{url?<img className="certify-logo" src={url} alt={`${use}${logo.name?' · '+logo.name:''}`}/>:<p>{ct('Logo preview unavailable · inspect the source evidence.')}</p>}</figure>;})}</div>:<p className="certify-value">{ct('No value recorded')}</p>;
  }
  if (claim.field_path === 'visual.logo' && value?.sourceId) {
    const url = sourceAsset(sources, value.sourceId);
    return url ? <img className="certify-logo" src={url} alt="Brand logo" /> : <p>{ct('Logo preview unavailable · inspect the source evidence.')}</p>;
  }
  if (claim.field_path === 'visual.palette' && value?.length) return <div className="certify-swatches">{value.map((c,i) => <div key={i}><span style={{backgroundColor: /^#[\da-f]{6}$/i.test(c.hex) ? c.hex : 'transparent'}} /><strong>{ct(c.role || 'Unassigned')}</strong><small>{c.hex}</small></div>)}</div>;
  if (claim.field_path === 'visual.type' && value?.length) return <div>{value.map((f,i) => <FontSpecimen key={i} family={f.sourceId?`BrandFont-${f.sourceId}`:f.family} label={f.family}/>)}</div>;
  if (claim.field_path === 'visual.typeScale') return <FontSpecimen family={claim.fontFamily||'inherit'} scale={value}/>;
  if (Array.isArray(value)) return <ul className="certify-values">{value.map((v,i) => <li key={i}>{typeof v === 'object' ? Object.entries(v).filter(([,x]) => typeof x === 'string').map(([k,x]) => `${fieldLabel(k)}: ${x}`).join(' · ') : String(v)}</li>)}</ul>;
  return <p className="certify-value">{typeof value === 'object' && value ? Object.entries(value).filter(([,v]) => typeof v !== 'object').map(([k,v]) => `${fieldLabel(k)}: ${v}`).join(' · ') : ct(display(value))}</p>;
}
export function FontSpecimen({family,label=family,scale={}}){return <div className="certify-font-samples" style={{'--certify-specimen-family':`"${family}"`,fontFamily:`"${family}",sans-serif`}}><strong>{label}</strong>{['h1','h2','h3','h4','h5','h6','body'].map((tag,i)=><div key={tag}><small>{tag.toUpperCase()}</small><p style={{fontFamily:'inherit',fontSize:Math.min(48,Number(scale?.[tag])||[40,34,28,24,20,18,16][i]),lineHeight:1.3}}>The quick brown fox jumps over the lazy dog.</p></div>)}</div>;}
export function ClaimEvidence({ claim }) {
  const {locale}=useLocale();const copy=reviewCopy(locale);const ct=text=>reviewText(text,locale);
  const [tab, setTab] = React.useState(0);
  React.useEffect(() => setTab(0), [claim.claim_id]);
  const evidence = claim.evidence?.[tab] || claim.evidence?.[0];
  return <div className="certify-evidence">
    <div className="eyebrow">{copy.evidence}</div>
    {(claim.evidence||[]).length > 1 && <div className="certify-tabs" role="tablist" aria-label="Evidence sources">{claim.evidence.map((e,i) => <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{e.page ? `${ct('Page')} ${e.page}` : `${ct('Source')} ${i+1}`}</button>)}</div>}
    {!evidence ? <p className="certify-empty">{ct('● To confirm · No evidence yet')}</p> : <>
      <p className="certify-provenance">● {ct(evidence.first_party ? 'First-party' : 'Recorded / inferred')}{evidence.page ? ` · ${ct('Page')} ${evidence.page}` : ''}</p>
      {evidence.quote && <blockquote>{evidence.quote}</blockquote>}
      {evidence.screenshot && <img className="certify-source-image" src={evidence.screenshot} alt={`Screenshot of ${evidence.label}`} />}
      {evidence.asset_url && isImage(evidence) && <img className="certify-source-image" src={evidence.asset_url} alt={`Source: ${evidence.label}`} />}
      {evidence.asset_url && (evidence.mime === 'application/pdf' || /\.pdf$/i.test(evidence.label || '')) && <iframe className="certify-pdf" title={`Source PDF ${evidence.label}`} src={`${evidence.asset_url}#page=${evidence.page || 1}`} />}
      {(evidence.url || evidence.asset_url) ? <a href={evidence.url || evidence.asset_url} target="_blank" rel="noreferrer">{evidence.label || ct('Open source')} ↗</a> : <small>{evidence.label}</small>}
      {!evidence.quote && !evidence.asset_url && !evidence.screenshot && <p>{ct('No excerpt captured · inspect the source link.')}</p>}
    </>}
  </div>;
}
export function FixEditor({ claim, sources, onSave, onCancel }) {
  const {locale}=useLocale();const ct=text=>reviewText(text,locale);
  const [value, setValue] = React.useState(() => structuredClone(claim.value));
  const [error, setError] = React.useState('');
  const rows = Array.isArray(value) ? value : [];
  const setRow = (i, patch) => setValue(rows.map((row,j) => j === i ? { ...row, ...patch } : row));
  const save = e => {
    e.preventDefault();
    const patch = writeField({}, claim.field_path, value);
    const invalid = patch.visual && validateFoundationVisual(patch.visual);
    if (invalid) { setError(invalid); return; }
    onSave(value);
  };
  return <form className="certify-editor" onSubmit={save}>
    <h3>{ct('Fix')} {reviewFieldLabels[locale]?.[claim.field_path.split('.').at(-1)]||fieldLabel(claim.field_path)}</h3>
    {claim.field_path === 'visual.logo' ? <label>{ct('Brand logo')}<select aria-label="Brand logo" value={value?.sourceId || ''} onChange={e => setValue({...value,sourceId:e.target.value, conf:100})}><option value="">{ct('Choose an uploaded logo')}</option>{sources.filter(s => s.signals?.asset_role === 'logo' && s.signals?.ext === 'png' && s.signals?.rights_confirmed).map(s => <option key={s.id} value={s.id}>{s.src}</option>)}</select></label>
      : claim.field_path === 'visual.palette' ? <>{rows.map((c,i) => <div className="certify-edit-row" key={i}><label>{ct('Role')}<select value={c.role || ''} onChange={e => setRow(i,{role:e.target.value})}><option value="">{ct('Unassigned')}</option>{COLOUR_ROLES.map(r => <option key={r}>{r}</option>)}</select></label><label>{ct('Colour')}<input aria-label={`Colour ${i+1}`} value={c.hex || ''} onChange={e => setRow(i,{hex:e.target.value})} /></label><button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>{ct('Remove')}</button></div>)}<button type="button" onClick={() => setValue([...rows,{role:'accent',hex:'#ffffff'}])}>{ct('Add colour')}</button></>
      : claim.field_path === 'visual.type' ? <>{rows.map((f,i) => <div className="certify-edit-row" key={i}><label>{ct('Usage')}<select value={f.kind || 'Display'} onChange={e => setRow(i,{kind:e.target.value})}>{['Display','Body','Both'].map(k => <option key={k} value={k}>{ct(k)}</option>)}</select></label><label>{ct('Typeface')}<select value={f.sourceId || f.family || ''} onChange={e => { const source = sources.find(s => s.id === e.target.value); setValue(rows.map((r,j) => j === i ? source ? {kind:f.kind || 'Display',family:source.signals.font_family,sourceId:source.id} : {kind:f.kind || 'Display',family:e.target.value,provider:'google'} : r)); }}><option value="">{ct('Choose typeface')}</option>{GOOGLE_FONTS.map(name => <option key={name}>{name}</option>)}{sources.filter(s => s.signals?.asset_kind === 'font' && s.signals?.rights_confirmed).map(s => <option key={s.id} value={s.id}>{s.signals.font_family} · {ct('uploaded')}</option>)}</select></label><button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>{ct('Remove')}</button></div>)}<button type="button" onClick={() => setValue([...rows,{kind:'Display',family:'Instrument Sans',provider:'google'}])}>{ct('Add typeface')}</button></>
      : claim.kind === 'scalar' ? <label>{ct('Value')}<textarea aria-label="Value" autoFocus value={value ?? ''} onChange={e => setValue(e.target.value)} /></label>
      : claim.kind === 'list' ? <label>{ct('One item per line')}<textarea autoFocus value={rows.join('\n')} onChange={e => setValue(e.target.value.split('\n').filter(Boolean))} /></label>
      : claim.kind === 'object' ? <>{Object.entries(value || {h1:64,h2:48,h3:36,h4:28,h5:22,h6:18,body:16}).filter(([,v]) => typeof v !== 'object').map(([k,v]) => <label key={k}>{fieldLabel(k)}<input value={v} type={typeof v === 'number' ? 'number' : 'text'} onChange={e => setValue({...value,[k]:typeof v === 'number' ? Number(e.target.value) : e.target.value})} /></label>)}</>
      : <>{rows.map((row,i) => <fieldset key={i}><legend>{ct('Item')} {i+1}</legend>{Object.entries(row).filter(([,v]) => typeof v !== 'object').map(([k,v]) => <label key={k}>{fieldLabel(k)}<input value={v ?? ''} onChange={e => setRow(i,{[k]:e.target.value})} /></label>)}<button type="button" onClick={() => setValue(rows.filter((_,j) => j !== i))}>{ct('Remove')}</button></fieldset>)}<button type="button" onClick={() => setValue([...rows,{name:'',url:''}])}>{ct('Add item')}</button></>}
    <div className="certify-diff"><small>{ct('Before')}</small><ClaimValue claim={claim} value={claim.value} sources={sources}/><small>{ct('After')}</small><ClaimValue claim={claim} value={value} sources={sources}/></div>
    {error && <p role="alert">{error}</p>}
    <div className="certify-actions"><button className="btn btn--primary" type="submit">{ct('Save fix')}</button><button type="button" className="btn btn--ghost" onClick={onCancel}>{ct('Cancel')}</button></div>
  </form>;
}


export function SectionExplanation({path,locale='en'}){const e=sectionExplanation(path,locale);return <div className="certify-explanation"><p>{e.line}</p><details><summary aria-label={e.title}>ⓘ</summary><p>{e.info}</p></details></div>;}
