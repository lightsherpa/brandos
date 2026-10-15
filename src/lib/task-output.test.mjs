import test from 'node:test';
import assert from 'node:assert/strict';
import { outputStatus, statusLabel, expandOutput, newestRuns, taskSnapshot, requestHumanCraft, coalesceTaskCards, taskMetricsLabel, loadSavedTasks } from './task-output.js';
test('machine readiness and missing checks never imply human approval', () => {
 for (const status of ['ready','done','completed','flagged',undefined]) assert.equal(outputStatus(status),'needs_review');
 assert.equal(outputStatus('approved'),'approved'); assert.equal(statusLabel('failed'),'Failed');
});
test('task envelope expands one HTML/check card per item without losing parent ID', () => {
 const cards=expandOutput({id:'out',kind:'task',body:{task_id:'job',type:'email_sequence',items:[{index:0,status:'ready',html:'<p>A</p>',checks:[{pass:true}]},{index:1,status:'failed',html:'<p>B</p>'}]}});
 assert.equal(cards.length,2);assert.equal(cards[0].outputId,'out');assert.equal(cards[0].status,'needs_review');assert.equal(cards[1].status,'failed');assert.equal(cards[0].html,'<p>A</p>');
});
test('rerun item retains actual output ID for export',()=>{const [card]=expandOutput({id:'rerun',kind:'task_rerun',body:{task_id:'job',index:2,item:{html:'<p>new</p>',export:{stable:true}}}});assert.equal(card.itemIndex,2);assert.equal(card.outputId,'rerun');});
test('newest run chosen deterministically',()=>assert.deepEqual(newestRuns([{id:'old',ended_at:'2020-01-01'},{id:'new',ended_at:'2021-01-01'}]).map(r=>r.id),['new','old']));
test('persisted snapshot unwrapped for board',()=>assert.equal(taskSnapshot({snapshot:{id:'job',items:[]}}).id,'job'));
test('craft rejections surface and do not request credits',async()=>{let calls=0;await assert.rejects(requestHumanCraft(async()=>{calls++;return {ok:false,status:402,json:async()=>({error:'Insufficient credits'})};},{outputId:'o',slot:0}),/Insufficient/);assert.equal(calls,1);});
test('craft refreshes authoritative credit balance only after success',async()=>{const paths=[];let credits;await requestHumanCraft(async(path)=>{paths.push(path);return {ok:true,json:async()=>path==='/api/credits'?{balance:9}:{ok:true}};},{outputId:'o',slot:0},value=>credits=value);assert.deepEqual(paths,['/api/craft','/api/credits']);assert.equal(credits.balance,9);});

test('serialized database JSON task body still yields actual HTML',()=> {
 const [card]=expandOutput({id:'stored',kind:'task',body:JSON.stringify({type:'social_post',items:[{index:0,html:'<main>social</main>',export:{stable:true}}]})});
 assert.equal(card.html,'<main>social</main>');assert.equal(card.export.stable,true);
});
test('latest persisted task item supersedes original retaining its task type and export source',()=>{
 const original={id:'old',kind:'task',body:{task_id:'job',type:'social_post',items:[{index:0,status:'ready',html:'old'},{index:1,status:'ready',html:'second'}]}};
 const rerun={id:'new',kind:'task_rerun',body:{task_id:'job',index:0,item:{status:'ready',html:'new',export:{stable:true}}}};
 const cards=coalesceTaskCards([rerun,original]); assert.equal(cards.length,2);assert.equal(cards[0].outputId,'new');assert.equal(cards[0].kind,'social_post');assert.equal(cards[0].html,'new');assert.equal(cards[0].status,'needs_review');
});
test('metrics show elapsed and credits, never a dollar cost',()=>{
 assert.equal(taskMetricsLabel({total_ms:1200,cost:{total_usd:1.23}}),'Finished in 1s');
 assert.equal(taskMetricsLabel({total_ms:1200}, null, 12),'Finished in 1s · 12 cr');
 assert.equal(taskMetricsLabel({}), 'Finished');
 assert.doesNotMatch(taskMetricsLabel({total_ms:1200,cost:{total_usd:1.23}}, null, 4), /\$|cost/i);
});

test('presentation helpers resolve locale keys without changing truthful status',()=>{
 const t=(key,values)=>values ? `${key}:${values.seconds ?? values.count}` : key;
 assert.equal(statusLabel('ready',t),'taskOutput.status.needs_review');
 assert.equal(taskMetricsLabel({total_ms:1000},t,3),'taskOutput.finishedtaskOutput.elapsed:1taskOutput.credits:3');
});
test('new browser restores latest persisted task without local storage',async()=>{
 const calls=[]; const result=await loadSavedTasks(async path=>{calls.push(path);return {ok:true,json:async()=>({tasks:[{id:'older',created_at:'2020-01-01',status:'ready'},{id:'latest',created_at:'2021-01-01',status:'ready'}]})};},'brand',null);
 assert.deepEqual(calls,['/api/tasks?brandId=brand']);assert.equal(result.selectedId,'latest');assert.equal(result.tasks[0].status,'needs_review');
});
test('saved board restores valid previous selection and rejects deleted or cross-brand IDs',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({tasks:[{id:'a',created_at:'2021-01-01'},{id:'b',created_at:'2020-01-01'}]})});
 assert.equal((await loadSavedTasks(fetcher,'brand','b')).selectedId,'b');assert.equal((await loadSavedTasks(fetcher,'brand','foreign')).selectedId,'a');
});
test('saved task list errors remain visible instead of an empty success',async()=>{
 await assert.rejects(loadSavedTasks(async()=>({ok:false,status:503,json:async()=>({error:'Recovery unavailable'})}),'brand'),/Recovery unavailable/);
});
test('task cards require a recorded human workflow decision to show Approved',()=>{
 const output={id:'o',kind:'task',status:'approved',body:{task_id:'t',type:'email_sequence',items:[{index:0,status:'ready',html:'email'}]}};
 assert.equal(expandOutput(output)[0].status,'needs_review');
 const human={...output,workflow_status:'internally_approved',internal_reviewed_by:'reviewer',internal_reviewed_at:'time'};
 assert.equal(expandOutput(human)[0].status,'approved');
 assert.equal(expandOutput({...output,status:'qa_passed'})[0].status,'needs_review');
});

test('persisted quarantined task artifacts are hidden by Library until ready',()=>{const output={id:'quarantine',kind:'task',body:{task_id:'task',items:[{index:0,status:'flagged',quality_gated:true,html:'private render',copy:{caption:'Cake'}}]}};assert.equal(expandOutput(output)[0].html,null);output.body.items[0].status='ready';assert.equal(expandOutput(output)[0].html,'private render');});
