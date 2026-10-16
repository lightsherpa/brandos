import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryRoutes} from './deliveries.js';
const owner={userId:'owner',scope:'workspace',persona:'workspace_admin',permissions:new Set(['brief.read','output.client_approve']),memberships:[{workspace_id:'w',status:'active'}]};
const row={id:'b',title:'Granada, primera rebanada',brand_id:'brand',brand:{workspace_id:'w'},payload:{}};
const out=(id,part,text)=>({id,kind:'copy',status:'qa_passed',workflow_status:'client_review',body:{kind:'deliverables',type:'email',part,deliverables:[{body:text,qa:{passed:true},status:'qa_passed'}]}});
function fixture({actor=owner,brief=row,error=false,asset=false,approveOutput}={}){
 const tables={briefs:brief?[structuredClone(brief)]:[],brands:[{id:'brand',workspace_id:'w'}],runs:[{id:'r1',specialist_id:'a14',status:'completed',outputs:[out('subject','subject','Hola')]},{id:'r2',specialist_id:'a13',status:'completed',outputs:[out('body','body','Granada')]}],ledger:[{run_id:'r1',credits:2},{run_id:'r2',credits:12}]};
 if(asset)tables.runs.push({id:'r3',specialist_id:'a20',status:'completed',outputs:[{id:'hero',body:{asset_url:'http://169.254.169.254/latest/meta-data'},status:'qa_passed'}]});
 class Query{constructor(table){this.table=table;}select(){return this;}eq(){return this;}in(){return this;}order(){return this;}limit(){return this;}async maybeSingle(){return {data:tables[this.table]?.[0]||null,error:error?{}:null};}then(a,b){return Promise.resolve({data:tables[this.table]||[],error:error?{}:null}).then(a,b);}}
 const auth=async(c,next)=>{if(!c.req.header('Authorization'))return c.json({error:'Unauthorized'},401);c.set('auth',actor);return next();};
 const app=createDeliveryRoutes({db:{from:table=>new Query(table)},auth,human:async(c,next)=>c.req.header('x-actor')==='agent'?c.json({error:'Human required'},403):next(),approveOutput:approveOutput||(async()=>new Response('{}',{status:200})),fetchAsset:async()=>{throw Error('SSRF must never be fetched');}});
 return {app,tables,request:(path,options={})=>app.request(path,{...options,headers:{Authorization:'Bearer local-test',...options.headers}})};
}
test('customer DTO combines subject/body, totals credits and never exposes production identifiers or costs',async()=>{
 const f=fixture(),res=await f.request('/b');assert.equal(res.status,200);const body=await res.json();assert.equal(body.deliverables.length,1);assert.equal(body.deliverables[0].credits,14);assert.equal(body.deliverables[0].subject,'Hola');assert.equal(body.deliverables[0].text,'Granada');assert.equal(body.deliverables[0].canApprove,true);assert.equal(body.canInspect,false);assert.doesNotMatch(JSON.stringify(body),/agentId|outputIds|specialist_id|model|tokens|_usd|production/);
});
test('workspace boundaries and auth are enforced before returning deliverables; DB failures fail closed',async()=>{
 const f=fixture();assert.equal((await f.app.request('/b')).status,401);assert.equal((await fixture({brief:{...row,brand:{workspace_id:'foreign'}}}).request('/b')).status,403);assert.equal((await fixture({brief:null}).request('/b')).status,404);assert.equal((await fixture({error:true}).request('/b')).status,503);
});
test('only CDs and admins can inspect production, never a client with a reviewer persona or an internal designer',async()=>{
 for(const actor of [{...owner,persona:'creative_director'},{...owner,scope:'platform',persona:'designer',assignedWorkspaceIds:new Set(['w'])}])assert.equal((await(await fixture({actor}).request('/b')).json()).canInspect,false);
 for(const persona of ['creative_director','platform_admin','super_admin']){const actor={...owner,scope:'platform',persona,assignedWorkspaceIds:new Set(['w'])};const b=await(await fixture({actor}).request('/b')).json();assert.equal(b.canInspect,true);assert.ok(b.deliverables[0].production.length);}
});
test('one explicit approval applies to all contributors using the existing human workflow',async()=>{
 const calls=[];const f=fixture({approveOutput:async(id,action)=>{calls.push([id,action]);return new Response('{}');}});assert.equal((await f.request('/b/email-1/approve',{method:'POST'})).status,200);assert.deepEqual(calls.sort(),[['body','client_approve'],['subject','client_approve']]);assert.equal((await f.request('/b/email-1/approve',{method:'POST',headers:{'x-actor':'agent'}})).status,403);
});
test('partial approval failure is reported and no false success is returned',async()=>{
 let count=0;const f=fixture({approveOutput:async()=>new Response('{}',{status:++count===1?200:409})});assert.equal((await f.request('/b/email-1/approve',{method:'POST'})).status,409);
});
test('a partial approval can resume without approving an already-approved contributor again',async()=>{
 const calls=[];const f=fixture({approveOutput:async(id)=>{calls.push(id);return new Response('{}');}});
 Object.assign(f.tables.runs[0].outputs[0],{workflow_status:'client_approved',client_reviewed_by:'owner',client_reviewed_at:'2026-10-17'});
 assert.equal((await(await f.request('/b')).json()).deliverables[0].canApprove,true);
 assert.equal((await f.request('/b/email-1/approve',{method:'POST'})).status,200);
 assert.deepEqual(calls,['body']);
});
test('approving one item cannot silently approve siblings in a shared output row',async()=>{
 const calls=[];const f=fixture({approveOutput:async(id)=>{calls.push(id);return new Response('{}');}});
 f.tables.runs[0].outputs[0].body.deliverables.push({body:'Second subject',status:'qa_passed',qa:{passed:true}});
 f.tables.runs[1].outputs[0].body.deliverables.push({body:'Second email',status:'qa_passed',qa:{passed:true}});
 const body=await(await f.request('/b')).json();assert.equal(body.deliverables.length,2);assert.ok(body.deliverables.every(piece=>!piece.canApprove));
 assert.equal((await f.request('/b/email-1/approve',{method:'POST'})).status,409);assert.deepEqual(calls,[]);
});
test('download all is one real ZIP containing the finished merged email',async()=>{
 const res=await fixture().request('/b/download');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/zip/);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(bytes.readUInt32LE(0),0x04034b50);assert.match(bytes.toString(),/email-1.html/);assert.match(bytes.toString(),/Hola/);assert.match(bytes.toString(),/Granada/);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);
});
test('no partial download when any deliverable needs attention, no unknown output URL, no arbitrary server fetch',async()=>{
 const f=fixture();f.tables.runs[1].status='failed';assert.equal((await f.request('/b/download')).status,409);assert.equal((await fixture().request('/b/download?delivery=raw-agent-id')).status,404);assert.equal((await fixture({asset:true}).request('/b/download?delivery=hero_kv-1')).status,409);
});
test('old missing requested Hero remains a third needs-attention card without invented output or a DB write',async()=>{
 const f=fixture({brief:{...row,payload:{deliveryPlan:{deliverableGroups:['social_post','email','hero_kv'].map(type=>({type,count:1}))}}}});f.tables.runs.push({id:'social',specialist_id:'a16',status:'failed',outputs:[]});const b=await(await f.request('/b')).json();assert.deepEqual(b.deliverables.map(p=>p.type),['social_post','email','hero_kv']);assert.equal(b.deliverables[2].status,'attention');assert.equal(b.deliverables[2].canDownload,false);
});
test('share path is authenticated and does not create a public capability',async()=>{
 const f=fixture(),b=await(await f.request('/b')).json();assert.equal(b.sharePath,'#/canvas/b');assert.equal((await f.app.request('/b')).status,401);
});
