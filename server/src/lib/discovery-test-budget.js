// Internal safeguard for the explicitly approved local paid test only.
import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import path from 'node:path';
export function reserveDiscoveryTestSpend(amount,label){
 if(process.env.DISCOVERY_PAID_TEST!=='1')return ()=>{};
 const limit=Math.min(5,Number(process.env.DISCOVERY_PAID_TEST_LIMIT_USD)||5);
 const file=path.resolve('.bio-local/paid-budget.json');mkdirSync(path.dirname(file),{recursive:true});
 const read=()=>existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{limitUsd:limit,entries:[]};
 const save=ledger=>{writeFileSync(file+'.tmp',JSON.stringify(ledger,null,2));renameSync(file+'.tmp',file);};
 const ledger=read(),spent=ledger.entries.reduce((sum,e)=>sum+e.amountUsd,0);
 if(spent+amount>limit)throw Object.assign(new Error('Approved local discovery test budget exhausted'),{code:'TEST_BUDGET_EXHAUSTED'});
 const id=crypto.randomUUID();ledger.entries.push({id,label,amountUsd:amount,status:'reserved',at:new Date().toISOString()});save(ledger);
 return actual=>{
  if(!Number.isFinite(actual)||actual<0)return; // retain upper reservation when no bill is returned
  const latest=read(),entry=latest.entries.find(e=>e.id===id);entry.amountUsd=actual;entry.status='provider_reported';save(latest);
 };
}
