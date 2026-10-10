import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {officeKey} from './office-copy.js';import {PROP_CATALOG,composeOfficePieces,emptyCustomization} from './office-customization.js';
test('EN/ES/AR customization catalogs cover every stock piece and catalog item with stable values',async()=>{
 const assets=JSON.parse(await readFile(new URL('./agency-office-assets.json',import.meta.url)));const names=[...PROP_CATALOG.map(p=>p.name),...composeOfficePieces(emptyCustomization(),assets).map(p=>p.name||p.id)];let base;
 for(const locale of ['en','es','ar']){const data=JSON.parse(await readFile(new URL('../locales/'+locale+'.json',import.meta.url)));const keys=Object.keys(data.office).sort();if(base)assert.deepEqual(keys,base);base=keys;for(const name of names)assert.ok(data.office[officeKey(name).slice(7)],`${locale}: ${name}`);assert.ok(data.canvas.open_original_video);}
 assert.equal(PROP_CATALOG.find(p=>p.key==='snake').name,'Snake plant');assert.equal(PROP_CATALOG.find(p=>p.key==='snake').category,'Plants');
});
