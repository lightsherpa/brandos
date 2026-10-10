import {reserveDiscoveryTestSpend} from './discovery-test-budget.js';
import {streamCompletion} from './models/router.js';

// Server-owned BIO routes. Client overrides cannot select these steps.
export const DISCOVERY_ROUTES=Object.freeze({
 reader:{primary:'openrouter/anthropic/claude-haiku-5.5',fallback:'openrouter/google/gemini-3.8-flash',maxTokens:6000},
 synthesis:{primary:'openrouter/anthropic/claude-sonnet-5.5',fallback:'openrouter/anthropic/claude-opus-5.5',maxTokens:12000},
 vision:{primary:'openrouter/google/gemini-3.8-flash',fallback:'openrouter/anthropic/claude-sonnet-5.5',maxTokens:2000},
});

// Buffer each attempt before returning. A failed stream must never contaminate
// the fallback JSON. At most one fallback, with the same output cap.
export async function completeDiscoveryStep({step,system,messages,telemetry={},parse=x=>x,complete=streamCompletion,onUsage=()=>{}}){
 const config=DISCOVERY_ROUTES[step];
 if(!config)throw new Error(`Unknown discovery model step: ${step}`);
 let lastError;
 for(const route of [config.primary,config.fallback]){
  let text='',usage=null,stopReason=null;
  try{
   // Text messages are bounded by the compiler to <100k tokens. Vision reserves
   // the full advertised context at verified provider prices, including fallback.
   const reserve=step==='reader'?.08:step==='synthesis'?(route.includes('opus')?.75:.4):route.includes('sonnet')?2.1:.8;
   const settle=reserveDiscoveryTestSpend(reserve,`${step}:${route}`);
   for await(const event of complete({spec:{payload:{name:`Discovery ${step}`,modelRouting:{primary:route}}},system,messages,maxTokens:config.maxTokens,telemetry:{operationKey:'discovery.compile',feature:`discovery.${step}`,...telemetry}})){
    if(event.type==='token')text+=event.text;
    else if(event.type==='error')throw new Error(event.message);
    else if(event.type==='done'){usage=event.usage;stopReason=event.stopReason;settle(usage?.cost_usd);onUsage({...usage,step,route});}
   }
   if(!text.trim())throw new Error('Empty model response');
   if(['length','max_tokens'].includes(stopReason))throw new Error('Model response exceeded its output cap');
   return {value:parse(text,{stopReason}),text,usage,route,stopReason};
  }catch(error){lastError=error;}
 }
 throw new Error(`Discovery ${step} failed after bounded fallback: ${lastError?.message}`);
}
