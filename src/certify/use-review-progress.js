import React from 'react';
import {apiFetch} from '../lib/supabase-browser.js';
import {createReviewProgressStore} from './review-progress-store.js';
export function useReviewProgress({job,reviewerId,claims,enabled}){
 const key=`brandos.certify.progress:${reviewerId}:${job.id}:${job.bio.version}`;
 const store=React.useMemo(()=>createReviewProgressStore({key,initial:{bio_version:job.bio.version,decisions:{},active_id:claims[0]?.claim_id||null,scores:{},notes:'',mode:'review',question:''},claims,
  storage:typeof window==='undefined'?null:window.localStorage,
  request:async(method,body)=>{const response=await apiFetch(`/api/steward/jobs/${job.id}/progress`,{method,...(body?{body:JSON.stringify(body)}:{})});const json=await response.json();if(!response.ok)throw Object.assign(Error(json.error||'Progress unavailable'),{code:json.code});return json;}
 }),[key]);
 const state=React.useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 React.useEffect(()=>{if(enabled)store.load();return()=>store.dispose();},[store,enabled]);
 const evidenceKey=claims.map(c=>`${c.claim_id}:${c.evidence_token}`).join('|');
 React.useEffect(()=>{store.setClaims(claims);},[store,evidenceKey]);
 return {...state,update:store.update,flush:store.flush,retry:store.retry,useServer:store.useServer};
}
