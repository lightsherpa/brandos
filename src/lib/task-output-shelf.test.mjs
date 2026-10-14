import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
const result=await build({entryPoints:[new URL('./task-output-shelf.jsx',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',external:['react']});
const file=new URL(`./.shelf-${crypto.randomUUID()}.mjs`,import.meta.url);
await writeFile(file,result.outputFiles[0].text);
let OutputShelfCard;try{({OutputShelfCard}=await import(file.href));}finally{await unlink(file);}
const copy={flagged:'Needs review',stopped:'Failed',approved:'Approved',done:'Complete'};
for(const status of ['needs_review','pending','ready','done',undefined])test(`shelf ${status} remains pending review`,()=>{
 const html=renderToStaticMarkup(React.createElement(OutputShelfCard,{node:{id:'email',title:'Saved email',status,platform:'email'},copy}));
 assert.match(html,/<small>Needs review \/ email<\/small>/);assert.doesNotMatch(html,/Complete|Approved/);
});
for(const [status,label] of [['failed','Failed'],['approved','Approved']])test(`shelf shows explicit ${status}`,()=>{
 const html=renderToStaticMarkup(React.createElement(OutputShelfCard,{node:{id:'item',title:'Saved',status},copy}));assert.match(html,new RegExp(`<small>${label}</small>`));
});
test('failed specialist state stays failed without an output status',()=>{
 const html=renderToStaticMarkup(React.createElement(OutputShelfCard,{node:{id:'failed',state:'failed',title:'Failed output'},copy}));assert.match(html,/<small>Failed<\/small>/);
});
test('persisted qa_passed is displayed as Needs review, never Approved',()=>{
 const html=renderToStaticMarkup(React.createElement(OutputShelfCard,{node:{id:'auto',status:'qa_passed'},copy}));assert.match(html,/<small>Needs review<\/small>/);assert.doesNotMatch(html,/Approved/);
});
test('legacy task QA approval without human workflow metadata never renders Approved',async()=>{
 const {expandOutput}=await import('./task-output.js');
 const persisted={id:'legacy-task',kind:'task',status:'approved',body:{task_id:'t',type:'email_sequence',items:[{status:'ready'}]}};
 const [card]=expandOutput(persisted);
 const html=renderToStaticMarkup(React.createElement(OutputShelfCard,{node:card,copy}));assert.match(html,/<small>Needs review<\/small>/);assert.doesNotMatch(html,/Approved/);
 const [reviewed]=expandOutput({...persisted,workflow_status:'internally_approved',internal_reviewed_by:'human',internal_reviewed_at:'time'});
 assert.match(renderToStaticMarkup(React.createElement(OutputShelfCard,{node:reviewed,copy})),/<small>Approved<\/small>/);
});
