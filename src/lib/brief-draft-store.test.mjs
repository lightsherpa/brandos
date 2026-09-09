import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createBriefDraftStore,emptyDraft} from './brief-draft-store.js';
const userId=randomUUID(),brandId=randomUUID(),workspaceId=randomUUID(),draftId=randomUUID();
function fixture(records=[], wrapRequest=(request)=>request) {
 const map=new Map(records.map((r,i)=>[`ci_brief_draft:v1:${userId}:${brandId}:${i}`,JSON.stringify(r)]));
 const storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const rows=new Map();
 const request=async(path,init)=>{
  if(!init)return Response.json({ownerUserId:userId,workspaceId,drafts:[...rows.values()]});
  const body=JSON.parse(init.body),id=path.split('/').pop(),current=rows.get(id);
  if(body.revision!==(current?.revision||0))return Response.json({code:'DRAFT_CONFLICT',error:'conflict'},{status:409});
  const draft={id,payload:body.payload,revision:body.revision+1};rows.set(id,draft);return Response.json({draft});
 };
 const store=createBriefDraftStore({userId,brandId,storage,request:wrapRequest(request),uuid:randomUUID,delay:60000});
 return {store,map,rows};
}
const record=(input,at)=>({id:draftId,userId,brandId,workspaceId,revision:0,payload:{...emptyDraft(),input},at});
test('a malformed JSON recovery payload cannot reach composer rendering',async()=>{
 const {store}=fixture([{...record('x',1),payload:{}}]);
 await store.load();
 assert.equal(typeof store.getSnapshot().payload.input,'string');
 store.dispose();
});
test('saving one recovered tab leaves other unsaved copy visible in draft list',async()=>{
 const {store,map}=fixture([record('older tab unsaved content',1),record('newer tab content',2)]);
 await store.load();
 assert.ok([...map.values()].some(raw=>JSON.parse(raw).payload.input==='older tab unsaved content'));
 assert.ok(store.getSnapshot().drafts.some(row=>row.payload.input==='older tab unsaved content'),'older recovery still exists in storage but disappears from resume list');
 store.dispose();
});

test('recovery from another workspace cannot become active after scope resolution',async()=>{
 const {store,map}=fixture([{...record('foreign workspace private draft',1),workspaceId:randomUUID()}]);
 await store.load();
 assert.equal(store.getSnapshot().id,null);
 assert.equal(store.getSnapshot().payload.input,'');
 assert.equal(store.getSnapshot().drafts.length,0);
 assert.equal(map.size,1,'out-of-scope recovery is preserved, not erased');
 store.dispose();
});
test('choosing an older saved list row uses its latest acknowledged revision',async()=>{
 const {store}=fixture();
 await store.load();store.update({input:'first'});await store.flush();
 const staleRow=store.getSnapshot().drafts[0];
 store.update({input:'second'});await store.flush();
 await store.select(null);await store.select(staleRow);
 assert.equal(store.getSnapshot().payload.input,'second');
 assert.equal(store.getSnapshot().revision,2);
 store.dispose();
});

for (const [label,patch] of Object.entries({
  'invalid request shape': [],
  'wrong owner': {ownerUserId:randomUUID()},
  'wrong brand': {brandId:randomUUID()},
  'wrong workspace': {workspaceId:randomUUID()},
  'invalid payload': {payload:{}},
  'mismatched revision': {revision:2},
})) {
 test(`corrupt pending recovery with ${label} is ignored before HTTP reuse`,async()=>{
  const pending=Array.isArray(patch) ? patch : {ownerUserId:userId,brandId,workspaceId,revision:0,mutationId:randomUUID(),payload:emptyDraft(),...patch};
  const {store,rows,map}=fixture([{...record('recover safely',1),pending}]);
  await store.load();
  assert.equal(store.getSnapshot().id,null);
  assert.equal(rows.size,0,'invalid pending request must never be transmitted');
  assert.equal(map.size,1,'invalid record stays available for manual recovery');
  store.dispose();
 });
}
test('a list request started before a save cannot replace the acknowledged draft with stale text',async()=>{
 let hold=false,release;
 const {store}=fixture([],request=>async(path,init)=>{
  const response=await request(path,init);
  if(!init && hold) await new Promise(resolve=>{release=resolve;});
  return response;
 });
 await store.load();store.update({input:'first'});await store.flush();
 hold=true;const loading=store.load();await new Promise(resolve=>setImmediate(resolve));
 store.update({input:'second'});await store.flush();
 release();await loading;
 const row=store.getSnapshot().drafts.find(row=>!row.recoveryKey);
 assert.equal(row.payload.input,'second');
 assert.equal(row.revision,2);
 store.dispose();
});
test('oversized local draft remains recoverable and editable after server rejection',async()=>{
 const input='x'.repeat(50001);
 const {store,map}=fixture([record(input,1)],request=>(path,init)=>init && JSON.parse(init.body).payload.input.length>50000
  ? Promise.resolve(Response.json({error:'Invalid draft content or revision'},{status:400}))
  : request(path,init));
 await store.load();
 assert.equal(store.getSnapshot().payload.input,input);
 assert.equal(store.getSnapshot().status,'error');
 assert.ok(map.size>0);
 store.update({input:'shortened and editable'});
 assert.equal(store.getSnapshot().payload.input,'shortened and editable');
 assert.equal(await store.flush(),true,'correcting rejected content should allow the next save');
 store.dispose();
});
