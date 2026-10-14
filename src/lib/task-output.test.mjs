import test from 'node:test';
import assert from 'node:assert/strict';
import { outputStatus, statusLabel, expandOutput, newestRuns, taskSnapshot, requestHumanCraft, coalesceTaskCards, taskMetricsLabel } from './task-output.js';
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
test('legacy metrics have an honest unavailable cost',()=>{assert.equal(taskMetricsLabel({total_ms:1200,cost:null}),'Finished in 1s · cost unavailable');assert.equal(taskMetricsLabel({}), 'Finished · cost unavailable');});

test('presentation helpers resolve locale keys without changing truthful status',()=>{
 const t=(key,values)=>values ? `${key}:${values.seconds}` : key;
 assert.equal(statusLabel('ready',t),'vds.status.needs_review');
 assert.equal(taskMetricsLabel({total_ms:1000,cost:null},t),'vds.finishedvds.elapsed:1 · vds.costUnavailable');
});
