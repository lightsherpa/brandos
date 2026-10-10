import React from 'react';
import {useLocale} from './lib/i18n.js';
export function SectionTour({scope,steps}){
 const {t}=useLocale();
 const key=`caastor:tour:v1:${window.CI_USER?.id||'local'}:${scope}`;
 const [index,setIndex]=React.useState(()=>{try{return localStorage.getItem(key)?-1:0;}catch{return 0;}});
 const finish=()=>{try{localStorage.setItem(key,'seen');}catch{}setIndex(-1);};
 React.useEffect(()=>{
  if(index<0)return;
  const target=steps[index]?.target&&document.querySelector(steps[index].target);
  if(!target)return;
  if(target.tagName==='DETAILS')target.open=true;
  target.classList.add('discovery-tour-target');

  return()=>target.classList.remove('discovery-tour-target');
 },[index,scope]);
 if(index<0)return <button type="button" className="discovery-tour-replay" onClick={()=>setIndex(0)}>{t('discovery.tour.help')}</button>;
 const step=steps[index];
 return <aside className="discovery-tour" aria-label={t('discovery.tour.label')}>
  <div className="discovery-tour-top"><span>{t('discovery.tour.step',{current:index+1,total:steps.length})}</span><button type="button" onClick={finish}>{t('discovery.tour.dismiss')}</button></div>
  <h2>{step.title}</h2><p>{step.text}</p><div className="discovery-tour-actions"><button type="button" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>{t('discovery.tour.back')}</button><button type="button" onClick={()=>index===steps.length-1?finish():setIndex(i=>i+1)}>{t(index===steps.length-1?'discovery.tour.done':'discovery.tour.next')}</button></div>
 </aside>;
}
