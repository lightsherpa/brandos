import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DESKTOP_ITEMS,SURFACE_ITEMS,FURNITURE_SURFACES,surfaceAttachment} from './office-surfaces.js';
import {OFFICE_DECOR} from './generated-office-layout.js';
const assets=JSON.parse(readFileSync(new URL('./agency-office-assets.json',import.meta.url)));
const furniture=OFFICE_DECOR.map(([id,asset,x,y,width])=>({id,asset,x,y,width}));

test('all accessory contact points stay on supported surfaces, away from front panels',()=>{
 const check=(parent,item)=>{
  const surface=FURNITURE_SURFACES[parent.asset];
  assert.ok(surface,parent.asset);
  assert.ok(item.v>=surface.back&&item.v<surface.front,item.id||item.suffix);
  assert.ok(item.u-item.ratio/2>=surface.left&&item.u+item.ratio/2<=surface.right,item.id||item.suffix);
  assert.ok(assets[item.asset],item.asset);
  const piece=surfaceAttachment(parent,item,assets);
  assert.ok(piece.y<parent.y);
  assert.ok(piece.depth>Math.round(parent.y));
 };
 for(const item of SURFACE_ITEMS) check(furniture.find(p=>p.id===item.parent),item);
 for(const asset of ['WORK-01-desk-oak','WORK-08-desk-cream'])
  for(const item of DESKTOP_ITEMS) check({id:'desk',asset,x:42,y:37,width:12},item);
});

test('accessories move and scale with the parent instead of remaining at global coordinates',()=>{
 const parent={id:'desk',asset:'WORK-01-desk-oak',x:42,y:37,width:12};
 for(const item of DESKTOP_ITEMS) {
  const before=surfaceAttachment(parent,item,assets);
  const moved=surfaceAttachment({...parent,x:parent.x+7,y:parent.y+10},item,assets);
  assert.equal(moved.x,before.x+7);
  assert.ok(Math.abs(moved.y-before.y-10)<1e-10);
  const doubled=surfaceAttachment({...parent,width:24},item,assets);
  assert.ok(Math.abs(doubled.x-parent.x-2*(before.x-parent.x))<1e-10);
  assert.ok(Math.abs(doubled.y-parent.y-2*(before.y-parent.y))<1e-10);
  assert.equal(doubled.width,before.width*2);
 }
});

test('changing desk finish recalculates the attachment height for the new source geometry',()=>{
 const parent={id:'desk',asset:'WORK-01-desk-oak',x:42,y:37,width:12};
 const oak=surfaceAttachment(parent,DESKTOP_ITEMS[0],assets);
 const cream=surfaceAttachment({...parent,asset:'WORK-08-desk-cream'},DESKTOP_ITEMS[0],assets);
 assert.notEqual(cream.y,oak.y);
 assert.equal(cream.x,oak.x);
 assert.equal(cream.width,oak.width);
});
