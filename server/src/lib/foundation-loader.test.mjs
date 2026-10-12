import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let latest,active,rows=[],signed=[],queried=[];
const base={visual:{logo:{url:'https://brand.test/logo.svg',conf:90},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Inter',provider:'google'}]}};
const brand={id:'brand',workspace_id:'ws',name:'Cake Me',url:'https://brand.test',refusals:[]};
const db={from(table){let exact=[];const q={select(){return this;},eq(key,value){queried.push([table,key,value]);return this;},order(){return this;},limit(){return this;},or(){return this;},in(_key,ids){exact=ids;return this;},async maybeSingle(){return {data:table==='brands'?brand:latest,error:null};},then(resolve,reject){return Promise.resolve({data:table==='bios'?[active]:rows.filter(row=>exact.includes(row.id)),error:null}).then(resolve,reject);}};return q;},storage:{from:()=>({createSignedUrl:async ref=>{signed.push(ref);return {data:{signedUrl:`https://local.test/signed/${ref}`},error:null};}})}};
mock.module(new URL('./supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:db}});
const {loadBrandBio}=await import('./load-brand-bio.js');
test('shared production loader blocks legacy certified Cake Me before any URL or model work',async()=>{
 latest={payload:{visual:{palette:[{hex:'#ffd115'}],type:[]}}};active={version:1,certified:true,score:96,payload:latest.payload};signed=[];
 await assert.rejects(()=>loadBrandBio({workspaceId:'ws',brandId:'brand',requireCertified:true}),error=>error.code==='FOUNDATION_INCOMPLETE'&&error.missing.length===3&&error.credits===0);
 assert.equal(signed.length,0);
 const read=await loadBrandBio({workspaceId:'ws',brandId:'brand'});assert.equal(read.bio.score<=79,true);
});
test('a complete draft cannot hide an incomplete certified version from task loaders',async()=>{
 latest={payload:base};active={version:1,certified:true,score:96,payload:{}};
 await assert.rejects(()=>loadBrandBio({workspaceId:'ws',brandId:'brand',requireCertified:true}),error=>error.code==='FOUNDATION_INCOMPLETE');
});
test('private logo variants resolve for pipeline URL contract without changing persisted payload',async()=>{
 const payload={visual:{...base.visual,logo:{sourceId:'dark-logo',conf:100,variants:{dark:{sourceId:'dark-logo',conf:100},light:{sourceId:'light-logo',conf:100}}},type:[{kind:'Display',family:'Brand Sans',sourceId:'font'}]}};
 latest={payload};active={version:2,certified:true,score:96,payload};
 rows=[...['dark','light'].map(variant=>({id:`${variant}-logo`,src:`${variant}.svg`,raw_ref:`${variant}.svg`,signals:{ext:'svg',asset_role:'logo',rights_confirmed:true}})),{id:'font',src:'brand.woff2',raw_ref:'brand.woff2',signals:{ext:'woff2',asset_kind:'font',asset_role:'canonical',font_family:'Brand Sans',rights_confirmed:true}}];
 queried=[];signed=[];const before=JSON.stringify(payload);
 const result=await loadBrandBio({workspaceId:'ws',brandId:'brand',requireCertified:true});
 assert.equal(result.bio.visual.logo.url,'https://local.test/signed/dark.svg');assert.equal(result.bio.visual.logo.dark_url,result.bio.visual.logo.url);assert.equal(result.bio.visual.logo.light_url,'https://local.test/signed/light.svg');
 assert.equal(result.bio.visual.type[0].url,'https://local.test/signed/brand.woff2');assert.equal(JSON.stringify(payload),before);
 assert.ok(queried.some(([table,key,value])=>table==='bio_sources'&&key==='brand_id'&&value==='brand'));
});
test('deleted approved foundation uploads fail closed rather than yielding a missing renderer logo',async()=>{
 rows=[];
 await assert.rejects(()=>loadBrandBio({workspaceId:'ws',brandId:'brand',requireCertified:true}),error=>error.code==='FOUNDATION_INCOMPLETE');
});
