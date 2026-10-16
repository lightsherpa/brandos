import React from 'react';
import {useLocale} from './lib/i18n.js';
import {apiFetch} from './lib/supabase-browser.js';
import {renderGuidelines} from '../shared/brand-book/render.js';
import {guidelinesCopy} from './locales/brand-book-guidelines-copy.js';
import './brand-book-guidelines.css';

export const brandBookGuidelinesEnabled=()=>['1','true'].includes(String(import.meta.env?.VITE_BRAND_BOOK_GUIDELINES||'').toLowerCase());
export const BOOK_CATEGORIES=['logos','palette','typography','voice','imagery','strategy'];
const DEFAULT_CATEGORIES=['logos','palette','typography','voice','imagery'];
export function bookExportUrl(brandId,{version,locale='en',format='kit',items=DEFAULT_CATEGORIES,sourceIds}={}) {
 const query=new URLSearchParams({locale,format,items:items.join(','),version:String(version)});
 if(Array.isArray(sourceIds))query.set('sourceIds',sourceIds.join(','));
 return `/api/brand-book/${encodeURIComponent(brandId)}/export?${query}`;
}
export function guidelineAssets(snapshot) {
 const visual=snapshot.bio?.payload?.visual||{},roles=new Map();
 const record=(id,category,label)=>{if(id)roles.set(id,{category,label});};
 record(visual.logo?.sourceId,'logos',visual.logo?.name||visual.logo?.use||'');
 Object.values(visual.logo?.variants||{}).forEach(value=>record(value?.sourceId,'logos',value?.name||value?.use||''));
 (visual.type||[]).forEach(font=>record(font.sourceId,'typography',[font.family,font.weight,font.style].filter(Boolean).join(' · ')));
 (visual.references||[]).forEach(ref=>record(ref.sourceId,'imagery',ref.name||ref.tag||''));
 return [...roles].map(([id,role])=>{const source=(snapshot.sources||[]).find(row=>row.id===id);return {...role,id,label:role.label||source?.src||'',previewOnly:!source||source.previewOnly===true};});
}
export async function loadBookSnapshot(fetcher,brandId,{version,signal}={}) {
 const response=await fetcher(`/api/brand-book/${encodeURIComponent(brandId)}${version?`?version=${encodeURIComponent(version)}`:''}`,{signal});
 if(!response.ok)throw new Error('BOOK_UNAVAILABLE');
 const snapshot=await response.json();
 if(snapshot.brand?.id!==brandId||!snapshot.bio?.version||!['certified','draft'].includes(snapshot.mode))throw new Error('BOOK_SCOPE_MISMATCH');
 return snapshot;
}
export async function fetchBookDownload(fetcher,brandId,options) {
 const response=await fetcher(bookExportUrl(brandId,options));
 if(!response.ok)throw new Error(response.status===409?'BOOK_EDITION_UNAVAILABLE':'BOOK_EXPORT_FAILED');
 const blob=await response.blob();
 if(!blob.size)throw new Error('BOOK_EXPORT_EMPTY');
 const disposition=response.headers.get('Content-Disposition')||'';
 const filename=disposition.match(/filename="?([^";]+)"?/)?.[1]?.replace(/[/\\\x00-\x1f]/g,'_')||`brand-book-${options.format}-v${options.version}.zip`;
 return {blob,filename};
}
export function saveBookDownload({blob,filename},browser=window) {
 const url=browser.URL.createObjectURL(blob),anchor=browser.document.createElement('a');
 try{anchor.href=url;anchor.download=filename;browser.document.body.append(anchor);anchor.click();}finally{anchor.remove();browser.setTimeout(()=>browser.URL.revokeObjectURL(url),1000);}
}
export function publicBookShareUrl(path,origin=window.location.origin) {
 const url=new URL(path,origin);
 if(url.origin!==origin||!/^\/api\/brand-book\/shared\/[a-zA-Z0-9_-]+$/.test(url.pathname)||url.search||url.hash)throw new Error('BOOK_SHARE_URL_INVALID');
 return url.href;
}

export function BrandBookGuidelines({brandId,version,go,fetcher=apiFetch}) {
 const {locale}=useLocale(),c=guidelinesCopy(locale);
 const [snapshot,setSnapshot]=React.useState(null),[error,setError]=React.useState(false),[retry,setRetry]=React.useState(0);
 React.useEffect(()=>{setSnapshot(null);setError(false);if(!brandId)return;const abort=new AbortController();loadBookSnapshot(fetcher,brandId,{version,signal:abort.signal}).then(value=>{if(!abort.signal.aborted)setSnapshot(value);}).catch(()=>{if(!abort.signal.aborted)setError(true);});return()=>abort.abort();},[brandId,version,retry,fetcher]);
 if(error)return <section className="book-guidelines-status" role="alert"><p>{c.unavailable}</p><button className="btn btn--primary" onClick={()=>setRetry(n=>n+1)}>{c.retry}</button></section>;
 if(!snapshot||snapshot.brand.id!==brandId||(version&&snapshot.bio.version!==version))return <section className="book-guidelines-status" role="status">{brandId?c.loading:c.pickBrand}</section>;
 return <GuidelinesReader key={`${brandId}:${snapshot.bio.version}`} {...{snapshot,locale,fetcher}} onBack={()=>go?.('bio')}/>;
}

