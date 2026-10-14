import {OFFICE_DECOR,OFFICE_ART,OFFICE_STATIONS} from './generated-office-layout.js';
import {DESKTOP_ITEMS,SURFACE_ITEMS,surfaceAttachment,FURNITURE_SURFACES,OFFICE_ASPECT} from './office-surfaces.js';

export const PROP_CATALOG = [
 ['plant','Floor plant','DECOR-06-floor-plant',3.2,'Plants','floor'],
 ['snake','Snake plant','DECOR-20-snake-plant',2.3,'Plants','floor'],
 ['cactus','Column cactus','DECOR-17-column-cactus',2.4,'Plants','floor'],
 ['barrel','Barrel cactus','DECOR-18-barrel-cactus',2.5,'Plants','floor'],
 ['pear','Prickly pear','DECOR-19-prickly-pear',2.5,'Plants','floor'],
 ['shelf-plant','Small potted plant','DECOR-09-shelf-plant',0.16,'Plants','surface'],
 ['sofa','Charcoal sofa','DECOR-04-sofa',11,'Furniture','floor'],
 ['armchair','Lounge armchair','DECOR-21-lounge-armchair',4,'Furniture','floor'],
 ['table','Coffee table','DECOR-05-coffee-table',6,'Furniture','floor'],
 ['cabinet','Storage cabinet','DECOR-11-storage-cabinet',9,'Furniture','floor'],
 ['shelf','Oak bookshelf','DECOR-10-oak-bookshelf',4,'Furniture','floor'],
 ['desk','Oak desk','WORK-01-desk-oak',12,'Furniture','floor'],
 ['cream-desk','Cream desk','WORK-08-desk-cream',12,'Furniture','floor'],
 ['chair','Orange office chair','WORK-02-chair-orange-front',2.8,'Furniture','floor'],
 ['rug','Studio rug','DECOR-12-rug',12,'Decor','floor'],
 ['frame','Empty frame','DECOR-02-frame-square',4,'Decor','wall'],
 ['art','Abstract artwork','DECOR-03-abstract-art',4,'Decor','wall'],
 ['board','Concept board','DECOR-16-concept-pinboard',7,'Decor','wall'],
 ['laptop','Laptop','WORK-03-laptop-open',0.225,'Equipment','surface'],
 ['monitor','Monitor','WORK-04-monitor',0.25,'Equipment','surface'],
 ['lamp','Task lamp','WORK-12-task-lamp',0.105,'Equipment','surface'],
 ['notebook','Notebook','DECOR-15-notebook',0.125,'Equipment','surface'],
 ['mug','Coffee mug','DECOR-13-mug',0.05,'Equipment','surface'],
 ['coffee','Coffee machine','DECOR-14-coffee-machine',0.2,'Equipment','surface'],
].map(([key,name,asset,width,category,kind])=>({key,name,asset,width,category,kind}));
const knownAssets=new Set(PROP_CATALOG.map(p=>p.asset));
export const emptyCustomization=()=>({version:1,deskStyle:'oak',showArt:true,overrides:{},bindings:{},hidden:[],extras:[]});
export function officeStorageKey(scope) {return `brandos-generated-office-v1:${scope}`;}
const finite=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
export function sanitizeOfficeCustomization(raw) {
 const result=emptyCustomization();
 if(!raw||raw.version!==1) return result;
 result.deskStyle=raw.deskStyle==='cream'?'cream':'oak';result.showArt=raw.showArt!==false;
 result.hidden=Array.isArray(raw.hidden)?raw.hidden.filter(id=>typeof id==='string'&&id.length<100).slice(0,250):[];
 for(const [id,value] of Object.entries(raw.overrides||{}).slice(0,250)) {
  if(id.length>100||!value||typeof value!=='object') continue;
  result.overrides[id]={x:finite(value.x,50,3,97),y:finite(value.y,70,14,83),scale:finite(value.scale,1,0.7,1.3)};
 }
 for(const [id,value] of Object.entries(raw.bindings||{}).slice(0,250)) {
  if(id.length<100&&value&&typeof value==='object')result.bindings[id]={u:finite(value.u,0.5,0.1,0.9),v:finite(value.v,0.15,0.055,0.29)};
 }
 const ids=new Set();
 for(const piece of Array.isArray(raw.extras)?raw.extras.slice(0,80):[]) {
  if(!piece||typeof piece.id!=='string'||!/^custom-[a-z0-9-]+$/i.test(piece.id)||ids.has(piece.id)||!knownAssets.has(piece.asset))continue;
  ids.add(piece.id);
  const catalog=PROP_CATALOG.find(c=>c.asset===piece.asset);
  if(catalog.kind==='surface'&&(typeof piece.parent!=='string'||piece.parent.length>100))continue;
  result.extras.push({id:piece.id,asset:piece.asset,name:catalog.name,kind:catalog.kind,x:finite(piece.x,50,3,97),y:finite(piece.y,75,14,83),width:catalog.width,parent:catalog.kind==='surface'?piece.parent:undefined,u:finite(piece.u,0.5,0.1,0.9),v:finite(piece.v,0.15,0.055,0.29),ratio:catalog.width});
 }
 return result;
}
export function readOfficeCustomization(storage,scope) {
 try{return sanitizeOfficeCustomization(JSON.parse(storage.getItem(officeStorageKey(scope))));}catch{return emptyCustomization();}
}
export function composeOfficePieces(config,assets) {
 const hidden=new Set(config.hidden);
 const apply=piece=>{
  const override=config.overrides[piece.id];
  return override?{...piece,x:override.x,y:override.y,width:piece.width*override.scale,depth:piece.depth===0?0:Math.round(override.y)}:piece;
 };
 const roots=OFFICE_DECOR.map(([id,asset,x,y,width,depth])=>({id,asset,x,y,width,depth,name:id.replaceAll('-',' ')}));
 for(const {id,x,y} of OFFICE_STATIONS)roots.push({id:`${id}-desk`,asset:config.deskStyle==='cream'?'WORK-08-desk-cream':'WORK-01-desk-oak',x,y,width:12,name:`${id} workstation`});
 if(config.showArt)for(const [id,asset,x,y,width,depth] of OFFICE_ART)roots.push({id,asset,x,y,width,depth,name:id.replaceAll('-',' ')});
 roots.push(...config.extras.filter(p=>p.kind!=='surface').map(p=>({...p,depth:p.asset==='DECOR-12-rug'?0:undefined})));
 const furniture=roots.filter(p=>!hidden.has(p.id)).map(apply);
 const attachments=[];
 const add=(item)=>{
  if(hidden.has(item.id))return;
  const parent=furniture.find(p=>p.id===item.parent);if(!parent)return;
  const surface=FURNITURE_SURFACES[parent.asset];if(!surface)return;
  item={...item,...config.bindings?.[item.id]};
  const safe={...item,u:finite(item.u,0.5,surface.left+item.ratio/2,surface.right-item.ratio/2),v:finite(item.v,0.15,surface.back,surface.front-0.025)};
  attachments.push({...surfaceAttachment(parent,safe,assets),name:item.name||item.id.replaceAll('-',' '),binding:safe});
 };
 for(const item of SURFACE_ITEMS)add(item);
 for(const {id,x,y} of OFFICE_STATIONS) {
  const parent=furniture.find(p=>p.id===`${id}-desk`);if(!parent)continue;
  const shift=config.overrides[parent.id];
  const chair=apply({id:`${id}-chair`,asset:'WORK-02-chair-orange-front',x:parent.x,y:parent.y+7*(shift?.scale||1),width:2.8*(shift?.scale||1),name:`${id} chair`});
  if(!hidden.has(chair.id))attachments.push(chair);
  for(const item of DESKTOP_ITEMS)add({...item,id:`${id}-desk-${item.suffix}`,parent:parent.id});
 }
 for(const item of config.extras.filter(p=>p.kind==='surface'))add(item);
 for(const piece of furniture.filter(p=>p.asset==='DECOR-03-abstract-art'&&p.id.startsWith('studio-art'))) {
  const id=`${piece.id}-frame`;if(!hidden.has(id))attachments.push({id,asset:'DECOR-02-frame-square',x:piece.x,y:piece.y+0.8,width:piece.width+1.2,depth:(piece.depth??Math.round(piece.y))+1,name:'Artwork frame',parent:piece.id});
 }
 return [...furniture,...attachments];
}
export function moveOfficePiece(config,piece,x,y,assets,pieces) {
 if(piece.binding) {
  const parent=pieces.find(p=>p.id===piece.parent);const surface=FURNITURE_SURFACES[parent.asset];
  const [l,t,r,b]=assets[parent.asset].bounds;
  const height=parent.width*(b-t)/(r-l)*OFFICE_ASPECT;
  const u=finite(0.5+(x-parent.x)/parent.width,0.5,surface.left+piece.binding.ratio/2,surface.right-piece.binding.ratio/2);
  const v=finite(1-(parent.y-y)/height,0.15,surface.back,surface.front-0.025);
  if(config.extras.some(p=>p.id===piece.id))return {...config,extras:config.extras.map(p=>p.id===piece.id?{...p,u,v}:p)};
  return {...config,bindings:{...config.bindings,[piece.id]:{u,v}}};
 }
 if(piece.parent)return config;
 const scale=config.overrides[piece.id]?.scale||1;
 const half=piece.width/2;
 return {...config,overrides:{...config.overrides,[piece.id]:{x:finite(x,piece.x,3+half,97-half),y:finite(y,piece.y,18,82),scale}}};
}
