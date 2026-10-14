import {test} from 'node:test';
import assert from 'node:assert/strict';
import { embedExportAssets, exportSocialPng } from './stable-export.js';
test('stable export embeds licensed font, logo and photograph and records hashes',async()=>{
 const assets=[];const layer1={logo:{url:'https://a/logo',sourceId:'logo'},fonts:{display:'Fraunces'},font_assets:[{family:'Fraunces',url:'https://a/font',sourceId:'font',license:'open_source',license_reference:'OFL',rights_confirmed:true}]};
 const out=await embedExportAssets('<head></head><img src="https://a/logo"><img src="https://a/photo">',{layer1,imageUrl:'https://a/photo',fetchAsset:async(url)=>{assets.push(url);return {dataUrl:'data:image/png;base64,YQ==',type:'image/png',bytes:Buffer.from(url)};}});
 assert.equal(assets.length,3);assert.ok(out.html.includes('@font-face'));assert.ok(!out.html.includes('src="https://'));assert.equal(out.assets.length,3);assert.ok(out.assets.every(a=>/^[a-f0-9]{64}$/.test(a.sha256)));assert.equal(out.stable,true);
});
test('unlicensed font fails closed',async()=>{await assert.rejects(embedExportAssets('<head></head>',{layer1:{font_assets:[{family:'X',url:'https://a'}]}}),/licensed/i);});
test('PNG waits for images and fonts and refuses remote resources',async()=>{
 await assert.rejects(exportSocialPng('<img src="https://a/x">',{chromium:{}}),/embedded/i);
 let closed=false;let size;
 const page={route:async()=>{},setContent:async()=>{},evaluate:async()=>{},screenshot:async(opts)=>{size=opts;return Buffer.from('PNG');}};
 const chromium={launch:async()=>({newPage:async()=>page,close:async()=>{closed=true;}})};
 const png=await exportSocialPng('<html><img src="data:image/png;base64,YQ=="></html>',{chromium,width:1080,height:1350});assert.equal(png.toString(),'PNG');assert.equal(size.type,'png');assert.ok(closed);
});
