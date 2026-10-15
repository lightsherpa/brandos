import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileIssue,appendUploadedAsset,fontDescriptors,uploadMetadata,uploadErrorCopyKey,LOGO_USES,PALETTE_GROUPS,MAX_REFERENCE_BATCH,MAX_REFERENCE_BYTES,MAX_ASSET_BYTES,brandCoreInputsEnabled} from './brand-core-inputs.js';
import {MAX_REFERENCE_BYTES as SERVER_REFERENCE_BYTES, MAX_UPLOAD_BYTES} from '../../server/src/lib/ingest-guards.js';
import {validateFoundationVisual,logoSourceIds} from '../../server/src/lib/brand-foundation.js';
import {validateVisualAssetMetadata} from '../../server/src/lib/ingest-guards.js';
import {brandCoreInputsCopy} from '../locales/brand-core-inputs-copy.js';

test('Brand Core inputs flag defaults off and reference batch limit is ten',()=>{
 assert.equal(brandCoreInputsEnabled,false);assert.equal(MAX_REFERENCE_BATCH,10);
});
test('file errors distinguish empty, size and unsupported format without rejecting future files',()=>{
 assert.equal(MAX_REFERENCE_BYTES,SERVER_REFERENCE_BYTES);
 assert.equal(MAX_ASSET_BYTES,MAX_UPLOAD_BYTES);
 assert.equal(fileIssue({name:'one.png',size:0},'logo'),'empty');
 assert.equal(fileIssue({name:'one.png',size:15*1024*1024+1},'logo'),'size');
 assert.equal(fileIssue({name:'one.png',size:5*1024*1024+1},'reference'),'size');
 assert.equal(fileIssue({name:'one.png',size:5*1024*1024},'reference'),null);
 assert.equal(fileIssue({name:'one.png',size:5*1024*1024+1},'logo'),null);
 assert.equal(fileIssue({name:'one.woff2',size:15*1024*1024},'font'),null);
 assert.equal(fileIssue({name:'one.svg',size:120},'logo'),'format');
 assert.equal(fileIssue({name:'one.PNG',size:120},'logo'),null);
 assert.equal(fileIssue({name:'one.webp',size:120},'reference'),null);
 assert.equal(fileIssue({name:'one.woff2',size:120},'font'),null);
});
test('413 and payload-too-large map to the size toast, not a generic failure',()=>{
 assert.equal(uploadErrorCopyKey({code:'PAYLOAD_TOO_LARGE',error:'Request body too large'},413),'size');
 assert.equal(uploadErrorCopyKey({code:'TOO_LARGE'},413),'size');
 assert.equal(uploadErrorCopyKey({},413),'size');
 assert.equal(uploadErrorCopyKey({error:'Upload needs attention'},400),null);
 assert.equal(brandCoreInputsCopy.en.size,'File too large · max 5 MB for references / 15 MB for logos and fonts');
 for(const locale of ['en','es','ar']){
  assert.match(brandCoreInputsCopy[locale].size,/5/);
  assert.match(brandCoreInputsCopy[locale].size,/15/);
  assert.match(brandCoreInputsCopy[locale].imageFormats,/5/);
  assert.match(brandCoreInputsCopy[locale].logoFormats,/15/);
  assert.match(brandCoreInputsCopy[locale].fontHelp,/15/);
 }
});
test('logo variants retain every upload and independently carry one of the seven uses',()=>{
 let visual={};
 for(let i=0;i<21;i++)visual=appendUploadedAsset(visual,{kind:'logo',file:{name:`logo-${i}.png`},tag:LOGO_USES[i%7]},{id:`logo-${i}`},'blob:logo');
 assert.equal(Object.keys(visual.logo.variants).length,21);
 assert.equal(logoSourceIds({visual}).length,21);
 for(const use of LOGO_USES)assert.equal(Object.values(visual.logo.variants).filter(item=>item.use===use).length,3);
});
test('commercial font family keeps multiple weights and styles without replacing earlier fonts',()=>{
 let visual={type:[{family:'Inter',kind:'Body',provider:'google'}]};
 for(const name of ['Cake-Regular.woff2','Cake-Semibold.woff2','Cake-BoldItalic.woff2'])visual=appendUploadedAsset(visual,{kind:'font',file:{name},family:'Cake',usage:'Display',descriptors:fontDescriptors(name)},{id:name},'blob:font');
 assert.equal(visual.type.length,4);
 assert.deepEqual(visual.type.slice(1).map(item=>[item.weight,item.style]),[['400','normal'],['600','normal'],['700','italic']]);
 assert.equal(validateFoundationVisual(visual),null);
});
test('palette supports unlimited colours in five groups and retains legacy duplicate-role validation',()=>{
 const palette=PALETTE_GROUPS.flatMap(group=>Array.from({length:12},(_,i)=>({role:group,group,hex:'#123456',name:`${group}-${i}`})));
 assert.equal(palette.length,60);assert.equal(validateFoundationVisual({palette}),null);
 assert.match(validateFoundationVisual({palette:[{role:'primary',hex:'#123456'},{role:'primary',hex:'#234567'}]}),/one primary/);
 assert.match(validateFoundationVisual({palette:[{role:'primary',group:'unknown',hex:'#123456'}]}),/Unknown colour group/);
});
test('reference tags and append intent survive server upload boundary validation',()=>{
 for(const tag of ['product','lifestyle','usage']){
  const metadata=uploadMetadata({kind:'reference',tag});
  const result=validateVisualAssetMetadata({ext:'png',...metadata,rightsConfirmed:true});
  assert.equal(result.ok,true);assert.equal(result.metadata.reference_tag,tag);assert.equal(result.metadata.reference_append,true);
 }
 assert.equal(validateVisualAssetMetadata({ext:'png',rightsConfirmed:true,referenceTag:'made-up'}).code,'REFERENCE_TAG');
 assert.equal(validateVisualAssetMetadata({ext:'png',rightsConfirmed:true,logoUse:'made-up'}).code,'LOGO_USE');
});
test('logo use and font descriptors persist on durable source metadata',()=>{
 const logo=validateVisualAssetMetadata({ext:'png',...uploadMetadata({kind:'logo',tag:'monochrome'})});
 assert.equal(logo.metadata.logo_use,'monochrome');
 const font=validateVisualAssetMetadata({ext:'woff2',...uploadMetadata({kind:'font',family:'Cake',usage:'Both',descriptors:{weight:'700',style:'italic'}})});
 assert.equal(font.metadata.font_weight,'700');assert.equal(font.metadata.font_style,'italic');
});
test('every new control and error has en/es/ar copy and Brand Core stays English',()=>{
 const keys=Object.keys(brandCoreInputsCopy.en).sort();
 for(const locale of ['en','es','ar']){
  assert.deepEqual(Object.keys(brandCoreInputsCopy[locale]).sort(),keys);
  for(const value of Object.values(brandCoreInputsCopy[locale]))assert.ok(Array.isArray(value)?value.every(Boolean):typeof value==='string'&&value.length>0);
  assert.match(brandCoreInputsCopy[locale].title,/Brand Core/);
  assert.equal(brandCoreInputsCopy[locale].uses.length,LOGO_USES.length);
 }
});
