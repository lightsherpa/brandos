import {ct,useCanvasCopy} from './copy.js';
import React,{useState,useEffect} from 'react';
import { request } from './api.js';
import {supabase} from '../lib/supabase-browser.js';
import { uuid } from './document.js';
import { CanvasProvider } from './CanvasProvider.jsx';
import { CanvasWorkspace } from './CanvasWorkspace.jsx';
import './canvas.css';
export function CanvasEntry({context,onClear,go,fallback}) {
  useCanvasCopy();
  const [enabled,setEnabled]=useState(null),[initial,setInitial]=useState(null),[error,setError]=useState(null);
  useEffect(()=>{
    let active=true;
    (async()=>{
      // Existing briefs resolve their actual brand under RLS before checking the flag.
      let brandId=context.brandId;
      if(!brandId && context.briefId){const {data}=await supabase.from('briefs').select('brand_id').eq('id',context.briefId).maybeSingle();brandId=data?.brand_id;}
      if(!brandId){if(active)setEnabled(false);return;}
      const access=await request(`/api/canvases/access?brandId=${encodeURIComponent(brandId)}`).catch(e=>{if(e.status===404)return {enabled:false};throw e;});
      if(!active)return;setEnabled(access.enabled);if(!access.enabled)return;
      const key=context.canvasCreationKey || uuid();
      const nextContext={...context,brandId,canvasCreationKey:key};
      if(!context.briefId)sessionStorage.setItem('ci_run_context',JSON.stringify(nextContext));
      const {canvas}=await request('/api/canvases',{briefId:context.briefId,brandId,creationKey:key,context:nextContext});
      const data=await request(`/api/canvases/${canvas.id}`);
      if(active){setInitial(data);sessionStorage.setItem('ci_run_context',JSON.stringify({mode:'view',briefId:canvas.brief_id,brandId,canvasId:canvas.id}));}
    })().catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[context]);
  if(enabled===false)return fallback;
  if(error)return <div className="cvs-entry"><p role="alert">{error}</p><button className="btn btn--ghost" onClick={()=>{onClear();go('briefs');}}>{ct("Back to briefs")}</button></div>;
  if(!initial)return <div className="cvs-entry" role="status">{ct("Opening the canvas…")}</div>;
  return <CanvasProvider key={initial.canvas.id} initial={initial}><CanvasWorkspace onBack={async()=>{onClear();go('briefs');}} go={go}/></CanvasProvider>;
}
