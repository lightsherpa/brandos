import React from 'react';
import {useLocale} from './lib/i18n.js';
export function DiscoverySourceReferences({items,onChange}){
 const {t}=useLocale();
 const change=(id,key,value)=>onChange(items.map(row=>row.id===id?{...row,[key]:value}:row));
 return <section className="discovery-intake-section discovery-references" aria-labelledby="discovery-reference-heading">
   <div className="discovery-section-heading"><span className="discovery-section-number">02</span><div><h2 id="discovery-reference-heading">{t('discovery.intake.references')}</h2><p>{t('discovery.intake.referencesHelp')}</p></div></div>
   {items.length===0&&<p className="discovery-reference-empty">{t('discovery.intake.referenceEmpty')}</p>}
   <ol className="discovery-reference-list">{items.map((row,i)=><li className="discovery-reference-row" key={row.id}>
     <div className="discovery-reference-fields"><label htmlFor={`reference-url-${row.id}`}><span className="sr-only">{t('discovery.sourcesIntake.url')} {i+1}</span><input id={`reference-url-${row.id}`} value={row.url} onChange={e=>change(row.id,'url',e.target.value)} placeholder="https://"/></label>
     <label><span className="sr-only">{t('discovery.sourcesIntake.purpose')} {i+1}</span><select value={row.purpose} onChange={e=>change(row.id,'purpose',e.target.value)}>{['current','aspiration','competitive'].map(key=><option key={key} value={key}>{t('discovery.sourcesIntake.'+key)}</option>)}</select></label>
     <button type="button" className="discovery-icon-action" aria-label={t('discovery.intake.removeReference',{count:i+1})} onClick={()=>onChange(items.filter(item=>item.id!==row.id))}>×</button></div>
     <details className="discovery-reference-note" open={row.note?true:undefined}><summary>{t('discovery.intake.referenceNote')}</summary><label><span className="sr-only">{t('discovery.sourcesIntake.note')}</span><textarea value={row.note} onChange={e=>change(row.id,'note',e.target.value)} rows={2} placeholder={t('discovery.intake.notePlaceholder')}/></label></details>
   </li>)}</ol>
   <button type="button" className="discovery-text-action" disabled={items.length>=6} onClick={()=>onChange([...items,{id:crypto.randomUUID(),url:'',purpose:'current',note:''}])}><span aria-hidden="true">＋</span> {t('discovery.sourcesIntake.add')}</button>
 </section>;
}
