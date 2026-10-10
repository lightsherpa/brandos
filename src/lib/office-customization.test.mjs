import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyCustomization,composeOfficePieces,moveOfficePiece,readOfficeCustomization,officeStorageKey,sanitizeOfficeCustomization,PROP_CATALOG} from './office-customization.js';
const assets=JSON.parse(fs.readFileSync(new URL('./agency-office-assets.json',import.meta.url)));
test('moving a workstation carries its laptop and chair, preserving relative positions',()=>{
 const config=emptyCustomization(),pieces=composeOfficePieces(config,assets),desk=pieces.find(p=>p.id==='strategy-desk');
 const after=composeOfficePieces(moveOfficePiece(config,desk,desk.x+4,desk.y+3,assets,pieces),assets);
 for(const id of ['strategy-desk-laptop','strategy-chair']){
  const old=pieces.find(p=>p.id===id),next=after.find(p=>p.id===id);
  assert.equal(next.x,old.x+4);assert.equal(next.y,old.y+3);
 }
});
test('added surface props fit their support and disappear when the parent is removed',()=>{
 const config=emptyCustomization();config.extras=[{id:'custom-mug',asset:'DECOR-13-mug',name:'Coffee mug',kind:'surface',parent:'strategy-desk',u:5,v:5,ratio:.05}];
 const pieces=composeOfficePieces(config,assets),mug=pieces.find(p=>p.id==='custom-mug');
 assert.equal(mug.binding.u,.895);assert.ok(Math.abs(mug.binding.v-.265)<1e-10);
 const moved=moveOfficePiece(config,mug,-100,-100,assets,pieces);
 const next=composeOfficePieces(moved,assets).find(p=>p.id===mug.id);assert.ok(next.binding.u>=.105);assert.ok(next.binding.v>=.055);
 config.hidden=['strategy-desk'];assert.ok(!composeOfficePieces(config,assets).some(p=>p.parent==='strategy-desk'||p.id==='strategy-chair'));
});
test('browser storage isolates projects and recovers corrupt data',()=>{
 const map=new Map([[officeStorageKey('a'),JSON.stringify({...emptyCustomization(),deskStyle:'cream'})],[officeStorageKey('b'),'invalid']]);
 const storage={getItem:key=>map.get(key)};
 assert.equal(readOfficeCustomization(storage,'a').deskStyle,'cream');assert.equal(readOfficeCustomization(storage,'b').deskStyle,'oak');assert.equal(readOfficeCustomization(storage,'c').deskStyle,'oak');
 const catalog=PROP_CATALOG[0];const sanitized=sanitizeOfficeCustomization({...emptyCustomization(),extras:Array.from({length:100},(_,i)=>({id:'custom-'+i,asset:catalog.asset,x:Infinity,y:-100,width:999}))});
 assert.equal(sanitized.extras.length,80);assert.equal(sanitized.extras[0].width,catalog.width);assert.equal(sanitized.extras[0].y,14);
 assert.ok(PROP_CATALOG.every(prop=>assets[prop.asset]));
});
test('stock accessory placement survives saving and reloading',()=>{
 const config=emptyCustomization(),pieces=composeOfficePieces(config,assets),lamp=pieces.find(p=>p.id==='strategy-desk-lamp');
 const next=moveOfficePiece(config,lamp,lamp.x-1,lamp.y,assets,pieces);
 const restored=sanitizeOfficeCustomization(JSON.parse(JSON.stringify(next)));
 assert.deepEqual(composeOfficePieces(next,assets),composeOfficePieces(restored,assets));
});
