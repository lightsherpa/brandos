// Human approval is an explicit persisted decision, never inferred from QA.
export function outputStatus(status) { return status === 'approved' ? 'approved' : ['failed','error'].includes(status) ? 'failed' : 'needs_review'; }
export function statusLabel(status, t) { return t ? t('taskOutput.status.' + outputStatus(status)) : {approved:'Approved',failed:'Failed',needs_review:'Needs review'}[outputStatus(status)]; }
export function newestRuns(runs=[]) { return [...runs].sort((a,b)=>Date.parse(b.ended_at||b.started_at||b.created_at||0)-Date.parse(a.ended_at||a.started_at||a.created_at||0)||String(b.id).localeCompare(String(a.id))); }
export function taskSnapshot(body) { return body?.snapshot || body; }
export function hasHumanOutputApproval(output) {
 return output.status === 'approved' && ((['internally_approved','client_review','client_approved'].includes(output.workflow_status) && output.internal_reviewed_by && output.internal_reviewed_at) || (output.workflow_status === 'client_approved' && output.client_reviewed_by && output.client_reviewed_at));
}
export function expandOutput(output) {
 let body=output.body||{}; if(typeof body==='string'){try{body=JSON.parse(body);}catch{}}
 const task=output.kind==='task'||body.kind==='task'||output.kind==='task_rerun';
 if(!task) return [{...output,outputId:output.id,status:outputStatus(output.status),text:body.edited_text||body.text||(typeof body==='string'?body:''),assetUrl:body.asset_url||null,edited:!!body.edited_text}];
 const items=Array.isArray(body.items)?body.items:body.item?[{...body.item,index:body.index}]:body.snapshot?.items||[];
 return items.map((item,i)=>({...output,id:`${output.id}:${item.index??i}`,outputId:output.id,itemIndex:item.index??i,taskId:body.task_id||body.snapshot?.id,taskType:body.type||body.snapshot?.type,kind:body.type||body.snapshot?.type||'task',status:hasHumanOutputApproval(output)?'approved':outputStatus(item.status === 'approved' ? 'ready' : item.status),text:item.copy?.caption||item.copy?.subject||'',html:item.html,checks:[...(item.checks||[]),...(item.review||[])],export:item.export,assetUrl:null,edited:false}));
}
export async function requestHumanCraft(fetcher, body, onCredits=()=>{}) {
 if(body.outputId==null||body.slot==null) throw new Error('This deliverable is not saved yet.');
 const response=await fetcher('/api/craft',{method:'POST',body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error||`Could not queue human craft (${response.status}).`);
 try {const credits=await fetcher('/api/credits');if(credits.ok)onCredits(await credits.json());}catch{}
 return data;
}
// Caller orders persisted outputs newest first. Resolve original type before
// collapsing reruns so every export remains bound to the newest output row.
export function coalesceTaskCards(outputs=[]) {
 const expanded=outputs.flatMap(expandOutput), types=new Map();
 for(const card of expanded) if(card.taskId && card.taskType) types.set(card.taskId,card.taskType);
 const seen=new Set();
 return expanded.filter(card=>{if(!card.taskId)return true;const key=`${card.taskId}:${card.itemIndex}`;if(seen.has(key))return false;seen.add(key);return true;}).map(card=>card.taskId?{...card,taskType:types.get(card.taskId)||card.taskType,kind:types.get(card.taskId)||card.kind}:card);
}
export function taskMetricsLabel(metrics, t) {
 const elapsed=Number.isFinite(metrics?.total_ms)?(t ? t('taskOutput.elapsed', {seconds:(metrics.total_ms/1000).toFixed(0)}) : ` in ${(metrics.total_ms/1000).toFixed(0)}s`):'';
 const cost=metrics?.cost?.total_usd;
 return `${t ? t('taskOutput.finished') : 'Finished'}${elapsed} · ${Number.isFinite(cost)?`$${cost.toFixed(3)}`:t ? t('taskOutput.costUnavailable') : 'cost unavailable'}`;
}
export async function loadSavedTasks(fetcher, brandId, preferredId) {
 const response=await fetcher(`/api/tasks?brandId=${encodeURIComponent(brandId)}`);
 const body=await response.json();
 if(!response.ok) throw new Error(body.error||`Could not recover saved tasks (${response.status}).`);
 const tasks=[...(body.tasks||[])].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(task=>({...task,status:task.status==='running'?'running':outputStatus(task.status)}));
 return {tasks,selectedId:tasks.some(task=>task.id===preferredId)?preferredId:tasks[0]?.id||null};
}
