// Every interaction first reaches local recovery storage, then a serial,
// reviewer/version-scoped server snapshot. A retry reuses its request UUID.
import {validDecisions} from './friction-model.js';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const clone=v=>JSON.parse(JSON.stringify(v));
export function createReviewProgressStore({key,initial,claims,request,storage,delay=180,uuid=()=>crypto.randomUUID()}){
 let listeners=new Set(),ledger=claims,revision=0,dirty=false,pending=null,loaded=false,disposed=false,timer=null,flight=null,cache=null;
 try{cache=JSON.parse(storage?.getItem(key)||'null');}catch{}
 let draft={...initial,...(cache?.draft||{}),decisions:validDecisions(cache?.draft?.decisions||initial.decisions,ledger)};
 if(cache){revision=Number(cache.revision)||0;dirty=!!cache.dirty;pending=cache.pending||null;}
 let snapshot={draft,phase:'loading',ready:false,error:null,invalidated:[]};
 const emit=(phase=snapshot.phase,error=null)=>{snapshot={...snapshot,draft:clone(draft),phase,error,ready:loaded||phase==='offline'};if(!disposed)listeners.forEach(fn=>fn());};
 const persist=()=>{try{storage?.setItem(key,JSON.stringify({revision,dirty,pending,draft}));}catch{/* Server still saves when browser recovery storage is unavailable. */}};
 const normalize=value=>({...Object.fromEntries(Object.keys(initial).map(field=>[field,value?.[field]??initial[field]])),decisions:validDecisions(value?.decisions,ledger)});
 async function savePending(){
  const sent=pending;const response=await request('PUT',sent.body);
  revision=response.progress.revision;pending=null;
  const acknowledged=normalize(response.progress);
  if(equal(draft,sent.draft))draft=acknowledged;
  else draft={...draft,decisions:validDecisions(draft.decisions,ledger)};
  dirty=!equal(draft,acknowledged);snapshot.invalidated=response.invalidated_claim_ids||[];persist();
 }
 async function drain(){
  if(flight)return flight;
  flight=(async()=>{await Promise.resolve();try{
   if(!loaded)return false;
   while(dirty||pending){
    if(!pending){const sent=clone(draft);pending={draft:sent,body:{...sent,bio_version:initial.bio_version,expected_revision:revision,request_id:uuid()}};persist();}
    emit('saving');await savePending();
   }
   emit('saved');return true;
  }catch(error){emit(error.code==='PROGRESS_CONFLICT'?'conflict':'offline',error.code||'PROGRESS_UNAVAILABLE');return false;}finally{flight=null;}})();return flight;
 }
 async function load({discardLocal=false}={}){
  if(flight)return flight;
  flight=(async()=>{await Promise.resolve();emit('loading');
  try{
   // Settle a possibly acknowledged pre-refresh request idempotently first.
   if(pending&&!discardLocal){try{await savePending();}catch(error){if(!['PROGRESS_CONFLICT','PROGRESS_CLOSED','JOB_CLOSED','STALE_PROGRESS_VERSION'].includes(error.code))throw error;pending=null;}}
   const response=await request('GET');const remote=normalize(response.progress);const remoteRevision=response.progress?.revision||0;snapshot.closed=!!response.closed;snapshot.jobStatus=response.job_status;
   if(response.closed){draft=remote;revision=remoteRevision;dirty=false;pending=null;loaded=true;persist();emit('saved');return true;}
   if(discardLocal){try{storage?.setItem(key+'.recovery',JSON.stringify({revision,draft}));}catch{}dirty=false;pending=null;draft=remote;}
   else if(dirty&&revision!==remoteRevision&&!equal(draft,remote)){loaded=true;emit('conflict','PROGRESS_CONFLICT');return false;}
   else if(!dirty||equal(draft,remote)){draft=remote;dirty=false;pending=null;}
   revision=remoteRevision;loaded=true;snapshot.invalidated=response.invalidated_claim_ids||[];persist();emit(dirty?'saving':'saved');
   if(dirty)queueMicrotask(()=>drain());return true;
  }catch(error){emit('offline',error.code||'PROGRESS_UNAVAILABLE');return false;}finally{flight=null;}
  })();return flight;
 }
 function update(patch){draft=normalize({...draft,...(typeof patch==='function'?patch(clone(draft)):patch)});dirty=true;persist();emit(loaded?'saving':'offline');clearTimeout(timer);timer=setTimeout(()=>loaded?drain():load(),delay);}
 return{getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},load,update,
  async flush(){clearTimeout(timer);if(!loaded&&!await load())return false;if(snapshot.phase==='conflict')return false;return drain();},
  retry:()=>loaded&&snapshot.phase!=='conflict'?drain():load(),
  useServer:()=>load({discardLocal:true}),
  setClaims(next){ledger=next;const decisions=validDecisions(draft.decisions,ledger);if(!equal(decisions,draft.decisions))update({decisions});},
  dispose(){disposed=true;clearTimeout(timer);listeners.clear();}
 };
}
