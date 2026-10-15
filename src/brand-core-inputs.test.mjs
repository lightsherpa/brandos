import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('enabled Brand Core input screen renders all variants, refs and colours without truncation',async t=>{
 const vite=await createServer({server:{middlewareMode:true,ws:false},appType:'custom',define:{'import.meta.env.VITE_UI_FIXTURE':'"1"','import.meta.env.VITE_BRAND_CORE_INPUTS':'"1"'}});t.after(()=>vite.close());
 const {FoundationStrip}=await vite.ssrLoadModule('/src/brand-foundation.jsx');
 const variants=Object.fromEntries(Array.from({length:9},(_,i)=>[`logo-${i}`,{sourceId:`logo-${i}`,name:`Variant ${i}`,use:'primary'}]));
 const references=Array.from({length:11},(_,i)=>({sourceId:`ref-${i}`,name:`Reference ${i}`,tag:'lifestyle',role:'canonical'}));
 const palette=Array.from({length:8},(_,i)=>({role:'tertiary',group:'tertiary',name:`Tertiary ${i}`,hex:'#eecc11'}));
 const html=renderToStaticMarkup(React.createElement(FoundationStrip,{brandId:'local',payload:{visual:{logo:{variants},references,palette}}}));
 assert.equal((html.match(/<figure/g)||[]).length,20);
 assert.match(html,/Variant 8/);assert.match(html,/Reference 10/);assert.match(html,/Tertiary 7/);
 assert.match(html,/Brand \/ lifestyle/);assert.match(html,/up to 10 images/);assert.match(html,/Edit Brand Core inputs/);
 assert.doesNotMatch(html,/Failed to fetch|window.alert/);
});
