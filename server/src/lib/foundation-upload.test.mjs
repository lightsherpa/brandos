import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {foundationUploadError} from './foundation-upload.js';
test('logo metadata alone cannot certify an unreadable or misnamed image',async()=>{
 assert.equal((await foundationUploadError(Buffer.from('fake PNG'),'png',{asset_role:'logo'})).code,'LOGO_INVALID');
 const png=await readFile(new URL('./fixtures/social/square.png',import.meta.url));
 assert.equal(await foundationUploadError(png,'png',{asset_role:'logo'}),null);
 assert.equal((await foundationUploadError(png,'svg',{asset_role:'logo'})).code,'LOGO_SVG');
});
test('licensed font metadata requires real font bytes',async()=>{
 assert.equal((await foundationUploadError(Buffer.from('fake font'),'woff2',{asset_kind:'font'})).code,'FONT_INVALID');
 assert.equal(await foundationUploadError(await readFile(new URL('./assets/fonts/instrument-sans.ttf',import.meta.url)),'ttf',{asset_kind:'font'}),null);
});
