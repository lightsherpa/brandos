import { apiFetch } from './supabase-browser.js';
export async function loadModelCatalog() {
  const response=await apiFetch('/api/creative/catalog');
  if(!response.ok)throw new Error('Model catalog unavailable');return response.json();
}
export async function followMediaJob(jobId,{onProgress,onQa,onDone,onError},signal) {
  while(!signal?.aborted){
    const res=await apiFetch(`/api/creative/jobs/${encodeURIComponent(jobId)}`);
    if(!res.ok)throw new Error('Unable to reconnect to media job');
    const job=await res.json();onProgress?.({stage:job.state,pct:job.progress,jobId});
    if(job.state==='completed'){onQa?.(job.qa);onDone?.({...job,outputId:job.outputId});return job;}
    if(['failed','reconcile','cancel_requested'].includes(job.state)){onError?.({message:job.error||'Media needs review',jobId});return job;}
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
}
export async function submitMedia(body,callbacks,signal) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)));
  const signature=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const pendingKey=`creative-request:${signature}`;
  const requestKey=body.requestKey||sessionStorage.getItem(pendingKey)||crypto.randomUUID();
  // Keep this key through lost responses/reloads; retry reuses the server job.
  sessionStorage.setItem(pendingKey,requestKey);
  const res=await apiFetch('/api/creative/jobs',{method:'POST',body:JSON.stringify({...body,requestKey})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Media submission failed');
  // Store only the durable job ID; reconnect never performs a second POST.
  sessionStorage.setItem(`creative-job:${body.brandId||''}:${body.specialistId}`,data.jobId);
  const job=await followMediaJob(data.jobId,callbacks,signal);
  if(['completed','failed'].includes(job?.state))sessionStorage.removeItem(pendingKey);
  return job;
}
