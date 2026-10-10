import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasOfficeNodes} from './office-adapter.js';
import {officeModel} from '../lib/office-model.js';
const document={nodes:[{id:'brief',type:'brief',title:'Synthetic brief'},{id:'copy',type:'specialist',specialistId:'a16',title:'Copy',pickedRunId:'r1',pickedOutputId:'o1'},{id:'image',type:'specialist',specialistId:'a41',title:'Image'}],edges:[{from:'copy',to:'image'}]};
const runs=[{id:'r1',canvas_node_id:'copy',status:'completed',outputs:[{id:'o1',title:'Selected copy',status:'ready',workflow_status:'draft',body:{text:'Selected output'}}]},{id:'r2',canvas_node_id:'copy',status:'completed',outputs:[{id:'o2',body:{text:'Unselected output'}}]}];
test('office reads the chosen output and real graph source without mutating execution data',()=>{
 const before=JSON.stringify({document,runs}),nodes=canvasOfficeNodes(document,runs);
 assert.equal(nodes.find(n=>n.id==='image').inputFrom,'copy');
 const shelf=officeModel(nodes).outputs;assert.equal(shelf.length,1);assert.equal(shelf[0].body,'Selected output');assert.equal(shelf[0].canvasNodeId,'copy');assert.equal(shelf[0].outputId,'o1');
 assert.equal(JSON.stringify({document,runs}),before);assert.equal(officeModel(nodes).pendingReview,true);
});
test('uncertain execution is neither queued, complete nor a simulated failure',()=>{
 for(const field of ['mediaState','textState']){
  const nodes=canvasOfficeNodes(document,[{id:'r3',canvas_node_id:'image',status:'running',[field]:'reconcile'}]);
  assert.equal(nodes.find(n=>n.id==='image').state,'reconcile');assert.equal(officeModel(nodes).uncertain,true);
 }
 const nodes=canvasOfficeNodes(document,[],{image:{phase:'reconciling'}});assert.equal(nodes.find(n=>n.id==='image').state,'checking');
});
test('missing selections expose no invented output; stale picked output retains review flag',()=>{
 const noPick=structuredClone(document);delete noPick.nodes[1].pickedOutputId;assert.equal(officeModel(canvasOfficeNodes(noPick,runs)).outputs.length,0);
 const stale=structuredClone(document);stale.nodes[1].stale=true;const model=officeModel(canvasOfficeNodes(stale,runs));assert.equal(model.flagged,true);assert.equal(model.outputs[0].status,'flagged');
});
test('image and video cards never mistake a video asset for an image thumbnail',()=>{
 const doc=structuredClone(document);doc.nodes[1].outputType='image';
 const images=structuredClone(runs);images[0].outputs[0].kind='image';images[0].outputs[0].body={asset_url:'/synthetic-image.png'};
 let card=officeModel(canvasOfficeNodes(doc,images)).outputs[0];assert.equal(card.mediaType,'image');assert.equal(card.assetUrl,'/synthetic-image.png');
 doc.nodes[1].outputType='video';images[0].outputs[0].kind='video';images[0].outputs[0].body={asset_url:'/synthetic-video.mp4'};
 card=officeModel(canvasOfficeNodes(doc,images)).outputs[0];assert.equal(card.mediaType,'video');assert.equal(card.assetUrl,undefined);assert.equal(card.outputId,'o1');
});
test('QA flag and steward approval remain separate from client acceptance',()=>{
 const data=structuredClone(runs);data[0].outputs[0].status='flagged';data[0].outputs[0].workflow_status='internally_approved';
 let card=officeModel(canvasOfficeNodes(document,data)).outputs[0];assert.equal(card.status,'flagged');assert.equal(card.workflowStatus,'internally_approved');assert.equal(card.workflowLabel,'Approved by steward');assert.equal(card.reviewNote,'QA flagged');
 data[0].outputs[0].status='approved';data[0].outputs[0].workflow_status='client_approved';card=officeModel(canvasOfficeNodes(document,data)).outputs[0];assert.equal(card.workflowLabel,'Approved by client');
});
