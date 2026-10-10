import {ct,useCanvasCopy} from './copy.js';
import React,{createContext,useContext,useReducer,useRef,useState,useEffect,useCallback} from 'react';
import { historyReducer,editDocument } from './document.js';
import { request } from './api.js';
const CanvasContext=createContext(null);
export const useCanvas=()=>useContext(CanvasContext);
export function CanvasProvider({initial,children}) {
  useCanvasCopy();
  const [state,dispatch]=useReducer(historyReducer,{document:initial.canvas.document,past:[],future:[]});
  const [runs,setRuns]=useState([]),[runsLoaded,setRunsLoaded]=useState(false),[saveState,setSaveState]=useState('saved'),[error,setError]=useState(null);
  const [selectedId,setSelectedId]=useState(null),[busy,setBusy]=useState({}),[notice,setNotice]=useState('');
  const metadata=useRef(initial.canvas),docRef=useRef(state.document),persisted=useRef(JSON.stringify(initial.canvas.document)),saving=useRef(null),blocked=useRef(false),alive=useRef(true);
  docRef.current=state.document;
  const canWrite=initial.permissions.includes('brief.write'),canRun=initial.permissions.includes('brief.run');
  useEffect(()=>()=>{alive.current=false;},[]);
  const command=useCallback(action=>{
    if(!canWrite)return;
    try {if(!['undo','redo'].includes(action.type))editDocument(docRef.current,action);dispatch(action);setError(null);}catch(e){setError(ct(e.message));}
  },[canWrite]);
  const flush=useCallback(async()=>{
    if(!canWrite || blocked.current) {if(blocked.current)throw new Error(ct("Resolve the save conflict before running."));return;}
    if(saving.current)await saving.current;
    if(persisted.current===JSON.stringify(docRef.current))return;
    const job=(async()=>{
      setSaveState('saving');
      while(persisted.current!==JSON.stringify(docRef.current)){
        const document=docRef.current,serialized=JSON.stringify(document);
        const data=await request(`/api/canvases/${metadata.current.id}`,{document,revision:metadata.current.revision},'PUT');
        metadata.current=data.canvas;persisted.current=serialized;
      }
      if(alive.current)setSaveState('saved');
    })();
    saving.current=job;
    try {await job;}catch(e){if(e.code==='CANVAS_CONFLICT')blocked.current=true;if(alive.current){setSaveState(e.code==='CANVAS_CONFLICT'?'conflict':'error');setError(ct(e.message));}throw e;}finally{if(saving.current===job)saving.current=null;}
  },[canWrite]);
  useEffect(()=>{
    if(persisted.current===JSON.stringify(state.document)||!canWrite)return;
    setSaveState(s=>s==='conflict'?s:'unsaved');
    const timer=setTimeout(()=>flush().catch(()=>{}),700);return()=>clearTimeout(timer);
  },[state.document,flush,canWrite]);
  useEffect(()=>{
    const before=e=>{if(persisted.current!==JSON.stringify(docRef.current)){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);
  },[]);
  const reloadRuns=useCallback(async()=>{
    const data=await request(`/api/canvases/${metadata.current.id}/runs`);if(alive.current){setRuns(data.runs);setRunsLoaded(true);}return data.runs;
  },[]);
  useEffect(()=>{let cancelled=false; const refresh=()=>reloadRuns().catch(e=>{if(!cancelled)setError(ct(e.message));});refresh();const timer=setInterval(refresh,5000);return()=>{cancelled=true;clearInterval(timer);};},[reloadRuns]);
  const hydrate=useCallback(canvas=>{metadata.current=canvas;docRef.current=canvas.document;persisted.current=JSON.stringify(canvas.document);blocked.current=false;dispatch({type:'hydrate',document:canvas.document});setSaveState('saved');setError(null);},[]);
  return <CanvasContext.Provider value={{...state,docRef,canvas:initial.canvas,brief:initial.brief,bio:initial.bio,specialists:initial.specialists,mediaProfiles:initial.mediaProfiles||[],emailHtml:initial.emailHtml===true,permissions:initial.permissions,userId:initial.userId,canWrite,canRun,runs,runsLoaded,setRuns,reloadRuns,saveState,error,setError,command,flush,hydrate,selectedId,setSelectedId,busy,setBusy,notice,setNotice}}>{children}</CanvasContext.Provider>;
}
