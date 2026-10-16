import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {deliveryCopy} from './locales/grouped-deliverables-copy.js';
const groups=['social_post','email','hero_kv'].map((type,index)=>({id:type+'-1',index:0,type,status:index===2?'attention':'review',complete:index!==2,credits:12,text:'Approved copy',subject:type==='email'?'Hola Granada':''}));
test('Canvas renders exactly three deliverable cards, one status and credit total each, with one final Delivery',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {DeliveryBoard}=await vite.ssrLoadModule('/src/grouped-deliverables.jsx');
 const html=renderToStaticMarkup(React.createElement(DeliveryBoard,{brief:{id:'granada',title:'Granada, primera rebanada'},deliverables:groups,Canvas:({nodeData,renderNode})=>React.createElement('div',{'data-canvas':'existing'},nodeData.map(node=>React.createElement('div',{key:node.id},renderNode(node))))}));
 assert.match(html,/data-canvas="existing"/);assert.equal((html.match(/data-deliverable-card=/g)||[]).length,3);for(const name of ['Social Post','Email','Hero KV'])assert.ok(html.includes(name));assert.equal((html.match(/>Download all<\/button>/g)||[]).length,1);assert.equal((html.match(/>Copy share link<\/button>/g)||[]).length,1);assert.doesNotMatch(html,/L2-|Social Captions|Subject Lines|Email Sequence|streaming|How it was made/);assert.match(html,/Needs attention/);assert.match(html,/Brandolph/);
});
test('new copy covers exactly the same controls in en/es/ar, including all status labels',()=>{
 const keys=Object.keys(deliveryCopy('en')).sort();for(const locale of ['es','ar']){const copy=deliveryCopy(locale);assert.deepEqual(Object.keys(copy).sort(),keys);assert.ok(Object.values(copy).every(value=>typeof value==='string'&&value.trim()));assert.match(copy.intro,/Brandolph/);for(const status of ['working','review','delivered','attention'])assert.ok(copy[status]);}
});
test('live customer previews never display streamed fragments before a production step finishes',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {runsFromCanvas}=await vite.ssrLoadModule('/src/grouped-deliverables.jsx');
 const runs=runsFromCanvas([{id:'live',kind:'specialist',specId:'a16',state:'running',outputText:'PRIVATE UNFINISHED TOKENS'}]);
 assert.deepEqual(runs[0].outputs,[]);assert.equal(runs[0].status,'running');
});
