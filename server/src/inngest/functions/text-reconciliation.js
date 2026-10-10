import {inngest} from '../../lib/inngest.js';
import {supabaseAdmin} from '../../lib/supabase.js';
export const quarantineTextExecutions=inngest.createFunction({id:'canvas-text-reconciliation',retries:1,triggers:[{cron:'* * * * *'}]},async({step})=>step.run('quarantine-stale',async()=>{
 const {data,error}=await supabaseAdmin.rpc('quarantine_stale_text_runs');if(error)throw error;return {quarantined:data};
}));
