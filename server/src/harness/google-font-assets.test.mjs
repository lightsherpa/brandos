import {test} from 'node:test';import assert from 'node:assert/strict';
import {googleFontRequest,parseGoogleFontFaces,hydrateGoogleFontAssets} from './google-font-assets.js';
import {buildLayer1} from './brand-core.js';import {assertCompositionBrand} from './render.js';import {embedExportAssets} from './stable-export.js';
const font={family:'Lato',provider:'google',weight:'400',style:'normal'};
const css=`@font-face{font-family:'Lato';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/lato/v24/latin-ext.woff2) format('woff2');unicode-range:U+0100-02FF;}@font-face{font-family:'Lato';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/lato/v24/latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131;}`;
test('requests exact allowlisted family, weights and styles',()=>{
 assert.match(googleFontRequest({...font,weights:['700','400'],style:'italic'}),/Lato:ital,wght@1,400;1,700/);
 assert.throws(()=>googleFontRequest({...font,family:'untrusted;url(x)'}),/Unsupported/);
 assert.throws(()=>googleFontRequest({...font,weight:'400;'}),/weight/);
});
test('Google faces preserve subset unicode ranges, provenance and licensing',()=>{
 const faces=parseGoogleFontFaces(css,font);assert.equal(faces.length,2);
 assert.equal(faces[0].unicode_range,'U+0100-02FF');assert.equal(faces[1].unicode_range,'U+0000-00FF,U+0131');
 assert.ok(faces.every(f=>f.family==='Lato'&&f.weight==='400'&&f.style==='normal'&&f.license==='open_source'&&f.rights_confirmed&&f.sourceId.startsWith('google-font:Lato:')));
});
test('malicious URLs, wrong families/styles and unavailable faces fail closed',()=>{
 for(const bad of [css.replaceAll('fonts.gstatic.com','evil.test'),css.replaceAll("'Lato'","'Arial'"),css.replaceAll('font-style:normal','font-style:italic'),css.replaceAll('U+0100-02FF','U+ZZZZ'), '']) assert.throws(()=>parseGoogleFontFaces(bad,font));
 assert.throws(()=>parseGoogleFontFaces(css,{...font,weight:'700'}),/style unavailable/);
});
test('runtime hydration keeps the uploaded display face and fetches exact Google body/label faces',async()=>{
 const original=buildLayer1({bio:{visual:{type:[{kind:'Display',family:'Meaty Nineties',url:'https://assets.test/meaty',sourceId:'uploaded',license:'commercial',suggest:'Invoice',rights_confirmed:true,weight:'500',style:'italic'},{kind:'Body',...font},{kind:'Label',family:'Inter',provider:'google',weight:'600'}],logo:{url:'https://assets.test/logo',sourceId:'logo'}}}});
 const calls=[];const resolved=await hydrateGoogleFontAssets(original,{cacheEnabled:false,fetchCss:async url=>{calls.push(url);return new Response(url.includes('Inter')?css.replaceAll('Lato','Inter').replaceAll('400','600'):css);}});
 assert.equal(calls.length,2);assert.equal(original.font_assets.length,1);assert.equal(resolved.font_assets.length,5);
 assert.equal(resolved.font_assets[0].family,'Meaty Nineties');assert.equal(resolved.font_assets[0].weight,'500');assert.equal(resolved.font_assets[0].style,'italic');
 assert.ok(resolved.font_assets.some(f=>f.family==='Lato'));assert.ok(resolved.font_assets.some(f=>f.family==='Inter'));
 const old=process.env.CREW_CANVAS;process.env.CREW_CANVAS='1';try{assert.doesNotThrow(()=>assertCompositionBrand(resolved));assert.throws(()=>assertCompositionBrand(original),/body font unavailable/);}finally{if(old===undefined)delete process.env.CREW_CANVAS;else process.env.CREW_CANVAS=old;}
});
test('font subset embedding keeps unicode ranges and metadata instead of overriding the family',async()=>{
 const assets=parseGoogleFontFaces(css,font);const out=await embedExportAssets('<head></head>',{layer1:{font_assets:assets},fetchAsset:async()=>({dataUrl:'data:font/woff2;base64,YQ==',type:'font/woff2',bytes:Buffer.from('font')})});
 assert.equal((out.html.match(/@font-face/g)||[]).length,2);assert.match(out.html,/unicode-range:U\+0100-02FF/);assert.match(out.html,/unicode-range:U\+0000-00FF,U\+0131/);assert.equal(out.assets[0].unicode_range,'U+0100-02FF');assert.equal(out.assets[0].weight,'400');
});
test('Google hydration failure and oversized stylesheet never substitute another font',async()=>{
 await assert.rejects(hydrateGoogleFontAssets({google_fonts:[font]},{cacheEnabled:false,fetchCss:async()=>new Response('not found',{status:404})}),/unavailable/);
 await assert.rejects(hydrateGoogleFontAssets({google_fonts:[font]},{cacheEnabled:false,fetchCss:async()=>new Response('x'.repeat(128*1024+1))}),/too large/);
});
