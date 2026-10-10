import { inngest } from '../../lib/inngest.js';
import { advanceJob, store } from '../../lib/creative/store.js';
import { supabaseAdmin } from '../../lib/supabase.js';
export const creativeMedia = inngest.createFunction({id:'creative-media-v1',retries:2,
  concurrency:{limit:1,key:'event.data.jobId'},triggers:[{event:'creative/media.requested'}]},async({event,step})=>{
  for(let n=0;n<180;n++) {
    const job=await step.run(`advance-${n}`,()=>advanceJob(event.data.jobId));
    if(['completed','failed','reconcile','cancel_requested'].includes(job.state)) return {state:job.state};
    await step.sleep(`poll-${n}`,'10s');
  }
  await step.run('polling-exhausted',()=>store.patch(event.data.jobId,{state:'reconcile',error:'Polling window elapsed; reconcile existing provider task'}));
});
// Transactional job row is the outbox. Lost HTTP/event dispatches recover here.
export const recoverCreativeMedia = inngest.createFunction({id:'creative-media-recovery',retries:1,triggers:[{cron:'*/5 * * * *'}]},async({step})=>{
  const jobs=await step.run('load-outbox',async()=>{
    const {data,error}=await supabaseAdmin.from('creative_jobs').select('id').not('state','in','(completed,failed,reconcile,cancel_requested)').lt('updated_at',new Date(Date.now()-10*60000).toISOString()).limit(100);
    if(error) throw error;return data;
  });
  if(jobs.length) await step.sendEvent('resume',jobs.map(j=>({name:'creative/media.requested',data:{jobId:j.id}})));
  return {resumed:jobs.length};
});
