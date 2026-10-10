import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedDocument,uuid,canConnect,edgeFor,editDocument,historyReducer,pointInGraph,validateDocument,downstream} from './document.js';
import {workflowActions} from './view-model.js';
const seed=()=>seedDocument({title:'Serum campaign',specialists:[{id:'a01',name:'Positioning',outputType:'text'},{id:'a14',name:'Social copy',outputType:'text'},{id:'a12',name:'Hero image',outputType:'image'}]});
test('graph prevents cycles, self edges, duplicate edges and unsupported reference targets',()=>{
  const d=seed(),[a,b,img]=d.nodes.slice(2);
  assert.match(canConnect(d,a.id,a.id),/itself/);
  const e=editDocument(d,{type:'connect',edge:edgeFor(d,a.id,b.id)});
  assert.match(canConnect(e,b.id,a.id),/cycle/);
  assert.match(canConnect(e,a.id,b.id),/already/);
  assert.match(canConnect(d,img.id,b.id),/Image references/);
  assert.match(canConnect(d,a.id,d.nodes[0].id),/does not accept/);
});
test('picked output changes mark every downstream node stale; rename does not',()=>{
  let d=seed();const [a,b,img]=d.nodes.slice(2);
  d=editDocument(d,{type:'connect',edge:edgeFor(d,a.id,b.id)});
  d=editDocument(d,{type:'connect',edge:edgeFor(d,b.id,img.id)});
  d=editDocument(d,{type:'update',id:b.id,patch:{stale:false}});d=editDocument(d,{type:'update',id:img.id,patch:{stale:false}});
  assert.deepEqual([...downstream(d,a.id)],[b.id,img.id]);
  const renamed=editDocument(d,{type:'update',id:a.id,patch:{title:'New title'}});
  assert.equal(renamed.nodes.find(n=>n.id===b.id).stale,false);
  const changed=editDocument(d,{type:'update',id:a.id,patch:{pickedRunId:uuid(),pickedOutputId:uuid()}});
  assert.equal(changed.nodes.find(n=>n.id===b.id).stale,true);assert.equal(changed.nodes.find(n=>n.id===img.id).stale,true);
});
test('node removal is reversible and never mutates asset history',()=>{
  const document=seed(),id=document.nodes[2].id,initial={document,past:[],future:[]};
  const removed=historyReducer(initial,{type:'remove',id});
  assert.equal(removed.document.nodes.length,4);
  assert.equal(removed.document.edges.some(e=>e.to===id),false);
  const undo=historyReducer(removed,{type:'undo'});assert.deepEqual(undo.document,document);
  assert.deepEqual(historyReducer(undo,{type:'redo'}).document,removed.document);
  assert.equal(editDocument(document,{type:'remove',id:document.nodes[0].id}),document);
});
test('two instances of a specialist have independent identities and legacy versions',()=>{
  const run={id:uuid(),specialist_id:'a01',outputs:[{id:uuid()}]};
  const d=seedDocument({title:'Brief',specialists:[{id:'a01',name:'Positioning',outputType:'text'}],runs:[run]});
  const original=d.nodes[2],{pickedRunId,pickedOutputId,legacyRunIds,...copy}=original;
  const next=editDocument(d,{type:'add',node:{...copy,id:uuid()}});
  assert.notEqual(next.nodes[2].id,next.nodes[3].id);assert.equal(next.nodes[3].pickedRunId,undefined);
});
test('wire drop coordinates invert pan/zoom; malformed ports and selections are rejected',()=>{
  assert.deepEqual(pointInGraph({x:450,y:270},{left:50,top:20},{x:100,y:50,zoom:.5}),{x:600,y:400});
  const d=seed();assert.throws(()=>validateDocument({...d,nodes:[...d.nodes,d.nodes[0]]}),/unique/);
  assert.throws(()=>validateDocument({...d,edges:[{...d.edges[0],fromPort:'image'}]}),/port/);
  assert.throws(()=>validateDocument({...d,nodes:d.nodes.map((n,i)=>i===2?{...n,pickedRunId:uuid()}:n)}),/both/);
});
test('review controls respect workflow state, permissions and separation of duty',()=>{
  assert.deepEqual(workflowActions({workflow_status:'draft'},['output.client_approve'],'user'),[]);
  assert.equal(workflowActions({workflow_status:'submitted_internal',submitted_by:'user'},['output.internal_approve'],'user').some(([a])=>a==='internal_approve'),false);
  assert.equal(workflowActions({workflow_status:'submitted_internal',submitted_by:'other'},['output.internal_approve'],'user')[0][0],'internal_approve');
  assert.equal(workflowActions({workflow_status:'client_review'},['output.client_approve'],'user')[0][0],'client_approve');
});

test('approved-media graph accepts one image reference for video while refusing video chains',()=>{
  const d=seed(),source=d.nodes.at(-1),video={...source,id:uuid(),title:'Video',outputType:'video',x:1100,settings:{tier:'auto'}};
  d.nodes.push(video);assert.equal(canConnect(d,source.id,video.id),null);
  const e=editDocument(d,{type:'connect',edge:edgeFor(d,source.id,video.id)});assert.equal(validateDocument(e),e);
  assert.match(canConnect(e,video.id,d.nodes[2].id),/Video outputs/);
});

// Locale changes must never alter the execution/review identifiers used by CSS/API.
test('translated status and workflow labels preserve internal state/action identities',async()=>{
  const {statusCode,statusLabel}=await import('./view-model.js'),{setLocale}=await import('../lib/i18n.js');
  const node={id:uuid(),type:'specialist'},runs=[{canvas_node_id:node.id,status:'running',textState:'reconcile'}],states=[];
  try{for(const locale of ['en','es','ar']){setLocale(locale);assert.equal(statusCode(node,runs),'reconcile');states.push(statusLabel(node,runs));assert.deepEqual(workflowActions({workflow_status:'client_review'},['output.client_approve'],'user').map(([action])=>action),['client_approve','client_changes']);}}finally{setLocale('en');}
  assert.equal(new Set(states).size,3);
});
