import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createDeliveryRoutes} from './deliveries.js';
import {createBriefReferenceRoutes} from './brief-references.js';
import {createBriefDraftRoutes} from './brief-drafts.js';
import {createBrandExampleRoutes} from './brand-output-examples.js';
import {loadBriefReferences,bindBriefReferences} from '../lib/brief-references.js';
const draftId='22222222-2222-4222-8222-222222222222';
const refId='11111111-1111-4111-8111-111111111111';
const asset=`${process.env.SUPABASE_URL||'http://127.0.0.1:54321'}/storage/v1/object/sign/bio-sources/w/brand/outputs/output.png?token=temporary`;
function fixture({edit=true,accepted=true,foreign=false,persona='creative_director'}={}){
 const actor={userId:'u',persona,scope:'workspace',permissions:new Set(['brief.write','brief.read','bio.read','bio.propose',...(edit?['brand.manage']:[])]),memberships:[{workspace_id:'w',status:'active'}]};
 const output=(id,part,body)=>({id,status:'qa_passed',workflow_status:accepted?'client_approved':'client_review',client_reviewed_by:accepted?'u':null,client_reviewed_at:accepted?'2026-10-17':null,body:{type:'social_post',part,deliverables:[{...body,qa:{passed:true},status:'qa_passed'}]}});
 const tables={brief_drafts:[{id:draftId,brand_id:'brand',owner_user_id:'u',workspace_id:'w',revision:1,payload:{references:[]}}],brands:[{id:'brand',workspace_id:foreign?'foreign':'w'}],briefs:[{id:'brief',brand_id:'brand',title:'Granada',brand:{workspace_id:foreign?'foreign':'w'},payload:{deliveryPlan:{deliverableGroups:[{type:'social_post',count:1,crew:{caption:'a16',image:'a41'}}]}}}],runs:[{id:'r1',brief_id:'brief',specialist_id:'a16',status:'completed',outputs:[output('caption','caption',{text:'Muy pronto en Granada'})]},{id:'r2',brief_id:'brief',specialist_id:'a41',status:'completed',outputs:[output('image','image',{asset_url:asset})]}],ledger:[],brief_references:[{id:refId,brand_id:'brand',owner_id:'u',cleanup_pending:false,brief_id:'brief',storage_path:'reference.png',name:'inspiration.png'}],brand_output_examples:[],bios:[{certified:true,version:3,payload:{visual:{references:[]}}}],bio_sources:[]};
 const uploads=[],removed=[];
 class Query{
  constructor(table){this.table=table;this.filters=[];this.operation='read';}
  select(){return this;}order(){return this;}limit(){return this;}eq(k,v){this.filters.push(row=>row[k]===v);return this;}is(k,v){return this.eq(k,v);}not(k,op,v){this.filters.push(row=>row[k]!==v);return this;}in(k,v){this.filters.push(row=>v.includes(row[k]));return this;}
  delete(){this.operation='delete';return this;}
  insert(row){this.operation='insert';this.row=row;return this;}update(row){this.operation='update';this.row=row;return this;}
  async result(single){let rows=(tables[this.table]||[]).filter(row=>this.filters.every(test=>test(row)));if(this.operation==='delete')tables[this.table]=(tables[this.table]||[]).filter(row=>!rows.includes(row));if(this.operation==='insert'){
   if(this.table==='brief_references'&&tables[this.table].some(row=>!row.brief_id&&row.draft_id===this.row.draft_id&&row.sha256===this.row.sha256))return {error:{code:'23505'}};
   if(this.table==='brand_output_examples'&&tables[this.table].some(row=>row.brief_id===this.row.brief_id&&row.deliverable_key===this.row.deliverable_key))return {error:{code:'23505'}};
   const row={id:'new-id',...(this.table==='brief_references'?{brief_id:null}:{}),...this.row};(tables[this.table]||=[]).push(row);rows=[row];
  }if(this.operation==='update')rows.forEach(row=>Object.assign(row,this.row));return {data:single?rows[0]||null:rows,error:null};}
  maybeSingle(){return this.result(true);}single(){return this.result(true);}then(a,b){return this.result(false).then(a,b);}
 }
 const db={from:table=>new Query(table),rpc:async(name,args)=>{
   assert.equal(name,'propose_brand_output_example');let row=tables.brand_output_examples.find(r=>r.brief_id===args.p_brief_id&&r.deliverable_key===args.p_delivery_key);if(row)return {data:row};
   row={id:'example',brand_id:args.p_brand_id,brief_id:args.p_brief_id,deliverable_key:args.p_delivery_key,output_ids:args.p_output_ids,reference_ids:tables.brief_references.filter(r=>r.brief_id===args.p_brief_id).map(r=>r.id),snapshot:args.p_snapshot,addition_status:'pending',created_by:args.p_user_id};tables.brand_output_examples.push(row);
   tables.bios.push({...structuredClone(tables.bios.at(-1)),version:4,certified:false,payload:{...tables.bios.at(-1).payload,approved_output_examples:[row.id]}});return {data:row};
  },storage:{from:bucket=>({upload:async(path,bytes)=>{uploads.push({bucket,path,bytes});return {data:{path}};},remove:async paths=>{removed.push(...paths);return {};},createSignedUrl:async path=>({data:{signedUrl:`http://127.0.0.1:54321/storage/v1/object/sign/${bucket}/${path}?token=fresh`}})})}};
 const auth=async(c,next)=>{if(!c.req.header('Authorization'))return c.json({error:'Unauthorized'},401);c.set('auth',actor);return next();};
 const human=async(c,next)=>c.req.header('x-actor')==='agent'?c.json({error:'Human required'},403):next();
 const delivery=createDeliveryRoutes({db,auth,human}),reference=createBriefReferenceRoutes({db,auth,human}),examples=createBrandExampleRoutes({db,auth});
 const request=(app,path,init={})=>app.request(path,{...init,headers:{Authorization:'Bearer test',...init.headers}});
 const drafts=createBriefDraftRoutes({db,authenticate:auth});return {tables,uploads,removed,db,actor,delivery,reference,examples,drafts,request};
}
test('a real PNG uploads once as brief-only evidence, never a Brand Core source',async()=>{
 const f=fixture(),bytes=await sharp({create:{width:32,height:32,channels:3,background:'#ffd115'}}).png().toBuffer();
 const form=new FormData();form.set('brandId','brand');form.set('draftId',draftId);form.set('file',new Blob([bytes],{type:'image/png'}),'photo.png');
 const response=await f.request(f.reference,'/references',{method:'POST',body:form});assert.equal(response.status,201);assert.equal((await response.json()).scope,'brief');
 assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].bucket,'brief-references');assert.equal(f.tables.bio_sources.length,0);assert.equal(f.tables.brand_output_examples.length,0);assert.equal(f.tables.brief_references.at(-1).brief_id,null);
});
test('accept then Add to Brand Core saves the OUTPUT, its contributors and reference lineage without upload or recertification',async()=>{
 const f=fixture(),before=structuredClone(f.tables.bios);
 const dto=await(await f.request(f.delivery,'/brief')).json();assert.equal(dto.deliverables[0].canAddToBrandCore,true);
 const add=()=>f.request(f.delivery,'/brief/social_post-1/brand-core',{method:'POST'});
 assert.equal((await add()).status,200);assert.equal((await add()).status,200);
 assert.equal(f.tables.brand_output_examples.length,1);const saved=f.tables.brand_output_examples[0];
 assert.equal(saved.addition_status,'pending');assert.equal(saved.snapshot.text,undefined);assert.equal(saved.snapshot.html,undefined);assert.deepEqual(saved.snapshot.assetRef,{bucket:'bio-sources',path:'w/brand/outputs/output.png'});assert.doesNotMatch(JSON.stringify(saved.snapshot),/reference.png|temporary/);
 assert.deepEqual(saved.reference_ids,[refId]);assert.deepEqual(saved.output_ids.sort(),['caption','image']);assert.equal(saved.brief_id,'brief');assert.equal(saved.deliverable_key,'social_post-1');
 assert.equal(f.uploads.length,0);assert.equal(f.tables.bio_sources.length,0);assert.deepEqual(f.tables.bios[0],before[0]);assert.equal(f.tables.bios[1].certified,false);assert.deepEqual(f.tables.bios[1].payload.approved_output_examples,['example']);
 const list=await(await f.request(f.examples,'/brand/examples')).json();assert.equal(list.examples.length,1);assert.equal(list.examples[0].snapshot.text,'Muy pronto en Granada');assert.match(list.examples[0].snapshot.assetUrl,/output.png\?token=fresh/);
});
for(const persona of ['user','workspace_admin'])test(`${persona} with bio.propose but no Brand Core edit permission has no action and POST 403`,async()=>{
 const f=fixture({edit:false,persona}),dto=await(await f.request(f.delivery,'/brief')).json();assert.equal(f.actor.permissions.has('bio.propose'),true);assert.equal(dto.deliverables[0].canAddToBrandCore,false);
 assert.equal((await f.request(f.delivery,'/brief/social_post-1/brand-core',{method:'POST'})).status,403);assert.equal(f.tables.brand_output_examples.length,0);assert.equal(f.tables.bios.length,1);
});
test('unaccepted output/reference, foreign workspace and unauthenticated requests never become examples',async()=>{
 const f=fixture({accepted:false});assert.equal((await f.request(f.delivery,'/brief/social_post-1/brand-core',{method:'POST'})).status,409);assert.equal(f.tables.brand_output_examples.length,0);
 assert.equal((await f.delivery.request('/brief/social_post-1/brand-core',{method:'POST'})).status,401);
 const foreign=fixture({foreign:true});assert.equal((await foreign.request(foreign.delivery,'/brief/social_post-1/brand-core',{method:'POST'})).status,403);assert.equal((await foreign.request(foreign.examples,'/brand/examples')).status,403);
 assert.equal((await f.request(f.delivery,'/brief/social_post-1/brand-core',{method:'POST',headers:{'x-actor':'agent'}})).status,403);
});
test('reference resolution is pinned to the same brand, owner and brief and binding cannot be stolen',async()=>{
 const f=fixture();const load=overrides=>loadBriefReferences({db:f.db,ids:[refId],brandId:'brand',userId:'u',briefId:'brief',...overrides});
 const refs=await load();assert.equal(refs[0].source,'brief');assert.match(refs[0].url,/brief-references/);
 await assert.rejects(()=>load({brandId:'other'}),e=>e.status===403);await assert.rejects(()=>load({briefId:'other'}),e=>e.status===403);
 await assert.rejects(()=>load({briefId:null}),e=>e.status===403);
 f.tables.brief_references[0].brief_id=null;await assert.rejects(()=>load({briefId:null,userId:'someone'}),e=>e.status===403);
 assert.equal((await load({briefId:null})).length,1);
 await bindBriefReferences({db:f.db,ids:[refId],brandId:'brand',userId:'u',briefId:'new-brief'});
 await assert.rejects(()=>bindBriefReferences({db:f.db,ids:[refId],brandId:'brand',userId:'u',briefId:'stolen'}));assert.equal(f.tables.brief_references[0].brief_id,'new-brief');
});

