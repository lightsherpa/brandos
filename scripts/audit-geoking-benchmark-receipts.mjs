import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const root=new URL('../output/discovery-bio/geoking-comparison/',import.meta.url);
const report=JSON.parse(await readFile(new URL('comparison.json',root)));
const env=parseEnv(await readFile('/Users/oscarmottaquintana/Documents/Claudio/CaastorOS/server/.env','utf8'));
const stats=await Promise.all(report.runs.flatMap(run=>run.calls.map(async call=>{
 if(!call.receipt)return {model:run.model,label:call.label,status:'no receipt',totalCost:null};
 const response=await fetch('https://openrouter.ai/api/v1/generation?id='+encodeURIComponent(call.receipt),{headers:{Authorization:'Bearer '+env.OPENROUTER_API_KEY},signal:AbortSignal.timeout(20000)});
 const {data}=await response.json();
 return {model:run.model,label:call.label,receipt:call.receipt,status:response.status,totalCost:data?.total_cost??null,nativeTokensReasoning:data?.native_tokens_reasoning??null,provider:data?.provider_name??null,finishReason:data?.finish_reason??null,streamingCost:call.usage?.cost_usd??null};
})));
await writeFile(new URL('receipt-audit.json',root),JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify(stats.map(x=>({model:x.model,label:x.label,status:x.status,cost:x.totalCost})),null,2));
