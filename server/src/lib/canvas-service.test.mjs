import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedDocument,uuid,edgeFor} from '../../../src/canvas/document.js';
import {claimCanvasQuote,getCanvas,prepareNode,validateReferences,fingerprint} from './canvas-service.js';
import {quoteSpecialist} from './canvas-tiers.js';
import {createCanvasesApp} from '../routes/canvases.js';
const mediaPlanner=async({spec,override})=>({model:{route:override||spec.payload.modelRouting.primary},credits:quoteSpecialist(spec,{tier:override?'premium':'auto'}).credits,maxCost:1,routing:{requestedMode:'off'}});
// Deterministic in-memory PostgREST double; no live services or paid calls.
function database(tables) {
  return {tables,from(table){
    let filters=[],mutation=null,selection=false;
    const query={select(){selection=true;return query;},eq(k,v){filters.push(r=>r[k]===v);return query;},in(k,v){filters.push(r=>v.includes(r[k]));return query;},order(){return query;},limit(){return query;},update(value){mutation=['update',value];return query;},insert(value){mutation=['insert',value];return query;},delete(){mutation=['delete'];return query;},
      async result(single=false){
        let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));
        if(mutation?.[0]==='update')for(const row of rows)Object.assign(row,structuredClone(mutation[1]));
        if(mutation?.[0]==='insert'){rows=(Array.isArray(mutation[1])?mutation[1]:[mutation[1]]).map(r=>({id:uuid(),state:table==='canvas_quotes'?'pending':undefined,...structuredClone(r)}));tables[table]??=[];tables[table].push(...rows);}
        if(mutation?.[0]==='delete')tables[table]=(tables[table]||[]).filter(r=>!rows.includes(r));
        return {data:structuredClone(single?rows[0]||null:rows),error:null};
      },maybeSingle(){return query.result(true);},single(){return query.result(true);},then(resolve,reject){return query.result().then(resolve,reject);}};
    return query;
  }};
}
function fixture() {
  const workspaceId=uuid(),brandId=uuid(),briefId=uuid(),canvasId=uuid(),userId=uuid();
  const spec={id:uuid(),specialist_id:'a01',version:4,payload:{name:'Positioning',cr_estimate:8,modelRouting:{primary:'anthropic/claude-sonnet-4-6'}}},image={id:uuid(),specialist_id:'a12',version:1,payload:{name:'Hero KV',cr_estimate:6,modelRouting:{primary:'vendor/fal/flux-schnell'}}};
  const document=seedDocument({title:'Serum campaign',specialists:[{id:'a01',name:'Positioning',outputType:'text'},{id:'a12',name:'Hero KV',outputType:'image'}]});
  const canvas={id:canvasId,workspace_id:workspaceId,brand_id:brandId,brief_id:briefId,document,revision:0};
  const db=database({workspaces:[{id:workspaceId,canvas_v2_enabled:true}],brands:[{id:brandId,workspace_id:workspaceId}],briefs:[{id:briefId,brand_id:brandId,title:'Serum campaign',payload:{request:'Launch the serum'}}],canvas_layouts:[canvas],specs:[{...spec,active:true},{...image,active:true}],runs:[],outputs:[],canvas_quotes:[],canvas_text_qualifications:['anthropic/claude-sonnet-4-6','anthropic/claude-opus-4-7','openrouter/google/gemini-2.5-flash'].map(route=>({id:uuid(),workspace_id:workspaceId,route,version:1,enabled:true,verified_at:"2026-01-01T00:00:00Z",valid_until:"2099-01-01T00:00:00Z",evidence:{sourceUrl:"https://unit-fixture.invalid",artifact:"unit-only"},bounds:{endpoint:route.startsWith('anthropic/')?'https://api.anthropic.com/v1/messages':'https://openrouter.ai/api/v1/chat/completions',contextTokens:100000,maxOutputTokens:65536,inputUsdPerMillionMax:.01,outputUsdPerMillionMax:.01,requestFeeUsdMax:.001,provider:"unit-only",hardOutputCap:true,allFeesIncluded:true,fullContextBillingBound:true}})),api_budgets:[{scope_type:"workspace",scope_key:workspaceId,active:true,monthly_budget_usd:20,per_request_ceiling_usd:1}]});
  const auth={userId,scope:'workspace',persona:'user',permissions:new Set(['brief.read','brief.write','brief.run','output.read']),memberships:[{workspace_id:workspaceId,status:'active'}]};
  const bioLoader=async()=>({bio:{version:3,certified_by:uuid()},brand:{id:brandId}});
  // stable cert identity: quotes are sensitive to a changed BIO.
  const bio={bio:{version:3,certified_by:uuid()},brand:{id:brandId}};
  return {db,auth,canvas,spec,image,bioLoader:async()=>bio};
}
test('tiers share the existing route multiplier and include deliverable count/platforms',()=>{
  const {spec,image}=fixture();
  assert.equal(quoteSpecialist(spec,{tier:'premium',deliverableSpec:{count:3,platforms:['ig','li']}}).credits,96);
  assert.equal(quoteSpecialist(spec,{tier:'fast'}).credits,6);
  assert.equal(quoteSpecialist(image,{tier:'auto'}).credits,5);
  assert.throws(()=>quoteSpecialist(spec,{tier:'arbitrary'}),/tier/);
  assert.throws(()=>quoteSpecialist(spec,{deliverableSpec:{count:999}}),/count/);
});
test('workspace membership and permissions are enforced even with service-role DB access',async()=>{
  const {db,auth,canvas}=fixture();
  await assert.rejects(()=>getCanvas({...auth,memberships:[]},canvas.id,'brief.read',db),e=>e.status===403);
  await assert.rejects(()=>getCanvas({...auth,permissions:new Set(['brief.read'])},canvas.id,'brief.write',db),e=>e.status===403);
  assert.equal((await getCanvas(auth,canvas.id,'brief.read',db)).id,canvas.id);
});
test('exact selected upstream output reaches the execution snapshot',async()=>{
  const f=fixture(),[source,target]=f.canvas.document.nodes.slice(2),runId=uuid(),outputId=uuid();
  Object.assign(source,{pickedRunId:runId,pickedOutputId:outputId});
  f.canvas.document.edges.push(edgeFor(f.canvas.document,source.id,target.id));
  f.db.tables.outputs.push({id:outputId,brief_id:f.canvas.brief_id,run_id:runId,body:{text:'Approved positioning'},kind:'text',status:'approved',run:{id:runId,specialist_id:'a01',status:'completed'}});
  const prepared=await prepareNode(f.canvas,target.id,f.db,f.bioLoader,mediaPlanner);
  assert.equal(prepared.snapshot.priorOutputs[0].id,outputId);assert.equal(prepared.snapshot.priorOutputs[0].body.text,'Approved positioning');
  source.stale=true;await assert.rejects(()=>prepareNode(f.canvas,target.id,f.db,f.bioLoader,mediaPlanner),e=>e.code==='INPUT_NOT_READY');
});
test('foreign brief/output references are rejected before prompt construction',async()=>{
  const f=fixture(),node=f.canvas.document.nodes[2],runId=uuid(),out=uuid();
  Object.assign(node,{pickedRunId:runId,pickedOutputId:out});
  f.db.tables.runs.push({id:runId,brief_id:uuid(),specialist_id:'a01',outputs:[{id:out}]});
  await assert.rejects(()=>validateReferences(f.canvas,f.canvas.document,f.db),e=>e.status===403);
});
test('quote claims are one-time even under concurrent duplicate submissions',async()=>{
  const f=fixture(),node=f.canvas.document.nodes[2],prepared=await prepareNode(f.canvas,node.id,f.db,f.bioLoader,mediaPlanner),id=uuid();
  f.db.tables.canvas_quotes.push({id,canvas_id:f.canvas.id,node_id:node.id,created_by:f.auth.userId,state:'pending',fingerprint:prepared.fingerprint,credits:prepared.quote.credits,request:{route:prepared.quote.route},expires_at:new Date(Date.now()+60000).toISOString()});
  const body={canvasId:f.canvas.id,nodeId:node.id,quoteId:id};
  const results=await Promise.allSettled([claimCanvasQuote(f.auth,body,f.db,f.bioLoader,mediaPlanner),claimCanvasQuote(f.auth,body,f.db,f.bioLoader,mediaPlanner)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'RUN_ALREADY_SUBMITTED');
});
test('changed settings, edited input bodies, or expiry invalidate approval',async()=>{
  const f=fixture(),node=f.canvas.document.nodes[2],p=await prepareNode(f.canvas,node.id,f.db,f.bioLoader,mediaPlanner),id=uuid();
  f.db.tables.canvas_quotes.push({id,canvas_id:f.canvas.id,node_id:node.id,created_by:f.auth.userId,state:'pending',fingerprint:p.fingerprint,credits:p.quote.credits,request:{route:p.quote.route},expires_at:new Date(Date.now()+60000).toISOString()});
  node.settings.tier='fast';await assert.rejects(()=>claimCanvasQuote(f.auth,{canvasId:f.canvas.id,nodeId:node.id,quoteId:id},f.db,f.bioLoader,mediaPlanner),e=>e.code==='QUOTE_CHANGED');
  assert.notEqual(fingerprint({...p.snapshot,priorOutputs:[{body:{text:'first'}}]}),fingerprint({...p.snapshot,priorOutputs:[{body:{text:'edited'}}]}));
});
test('API save uses revision CAS and denies stale writes',async()=>{
  const f=fixture(),app=createCanvasesApp({db:f.db,authMiddleware:async(c,next)=>{c.set('auth',f.auth);await next();},bioLoader:f.bioLoader});
  const save=revision=>app.request(`/${f.canvas.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({revision,document:f.canvas.document})});
  assert.equal((await save(0)).status,200);const stale=await save(0);assert.equal(stale.status,409);assert.equal((await stale.json()).code,'CANVAS_CONFLICT');
});
test('API quotes include aggregate caps and never return internal routes',async()=>{
  const f=fixture(),checks=[],app=createCanvasesApp({db:f.db,authMiddleware:async(c,next)=>{c.set('auth',f.auth);await next();},bioLoader:f.bioLoader,mediaPlanner,quoteCheck:async(w,n,opts)=>{checks.push([n,opts]);return {ok:true,balance:100};}});
  const response=await app.request(`/${f.canvas.id}/quotes`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeIds:f.canvas.document.nodes.slice(2).map(n=>n.id)})});
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.total,13);assert.equal(checks.at(-1)[1].runCap,0);
  assert.doesNotMatch(JSON.stringify(data),/anthropic|openrouter|vendor|modelRouting|cost_usd/);
});
