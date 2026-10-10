import React from 'react';
import {useLocale} from './lib/i18n.js';
import './bio-competitive.css';
export function safeCompetitiveUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function CompetitiveRecords({kind,items=[],editing=false,onChange,compact=false}){
 const {t}=useLocale();const rows=Array.isArray(items)?items:[];const competitor=kind==='competitors';
 const keys=competitor&&compact?['name','url','reasonToChoose']:competitor?['name','url','positioning','reasonToChoose','difference','source','sourceDate']:['claim','proof','rationale','source'];
 const change=(index,key,value)=>onChange(rows.map((row,i)=>i===index?{...row,[key]:value}:row));
 return <div className="bio-landscape-records">
  {!rows.length&&<p className="bio-landscape-empty">{t('discovery.landscape.'+(competitor?'emptyCompetitors':'emptyDifferences'))}</p>}
  {rows.map((raw,index)=>{const row=raw&&typeof raw==='object'?raw:{name:String(raw),claim:String(raw)};return <article className="bio-landscape-record" key={row.id||index}>
   <header><h4>{row.name||row.claim||t('discovery.landscape.'+(competitor?'newCompetitor':'newDifference'))}</h4>{editing&&<button type="button" onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>{t('discovery.landscape.remove')}</button>}</header>
   {competitor&&(editing?<label>{t('discovery.landscape.type')}<select value={row.type||'unspecified'} onChange={e=>change(index,'type',e.target.value)}>{['unspecified','direct','indirect','status_quo'].map(type=><option key={type} value={type}>{t('discovery.landscape.'+type)}</option>)}</select></label>:<p>{t('discovery.landscape.'+(row.type||'unspecified'))}</p>)}
   <p className="bio-landscape-notice">{t('discovery.landscape.clientInput')}</p>
   <div className="bio-landscape-fields">{keys.map(key=>editing?<label key={key}>{t('discovery.landscape.'+key)}{['positioning','reasonToChoose','difference','proof','rationale'].includes(key)?<textarea rows={3} value={row[key]||''} onChange={e=>change(index,key,e.target.value)}/>:<input type={key==='sourceDate'?'date':'text'} value={row[key]||''} onChange={e=>change(index,key,e.target.value)}/>}</label>:<div key={key}><strong>{t('discovery.landscape.'+key)}</strong><p>{row[key]?(key==='url'||key==='source')&&safeCompetitiveUrl(row[key])?<a href={safeCompetitiveUrl(row[key])} target="_blank" rel="noopener noreferrer">{row[key]}</a>:row[key]:t('discovery.landscape.notProvided')}</p></div>)}</div>
   {!competitor&&!row.proof&&<p className="bio-landscape-notice">{t('discovery.landscape.needsProof')}</p>}
  </article>})}
  {editing&&<button type="button" onClick={()=>onChange([...rows,{id:crypto.randomUUID(),...(competitor?{name:'',type:'unspecified'}:{claim:''})}])}>{t('discovery.landscape.'+(competitor?'addCompetitor':'addDifference'))}</button>}
 </div>;
}
export function BioCompetitive({value={},editing,onChange,aspirations}){
 const {t}=useLocale();const patch=(key,next)=>onChange({...value,[key]:next});
 return <section className="bio-landscape" aria-label={t('discovery.chapter.positioning.label')}><h2>{t('discovery.chapter.positioning.label')}</h2><p>{t('discovery.chapter.positioning.blurb')}</p>
  {aspirations?.direction&&<section><h3>{t('discovery.sourcesIntake.aspirations')}</h3><p>{aspirations.direction}</p><ul>{(aspirations.notYetTrue||[]).map((item,i)=><li key={i}>{item}</li>)}</ul></section>}
  <h3>{t('discovery.field.positioning.frameOfReference')}</h3>{editing?<label>{t('discovery.landscape.marketPrompt')}<textarea rows={3} value={value.frameOfReference||''} onChange={e=>patch('frameOfReference',e.target.value)}/></label>:<p>{value.frameOfReference||t('discovery.landscape.notProvided')}</p>}
  <h3>{t('discovery.field.positioning.competitors')}</h3><CompetitiveRecords kind="competitors" items={value.competitors} editing={editing} onChange={next=>patch('competitors',next)}/>
  <h3>{t('discovery.field.positioning.pointsOfDifference')}</h3><CompetitiveRecords kind="differences" items={value.pointsOfDifference} editing={editing} onChange={next=>patch('pointsOfDifference',next)}/>
  {['pointsOfParity','researchGaps'].map(key=><section key={key}><h3>{t('discovery.field.positioning.'+key)}</h3>{editing?<label>{t('discovery.landscape.onePerLine')}<textarea rows={3} value={(value[key]||[]).join('\n')} onChange={e=>patch(key,e.target.value.split('\n').filter(s=>s.trim()))}/></label>:<ul>{(value[key]||[]).length?(value[key]||[]).map((item,i)=><li key={i}>{item}</li>):<li>{t('discovery.landscape.notProvided')}</li>}</ul>}</section>)}
 </section>;
}
