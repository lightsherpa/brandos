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
 const {CertifyReview}=await vite.ssrLoadModule('/src/certify/LegacyCertifyView.jsx');
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

test('Certify UX starts in review with focus and Stewart visible and one final entry',async(t)=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {ModernCertifyReview}=await vite.ssrLoadModule('/src/certify/CertifyView.jsx');
 const html=renderToStaticMarkup(React.createElement(ModernCertifyReview,{data:data()}));
 assert.match(html,/Focus first/);assert.match(html,/Stewart/);assert.match(html,/certify-support/);assert.match(html,/How the brand looks/);assert.match(html,/ⓘ/);
 assert.equal((html.match(/>Review confirmation<\/button>/g)||[]).length,1);
 assert.doesNotMatch(html,/Add to S3|Copy question|Human certification seal|not yet true/);
});
test('font specimens render H1 to H6 and body using the brand family',async(t)=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {ClaimValue}=await vite.ssrLoadModule('/src/certify/CertifyView.jsx');
 const html=renderToStaticMarkup(React.createElement(ClaimValue,{claim:{field_path:'visual.type',value:[{family:'Cake Commercial'}]}}));
 for(const label of ['H1','H2','H3','H4','H5','H6','BODY'])assert.ok(html.includes(label));
 assert.match(html,/Cake Commercial/);assert.equal((html.match(/The quick brown fox/g)||[]).length,7);
});
test('competitors expose source links beside each rendered finding',async(t)=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {ClaimValue}=await vite.ssrLoadModule('/src/certify/CertifyView.jsx');
 const html=renderToStaticMarkup(React.createElement(ClaimValue,{claim:{field_path:'positioning.competitors',value:[{name:'Bakery',source:'https://bakery.test/about',positioning:'Daily treats'}]}}));
 assert.match(html,/href="https:\/\/bakery.test\/about"/);assert.match(html,/Daily treats/);
});
test('Stewart shows the deterministic case file, current risks, sources and review actions',async(t)=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {StewartSupport}=await vite.ssrLoadModule('/src/certify/CertifyView.jsx');
 const claim={field_path:'identity.positioning',evidence:[{label:'Brand website',url:'https://brand.test/about'}]};
 const copilot={caseFile:{readiness:{level:'steward-ready'},risks:[{field:'identity.positioning',reason:'Conflicting evidence or values exist for this claim.',action:'Resolve before certification.'},{field:'voice.register',reason:'UNRELATED RISK'}],changes:[],sourceSummary:{count:4},claims:{sourceBacked:[{}]}},suggestions:[{id:'ask-position',field:'identity.positioning',type:'ask_client',reason:'This high-impact Brand Core field is empty and should not be invented.'}]};
 const html=renderToStaticMarkup(React.createElement(StewartSupport,{claim,copilot,locale:'en',localLabel:()=> 'Positioning'}));
 assert.match(html,/Ready for review/);assert.match(html,/Conflicting evidence/);assert.match(html,/Resolve before certification/);assert.match(html,/href="https:\/\/brand.test\/about"/);assert.match(html,/Suggested actions/);assert.match(html,/Review evidence/);assert.match(html,/Dismiss suggestion/);assert.doesNotMatch(html,/UNRELATED RISK/);
});
