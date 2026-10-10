import {supabaseAdmin} from './supabase.js';
const active=['claimed','submitting','generating','generation_complete','qa_running','settling'];
export async function textExecutionLease(runId,db=supabaseAdmin){
 let phase='claimed',possible=false,lost=false,closed=false,chain=Promise.resolve();
 const serialize=fn=>{const next=chain.then(fn);chain=next.catch(()=>{lost=true;});return next;};
 const step=(next,patch={})=>serialize(async()=>{
  if(lost||closed)throw new Error('TEXT_RECONCILIATION_REQUIRED');
  const {data,error}=await db.from('text_execution_evidence').update({...patch,phase:next,heartbeat_at:new Date().toISOString()}).eq('run_id',runId).eq('phase',phase).select('run_id').maybeSingle();
  if(error||!data)throw new Error('TEXT_RECONCILIATION_REQUIRED');phase=next;possible=patch.provider_possible??possible;
 });
 const timer=setInterval(()=>{if(closed)return;serialize(async()=>{const {data,error}=await db.from('text_execution_evidence').update({heartbeat_at:new Date().toISOString()}).eq('run_id',runId).in('phase',active).select('run_id');if(error||!data?.length)throw new Error('TEXT_RECONCILIATION_REQUIRED');}).catch(()=>{});},20000);timer.unref?.();
 return {step,get providerPossible(){return possible;},get mustHold(){return possible||lost;},async hold(reason){await chain;const {error}=await db.from('text_execution_evidence').update({interrupted_phase:phase,phase:'reconcile',error:String(reason||'Execution interrupted').slice(0,1000)}).eq('run_id',runId).in('phase',active);if(error)throw error;},stop(){closed=true;clearInterval(timer);}};
}
