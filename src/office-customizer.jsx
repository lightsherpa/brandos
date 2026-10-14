import React,{useState} from 'react';
import assets from './lib/agency-office-assets.json';
import {PROP_CATALOG} from './lib/office-customization.js';
import {FURNITURE_SURFACES} from './lib/office-surfaces.js';
export function OfficeCustomizer({pieces,selectedPiece,selectedScale,onSelect,onAdd,onRemove,onMove,onScale,onUndo,onReset,canUndo,extraCount,saveStatus}) {
 const [category,setCategory]=useState('All'),[target,setTarget]=useState('');
 const selected=pieces.find(p=>p.id===selectedPiece);
 const supports=pieces.filter(p=>FURNITURE_SURFACES[p.asset]);
 const currentTarget=supports.some(p=>p.id===target)?target:supports[0]?.id;
 return <div className="bs-customizer" aria-label="Office customization">
  <div className="bs-customizer-heading"><div><strong>Make this agency yours</strong><p>Drag furniture or use the arrow controls. Small props stay attached to their surface.</p></div><span role="status">{saveStatus}</span><button onClick={onUndo} disabled={!canUndo}>Undo</button><button onClick={onReset}>Restore default office</button></div>
  <div className="bs-prop-tools"><label>Selected prop <select aria-label="Selected office prop" value={selectedPiece||''} onChange={e=>onSelect(e.target.value)}><option value="">Choose a prop</option>{pieces.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label>
   {selected&&<><div className="bs-nudge" aria-label="Move selected prop">{[['←',-1,0,'Move left'],['↑',0,-1,'Move up'],['↓',0,1,'Move down'],['→',1,0,'Move right']].map(([label,dx,dy,name])=><button key={name} aria-label={name} disabled={Boolean(selected.parent&&!selected.binding)} onClick={()=>onMove(selected.id,selected.x+dx,selected.y+dy)}>{label}</button>)}</div>
    {!selected.parent&&<label>Size <input aria-label="Prop size" type="range" min="0.7" max="1.3" step="0.05" value={selectedScale} onChange={e=>onScale(selected.id,Number(e.target.value))}/></label>}
    <button onClick={()=>onRemove(selected.id)}>Remove prop</button></>}
  </div>
  <div className="bs-catalog-filters"><label>Category <select aria-label="Prop category" value={category} onChange={e=>setCategory(e.target.value)}>{['All','Plants','Furniture','Decor','Equipment'].map(c=><option key={c}>{c}</option>)}</select></label><label>Place small props on <select aria-label="Prop supporting surface" value={currentTarget||''} onChange={e=>setTarget(e.target.value)}>{supports.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label><small>{extraCount}/80 added props</small></div>
  <div className="bs-prop-catalog">{PROP_CATALOG.filter(p=>category==='All'||p.category===category).map(prop=><button key={prop.key} disabled={extraCount>=80||(prop.kind==='surface'&&!currentTarget)} onClick={()=>onAdd(prop,currentTarget)} aria-label={`Add ${prop.name}`}><img src={assets[prop.asset].src} alt="" loading="lazy"/><strong>{prop.name}</strong><small>{prop.kind==='surface'?'On selected surface':prop.kind==='wall'?'Display decor':'On the floor'}</small></button>)}</div>
 </div>;
}
