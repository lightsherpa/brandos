import {summarizeBenchmark} from './benchmark.js';
const numeric=value=>value==null?null:Number.isFinite(Number(value))?Number(value):null;
export function operationCost(event){
 const reconciled=numeric(event.reconciled_cost_usd),reported=numeric(event.reported_cost_usd),estimated=numeric(event.estimated_cost_usd);
 return {reconciled,reported,estimated,value:reconciled??reported??estimated,source:reconciled!=null?'reconciled':reported!=null?'reported':estimated!=null?'estimated':'unknown'};
}
export function platformMeasurements({runs,jobs,events,usage,spend=[],acceptanceStage='client_approved'}){
 const records=runs.map(run=>{
  const job=jobs.find(j=>j.run_id===run.id),history=events.filter(e=>e.run_id===run.id),operations=usage.filter(e=>e.parent_run_id===run.id).map(e=>({operation:e.operation,feature:e.feature,...operationCost(e)}));
  const routing=job?.routing||null,billing=spend.find(h=>h.run_id===run.id),billingKnown=billing&&['settled','released'].includes(billing.state)&&billing.actual_cost_usd!=null;
  const acceptance=history.filter(e=>e.kind==='workflow'&&e.state===acceptanceStage).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at))[0];
  // No usage rows is unknown, including legacy text executions with an unlinked ledger.
  const missing=job ? ['generation',...(job.model.modality==='image'?['qa']:[]),...(routing?.attempted?['jev']:[])].filter(op=>!operations.some(e=>e.operation===op)) : operations.length?[]:['execution'];
  const costUnknown=billing? !billingKnown:missing.length>0||operations.some(e=>e.value==null);
  const knownCostUsd=operations.reduce((sum,e)=>sum+(e.value??0),0);
  const revisions=history.filter(e=>e.kind==='content_revision').length;
  const changeRequests=history.filter(e=>e.kind==='workflow'&&['changes_requested_internal','changes_requested_client'].includes(e.state)).length;
  const failures=history.filter(e=>e.kind==='job_state'&&(e.error||['failed','reconcile','retrieval_failed','persistence_failed'].includes(e.state))||e.kind==='run_status'&&e.state==='failed'||e.kind==='text_phase'&&(e.state==='reconcile'||e.error));
  const started=Date.parse(run.started_at),acceptedAt=acceptance?.occurred_at||null;
  return {runId:run.id,jobId:job?.id||null,canvasId:run.canvas_id||null,nodeId:run.canvas_node_id||null,model:job?.model?.model||run.model_used||'unknown',version:job?.model?.version||job?.catalog_version||null,settings:job?.input?.settings||run.canvas_snapshot?.settings||{},gateway:job?.model?.gateway||'legacy',cacheMode:job?.input?.settings?.cacheMode||'unrecorded',cohort:routing?.mode==='shadow'?'shadow':routing?.mode==='active'?'active':job?'baseline':'unassigned',accepted:!!acceptance,acceptanceStage,acceptedAt,revisions,changeRequests,failed:run.status==='failed'||job?.state==='failed',errorEvents:failures.length,latencyMs:numeric(run.latency_ms),timeToAcceptedMs:acceptedAt&&Number.isFinite(started)?Math.max(0,Date.parse(acceptedAt)-started):null,knownCostUsd,totalCostUsd:billingKnown?numeric(billing.actual_cost_usd):costUnknown?null:knownCostUsd,executionSpend:billing?{state:billing.state,maxCostUsd:numeric(billing.max_cost_usd),knownReportedSubtotalUsd:numeric(billing.known_subtotal_usd),breached:billing.breached,billingSource:billing.reconciliation?'operator_reconciled':'provider_reported'}:null,costUnknown,missingCostOperations:missing,costs:operations,routing:routing?{mode:routing.mode,chosenRoute:routing.chosenRoute,recommendation:routing.recommendation||null,confidence:routing.confidence,fallback:routing.fallback,attempted:!!routing.attempted}:null,measurementEvents:history.length};
 });
 return {acceptanceStage,records,comparisons:summarizeBenchmark(records),coverage:{runs:records.length,runsWithEvents:records.filter(r=>r.measurementEvents).length,costUnknownRuns:records.filter(r=>r.costUnknown).length},caution:'Prospective platform evidence. Internal review is not client acceptance. Shadow cohorts are observational and do not prove causal improvement.'};
}
export async function loadPlatformMeasurements(db,{workspaceId,from,to,acceptanceStage}){
 // Fail on truncated evidence instead of reporting misleading totals. Narrow the period.
 const fetchRows=async query=>{
  const rows=[];
  for(let offset=0;offset<10000;offset+=1000){
    const {data,error,count}=await query.range(offset,offset+999);if(error)throw error;
    if(count>10000)throw new Error('Measurement period contains too many rows; narrow the period.');
    rows.push(...(data||[]));if(rows.length>=count||!data?.length)break;
  }
  return rows;
 };
 const runs=await fetchRows(db.from('runs').select('*,brief:briefs!inner(brand:brands!inner(workspace_id))',{count:'exact'}).eq('brief.brand.workspace_id',workspaceId).gte('started_at',from).lte('started_at',to).limit(10000));
 if(!runs.length)return platformMeasurements({runs:[],jobs:[],events:[],usage:[],acceptanceStage});
 // Fetch all subsequent reviews/costs for this run cohort, including outside its start period.
 const ids=runs.map(r=>r.id),all={jobs:[],events:[],usage:[],spend:[]};
 for(let i=0;i<ids.length;i+=100){const batch=ids.slice(i,i+100);const rows=await Promise.all([
 fetchRows(db.from('creative_jobs').select('*',{count:'exact'}).eq('workspace_id',workspaceId).in('run_id',batch).limit(10000)),
 fetchRows(db.from('execution_measurement_events').select('*',{count:'exact'}).eq('workspace_id',workspaceId).in('run_id',batch).limit(10000)),
 fetchRows(db.from('api_usage_events').select('*',{count:'exact'}).eq('workspace_id',workspaceId).in('parent_run_id',batch).limit(10000)),
 fetchRows(db.from('execution_spend_holds').select('*',{count:'exact'}).eq('workspace_id',workspaceId).in('run_id',batch).limit(10000))]);
 ['jobs','events','usage','spend'].forEach((key,j)=>all[key].push(...rows[j]));}
 return platformMeasurements({runs,...all,acceptanceStage});
}
