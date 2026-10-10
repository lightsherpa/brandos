// Explicit paid runner. Never invoked by tests or discovery. One persisted state
// file per configuration; an uncertain submission cannot be silently repeated.
import {readFile,writeFile,mkdir,open,unlink,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mediaAdapter,providerAvailable} from '../server/src/lib/creative/providers.js';
import {requireBenchmarkBudget,validateBenchmarkLedger} from '../server/src/lib/creative/benchmark.js';
const configPath=process.argv.find(a=>a.startsWith('--config='))?.slice(9);
if(!configPath||!process.argv.includes('--paid'))throw new Error('Requires --paid --config=<reviewed JSON configuration>');
const config=JSON.parse(await readFile(configPath,'utf8'));
const budgetUsd=Number(process.env.CREATIVE_BENCHMARK_BUDGET_USD);
const briefs=JSON.parse(await readFile(new URL('./fixtures/creative-briefs.json',import.meta.url)));
if(!config.outputDirectory||!Array.isArray(config.cases))throw new Error('outputDirectory and cases required');
await mkdir(config.outputDirectory,{recursive:true});
const lockFile=`${config.outputDirectory}/runner.lock`;
const lock=await open(lockFile,'wx');
const ledgerFile=`${config.outputDirectory}/budget.json`;
const save=async value=>{await writeFile(`${ledgerFile}.tmp`,JSON.stringify(value,null,2));await rename(`${ledgerFile}.tmp`,ledgerFile);};
try {
let ledger;try{ledger=JSON.parse(await readFile(ledgerFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;ledger={committedUsd:0,cases:{}};}
validateBenchmarkLedger(ledger);
for(const item of config.cases){
 const brief=briefs.find(b=>b.id===item.briefId);if(!brief||!['image','video'].includes(brief.modality))throw new Error('Media brief required');
 if(!item.model?.version||!item.model?.model||!item.model?.gateway||!item.rateEvidenceUrl||!item.settings)throw new Error('Pinned model/version/settings and reviewed pricing evidence required');
 if(brief.requiresApprovedReference&&!item.reference)throw new Error('Approved reference required');
 const id=createHash('sha256').update(JSON.stringify(item)).digest('hex');
 if(ledger.cases[id]){console.log(`${id}: existing state ${ledger.cases[id].state}; no resubmission`);continue;}
 requireBenchmarkBudget({budgetUsd,committedUsd:ledger.committedUsd,maxCostUsd:item.maxCostUsd,credentials:providerAvailable(item.model)});
 // Persist budget hold before the POST. Costs remain held for uncertain jobs.
 ledger.committedUsd+=item.maxCostUsd;ledger.cases[id]={state:'submitting',item,startedAt:new Date().toISOString()};await save(ledger);
 const adapter=mediaAdapter(item.model);
 try{
  const task=await adapter.submit({prompt:brief.brief,settings:item.settings,reference:item.reference});
  Object.assign(ledger.cases[id],{task,state:'submitted'});await save(ledger);
  let result=task.result;
  for(let attempt=0;!result||!['generated','failed'].includes(result.state);attempt++){
   if(attempt>=180)throw new Error('Polling exhausted; resume existing provider task manually');
   await new Promise(r=>setTimeout(r,10000));result=await adapter.status(task);if(result.state==='ready')result=await adapter.result(task);
  }
  Object.assign(ledger.cases[id],{state:result.state,result,model:item.model.model,version:item.model.version,gateway:item.model.gateway,settings:item.settings,cacheMode:item.cacheMode||'none',accepted:null,revisions:0,totalCostUsd:result.usage?.cost??null,failed:result.state==='failed',timeToAcceptedMs:null,generationLatencyMs:Date.now()-Date.parse(ledger.cases[id].startedAt),capabilities:item.model.features});
 }catch(e){Object.assign(ledger.cases[id],{state:e.definite?'failed':'reconcile',error:e.message});}
 await save(ledger);
}
console.log('Benchmark calls recorded. Acceptance, revisions and time/cost to accepted output require human review. No production promotion performed.');

} finally { await lock.close(); await unlink(lockFile); }
