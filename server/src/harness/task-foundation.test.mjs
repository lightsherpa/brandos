import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let imageCalls=0,textCalls=0;
mock.module(new URL('../lib/load-brand-bio.js',import.meta.url).href,{namedExports:{
 loadBrandBio:async()=>{textCalls++;return {brand:{id:'brand'},bio:{visual:{}},refusals:[]};},
 loadBioForImage:async()=>{imageCalls++;throw Object.assign(Error('Missing foundation'),{code:'FOUNDATION_INCOMPLETE',status:409});},
}});
mock.module(new URL('../lib/supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:{from:()=>({select(){return this;},in(){return this;},eq:async()=>({data:[]})})}}});
mock.module(new URL('../lib/visual-assets.js',import.meta.url).href,{namedExports:{loadVisualAssets:async()=>({references:[]})}});
mock.module(new URL('./rules.js',import.meta.url).href,{namedExports:{loadRules:async()=>[],applyRules:x=>x}});
const {loadTaskContext}=await import('./task-context.js');
test('copy tasks and social copy reruns pass without foundation',async()=>{
 await loadTaskContext({workspaceId:'ws',brandId:'brand',type:'email_sequence'});
 await loadTaskContext({workspaceId:'ws',brandId:'brand',type:'social_post',copyOnly:true});
 assert.equal(textCalls,2);assert.equal(imageCalls,0);
});
test('social images and email heroes use foundation gate',async()=>{
 for(const params of [{type:'social_post'},{type:'email_sequence',heroes:true}])await assert.rejects(()=>loadTaskContext({workspaceId:'ws',brandId:'brand',...params}),e=>e.code==='FOUNDATION_INCOMPLETE'&&e.status===409);
 assert.equal(imageCalls,2);
});