test('an input reference file cannot be promoted in place of a generated output',async()=>{
 const f=fixture();f.tables.runs[1].outputs[0].body.deliverables[0].asset_url=asset.replace('bio-sources/w/brand/outputs/output.png','brief-references/reference.png');
 assert.equal((await f.request(f.delivery,'/brief/social_post-1/brand-core',{method:'POST'})).status,409);assert.equal(f.tables.brand_output_examples.length,0);
});

test('the original reference is viewable only through its authorized brief, not Brand Core',async()=>{
 const f=fixture(),r=await f.request(f.reference,'/brief/references');assert.equal(r.status,200);const j=await r.json();assert.equal(j.scope,'brief');assert.match(j.references[0].url,/brief-references/);assert.equal(j.references[0].id,refId);
 const other=fixture({foreign:true});assert.equal((await other.request(other.reference,'/brief/references')).status,403);assert.equal((await f.reference.request('/brief/references')).status,401);
});

async function uploadPhoto(f,bytes,name='photo.png',draft=draftId){const form=new FormData();form.set('brandId','brand');form.set('draftId',draft);form.set('file',new Blob([bytes],{type:'image/png'}),name);return f.request(f.reference,'/references',{method:'POST',body:form});}
const photo=()=>sharp({create:{width:32,height:32,channels:3,background:'#ffd115'}}).png().toBuffer();
test('hash dedupe reuses identical bytes in a draft even with a different filename; another draft stays isolated',async()=>{
 const f=fixture(),bytes=await photo(),first=await(await uploadPhoto(f,bytes)).json(),again=await uploadPhoto(f,bytes,'renamed.png');assert.equal(again.status,200);assert.equal((await again.json()).reference.id,first.reference.id);assert.equal(f.uploads.length,1);
 assert.match(f.tables.brief_references.at(-1).sha256,/^[a-f0-9]{64}$/);
 const other='33333333-3333-4333-8333-333333333333';f.tables.brief_drafts.push({...f.tables.brief_drafts[0],id:other});assert.equal((await uploadPhoto(f,bytes,'photo.png',other)).status,201);assert.equal(f.uploads.length,2);
});
test('discarding a draft deletes its unbound photo file and metadata, retaining production references and other drafts',async()=>{
 const f=fixture(),uploaded=await(await uploadPhoto(f,await photo())).json(),row=f.tables.brief_references.find(r=>r.id===uploaded.reference.id);const path=row.storage_path;
 // A bound reference is retained even if originally attached to this draft.
 f.tables.brief_references[0].draft_id=draftId;
 const brand='44444444-4444-4444-8444-444444444444';f.tables.brands[0].id=brand;f.tables.brief_drafts[0].brand_id=brand;f.tables.brief_references.forEach(r=>r.brand_id=brand);
 const response=await f.request(f.drafts,`/${draftId}`,{method:'DELETE',body:JSON.stringify({brandId:brand,ownerUserId:'u',revision:1})});assert.equal(response.status,200);assert.deepEqual(f.removed,[path]);assert.equal(f.tables.brief_references.length,1);assert.equal(f.tables.brief_drafts.length,0);
 assert.equal((await f.request(f.reference,`/references/${refId}`,{method:'DELETE'})).status,409);assert.equal(f.removed.length,1);
});
test('foreign-owner deletion is denied and a cleanup claim prevents a concurrent run binding the file',async()=>{
 const f=fixture();f.tables.brief_references[0].brief_id=null;f.tables.brief_references[0].cleanup_pending=true;
 await assert.rejects(()=>bindBriefReferences({db:f.db,ids:[refId],brandId:'brand',userId:'u',briefId:'new'}));
 f.tables.brief_references[0].owner_id='other';assert.equal((await f.request(f.reference,`/references/${refId}`,{method:'DELETE'})).status,403);assert.equal(f.removed.length,0);
});

