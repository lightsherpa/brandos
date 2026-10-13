import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {DEFAULT_RUBRIC} from '../../server/src/lib/evaluate-certification.js';
import {buildClaimLedger} from '../../server/src/lib/claim-ledger.js';
process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:54321';process.env.VITE_SUPABASE_ANON_KEY ||= 'test';
const data=()=>{const payload={identity:{positioning:'Baked for joy'},visual:{logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Instrument Sans',provider:'google'}]},confidence:{'identity.positioning':{conf:90,source:'https://brand.test'}},evidence:{'identity.positioning':'Baked for joy, every day.'}};const sources=[{id:'logo',src:'logo.png',kind:'file_upload',evidence_url:'https://files.test/logo.png',signals:{mime:'image/png'}}];return {job:{brand_id:'brand',status:'in_review',brand:{name:'Cake Me'},bio:{id:'bio',payload}},sources,certify:{logoRights:['logo'],...buildClaimLedger({brandId:'brand',bioVersion:2,payload,sources})},rubric:DEFAULT_RUBRIC};};
test('intro shows real foundation candidates and source previews without agent content',async(t)=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {CertifyReview}=await vite.ssrLoadModule('/src/certify/CertifyView.jsx');
 const html=renderToStaticMarkup(React.createElement(CertifyReview,{data:data()}));
 assert.match(html,/Brand in 60 seconds/);assert.match(html,/Baked for joy/);assert.match(html,/https:\/\/files.test\/logo.png/);assert.match(html,/Instrument Sans/);assert.match(html,/Start review/);
 assert.doesNotMatch(html,/assistant|copilot|\bBIO\b|Caastor/i);
});
test('evidence card renders excerpts, source URL, screenshot and an explicit missing state',async(t)=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {ClaimEvidence}=await vite.ssrLoadModule('/src/certify/CertifyView.jsx');
 const claim={claim_id:'c',evidence:[{label:'https://brand.test',quote:'Baked for joy',url:'https://brand.test',screenshot:'https://files.test/site.png',first_party:true}]};
 const html=renderToStaticMarkup(React.createElement(ClaimEvidence,{claim}));
 assert.match(html,/Baked for joy/);assert.match(html,/href="https:\/\/brand.test"/);assert.match(html,/src="https:\/\/files.test\/site.png"/);
 assert.match(renderToStaticMarkup(React.createElement(ClaimEvidence,{claim:{claim_id:'missing',evidence:[]}})),/To confirm · No evidence yet/);
});
