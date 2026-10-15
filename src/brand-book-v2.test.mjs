import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
process.env.VITE_SUPABASE_URL||='http://127.0.0.1:54321';process.env.VITE_SUPABASE_ANON_KEY||='test';
const fixture={bio:{version:3},brandName:'Cake Me',brandId:'cake',certified:true,payload:{identity:{positioning:'Happiness in every bite'},voice:{register:'Warm and playful',signatures:['Made with heart']},visual:{logo:{sourceId:'main',variants:{a:{sourceId:'main',use:'primary'},b:{sourceId:'mark',use:'mark'}}},palette:[{hex:'#ffee00',role:'primary',usage:'Lead surfaces'},...Array.from({length:5},(_,i)=>({hex:'#110011',group:'accent',name:`Accent ${i}`}))],type:[{family:'Cake Family',sourceId:'font',kind:'Display'}],references:[{sourceId:'product',tag:'product',name:'Cake photo'}]}},sources:[{id:'main',evidence_url:'https://assets.test/main.png'},{id:'mark',evidence_url:'https://assets.test/mark.png'},{id:'product',evidence_url:'https://assets.test/cake.jpg'}],go:()=>{}};
test('editorial brand book renders real strategy, unlimited palette, voice examples and signed logo/reference assets',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {BrandBookV2}=await vite.ssrLoadModule('/src/brand-book-v2.jsx');const html=renderToStaticMarkup(React.createElement(BrandBookV2,fixture));
 for(const content of ['Happiness in every bite','Made with heart','Lead surfaces','Accent 4','book2-strategy','book2-visual','book2-voice','https://assets.test/cake.jpg','Brand Core'])assert.ok(html.includes(content),content);
 assert.doesNotMatch(html,/Certify/);
 assert.equal((html.match(/src="https:\/\/assets.test\/main.png"/g)||[]).length,2);
 assert.match(html,/On light/);assert.match(html,/On dark/);assert.doesNotMatch(html,/sourceId|"identity"|"visual"/);
});
test('only loaded brand font is described as a live specimen with H1–H6 and body',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());const {BookFontSpecimen}=await vite.ssrLoadModule('/src/brand-book-v2.jsx');
 const html=renderToStaticMarkup(React.createElement(BookFontSpecimen,{font:{family:'Commercial Cake',kind:'Both',weight:600},loadedFamily:'BrandFont-commercial',scale:{h1:58}}));
 for(const level of ['H1','H2','H3','H4','H5','H6','BODY'])assert.ok(html.includes(level));assert.match(html,/BrandFont-commercial/);assert.match(html,/--book-specimen-family/);assert.match(html,/font-family:inherit/);assert.equal((html.match(/The quick brown fox/g)||[]).length,7);assert.match(html,/font-size:58px/);
 const unavailable=renderToStaticMarkup(React.createElement(BookFontSpecimen,{font:{family:'Unloaded Cake'}}));assert.match(unavailable,/Font preview unavailable/);assert.doesNotMatch(unavailable,/The quick brown fox/);
});
test('book copy translates all controls into Spanish and Arabic while keeping Brand Core',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());const {BrandBookV2,bookCopy}=await vite.ssrLoadModule('/src/brand-book-v2.jsx');
 for(const locale of ['es','ar']){const html=renderToStaticMarkup(React.createElement(BrandBookV2,{...fixture,locale}));assert.ok(html.includes(bookCopy[locale].strategy));assert.ok(html.includes(bookCopy[locale].certified));assert.match(html,/Brand Core/);assert.doesNotMatch(html,/Certify/);}assert.match(renderToStaticMarkup(React.createElement(BrandBookV2,{...fixture,locale:'ar'})),/dir="rtl"/);
});
test('brand book flag defaults off and logo deduplication keeps all variants',async t=>{
 const vite=await createServer({define:{'import.meta.env.VITE_BRAND_BOOK_V2':'undefined'},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());const {bookLogos,brandBookV2Enabled}=await vite.ssrLoadModule('/src/brand-book-v2.jsx');assert.equal(brandBookV2Enabled(),false);const logos=bookLogos(fixture.payload.visual.logo);assert.equal(logos.length,2);assert.equal(logos[1].use,'mark');
});
test('owner confirmation is an obvious primary action before section content, with a sticky final footer',async t=>{
 const vite=await createServer({define:{'import.meta.env.VITE_CERTIFY_UX':'"1"'},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
 const {CertificationDialog}=await vite.ssrLoadModule('/src/bio-self-certification.jsx');
 const html=renderToStaticMarkup(React.createElement(CertificationDialog,{embedded:true,brandId:'cake',brandName:'Cake Me',bio:{id:'bio',version:3,payload:fixture.payload},renderSection:()=>React.createElement('p',null,'SECTION CONTENT'),onClose:()=>{}}));
 assert.match(html,/bio-cert-section-action/);assert.match(html,/Confirm &amp; review next section/);assert.ok(html.indexOf('Confirm &amp; review next section')<html.indexOf('SECTION CONTENT'));assert.match(html,/bio-cert-primary-footer/);assert.match(html,/Continue to final confirmation/);assert.doesNotMatch(html,/<input type="checkbox"/);
});