test('concurrent identical uploads leave one reference and remove only the losing object',async()=>{
 const f=fixture(),bytes=await photo(),responses=await Promise.all([uploadPhoto(f,bytes),uploadPhoto(f,bytes)]);
 assert.ok(responses.every(r=>[200,201].includes(r.status)));const results=await Promise.all(responses.map(r=>r.json()));assert.equal(results[0].reference.id,results[1].reference.id);
 const rows=f.tables.brief_references.filter(r=>r.sha256);assert.equal(rows.length,1);assert.ok(!f.removed.includes(rows[0].storage_path));assert.equal(f.uploads.length-f.removed.length,1);
});
test('failed Storage removal is retryable and never leaves a bindable reference to a deleted file',async()=>{
 const f=fixture(),uploaded=await(await uploadPhoto(f,await photo())).json(),row=f.tables.brief_references.find(r=>r.id===uploaded.reference.id);
 const storage=f.db.storage.from;let fail=true;f.db.storage.from=bucket=>({...storage(bucket),remove:async paths=>fail?{error:{message:'offline'}}:storage(bucket).remove(paths)});
 assert.equal((await f.request(f.reference,`/references/${row.id}`,{method:'DELETE'})).status,503);assert.equal(row.cleanup_pending,true);assert.ok(f.tables.brief_references.includes(row));
 await assert.rejects(()=>bindBriefReferences({db:f.db,ids:[row.id],brandId:'brand',userId:'u',briefId:'new'}));
 fail=false;assert.equal((await f.request(f.reference,`/references/${row.id}`,{method:'DELETE'})).status,200);assert.ok(!f.tables.brief_references.includes(row));
});
