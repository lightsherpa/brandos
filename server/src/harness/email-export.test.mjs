import {test} from 'node:test';import assert from 'node:assert/strict';
import {renderEmail} from './render.js';import {checkEmailHtml} from './checks/email.js';
import {checkAndRender,publicItem} from './pipeline.js';
const layer1={brand:{name:'Cake Me'},logo:{url:'https://assets.test/logo.png',sourceId:'logo'},palette:{primary:'#FFD115',ink:'#111111',surface:'#ffffff'},fonts:{display:'Fraunces',body:'Arial'},voice:{forbidden:[]},font_assets:[{family:'Fraunces',url:'https://assets.test/font.ttf',sourceId:'font',license:'open_source',license_reference:'OFL',rights_confirmed:true}]};
const email={subject:'Hola Cake Me',preheader:'Una selección de ideas para tu próxima celebración especial.',headline:'Tu próxima celebración',body_blocks:['Elige tu tarta favorita.'],cta:{label:'Ver tartas',url:'https://cakeme.es'}};
const unhosted = async html => ({html, delivery_ready:false, requires_asset_hosting:true, outbound_sending_enabled:false});
const embed=async html=>({html:html.replace('</head>',`<style>${'A'.repeat(480000)}</style></head>`),stable:true,assets:[{role:'font',sourceId:'font'}]});
test('standalone email and small transport draft remain separate with truthful delivery metadata',async()=>{
 const r=await renderEmail({email,layer1,embedAssets:embed,hostAssets:unhosted});assert.ok(Buffer.byteLength(r.html)>80*1024);assert.ok(Buffer.byteLength(r.transport_html)<80*1024);assert.equal(r.transport.delivery_ready,false);assert.equal(r.transport.requires_asset_hosting,true);assert.equal(r.transport.font_mode,'fallback_stack');
 const checks=checkEmailHtml({html:r.transport_html,mjmlErrors:r.mjmlErrors,tokens:r.tokens});assert.equal(checks.find(c=>c.id==='HTML_SIZE').pass,true);
});
test('actual oversized transport stays hard failed',()=>{const checks=checkEmailHtml({html:'X'.repeat(81*1024),tokens:{ink:'#111111',primary:'#FFD115',cta_text:'#111111'}});assert.equal(checks.find(c=>c.id==='HTML_SIZE').pass,false);});
test('pipeline checks transport and persists distinct standalone export without claiming send readiness',async()=>{
 const it={index:0,copy:email};await checkAndRender({type:'email_sequence',task:{heroes:false},it,layer1,language:'es',renderEmailFn:args=>renderEmail({...args,embedAssets:embed,hostAssets:unhosted})});
 assert.equal(it.checks.find(c=>c.id==='HTML_SIZE').pass,true);assert.ok(it.checks.find(c=>c.id==='STANDALONE_EXPORT').pass);const saved=publicItem(it);assert.ok(saved.html.length>80*1024);assert.ok(saved.transport_html.length<80*1024);assert.equal(saved.transport.delivery_ready,false);assert.equal(saved.export.stable,true);assert.equal(saved.export.kind,"standalone_html");assert.equal(saved.export.delivery_ready,false);
});

test('pipeline persists hosted transport HTML and readiness while sending stays disabled',async()=>{
 const hostAssets=async html=>({html:html.replaceAll('https://assets.test/logo.png','https://storage.test/storage/v1/object/public/email-assets/sha256/logo.png'),delivery_ready:true,requires_asset_hosting:false,outbound_sending_enabled:false});
 const it={index:0,copy:email};await checkAndRender({type:'email_sequence',task:{heroes:false},it,layer1,language:'es',renderEmailFn:args=>renderEmail({...args,embedAssets:embed,hostAssets})});
 const saved=publicItem(it);assert.equal(saved.transport.delivery_ready,true);assert.equal(saved.export.delivery_ready,true);assert.equal(saved.transport.outbound_sending_enabled,false);assert.match(saved.transport_html,/public\/email-assets\/sha256\/logo.png/);assert.equal(saved.checks.find(c=>c.id==='HTML_SIZE').pass,true);
});
