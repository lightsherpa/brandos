import test from 'node:test';import assert from 'node:assert/strict';
import {stylesheetLinks,resolveVisualStyles,contrastRatio} from './discovery-styles.js';
test('linked Google/Adobe CSS and relative sheets are retained; private URLs are excluded',()=>{
 const html='<link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plex"><link rel="stylesheet" href="http://127.0.0.1/private">';
 assert.deepEqual(stylesheetLinks(html,'https://brand.test').sort(),['https://brand.test/brand.css','https://fonts.googleapis.com/css2?family=Plex'].sort());
});
test('extracts linked font declarations, palette roles and measured contrast with bounded imports',async()=>{
 const calls=[];const result=await resolveVisualStyles({html:'<link rel="stylesheet" href="/brand.css">',url:'https://brand.test',read:async url=>{calls.push(url);return url.endsWith('brand.css')?'@import "type.css"; :root{--brand-primary:#123456} body{background:#f5eddc;color:#123456}':'@font-face{font-family:"IBM Plex Sans";src:url("font.woff2")}';}});
 assert.equal(calls.length,2);assert.ok(result.type.some(t=>t.family==='IBM Plex Sans'));assert.ok(result.palette.some(c=>c.hex==='#123456'&&c.role==='primary'));assert.equal(result.computed,false);assert.equal(contrastRatio('#000000','#ffffff'),21);assert.ok(result.contrastPairs.length);
});
test('missing CSS stays an explicit gap and never produces invented values',async()=>{
 const result=await resolveVisualStyles({html:'<link rel="stylesheet" href="/missing.css">',url:'https://brand.test',read:async()=>{throw Error('404');}});assert.deepEqual(result.palette,[]);assert.equal(result.unreadableStylesheets.length,1);
});

test('page-specific brand styles win over generic widget and cookie CSS under the cap',()=>{
 const html=Array.from({length:9},(_,i)=>`<link rel="stylesheet" href="/plugins/widget${i}.css">`).join('')+'<link rel="stylesheet" href="/uploads/elementor/css/post-8.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Brand">';
 const links=stylesheetLinks(html,'https://brand.test');assert.equal(links.length,6);assert.ok(links.some(l=>l.includes('post-8')));assert.ok(links.some(l=>l.includes('fonts.googleapis')));
});

test('literal content fonts outrank unconsumed builder defaults',async()=>{
 const result=await resolveVisualStyles({html:'<style>:root{--e-global-typography-primary-font-family:"Roboto";--e-global-typography-secondary-font-family:"Roboto Slab"}.heading{font-family:"Meaty Nineties",sans-serif}nav{font-family:"Lexend",sans-serif}</style>',url:'https://brand.test'});
 assert.deepEqual(result.type.map(f=>f.family),['Meaty Nineties','Lexend']);
});
