import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crewFor,crewTask,validateComponent} from './crew-canvas.js';
import {publicItem,internalItem,runTask,checkAndRender,reviseComponent} from './pipeline.js';
import {TASKS} from './registry.js';
import {reviewerPasses} from './reviewer.js';
process.env.CREW_CANVAS='1';
const layer1={brand:{name:'Cake Me'},fonts:{display:'Georgia',body:'Arial'},palette:{primary:'#f40041',surface:'#ffffff',ink:'#161616'},logo:{url:'https://cdn.test/logo.png'},voice:{forbidden:[]},rules:[]};
const email={subject:'Cake for Friday',preheader:'Choose something special for your next celebration.',headline:'Make Friday sweeter',body_blocks:['A fresh cheesecake for your table. Choose your favourite flavour.'],cta:{label:'See cakes',url:'https://cake.test/cakes'}};
const passReview=async({task})=>[task.reviewerChecks.map(id=>({id,pass:true,reason:'Matches Brand Core',target:'copy'}))];
test('crews exclude unrelated specialists and optional heroes',()=>{assert.deepEqual(crewFor('social_post'),['copy','image','compositor','qa']);assert.deepEqual(crewFor('email_sequence'),['copy','html','qa']);assert.deepEqual(crewFor('email_sequence',true),['copy','html','hero','qa']);});
test('off-palette social cannot pass through a five-of-six threshold',()=>{const task=crewTask({...TASKS.social_post,type:'social_post'});const checks=task.reviewerChecks.map(id=>({id,pass:id!=='image_matches_palette_refs'}));assert.equal(reviewerPasses(task,checks),false);});
test('off-palette email hero is mandatory reviewer evidence',()=>{const task=crewTask({...TASKS.email_sequence,type:'email_sequence',heroes:true});assert.ok(task.reviewerChecks.includes('image_matches_palette_refs'));assert.ok(task.mandatory.includes('image_matches_palette_refs'));});
test('unreviewed and rejected images never publish URL or HTML',()=>{
 for(const status of ['imaging','checking','fixing','flagged']){const it=publicItem({status,html:'<html>bad</html>',image:{asset_url:'https://bad.test/img',ocr:{pass:false}},before:{image_url:'https://bad.test/img'}});assert.equal(it.html,null);assert.equal(it.image.asset_url,null);assert.equal(it.before.image_url,null);}
});
test('email rejects missing HTML, wrong fonts and off-palette renderer output',async()=>{const it={copy:email};await checkAndRender({type:'email_sequence',task:{heroes:false},it,layer1,language:'en',renderEmailFn:async()=>({html:'',tokens:{},mjmlErrors:[]})});for(const id of ['RENDERED_HTML','BRAND_FONTS','BRAND_PALETTE'])assert.equal(it.checks.find(c=>c.id===id).pass,false);});
test('email heroes cannot pass with missing image or text baked into image',async()=>{for(const image of [null,{asset_url:'https://cdn.test/hero.png',ocr:{pass:false}}]){const it={copy:email,image};await checkAndRender({type:'email_sequence',task:{heroes:true},it,layer1,language:'en'});assert.ok(it.checks.some(c=>['HERO_RENDERED','IMAGE','OCR_NOTEXT'].includes(c.id)&&!c.pass));assert.ok(!it.html.includes('https://cdn.test/hero.png'));}});
test('replacing one email field preserves all other fields and produces HTML',async()=>{const item={index:0,status:'ready',copy:email,image:null,checks:[],review:[]};const result=await reviseComponent({type:'email_sequence',brief:'Make Friday sweeter with a Cake Me cheesecake',layer1,spec:{language:'en',emails:[email]},item,component:'subject',action:'replace',value:'Your Friday cake',deps:{review:passReview}});assert.equal(result.item.status,'ready');assert.equal(result.item.copy.subject,'Your Friday cake');assert.deepEqual(result.item.copy.body_blocks,email.body_blocks);assert.deepEqual(result.item.copy.cta,email.cta);assert.match(result.item.html,/<html/);assert.deepEqual(item.copy,email);});
test('component contract rejects invalid paths, unsafe URLs and heroes-off image edits',()=>{assert.ok(validateComponent({type:'email_sequence',component:'__proto__',action:'replace',value:'x'}));assert.ok(validateComponent({type:'social_post',component:'image',action:'replace',value:'javascript:alert(1)'}));assert.ok(validateComponent({type:'email_sequence',heroes:false,component:'image',action:'regenerate'}));assert.equal(validateComponent({type:'social_post',component:'caption',action:'replace',value:'A proper caption'}),null);});

