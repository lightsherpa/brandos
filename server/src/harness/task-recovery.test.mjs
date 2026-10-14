import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconstructTasks } from './task-recovery.js';
const row=(body,kind='task',time='2026-10-14T10:00:00Z',workspace='w')=>({id:time,kind,body:JSON.stringify(body),created_at:time,run_id:'r',run:{bio_version:2,started_at:time,ended_at:time,cost_usd:0.1,latency_ms:100},brief:{brand_id:'b',payload:{request:'Stored brief'},brand:{workspace_id:workspace}}});
const base={task_id:'t',type:'email_sequence',spec:{emails:[{}]},items:[{index:0,status:'flagged',html:'original'}]};
test('legacy snapshots recover honest metadata and latest chronological rerun',()=>{const rows=[row({task_id:'t',index:0,item:{index:0,status:'ready',html:'latest'}},'task_rerun','2026-10-14T12:00:00Z'),row(base),row({task_id:'t',index:0,item:{index:0,status:'flagged',html:'older'}},'task_rerun','2026-10-14T11:00:00Z')];const [job]=reconstructTasks(rows,()=>true);assert.equal(job.items[0].html,'latest');assert.equal(job.status,'ready');assert.equal(job.rerun_counts[0],2);assert.equal(job.result.metrics.cost.total_usd,0.1);assert.equal(job.heroes,null);assert.equal(job.provenance.bioVersion,2);assert.equal(job.created_by,null);});
test('authorization uses DB brand scope and disallows cross-brand rerun injection',()=>{const rows=[row(base),row({...base,task_id:'secret'},'task','2026-10-14T10:00:00Z','other'),{...row({task_id:'t',index:0,item:{status:'ready',html:'injected'}},'task_rerun'),brief:{brand_id:'other',brand:{workspace_id:'w'}}}];const jobs=reconstructTasks(rows,ws=>ws==='w');assert.equal(jobs.length,1);assert.equal(jobs[0].items[0].html,'original');});
test('new metadata preserves metrics/provenance and cannot override tenant identity',()=>{const [job]=reconstructTasks([row({...base,snapshot:{id:'evil',brandId:'evil',workspaceId:'evil',heroes:true,metrics:{total_ms:33},provenance:{bioId:'bio',bioVersion:3,sourceIds:['ref']}}})],()=>true);assert.equal(job.id,'t');assert.equal(job.brandId,'b');assert.equal(job.workspaceId,'w');assert.equal(job.result.metrics.total_ms,33);assert.deepEqual(job.provenance.sourceIds,['ref']);});
test('recovery preserves an explicit human output approval but never promotes QA',()=>{
 const ready={...base,items:[{index:0,status:'ready',html:'saved'}]};
 const automatic={...row(ready),status:'qa_passed',workflow_status:'draft'};
 const [machine]=reconstructTasks([automatic],()=>true);assert.equal(machine.items[0].status,'ready');assert.notEqual(machine.status,'approved');
 const [approved]=reconstructTasks([{...automatic,status:'approved',workflow_status:'internally_approved',internal_reviewed_by:'human',internal_reviewed_at:'2026-10-14T13:00:00Z'}],()=>true);assert.equal(approved.items[0].status,'approved');assert.equal(approved.status,'approved');
 const [forged]=reconstructTasks([{...automatic,status:'approved'}],()=>true);assert.notEqual(forged.status,'approved');
});
test('an unreviewed rerun invalidates the previous item approval after restart',()=>{
 const original={...row({...base,items:[{index:0,status:'ready',html:'original'}]}),status:'approved',workflow_status:'internally_approved',internal_reviewed_by:'human',internal_reviewed_at:'time'};
 const rerun={...row({task_id:'t',index:0,item:{index:0,status:'ready',html:'new'}},'task_rerun','2026-10-14T14:00:00Z'),status:'qa_passed'};
 const [job]=reconstructTasks([original,rerun],()=>true);assert.equal(job.items[0].status,'ready');assert.notEqual(job.status,'approved');
});