export function GuidelinesReader({snapshot,locale='en',onBack,fetcher=apiFetch}) {
 const c=guidelinesCopy(locale),brandId=snapshot.brand.id,version=snapshot.bio.version;
 const certified=snapshot.mode==='certified'&&snapshot.bio.certified===true,exportable=certified&&snapshot.canExport===true,shareable=exportable&&snapshot.canShare===true;
 const [panel,setPanel]=React.useState(null),[format,setFormat]=React.useState('website'),[items,setItems]=React.useState(DEFAULT_CATEGORIES),[selected,setSelected]=React.useState(()=>guidelineAssets(snapshot).filter(asset=>!asset.previewOnly).map(asset=>asset.id));
 const [busy,setBusy]=React.useState(''),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[shares,setShares]=React.useState(null),[listError,setListError]=React.useState(false),[expiry,setExpiry]=React.useState(30),[createdLink,setCreatedLink]=React.useState(null);
 const lock=React.useRef(false),linkInput=React.useRef(null),assets=guidelineAssets(snapshot);
 const html=React.useMemo(()=>renderGuidelines({brand:snapshot.brand,bio:snapshot.bio,sources:snapshot.sources||[],assetMap:snapshot.assetMap||{},locale,mode:'preview'}),[snapshot,locale]);
 const toggle=(value,list,setList)=>setList(list.includes(value)?list.filter(item=>item!==value):[...list,value]);
 async function download(){if(lock.current||!exportable||!items.length)return;lock.current=true;setBusy('download');setError('');setNotice('');try{const available=assets.filter(asset=>items.includes(asset.category)&&!asset.previewOnly).map(asset=>asset.id),chosen=available.filter(id=>selected.includes(id));const result=await fetchBookDownload(fetcher,brandId,{version,locale,format,items,sourceIds:chosen.length===available.length?undefined:chosen});saveBookDownload(result);setNotice(c.downloaded);}catch(e){setError(e.message==='BOOK_EDITION_UNAVAILABLE'?c.editionChanged:c.downloadFailed);}finally{lock.current=false;setBusy('');}}
 const loadShares=React.useCallback(async()=>{setListError(false);try{const response=await fetcher(`/api/brand-book/${encodeURIComponent(brandId)}/shares`);if(!response.ok)throw Error();const data=await response.json();setShares(data.shares||[]);}catch{setListError(true);}},[brandId,fetcher]);
 React.useEffect(()=>{if(panel==='share'&&shareable)loadShares();},[panel,shareable,loadShares]);
 async function createShare(){if(lock.current||!shareable)return;lock.current=true;setBusy('create');setError('');setNotice('');try{const response=await fetcher(`/api/brand-book/${encodeURIComponent(brandId)}/shares`,{method:'POST',body:JSON.stringify({version,locale,expiresInDays:expiry})});if(!response.ok)throw Error();const data=await response.json();setCreatedLink({url:publicBookShareUrl(data.url),expiresAt:data.expiresAt});setNotice(c.shareCreated);await loadShares();}catch{setError(c.shareFailed);}finally{lock.current=false;setBusy('');}}
 async function copyLink(){if(!createdLink)return;try{await navigator.clipboard.writeText(createdLink.url);setNotice(c.copied);}catch{linkInput.current?.focus();linkInput.current?.select();setNotice(c.copyHelp);}}
 async function revoke(id){if(lock.current||!shareable)return;lock.current=true;setBusy(id);setError('');setNotice('');try{const response=await fetcher(`/api/brand-book/${encodeURIComponent(brandId)}/shares/${encodeURIComponent(id)}`,{method:'DELETE'});if(!response.ok)throw Error();setNotice(c.revoked);setCreatedLink(null);await loadShares();}catch{setError(c.revokeFailed);}finally{lock.current=false;setBusy('');}}
 const date=value=>value?new Date(value).toLocaleString(locale,{dateStyle:'medium'}):'—';
 return <section className="book-guidelines" dir={locale==='ar'?'rtl':'ltr'}>
  <header className="book-guidelines-toolbar"><button className="btn btn--ghost btn--sm" onClick={onBack}>{c.back}</button><div className="book-guidelines-edition"><strong>{snapshot.brand.name}</strong><span>{certified?c.certified:c.draft} · {c.version} {version}</span></div><div className="book-guidelines-tools"><button className="btn btn--ghost btn--sm" disabled={!exportable||!!busy} onClick={()=>{setPanel(panel==='download'?null:'download');setError('');setNotice('');}}>{c.download}</button>{snapshot.canShare&&<button className="btn btn--primary btn--sm" disabled={!shareable||!!busy} onClick={()=>{setPanel(panel==='share'?null:'share');setError('');setNotice('');}}>{c.share}</button>}</div></header>
  {!certified&&<p role="status" className="book-guidelines-draft">{c.draftNotice}</p>}
  {(error||notice)&&<div className="book-guidelines-notice" role={error?'alert':'status'}>{error||notice}</div>}
  {panel&&<section className="book-guidelines-panel" aria-label={panel==='download'?c.downloadTitle:c.shareTitle}><header><h2>{panel==='download'?c.downloadTitle:c.shareTitle}</h2><button className="btn btn--ghost btn--sm" disabled={!!busy} onClick={()=>setPanel(null)}>{c.close}</button></header>
   {panel==='download'?<><fieldset className="book-guidelines-formats"><legend>{c.downloadTitle}</legend>{['website','kit'].map(value=><label key={value}><input type="radio" name="book-format" checked={format===value} disabled={!!busy} onChange={()=>setFormat(value)}/><span><strong>{c[value]}</strong><small>{c[`${value}Note`]}</small></span></label>)}</fieldset><fieldset className="book-guidelines-categories"><legend>{c.select}</legend>{BOOK_CATEGORIES.map(category=><label key={category}><input type="checkbox" checked={items.includes(category)} disabled={!!busy} onChange={()=>toggle(category,items,setItems)}/>{c[category]}</label>)}</fieldset><details className="book-guidelines-assets"><summary>{c.assets}</summary><p>{c.previewNote}</p>{assets.filter(asset=>items.includes(asset.category)).length?assets.filter(asset=>items.includes(asset.category)).map((asset,i)=><label key={asset.id}><input type="checkbox" disabled={!!busy||asset.previewOnly} checked={!asset.previewOnly&&selected.includes(asset.id)} onChange={()=>toggle(asset.id,selected,setSelected)}/><span>{asset.label||`${c.file} ${i+1}`}<small>{c[asset.category]}{asset.previewOnly&&` · ${c.previewOnly}`}</small></span></label>):<p>{c.noAssets}</p>}</details><p className="book-guidelines-rights">{c.rights}</p>{!items.length&&<p role="status">{c.chooseOne}</p>}<button className="btn btn--primary" disabled={!!busy||!items.length||!exportable} onClick={download}>{busy==='download'?c.preparing:c.downloadNow}</button>{error&&<button className="btn btn--ghost" disabled={!!busy} onClick={download}>{c.retry}</button>}</>:<><p>{c.shareNotice}</p><div className="book-guidelines-share-create"><label>{c.expiry}<select value={expiry} disabled={!!busy} onChange={event=>setExpiry(Number(event.target.value))}>{[7,30,90].map(days=><option key={days} value={days}>{days} {c.days}</option>)}</select></label><button className="btn btn--primary" disabled={!!busy||!shareable} onClick={createShare}>{busy==='create'?c.creating:c.create}</button></div>{createdLink&&<div className="book-guidelines-link"><input ref={linkInput} readOnly value={createdLink.url} aria-label={c.shareTitle}/><button className="btn btn--ghost btn--sm" onClick={copyLink}>{c.copy}</button><small>{c.expires} {date(createdLink.expiresAt)}</small></div>}<h3>{c.existing}</h3>{listError?<p role="alert">{c.listFailed}<button className="btn btn--ghost" onClick={loadShares}>{c.retry}</button></p>:shares===null?<p role="status">{c.loading}</p>:!shares.length?<p>{c.emptyShares}</p>:<ul className="book-guidelines-shares">{shares.map(share=><li key={share.id}><div><strong>{c.version} {share.version} · {share.locale?.toUpperCase()}</strong><small>{c.created} {date(share.createdAt)} · {c.expires} {date(share.expiresAt)}</small></div>{share.revokedAt?<span>{c.revoked}</span>:Date.parse(share.expiresAt)<Date.now()?<span>{c.expired}</span>:<button className="btn btn--ghost btn--sm" disabled={!!busy} onClick={()=>revoke(share.id)}>{busy===share.id?c.revoking:c.revoke}</button>}</li>)}</ul>}</>}
  </section>}
  <iframe className="book-guidelines-frame" title={`${snapshot.brand.name} · ${c.preview}`} srcDoc={html} sandbox="allow-scripts allow-downloads" referrerPolicy="no-referrer"/>
 </section>;
}
