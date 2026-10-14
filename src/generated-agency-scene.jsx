import React,{useRef} from 'react';
import assets from './lib/agency-office-assets.json';
// Crop padded source bounds in CSS; the supplied full-resolution PNGs stay intact.
function Piece({id,asset,x,y,width,depth,parent,name,editing,selected,onPick,onMove,children}) {
 const drag=useRef(null);
 const source=assets[asset];
 const [iw,ih]=source.size,[left,top,right,bottom]=source.bounds;
 const w=right-left,h=bottom-top;
 return <div className={`bs-furniture ${editing?'is-editable':''} ${selected?'is-prop-selected':''}`} role={editing?'button':undefined} tabIndex={editing?0:undefined} aria-label={editing?`Select ${name||id}`:undefined}
  onPointerDown={editing?event=>{event.stopPropagation();onPick(id);const rect=event.currentTarget.closest('.bs-stage').getBoundingClientRect();drag.current={px:event.clientX,py:event.clientY,x,y,rect};event.currentTarget.setPointerCapture(event.pointerId);}:undefined}
  onPointerMove={editing?event=>{if(!drag.current)return;const d=drag.current;onMove(id,d.x+(event.clientX-d.px)/d.rect.width*100,d.y+(event.clientY-d.py)/d.rect.height*100);}:undefined}
  onPointerUp={editing?event=>{drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId);}:undefined}
  onPointerCancel={()=>{drag.current=null;}}
  onKeyDown={editing?event=>{const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(event.key==='Enter'||event.key===' '){event.preventDefault();onPick(id);}if(steps[event.key]){event.preventDefault();onPick(id);onMove(id,x+steps[event.key][0],y+steps[event.key][1]);}}:undefined} data-office-piece={id} data-asset={asset} data-surface-parent={parent} style={{left:x+'%',top:y+'%',width:width+'%',aspectRatio:`${w}/${h}`,zIndex:depth??Math.round(y)}}>
  {children}
  <img src={source.src} alt="" draggable={false} style={{width:iw/w*100+'%',height:ih/h*100+'%',left:-left/w*100+'%',top:-top/h*100+'%'}} />
 </div>;
}
export function GeneratedAgencyScene({pieces=[],editing=false,selectedPiece,onPick,onMove}) {
 return <>
  <img className="bs-room-shell" src={assets['ENV-01-empty-studio'].src} alt="" draggable={false}/>
  {pieces.map(piece=><Piece key={piece.id} {...piece} editing={editing} selected={selectedPiece===piece.id} onPick={onPick} onMove={onMove}/>)}
 </>;
}
