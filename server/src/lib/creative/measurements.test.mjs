import {test} from 'node:test';
import assert from 'node:assert/strict';
import {platformMeasurements,operationCost} from './measurements.js';
const run={id:'r',started_at:'2026-10-04T10:00:00Z',status:'completed',latency_ms:200};
const job={id:'j',run_id:'r',model:{modality:'image',model:'m',version:'v',gateway:'g'},input:{settings:{}},routing:{mode:'shadow',attempted:true,chosenRoute:'a',recommendation:'b',confidence:.95,fallback:'shadow'}};
test('persisted client acceptance/revisions/errors and routing drive platform measurements',()=>{
 const data=platformMeasurements({runs:[run],jobs:[job],events:[{run_id:'r',kind:'workflow',state:'internally_approved',occurred_at:'2026-10-04T10:00:10Z'},{run_id:'r',kind:'workflow',state:'changes_requested_client'},{run_id:'r',kind:'content_revision'},{run_id:'r',kind:'job_state',state:'retrieval_failed',error:'timeout'},{run_id:'r',kind:'workflow',state:'client_approved',occurred_at:'2026-10-04T10:01:00Z'}],usage:[{parent_run_id:'r',operation:'generation',reported_cost_usd:1},{parent_run_id:'r',operation:'qa',estimated_cost_usd:.1},{parent_run_id:'r',operation:'jev'}]});
 const r=data.records[0];assert.equal(r.accepted,true);assert.equal(r.timeToAcceptedMs,60000);assert.equal(r.revisions,1);assert.equal(r.changeRequests,1);assert.equal(r.errorEvents,1);assert.equal(r.routing.recommendation,'b');assert.equal(r.knownCostUsd,1.1);assert.equal(r.totalCostUsd,null);assert.equal(r.costs[0].source,'reported');assert.equal(r.costs[1].source,'estimated');assert.equal(r.costs[2].source,'unknown');assert.equal(data.comparisons[0].costPerAcceptedOutputUsd,null);
});
test('QA and internal approval never infer client acceptance; missing operation remains unknown',()=>{
 const r=platformMeasurements({runs:[run],jobs:[job],events:[{run_id:'r',kind:'workflow',state:'internally_approved',occurred_at:'2026-10-04T10:00:10Z'}],usage:[{parent_run_id:'r',operation:'generation',reported_cost_usd:0}]}).records[0];assert.equal(r.accepted,false);assert.equal(r.timeToAcceptedMs,null);assert.deepEqual(r.missingCostOperations,['qa','jev']);assert.equal(r.totalCostUsd,null);
});
test('reconciliation overrides estimates without double counting; zero is known',()=>{assert.deepEqual(operationCost({reported_cost_usd:'1',estimated_cost_usd:2,reconciled_cost_usd:'0'}),{reported:1,estimated:2,reconciled:0,value:0,source:'reconciled'});});

import {requireBenchmarkBudget} from './benchmark.js';
test('benchmark budget rejects missing, nonfinite, negative or string committed spend and enforces aggregate hold',()=>{
 const base={budgetUsd:1,maxCostUsd:.4,credentials:true};
 for(const committedUsd of [undefined,NaN,Infinity,-Infinity,-.1,'0',null])assert.throws(()=>requireBenchmarkBudget({...base,committedUsd}));
 assert.doesNotThrow(()=>requireBenchmarkBudget({...base,committedUsd:0}));
 assert.doesNotThrow(()=>requireBenchmarkBudget({...base,committedUsd:.6}));
 assert.throws(()=>requireBenchmarkBudget({...base,committedUsd:.6001}));
});

import {validateBenchmarkLedger} from './benchmark.js';
test('resuming a benchmark retains every persisted hold including uncertain/failed submissions',()=>{
 const cases={a:{state:'reconcile',item:{maxCostUsd:.4}},b:{state:'failed',item:{maxCostUsd:.3}}};
 assert.doesNotThrow(()=>validateBenchmarkLedger({committedUsd:.7,cases}));
 assert.throws(()=>validateBenchmarkLedger({committedUsd:.4,cases}));
 assert.throws(()=>validateBenchmarkLedger({committedUsd:NaN,cases}));
 assert.throws(()=>validateBenchmarkLedger({committedUsd:0,cases:{a:{item:{maxCostUsd:NaN}}}}));
});
