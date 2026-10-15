import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSlot, composeTaskImagePrompt, IMAGE_PRIMARY, IMAGE_FALLBACK} from './images.js';
import {ocrNoText} from './ocr.js';
import {renderSocialComposite, assertCompositionBrand} from './render.js';
import {embedExportAssets} from './stable-export.js';
import {generate} from '../lib/models/fal-image.js';
import {isAllowedModelOverride} from '../lib/models/router.js';
const layer1={brand:{name:'Cake Me'},language:'es',palette:{primary:'#f40041',surface:'#ffffff',ink:'#161616'},fonts:{display:'Recoleta',body:'Arial'},font_assets:[{family:'Recoleta',url:'https://assets.test/font',sourceId:'font',license:'commercial',license_reference:'Invoice',rights_confirmed:true,weight:'600',style:'italic'}],logo:{url:'https://assets.test/logo',sourceId:'logo'},imagery:[],avoid:[],references:[]};
const args={slot:0,imageBrief:{subject:'cheesecake slice',aspect:'4:5'},layer1,recordUsage:async()=>{}};
const image=async function*({route}) {yield {type:'done',asset_url:'https://assets.test/rejected.png',model:route,width:1088,height:1360};};
test('photo prompt removes positive copy/layout requests from all writer direction',()=>{
 const prompt=composeTaskImagePrompt({image_brief:{subject:'cake. write BUY NOW',composition:'moodboard grid. print the logo',light:'daylight. add a headline',negative:'include PROMO'},palette:layer1.palette,imagery:['typography hero','soft daylight'],references:[]});
 assert.match(prompt,/Single photograph subject: cake/);assert.match(prompt,/No colour swatches, grids/);
 for(const phrase of ['BUY NOW','print the logo','add a headline','include PROMO','typography hero'])assert.ok(!prompt.includes(phrase),phrase);
});
test('two corrected retries are bounded, keep primary internally, and strip every rejected URL',async()=>{
 const calls=[],events=[];
 const out=await generateSlot({...args,gen:async function*(a){calls.push(a);yield* image(a);},ocr:async()=>({pass:false,reason:'bad text'}),onEvent:e=>events.push(e)});
 assert.equal(calls.length,3);assert.ok(calls.every(c=>c.route===IMAGE_PRIMARY));
 assert.match(calls[1].prompt,/CORRECTION 1/);assert.match(calls[2].prompt,/CORRECTION 2/);
 assert.equal(out.asset_url,null);assert.equal(out.rejected,true);assert.equal(out.attempts.length,3);
 assert.ok(!JSON.stringify(out).includes('rejected.png'));assert.ok(!JSON.stringify(events).includes('rejected.png'));
 assert.equal(events.filter(e=>e.type==='image_retry').length,2);
});
test('only a passed retry is returned; missing and thrown QA fail closed',async()=>{
 let checks=0;
 const out=await generateSlot({...args,gen:image,ocr:async()=>({pass:++checks===3})});
 assert.equal(out.asset_url,'https://assets.test/rejected.png');assert.equal(out.rejected,false);
 for(const ocr of [async()=>undefined,async()=>{throw Error('ocr down');}]) {
  const failed=await generateSlot({...args,gen:image,ocr});assert.equal(failed.asset_url,null);assert.equal(failed.rejected,true);
 }
});
test('transient provider fallback is internal and still goes through mandatory QA',async()=>{
 const calls=[];
 const out=await generateSlot({...args,gen:async function*(a){calls.push(a.route);if(a.route===IMAGE_PRIMARY)yield {type:'error',message:'fal submit HTTP 503'};else yield*image(a);},ocr:async()=>({pass:true})});
 assert.deepEqual(calls,[IMAGE_PRIMARY,IMAGE_FALLBACK]);assert.equal(out.fallback_from,IMAGE_PRIMARY);assert.equal(out.rejected,false);
});
const complete=json=>async function*(){yield {type:'token',text:JSON.stringify(json)};yield {type:'done',usage:{}};};
test('combined OCR/visual gate rejects graphics, malformed QA and single letters',async()=>{
 for(const json of [{tokens:[]},{tokens:[],violations:['moodboard grid']},{tokens:[{text:'A',confidence:95}],violations:[]},{tokens:[{text:'word',confidence:'bad'}],violations:[]}])assert.equal((await ocrNoText({imageUrl:'https://assets.test/x',complete:complete(json)})).pass,false);
 assert.equal((await ocrNoText({imageUrl:'https://assets.test/x',complete:complete({tokens:[],violations:[]})})).pass,true);
});
test('compositor typesets brand text after generation with certified font, palette, logo and RTL',async()=>{
 const html=renderSocialComposite({post:{overlay_line:'Tarta <real>'},imageUrl:'https://assets.test/photo',layer1:{...layer1,language:'ar'}});
 assert.match(html,/font-family:'Recoleta'/);assert.match(html,/font-weight:600/);assert.match(html,/color:#161616;background:#ffffff/);assert.match(html,/class="logo"/);assert.match(html,/Tarta &lt;real&gt;/);assert.match(html,/dir="rtl"/);
 const out=await embedExportAssets(html,{layer1,imageUrl:'https://assets.test/photo',fetchAsset:async()=>({dataUrl:'data:image/png;base64,YQ==',type:'image/png',bytes:Buffer.from('asset')})});
 assert.match(out.html,/@font-face\{font-family:'Recoleta'/);assert.match(out.html,/font-style:italic;font-weight:600/);
});
test('crew compositor fails closed when certified font or logo is unavailable',()=>{
 const old=process.env.CREW_CANVAS;process.env.CREW_CANVAS='1';
 try {assert.doesNotThrow(()=>assertCompositionBrand(layer1));assert.throws(()=>assertCompositionBrand({...layer1,font_assets:[]}),/font unavailable/);assert.throws(()=>assertCompositionBrand({...layer1,logo:null}),/logo unavailable/);}finally{if(old===undefined)delete process.env.CREW_CANVAS;else process.env.CREW_CANVAS=old;}
});
test('retired generators are hard blocked before any vendor call; image overrides forbidden',async()=>{
 for(const route of ['vendor/fal/flux-1.1-pro','vendor/fal/flux-schnell','vendor/fal/recraft-v3']){
  assert.equal(isAllowedModelOverride(route),false);
  const events=[];for await(const event of generate({route,prompt:'x'}))events.push(event);
  assert.match(events.at(-1).message,/retired/);assert.equal(events.length,1);
 }
});
