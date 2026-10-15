import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {useBrandFonts} from './brand-fonts.jsx';
import {ClaimValue} from './certify/CertifyView.jsx';
import {reviewFieldLabel} from './certify/review-copy.js';
import {brandCoreInputsCopy} from './locales/brand-core-inputs-copy.js';
import {LOGO_USES,PALETTE_GROUPS,REFERENCE_TAGS} from './lib/brand-core-inputs.js';
import {DEFAULT_TYPE_SCALE} from '../server/src/lib/brand-foundation.js';
import './brand-book-v2.css';
export const brandBookV2Enabled=()=>['1','true'].includes(String(import.meta.env?.VITE_BRAND_BOOK_V2||'').toLowerCase());
export {bookCopy} from './locales/brand-book-copy.js';
import {bookCopy} from './locales/brand-book-copy.js';
export function bookLogos(logo={}){const out=new Map();if(logo.sourceId)out.set(logo.sourceId,{...logo,use:logo.use||'primary'});Object.entries(logo.variants||{}).forEach(([key,value])=>{if(value?.sourceId)out.set(value.sourceId,{...value,use:value.use||(LOGO_USES.includes(key)?key:'primary')});});return [...out.values()];}
const colour=value=>/^#[\da-f]{6}$/i.test(value||'')?value:undefined;
const text=value=>typeof value==='string'?value:'';
export function BrandBookV2({bio,payload=bio?.payload||{},brandName,certified,brandId,go,locale='en',replay=false,sources:providedSources}){
 const {t}=useLocale(),c=bookCopy[locale]||bookCopy.en,input=brandCoreInputsCopy[locale]||brandCoreInputsCopy.en;
 const visual=payload.visual||{},fonts=visual.type||[],logos=bookLogos(visual.logo),refs=visual.references||[];
 const fontState=useBrandFonts(fonts,brandId),[sources,setSources]=React.useState(providedSources||[]),[retry,setRetry]=React.useState(0);
 const ids=[...new Set([...logos,...refs].map(x=>x.sourceId).filter(Boolean))];
 React.useEffect(()=>{if(providedSources||replay||!brandId)return;let active=true;setSources([]);Promise.all(ids.map(async id=>{try{const res=await apiFetch(`/api/bios/${brandId}/sources/${id}/url`);if(!res.ok)return {id};return {id,evidence_url:(await res.json()).url};}catch{return {id};}})).then(rows=>{if(active)setSources(rows);});return()=>{active=false;};},[brandId,replay,providedSources,ids.join(','),retry]);
 const asset=id=>sources.find(s=>s.id===id)?.evidence_url;
 const display=fonts.find(f=>/display|both/i.test(f.kind||''))||fonts[0],body=fonts.find(f=>/body|both/i.test(f.kind||''))||display;
 const family=font=>fontState[font?.sourceId||font?.family]?.family;
 const palette=visual.palette||[],primary=palette.find(p=>/primary/i.test(p.group||p.role||''))||palette[0];
 const fields=sections=>sections.flatMap(section=>Object.entries(payload[section]||{}).filter(([key])=>!['name'].includes(key)).map(([key,value])=>({path:`${section}.${key}`,value}))).filter(f=>f.value&&(!Array.isArray(f.value)||f.value.length));
 const renderField=f=><article className="book2-field" key={f.path}><h3>{reviewFieldLabel(f.path,locale,t)}</h3><ClaimValue claim={{field_path:f.path,value:f.value}}/>{payload.confidence?.[f.path]?.source&&<small className="book2-source">{c.source} · {payload.confidence[f.path].source}</small>}</article>;
 const chapters=[['strategy',c.strategy,c.strategyNote],['visual',c.visual,c.visualNote],['voice',c.voice,c.voiceNote]];
 return <article className="book2" dir={locale==='ar'?'rtl':'ltr'} style={{'--book-accent':colour(primary?.hex)||'#cfeb89','--book-display':family(display)?`"${family(display)}"`:undefined,'--book-body':family(body)?`"${family(body)}"`:undefined}}>
  <header className="book2-masthead"><span>Brand Core / {String(bio.version).padStart(2,'0')}</span><span>{certified?'●':'○'} {certified?c.certified:c.draft}</span><button className="btn btn--ghost" onClick={()=>go('bio')}>{c.back} ↗</button></header>
  <section className="book2-cover"><div><p className="book2-eyebrow">{c.title}</p><h1>{brandName}</h1><p className="book2-position">{text(payload.identity?.positioning)||text(payload.identity?.essence)||c.empty}</p></div><div className="book2-edition"><span>{String(bio.version).padStart(2,'0')}</span><small>Brand Core</small></div></section>
  <div className="book2-toolbar"><nav aria-label={c.title}>{chapters.map(([id,label],i)=><a href={`#book2-${id}`} key={id}><small>0{i+1}</small> {label}</a>)}</nav></div>
  <section id="book2-strategy" className="book2-chapter"><header><span>01</span><div><h2>{c.strategy}</h2><p>{c.strategyNote}</p></div></header><div className="book2-strategy-grid">{fields(['identity','audience','positioning','goals','strategic']).map(renderField)}</div></section>
  <section id="book2-visual" className="book2-chapter"><header><span>02</span><div><h2>{c.visual}</h2><p>{c.visualNote}</p></div></header>
   <section className="book2-subsection"><h3>{c.logos}</h3><div className="book2-logos">{logos.length?logos.map(logo=><figure key={logo.sourceId}><div className="book2-lockups">{['light','dark'].map(bg=><div key={bg} data-background={bg}>{asset(logo.sourceId)?<img src={asset(logo.sourceId)} alt={logo.name||input.logo}/>:<span>{c.asset}</span>}<small>{c[bg]}</small></div>)}</div><figcaption>{input.uses[LOGO_USES.indexOf(logo.use)]||input.logo}{logo.name&&` · ${logo.name}`}</figcaption></figure>):<p>{c.empty}</p>}</div>{logos.some(logo=>!asset(logo.sourceId))&&!replay&&<button className="btn btn--ghost" onClick={()=>setRetry(n=>n+1)}>{input.retry}</button>}</section>
   <section className="book2-subsection"><h3>{c.palette}</h3><div className="book2-palette">{palette.length?palette.map((p,i)=><figure key={i}><div style={{background:colour(p.hex)||'transparent'}}/><figcaption><strong>{p.name||p.hex}</strong><code>{p.hex}</code><span>{input.groups[PALETTE_GROUPS.indexOf(p.group||p.role)]||p.role||p.group}</span><p>{p.usage||p.usageNote||p.notes||c.usage}</p></figcaption></figure>):<p>{c.empty}</p>}</div></section>
   <section className="book2-subsection"><h3>{c.type}</h3>{fonts.length?fonts.map((font,i)=><BookFontSpecimen key={i} {...{font,locale}} loadedFamily={family(font)} scale={visual.typeScale}/>):<p>{c.empty}</p>}</section>
   <section className="book2-subsection"><h3>{c.references}</h3><div className="book2-references">{refs.length?refs.map((ref,i)=><figure key={ref.sourceId||i}>{asset(ref.sourceId)?<img src={asset(ref.sourceId)} alt={ref.name||input.references}/>:<div>{c.asset}</div>}<figcaption>{input.tags[REFERENCE_TAGS.indexOf(ref.tag||ref.use)]||ref.name||input.references}</figcaption></figure>):<p>{c.empty}</p>}</div>{fields(['visual']).filter(f=>['visual.imagery','visual.avoid'].includes(f.path)).map(renderField)}</section>
  </section>
  <section id="book2-voice" className="book2-chapter"><header><span>03</span><div><h2>{c.voice}</h2><p>{c.voiceNote}</p></div></header>{payload.voice?.signatures?.length>0&&<div className="book2-voice-examples"><h3>{c.examples}</h3>{payload.voice.signatures.map((value,i)=><blockquote key={i}>{value}</blockquote>)}</div>}<div className="book2-strategy-grid">{fields(['voice']).filter(f=>f.path!=='voice.signatures').map(renderField)}</div></section>
  <footer className="book2-footer"><strong>{brandName}</strong><span>Brand Core · {bio.version}</span></footer>
 </article>;
}

export function BookFontSpecimen({font,loadedFamily,scale={},locale='en'}){
 const c=bookCopy[locale]||bookCopy.en,input=brandCoreInputsCopy[locale]||brandCoreInputsCopy.en;
 return <div className="book2-specimen" style={{fontFamily:loadedFamily?`"${loadedFamily}"`:undefined,'--book-specimen-family':loadedFamily?`"${loadedFamily}"`:undefined}}><header><strong>{font.family}</strong><span>{font.kind} · {font.weight||400} · {font.style||input.normal}</span></header>{loadedFamily?['h1','h2','h3','h4','h5','h6','body'].map(level=><div key={level} className="book2-type-line"><small>{level.toUpperCase()}</small><p style={{fontFamily:'inherit',fontSize:Math.min(scale?.[level]||DEFAULT_TYPE_SCALE[level],64),fontWeight:font.weight||400,fontStyle:font.style||'normal'}}>{locale==='en'?c.sample:`${c.sample} The quick brown fox.`}</p></div>):<p className="book2-font-unavailable" role="status">{c.font}</p>}</div>;
}
