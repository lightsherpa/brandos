import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let rightsFail=false,versions=[];
const brand={id:'brand',workspace_id:'ws',name:'Cake Me',url:'https://brand.test',refusals:[]};
const db={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},or(){return q;},in(){return q;},
 async maybeSingle(){return {data:table==='brands'?brand:versions[0]||null,error:null};},
 then(res,rej){return Promise.resolve(table==='bio_sources'?(rightsFail?{data:null,error:{message:'down'}}:{data:[{id:'L',raw_ref:'l.png',signals:{asset_role:'logo',ext:'png',rights_confirmed:true}}],error:null}):{data:versions,error:null}).then(res,rej);}};return q;},
 storage:{from:()=>({createSignedUrl:async r=>({data:{signedUrl:`https://local.test/${r}`},error:null})})}};
mock.module(new URL('./supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:db}});
const {loadBrandBio}=await import('./load-brand-bio.js');
const visual={logo:{sourceId:'L',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Inter',provider:'google'}]};
test('Q&A (degradeRights) keeps working when the rights lookup fails, flagged and using the stored score',async()=>{
 rightsFail=true;versions=[{id:'b1',version:1,score:88,payload:{visual}}];
 const r=await loadBrandBio({workspaceId:'ws',brandId:'brand',degradeRights:true});
 assert.equal(r.bio.rightsUnavailable,true);assert.equal(r.bio.score,88);
 await assert.rejects(()=>loadBrandBio({workspaceId:'ws',brandId:'brand'}),e=>e.code==='RIGHTS_LOOKUP_FAILED'&&e.status===503);
 rightsFail=false;
});
test('production rights failure is 503 even with degradeRights',async()=>{
 rightsFail=true;versions=[{id:'b1',version:1,certified:true,score:96,payload:{visual}}];
 await assert.rejects(()=>loadBrandBio({workspaceId:'ws',brandId:'brand',requireCertified:true,degradeRights:true}),e=>e.code==='RIGHTS_LOOKUP_FAILED'&&e.status===503);
 rightsFail=false;
});
test('image work never falls back to a version without a rights-confirmed foundation',async()=>{
 versions=[{id:'b2',version:2,certified:true,score:96,payload:{visual:{...visual,logo:{sourceId:'X',conf:100}}}}];
 await assert.rejects(()=>loadBrandBio({workspaceId:'ws',brandId:'brand',requireCertified:true,requireFoundation:true}),e=>e.code==='FOUNDATION_INCOMPLETE'&&e.logoStatus==='needs_rights');
});
