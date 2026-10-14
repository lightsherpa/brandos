import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractLogo} from './extract-logo.js';
import {resolveVisualStyles} from './discovery-styles.js';
const html=readFileSync(new URL('./fixtures/discovery/lamasbonita.html',import.meta.url),'utf8');
const css=readFileSync(new URL('./fixtures/discovery/lamasbonita.css',import.meta.url),'utf8');
const url='https://www.lamasbonita.es/';
test('real La Más Bonita div.topbar markup yields its 75x95 logo, never favicon',()=>{
 assert.equal(extractLogo(html,url)?.url,'https://www.lamasbonita.es/assets/images/logo.webp');
});
test('Organization logo outranks header and og image; ico and small candidates are rejected',()=>{
 const json='<script type="application/ld+json">{"@type":"Organization","logo":"/brand.png"}</script>';
 assert.equal(extractLogo('<header><img alt="logo" src="/header.png"></header>'+json,url).url,new URL('/brand.png',url).href);
 assert.equal(extractLogo('<header><img alt="logo" width="32" height="32" src="/small.png"><img alt="logo" src="/favicon.ico"></header>',url),null);
});
test('real stylesheet prioritizes header/button colour evidence over gray text and unused declarations',async()=>{
 const result=await resolveVisualStyles({html,url,read:async href=>href.endsWith('/main.css')?css:''});
 assert.equal(result.palette.find(c=>c.role==='primary')?.hex,'#6fd4e4');
 assert.ok(result.palette.find(c=>c.hex==='#6fd4e4').evidence.some(e=>/topbar|button/.test(e)));
 assert.equal(result.computed,false);
});
test('computed logo/CTA colour beats more frequent body text and saturated unused colour',async()=>{
 const result=await resolveVisualStyles({html:'',url,computedSamples:[{kind:'button',colors:['#6fd4e4','#ffffff']},...Array.from({length:40},()=>({kind:'body',colors:['#262628']}))]});
 assert.equal(result.palette.find(c=>c.role==='primary')?.hex,'#6fd4e4');
 assert.ok(result.palette.every(c=>c.evidence?.length));
});
test('neutral-only computed samples retain evidenced CSS brand proposal with truthful declaration status',async()=>{
 const result=await resolveVisualStyles({html,url,read:async href=>href.endsWith('/main.css')?css:'',computedSamples:[{kind:'body',colors:['#262628']} ]});
 const primary=result.palette.find(c=>c.role==='primary');
 assert.equal(primary?.hex,'#6fd4e4');assert.equal(primary.usageStatus,'declared-not-computed');
});
test('combined computed/declaration palette has unique foundation roles and dark text remains ink',async()=>{
 const result=await resolveVisualStyles({html,url,read:async href=>href.endsWith('/main.css')?css:'',computedSamples:[{kind:'body',colors:['#262628']},{kind:'background',colors:['#eeeeee']}]});
 for(const role of ['primary','ink','surface'])assert.ok(result.palette.filter(c=>c.role===role).length<=1);
 assert.equal(result.palette.find(c=>c.hex==='#262628').role,'ink');
});
