import {ct,canvasErrorCopy,executionLabel} from './copy.js';
import { apiFetch } from '../lib/supabase-browser.js';
export async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
  const res = await apiFetch(path, {method,...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(canvasErrorCopy(data.code,data.error || ct("Request failed ({status}).",{status:res.status}))), {code:data.code,status:res.status});
  return data;
}
export async function consumeSSE(response, onEvent) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Object.assign(new Error(canvasErrorCopy(error.code,error.error)),{code:error.code,status:response.status});
  }
  if (!response.body) throw new Error(ct("The response stream is unavailable."));
  const reader=response.body.getReader(),decoder=new TextDecoder(); let buffer='';
  const parse = block => {
    const lines=block.split('\n');
    const event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
    const raw=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(!raw)return; let data; try {data=JSON.parse(raw);}catch{return;}
    if(event==='error')data={...data,message:canvasErrorCopy(data.code,data.message)};onEvent(event,data);
  };
  try {
    while(true) {
      const {done,value}=await reader.read();
      buffer+=(done ? decoder.decode() : decoder.decode(value,{stream:true}));
      buffer=buffer.replace(/\r\n/g,'\n');
      let index; while((index=buffer.indexOf('\n\n'))>=0){parse(buffer.slice(0,index));buffer=buffer.slice(index+2);}
      if(done){if(buffer.trim())parse(buffer);break;}
    }
  } finally {reader.releaseLock();}
}
export async function runMediaNode(canvasId,nodeId,quoteId,onEvent){
  const job=await request('/api/creative/jobs',{canvasId,nodeId,quoteId});onEvent('started',{runId:job.runId,jobId:job.jobId});
  while(true){const status=await request(`/api/creative/jobs/${job.jobId}`);onEvent('progress',{stage:executionLabel(status.state)});if(status.state==='completed'){onEvent('done',{runId:status.runId});return;}if(['failed','reconcile','cancel_requested'].includes(status.state)){onEvent('error',{message:status.state==='reconcile'?ct("This job requires reconciliation before another submission."):ct("Media generation needs review.")});return;}await new Promise(resolve=>setTimeout(resolve,2000));}
}
export async function runNode(canvasId,nodeId,quoteId,onEvent) {
  return consumeSSE(await apiFetch('/api/runs/stream',{method:'POST',body:JSON.stringify({canvasId,nodeId,quoteId})}),onEvent);
}
export async function askBrandolph(brandId,messages,onEvent,context = {}) {
  return consumeSSE(await apiFetch('/api/brandolph/ask',{method:'POST',body:JSON.stringify({brandId,messages,...context})}),onEvent);
}
export function downloadDocument(document) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(document,null,2)],{type:'application/json'}));
  const link=globalThis.document.createElement('a');link.href=url;link.download='caastoros-canvas.json';link.click();URL.revokeObjectURL(url);
}
