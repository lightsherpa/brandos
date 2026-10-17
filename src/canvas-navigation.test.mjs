import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('Canvas navigation keeps explicit parents and isolates persistent pin choices by user',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {CanvasNavigation,canvasNavigationCopy,readCanvasPin,writeCanvasPin}=await vite.ssrLoadModule('/src/canvas-navigation.jsx');
 const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
 assert.equal(readCanvasPin(storage,'oscar'),false);writeCanvasPin(storage,'oscar',true);assert.equal(readCanvasPin(storage,'oscar'),true);assert.equal(readCanvasPin(storage,'other'),false);
 writeCanvasPin(storage,'oscar',false);assert.equal(readCanvasPin(storage,'oscar'),false);
 assert.equal(readCanvasPin({getItem(){throw Error();}},'oscar'),false);assert.doesNotThrow(()=>writeCanvasPin({setItem(){throw Error();}},'oscar',true));
 writeCanvasPin(storage,null,true);assert.equal(readCanvasPin(storage,null),false);
 const detail=renderToStaticMarkup(React.createElement(CanvasNavigation,{briefName:'Granada, primera rebanada',deliverableName:'Social Post',onBrief:()=>{},onCanvas:()=>{}}));
 assert.match(detail,/Back to Canvas/);assert.match(detail,/Granada, primera rebanada/);assert.match(detail,/aria-current="page"[^>]*>Social Post/);
 const canvas=renderToStaticMarkup(React.createElement(CanvasNavigation,{briefName:'Granada, primera rebanada',onBrief:()=>{},onCanvas:()=>{}}));assert.match(canvas,/Back to brief/);assert.doesNotMatch(canvas,/aria-current/);
 for(const locale of ['es','ar'])assert.deepEqual(Object.keys(canvasNavigationCopy(locale)).sort(),Object.keys(canvasNavigationCopy('en')).sort());
});
