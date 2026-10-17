import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
process.env.VITE_SUPABASE_URL||='http://127.0.0.1:54321';
process.env.VITE_SUPABASE_ANON_KEY||='test';

test('customer task cards retain QA checks and rule-save; the full Stepper remains available',async t=>{
 const previous=globalThis.window;globalThis.window={useSession:()=>({scope:'workspace',persona:'user'})};
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
 t.after(async()=>{globalThis.window=previous;await vite.close();});
 const {ItemCard,Stepper}=await vite.ssrLoadModule('/src/task-pipeline.jsx');
 const html=renderToStaticMarkup(React.createElement(ItemCard,{type:'email_sequence',taskId:'task',onItem:()=>{},item:{index:0,status:'flagged',html:'<p>Email</p>',copy:{subject:'Granada'},checks:[{id:'BANNED',pass:false,reason:'Forbidden: corporate'}],review:[]}}));
 assert.match(html,/Save as rule/);assert.match(html,/Forbidden: corporate/);assert.match(html,/1 issue/);
 assert.doesNotMatch(html,/How it was made|Written by|L2-/);
 const stepper=renderToStaticMarkup(React.createElement(Stepper,{stage:'Checking',status:'running'}));
 for(const label of ['Planning','Writing','Designing','Checking','Fixing','Needs review'])assert.ok(stepper.includes(label),label);
});
