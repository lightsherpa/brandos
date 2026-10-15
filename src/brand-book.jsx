import React from 'react';
import {useLocale} from './lib/i18n.js';
import {useLiveBio,BioReviewSection} from './portal-discovery.jsx';
import {productionBlocker} from '../server/src/lib/bio-stage.js';
import {SectionTour} from './section-tour.jsx';
import './brand-book.css';
import {BrandBookV2,brandBookV2Enabled} from './brand-book-v2.jsx';

function hasPendingFields(payload,section){return !Object.keys(payload.confidence||{}).some(k=>k.startsWith(section+'.'))||(section==='positioning'&&!!payload.positioning?.researchGaps?.length)||(payload.missing||[]).some(m=>m.field?.startsWith(section+'.'))||Object.entries(payload.confidence||{}).some(([key,value])=>key.startsWith(section+'.')&&Number(value?.conf)<85);}
const SECTIONS=['identity','positioning','audience','voice','visual','strategic'];
function sourcesFor(payload,section){
 return [...new Set(Object.entries(payload.confidence||{}).filter(([key,value])=>key.startsWith(section+'.')&&value?.source).map(([,value])=>String(value.source).replace(/steward edit/g,"Creative director")))].slice(0,4);
}
export function BrandBook({go,param}){
 const replayName=param?.startsWith('replay/')?param.slice(7):null;
 const {t,locale}=useLocale(),live=useLiveBio({enabled:!replayName,brandId:param&&!replayName?param:null}),[replay,setReplay]=React.useState(null),[error,setError]=React.useState(null);
 React.useEffect(()=>{
  if(!replayName)return;
  if(!['cake-me','geoking','demo'].includes(replayName)){setError(t('brandBook.replayUnavailable'));return;}
  let active=true;fetch(`/demo/bio/${replayName}.json`).then(r=>{if(!r.ok)throw Error(t('brandBook.replayUnavailable'));return r.json();}).then(value=>{if(active){if(value.unavailable)setError(t('brandBook.sourceFailure'));else setReplay(value);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
 },[replayName]);
 const bio=replayName?replay?.bio:live.bio,payload=bio?.payload||{},brandName=replayName?replay?.brandName:live.brandName;
 const certified=bio&&!productionBlocker(bio),by=replayName?replay?.certifier:live.cert?.byName;
 if(error)return <div className="brand-book"><p role="alert">{error}</p></div>;
 if(!bio)return <div className="brand-book"><h1>{t('brandBook.title')}</h1><p>{live.loading||replayName?t('brandBook.loading'):t('brandBook.noBio')}</p>{!replayName&&<button className="btn btn--primary" onClick={()=>go('discovery')}>{t('brandBook.startDiscovery')}</button>}</div>;
 if(brandBookV2Enabled())return <BrandBookV2 {...{bio,payload,brandName,certified,go,locale}} brandId={live.brandId} replay={!!replayName}/>;
 return <article className="brand-book">
  <header className="brand-book-header"><div><span className="brand-book-kicker">{t('brandBook.title')} · Brand Core v{bio.version}</span><h1>{brandName}</h1><p>{certified?t('brandBook.certified',{name:by||t('brandBook.director'),version:bio.version}):t('brandBook.pending')}</p>{replayName&&<small>{t('brandBook.replayLabel')}</small>}</div><button className="btn btn--ghost" onClick={()=>go('bio')}>{t('brandBook.back')}</button></header>
  <SectionTour scope="brand-book" steps={[{target:'#brand-book-index',title:t('brandBook.tourTitle'),text:t('brandBook.tourText')},{target:'#book-visual',title:t('brandBook.visualTourTitle'),text:t('brandBook.visualTourText')}]}/>
  <div className="brand-book-layout"><nav id="brand-book-index" aria-label={t('brandBook.sections')}>{SECTIONS.map((section,index)=><a key={section} href={`#book-${section}`} onClick={e=>{e.preventDefault();document.getElementById(`book-${section}`)?.scrollIntoView({behavior:'smooth',block:'start'});}}><span>{String(index+1).padStart(2,'0')}</span>{t('brandBook.section.'+section)}</a>)}</nav>
   <div>{SECTIONS.map(section=><section className="brand-book-section" id={`book-${section}`} key={section}><div className="brand-book-section-heading"><h2>{t('brandBook.section.'+section)}</h2><span className="brand-book-status">{t(certified&&!hasPendingFields(payload,section)?'brandBook.certifiedLabel':'brandBook.pending')}</span></div><BioReviewSection payload={payload} section={section}/><div className="brand-book-provenance" aria-label={t('brandBook.provenance')}>{sourcesFor(payload,section).map(source=><span key={source} title={source}>{source}</span>)}{!sourcesFor(payload,section).length&&<span>{t('brandBook.sourceGap')}</span>}</div></section>)}</div>
  </div>
 </article>;
}
Object.assign(window,{BrandBook});