test('a logo alone is not accepted as the required email hero',async()=>{const it={copy:email,image:{asset_url:'https://cdn.test/hero.png',ocr:{pass:true}}};await checkAndRender({type:'email_sequence',task:{heroes:true},it,layer1,language:'en',renderEmailFn:async()=>({html:'<!doctype html><html><img src="https://cdn.test/logo.png" alt="Cake Me"><style>Georgia Arial #f40041</style></html>',tokens:{ink:'#161616',cta_text:'#ffffff',primary:'#f40041'},mjmlErrors:[]})});assert.equal(it.checks.find(c=>c.id==='HERO_RENDERED').pass,false);});

test('export-only failure preserves accepted source privately and supports composition-only repair without generation',async()=>{
 const post={angle:'Friday cake',overlay_line:'A sweeter Friday',caption:'Make Friday sweeter with Cake Me.',hashtags:[],cta:'See cakes',claims:[],image_brief:{subject:'a cheesecake on a pink table',composition:'overhead',light:'daylight',palette_roles:['primary'],ref_ids:[],negative:'no text',aspect:'4:5'}};
 const spec={task:'social_post',language:'en',smp:'Make Friday sweeter',posts:[post]};
 let writes=0,images=0;
 const complete=async function*(){writes++;yield{type:'token',text:JSON.stringify(spec)};yield{type:'done',usage:{cost_usd:0,model:'test'}};};
 const gen=async function*(){images++;yield{type:'done',asset_url:'https://img.test/accepted.png',width:1080,height:1350,cost_usd:.01};};
 const events=[];
 const out=await runTask({type:'social_post',count:1,brief:'Make Friday sweeter with Cake Me.',layer1:{...layer1,references:[],imagery:[],avoid:[]},onEvent:e=>events.push(e),deps:{complete,gen,ocr:async()=>({pass:true}),review:passReview,renderSocialFn:async()=>{throw new Error('Temporary asset unavailable https://private.test/x?token=hidden');}}});
 assert.equal(out.status,'flagged');assert.equal(writes,1);assert.equal(images,1);assert.equal(out.items[0].image.asset_url,'https://img.test/accepted.png');assert.equal(out.items[0].quality_gated,true);
 assert.ok(events.some(e=>e.type==='item'&&e.item.status==='flagged'&&e.item.image?.asset_url==='https://img.test/accepted.png'));
 const boundary=publicItem(out.items[0]);assert.equal(boundary.image.asset_url,null);assert.equal(boundary.html,null);assert.equal(boundary.can_retry_render,true);
 const repaired=await reviseComponent({type:'social_post',brief:'Make Friday sweeter with Cake Me.',layer1,spec,item:out.items[0],component:'composition',action:'regenerate',deps:{complete:async()=>{throw new Error('No writer call allowed');},gen:async()=>{throw new Error('No image call allowed');},review:async()=>{throw new Error('Reuse passing review');},renderSocialFn:async()=>({html:'<!doctype html><html><style>Georgia #f40041</style><p>A sweeter Friday</p></html>',stable:true,assets:[]})}});
 assert.equal(repaired.item.status,'ready');assert.equal(repaired.item.image.asset_url,'https://img.test/accepted.png');assert.match(publicItem(repaired.item).html,/sweeter Friday/);assert.equal(repaired.metrics.cost.calls,0);
 const rejected=internalItem({status:'flagged',image:{asset_url:'https://img.test/rejected.png',ocr:{pass:false}}});assert.equal(rejected.image.asset_url,null);
});
