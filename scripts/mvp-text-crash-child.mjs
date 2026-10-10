// Provider-free crash harness: a real process dies after a real DB transaction.
import {supabaseAdmin as db} from '../server/src/lib/supabase.js';
import {textExecutionLease} from '../server/src/lib/text-execution.js';
if(new URL(process.env.SUPABASE_URL).hostname!=='127.0.0.1')throw new Error('Local target required');
const {data:runId,error}=await db.rpc('create_canvas_text_run',JSON.parse(process.env.MVP_TEXT_CLAIM));if(error)throw error;
if(process.env.MVP_TEXT_COMPLETE==='1'){
 const lease=await textExecutionLease(runId,db);
 await lease.step('submitting',{provider_possible:true});
 await lease.step('generating',{provider_receipt_id:'synthetic-no-provider-receipt'});
 await lease.step('generation_complete',{generation_complete:true,raw_output:'Synthetic completed generation saved before a simulated crash. No provider was called.',usage:{model:'synthetic',cost_usd:null}});
 await lease.step('qa_running');
}
process.send?.({runId,ready:true});setInterval(()=>{},1000);
