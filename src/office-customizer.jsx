import React,{useState} from 'react';
import {officeText as ot} from './lib/office-copy.js';
import {useLocale} from './lib/i18n.js';
import assets from './lib/agency-office-assets.json';
import {PROP_CATALOG} from './lib/office-customization.js';
import {FURNITURE_SURFACES} from './lib/office-surfaces.js';
export function OfficeCustomizer({pieces,selectedPiece,selectedScale,onSelect,onAdd,onRemove,onMove,onScale,onUndo,onReset,canUndo,extraCount,saveStatus}) {
 useLocale();
 const [category,setCategory]=useState('All'),[target,setTarget]=useState('');
 const selected=pieces.find(p=>p.id===selectedPiece);
 const supports=pieces.filter(p=>FURNITURE_SURFACES[p.asset]);
 const currentTarget=supports.some(p=>p.id===target)?target:supports[0]?.id;
 return <div className="bs-customizer" aria-label={ot("Office customization")}>
  <div className="bs-customizer-heading"><div><strong>{ot("Make this agency yours")}</strong><p>{ot("Drag furniture or use the arrow controls. Small props stay attached to their surface.")}</p></div><span role="status">{ot(saveStatus)}</span><button onClick={onUndo} disabled={!canUndo}>{ot("Undo")}</button><button onClick={onReset}>{ot("Restore default office")}</button></div>
  <div className="bs-prop-tools"><label>{ot("Selected prop")} <select aria-label={ot("Selected office prop")} value={selectedPiece||''} onChange={e=>onSelect(e.target.value)}><option value="">{ot("Choose a prop")}</option>{pieces.map(p=><option key={p.id} value={p.id}>{ot(p.name||p.id)}</option>)}</select></label>
   {selected&&<><div className="bs-nudge" aria-label={ot("Move selected prop")}>{[['←',-1,0,'Move left'],['↑',0,-1,'Move up'],['↓',0,1,'Move down'],['→',1,0,'Move right']].map(([label,dx,dy,name])=><button key={name} aria-label={ot(name)} disabled={Boolean(selected.parent&&!selected.binding)} onClick={()=>onMove(selected.id,selected.x+dx,selected.y+dy)}>{label}</button>)}</div>
    {!selected.parent&&<label>{ot("Size")} <input aria-label={ot("Prop size")} type="range" min="0.7" max="1.3" step="0.05" value={selectedScale} onChange={e=>onScale(selected.id,Number(e.target.value))}/></label>}
    <button onClick={()=>onRemove(selected.id)}>{ot("Remove prop")}</button></>}
  </div>
  <div className="bs-catalog-filters"><label>{ot("Category")} <select aria-label={ot("Prop category")} value={category} onChange={e=>setCategory(e.target.value)}>{['All','Plants','Furniture','Decor','Equipment'].map(c=><option key={c} value={c}>{ot(c)}</option>)}</select></label><label>{ot("Place small props on")} <select aria-label={ot("Prop supporting surface")} value={currentTarget||''} onChange={e=>setTarget(e.target.value)}>{supports.map(p=><option key={p.id} value={p.id}>{ot(p.name||p.id)}</option>)}</select></label><small>{ot("{count}/80 added props",{count:extraCount})}</small></div>
  <div className="bs-prop-catalog">{PROP_CATALOG.filter(p=>category==='All'||p.category===category).map(prop=><button key={prop.key} disabled={extraCount>=80||(prop.kind==='surface'&&!currentTarget)} onClick={()=>onAdd(prop,currentTarget)} aria-label={ot("Add {name}",{name:ot(prop.name)})}><img src={assets[prop.asset].src} alt="" loading="lazy"/><strong>{ot(prop.name)}</strong><small>{ot(prop.kind==='surface'?'On selected surface':prop.kind==='wall'?'Display decor':'On the floor')}</small></button>)}</div>
 </div>;
}
