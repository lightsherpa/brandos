import {test} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';import {readFile} from 'node:fs/promises';
test('foundation strip renders Missing states and three role swatches for legacy Cake Me',async t=>{
 const vite=await createServer({server:{middlewareMode:true,ws:false},appType:'custom',define:{'import.meta.env.VITE_UI_FIXTURE':'"1"'}});t.after(()=>vite.close());
 const {FoundationStrip}=await vite.ssrLoadModule('/src/brand-foundation.jsx');
 const payload=JSON.parse(await readFile(new URL('./fixtures/cake-me-foundation.json',import.meta.url),'utf8'));
 const html=renderToStaticMarkup(React.createElement(FoundationStrip,{brandId:'local',payload,onSave:()=>{}}));
 assert.match(html,/Brand Core · Foundation/);assert.equal((html.match(/foundation-missing/g)||[]).length,8);
 assert.match(html,/Upload light logo/);assert.match(html,/Upload dark logo/);assert.match(html,/Upload \/ choose font/);
 assert.equal((html.match(/class="foundation-swatch"/g)||[]).length,3);
 assert.match(html,/enable certification/);
 assert.match(html,/Instrument Sans · flagged fallback/);
 assert.match(html,/FoundationFallbackInstrument/);
});
test('Brand Core remains a proper name in Spanish and Arabic',async()=>{
 for(const locale of ['es','ar']){const messages=JSON.parse(await readFile(new URL(`./locales/${locale}.json`,import.meta.url),'utf8'));assert.equal(messages.nav.bio,'Brand Core');assert.equal(messages.discovery.bio.eyebrow,'Brand Core');}
});
