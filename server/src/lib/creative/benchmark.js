// Measurements are supplied by real runs; fixture expectations are not results.
export function summarizeBenchmark(records) {
  const groups=new Map();
  for(const r of records){
    const key=JSON.stringify([r.model,r.version,r.settings,r.gateway,r.cacheMode,r.cohort||'unassigned']);
    const g=groups.get(key)||{model:r.model,version:r.version,settings:r.settings,gateway:r.gateway,cacheMode:r.cacheMode,cohort:r.cohort||'unassigned',latencyMs:[],runs:0,accepted:0,revisions:0,totalCostUsd:0,costUnknown:false,timeToAcceptedMs:[],failures:0};
    if(Number.isFinite(r.latencyMs))g.latencyMs.push(r.latencyMs);
    g.runs++;g.accepted+=r.accepted===true?1:0;g.revisions+=r.revisions||0;g.failures+=r.failed?1:0;
    if(r.totalCostUsd==null)g.costUnknown=true;else g.totalCostUsd+=r.totalCostUsd;
    if(r.accepted&&Number.isFinite(r.timeToAcceptedMs))g.timeToAcceptedMs.push(r.timeToAcceptedMs);
    groups.set(key,g);
  }
  return [...groups.values()].map(g=>({...g,totalCostUsd:g.costUnknown?null:g.totalCostUsd,acceptanceRate:g.accepted/g.runs,p95LatencyMs:percentile(g.latencyMs,.95),medianTimeToAcceptedMs:percentile(g.timeToAcceptedMs,.5),p95TimeToAcceptedMs:percentile(g.timeToAcceptedMs,.95),costPerAcceptedOutputUsd:g.costUnknown||!g.accepted?null:g.totalCostUsd/g.accepted}));
}
export function evaluateJevLabels(cases,records) {
  let agreements=0,violations=0;
  const byId=new Map(records.map(r=>[r.id,r]));
  for(const c of cases){const r=byId.get(c.id);if(!r)continue;if(r.chosenRoute===c.acceptedRoute)agreements++;if(r.chosenRoute&&!c.eligibleRoutes.includes(r.chosenRoute))violations++;}
  return {labeledCases:cases.length,measuredCases:cases.filter(c=>byId.has(c.id)).length,agreement:cases.length?agreements/cases.length:0,hardConstraintViolations:violations,
    eligibleForHumanReview:cases.length>=100&&cases.every(c=>byId.has(c.id))&&violations===0&&agreements/cases.length>=.95,humanAccepted:false};
}
export function requireBenchmarkBudget({budgetUsd,committedUsd,maxCostUsd,credentials}) {
  if(!credentials)throw new Error('Benchmark credentials unavailable');
  if(!Number.isFinite(budgetUsd)||budgetUsd<=0||!Number.isFinite(maxCostUsd)||maxCostUsd<=0||!Number.isFinite(committedUsd)||committedUsd<0||committedUsd+maxCostUsd>budgetUsd)throw new Error('Explicit benchmark budget insufficient');
}

function percentile(values,p){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];}

export function validateBenchmarkLedger(ledger){
 if(!ledger||!Number.isFinite(ledger.committedUsd)||ledger.committedUsd<0||!ledger.cases||Array.isArray(ledger.cases)||typeof ledger.cases!=='object')throw new Error('Invalid benchmark budget ledger');
 let held=0;
 for(const entry of Object.values(ledger.cases)){
  const bound=entry?.item?.maxCostUsd;
  if(!Number.isFinite(bound)||bound<=0)throw new Error('Invalid persisted benchmark reservation');
  held+=bound;
 }
 if(!Number.isFinite(held)||ledger.committedUsd+Number.EPSILON*Math.max(1,held)<held)throw new Error('Persisted benchmark holds exceed committed budget');
 return ledger;
}
