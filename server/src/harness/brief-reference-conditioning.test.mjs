import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
const id='11111111-1111-4111-8111-111111111111',photo='https://storage.example/storage/v1/object/sign/brief-references/photo.png?token=test';
let chosen=[];
const bio={id:'bio',version:3,visual:{references:[]}},brand={id:'brand',name:'Cake Me'};
mock.module(new URL('../lib/load-brand-bio.js',import.meta.url).href,{namedExports:{loadBioForImage:async()=>({brand,bio,refusals:[]}),loadBrandBio:async()=>({brand,bio,refusals:[]})}});
mock.module(new URL('../lib/visual-assets.js',import.meta.url).href,{namedExports:{loadVisualAssets:async()=>({references:[]})}});
mock.module(new URL('./rules.js',import.meta.url).href,{namedExports:{loadRules:async()=>[],applyRules:layer=>layer}});
const db={from(table){const q={select(){return q;},in(_key,ids){chosen=ids;return q;},eq(){return q;},then(a,b){return Promise.resolve({data:table==='brief_references'?chosen.map(id=>({id,brand_id:'brand',owner_id:'owner',brief_id:null,storage_path:'photo.png',name:'photo.png'})):[]}).then(a,b);}};return q;},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:photo}})})}};
mock.module(new URL('../lib/supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:db}});
const {loadTaskContext}=await import('./task-context.js');
const {generateSlot}=await import('./images.js');
test('a brief photo reaches the social image provider, remains out of Brand Core, and never leaks into the next brief',async()=>{
 const before=structuredClone(bio),ctx=await loadTaskContext({workspaceId:'ws',brandId:'brand',type:'social_post',referenceIds:[id],userId:'owner'});
 assert.equal(ctx.layer1.references[0].url,photo);assert.equal(ctx.layer1.references[0].source,'brief');assert.deepEqual(ctx.provenance.briefReferenceIds,[id]);assert.deepEqual(ctx.provenance.sourceIds,[]);
 let received;async function* gen(options){received=options.referenceImageUrls;yield {type:'done',asset_url:'https://storage.example/generated-output.png',model:options.route,width:1080,height:1350,cost_usd:.01,uses_reference:true};}
 const image=await generateSlot({slot:0,imageBrief:{subject:'Cake Me typographic exercise background',aspect:'portrait_4_5'},layer1:ctx.layer1,gen,ocr:async()=>({pass:true}),recordUsage:async()=>{}});
 assert.deepEqual(received,[photo]);assert.equal(image.asset_url,'https://storage.example/generated-output.png');assert.notEqual(image.asset_url,photo);assert.deepEqual(bio,before);
 const next=await loadTaskContext({workspaceId:'ws',brandId:'brand',type:'social_post',userId:'owner'});assert.deepEqual(next.layer1.references,[]);assert.deepEqual(bio.visual.references,[]);
});
