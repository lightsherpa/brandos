import test from 'node:test';import assert from 'node:assert/strict';
import {afterSubmissionError} from './submission-state.js';import {canvasOfficeNodes} from './office-adapter.js';
test('proven preflight rejection restores persisted flagged/stale output without changing run or ledger data',()=>{
 const node={id:'n',type:'specialist',title:'Copy',pickedRunId:'r',pickedOutputId:'o',stale:true};
 const runs=[{id:'r',canvas_node_id:'n',status:'completed',outputs:[{id:'o',status:'flagged',workflow_status:'internally_approved',body:{text:'Saved'}}]}],ledger=[{credits:-300}];
 const before=JSON.stringify({node,runs,ledger});
 const busy=afterSubmissionError({n:{phase:'running'},other:{phase:'running'}},'n','q',{code:'QUOTE_CHANGED',status:409});
 assert.equal(busy.n,undefined);assert.equal(busy.other.phase,'running');
 const projected=canvasOfficeNodes({nodes:[node],edges:[]},runs,busy);assert.equal(projected[0].state,'flagged');assert.equal(projected[1].status,'flagged');assert.equal(projected[1].outputId,'o');assert.equal(projected[1].workflowStatus,'internally_approved');assert.equal(JSON.stringify({node,runs,ledger}),before);
});
test('unknown, duplicate or accepted submission remains reconciliation even with an HTTP error',()=>{
 for(const [code,accepted] of [['RUN_ALREADY_SUBMITTED',false],['UNKNOWN',false],['QUOTE_CHANGED',true]])assert.equal(afterSubmissionError({},'n','q',{code,status:409},accepted).n.phase,'reconciling');
});
