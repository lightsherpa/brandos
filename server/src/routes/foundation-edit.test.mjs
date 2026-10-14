import {test,mock} from 'node:test';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);let foreign=false;let appends=0;let metadata=null;let auth;
const payload={visual:{palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Inter',provider:'google'}]}};
const db={from(table){const q={select(){return this;},eq(){return this;},in(){return this;},order(){return this;},limit(){return this;},not(){return this;},delete(){return this;},insert(value){if(table==='bio_sources')metadata=value.signals;return this;},async maybeSingle(){return {data:table==='brands'?{id:'brand',workspace_id:'assigned'}:table==='bios'?{payload}:null};},async single(){return {data:{id:'new-row',version:2},error:null};},then(resolve,reject){return Promise.resolve({data:table==='bio_sources'&&!foreign?[{id:'logo',raw_ref:'assigned/brand/logo.svg',signals:{asset_role:'logo',ext:'svg',rights_confirmed:true}}]:[],error:null}).then(resolve,reject);}};return q;},async rpc(name){if(name==='reconcile_bio_review')return {data:{status:'gated',score:79,job_id:null},error:null};appends++;return {data:{id:'new-bio',version:2},error:null};},storage:{from:()=>({upload:async()=>({data:{},error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://local.test/file'}}),remove:async()=>({error:null})})}};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',auth);await next();}}});
mock.module(new URL('lib/assign-steward.js',root).href,{namedExports:{assignSteward:async()=>{}}});
const {default:app}=await import('./bios.js');
const designer=()=>({userId:'designer',workspaceId:null,persona:'designer',scope:'platform',permissions:new Set(['bio.read','bio.propose']),assignedWorkspaceIds:new Set(['assigned'])});
const patch=body=>app.request('/brand',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({payload:body})});
test('assigned designer can save roles and font; unassigned designer cannot',async()=>{
 auth=designer();appends=0;foreign=false;
 const res=await patch(payload);assert.equal(res.status,200);assert.equal(appends,1);
 auth={...designer(),assignedWorkspaceIds:new Set()};assert.equal((await patch(payload)).status,403);assert.equal(appends,1);
});
test('foreign logo source cannot enter a brand foundation',async()=>{
 auth=designer();foreign=true;const before=appends;
 const res=await patch({visual:{...payload.visual,logo:{sourceId:'logo',conf:100}}});assert.equal(res.status,400);assert.equal(appends,before);assert.equal((await res.json()).code,'FOUNDATION_ASSET');foreign=false;
});
test('upload defaults to inspiration and logo variant persists at ingest',async()=>{
 auth=designer();
 const png=await (await import('sharp')).default({create:{width:10,height:10,channels:4,background:'#ffd115'}}).png().toBuffer();
 const upload=async (extra,file=new File([png],'mark.png',{type:'application/octet-stream'}))=>{const form=new FormData();form.set('file',file);form.set('bucket','visual');form.set('rightsConfirmed','true');for(const [k,v]of Object.entries(extra))form.set(k,v);return app.request('/brand/sources/upload',{method:'POST',body:form});};
 assert.equal((await upload({})).status,200);assert.equal(metadata.asset_role,'inspiration');
 assert.equal((await upload({assetRole:'logo',logoVariant:'dark'})).status,200);assert.equal(metadata.asset_role,'logo');assert.equal(metadata.logo_variant,'dark');
 const svg=await upload({assetRole:'logo'},new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'mark.svg',{type:'image/svg+xml'}));assert.equal(svg.status,400);assert.match(JSON.stringify(await svg.json()),/SVG/);
});
