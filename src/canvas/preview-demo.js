// DEV-only sandbox transport. Never imported by the production entry point.
import {uuid,edgeFor} from './document.js';
export function installPreviewDemo(initial) {
  const key='caastoros-canvas-local-demo-v1';
  let state;try{state=JSON.parse(localStorage.getItem(key));}catch{}
  if(!state?.canvas?.document)state={canvas:structuredClone(initial.canvas),runs:[],quotes:[],proposals:[]};
  initial.canvas=state.canvas;
  const save=()=>localStorage.setItem(key,JSON.stringify(state));
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const stream=events=>new Response(events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''),{headers:{'Content-Type':'text/event-stream'}});
  const original=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const path=new URL(typeof input==='string'?input:input.url,location.origin).pathname;
    if(!path.startsWith('/api/'))return original(input,init);
    const body=init.body?JSON.parse(init.body):{},method=init.method||'GET';
    const estimates={auto:8,premium:16,balanced:8,fast:6};
    if(path.endsWith('/estimates'))return json({estimates});
    if(path.endsWith('/quotes')){
      const quotes=body.nodeIds.map(node_id=>({id:uuid(),node_id,credits:estimates[state.canvas.document.nodes.find(n=>n.id===node_id)?.settings.tier]||8}));
      state.quotes.push(...quotes);save();return json({quotes,total:quotes.reduce((s,q)=>s+q.credits,0),balance:1000,expiresAt:new Date(Date.now()+300000).toISOString()});
    }
    if(path==='/api/runs/stream'){
      if(state.runs.some(r=>r.id===body.quoteId))return json({error:'Already submitted',code:'RUN_ALREADY_SUBMITTED'},409);
      const node=state.canvas.document.nodes.find(n=>n.id===body.nodeId);
      if(!node)return json({error:'Node not found'},404);
      const text=node.specialistId==='a01'?'POSITIONING\n\nClinical clarity. A nightly ritual.\n\nLead with a simple daily routine, supported by evidence the brand can substantiate. Avoid promises of overnight transformation.':node.outputType==='image'?'LOCAL VISUAL TEST\n\nThis sandbox does not generate images. Test versions and connections here; image-provider integration requires the staging API.':'SOCIAL CAPTIONS\n\n1. A quiet moment, at the end of your day. Make the nightly ritual yours.\n\n2. Keep your routine simple. Let the evidence speak.\n\n3. Your evening, with a little more intention.';
      const run={id:body.quoteId,canvas_node_id:node.id,specialist_id:node.specialistId,spec_version:1,bio_version:3,tier:node.settings.tier,credits:state.quotes.find(q=>q.id===body.quoteId)?.credits||8,status:'completed',started_at:new Date().toISOString(),ended_at:new Date().toISOString(),latency_ms:0,outputs:[{id:uuid(),kind:'text',status:'approved',workflow_status:'draft',body:{text},qa_results:[{id:uuid(),passed:true,evidence:'Simulated QA result for local interaction testing.'}]}]};
      state.runs.push(run);save();return stream([['started',{runId:run.id}],['token',{text}],['done',{runId:run.id}]]);
    }
    if(path.endsWith('/runs'))return json({runs:state.runs});
    if(path==='/api/brandolph/ask')return stream([['token',{text:'Local test reply: keep the brief’s clinical proof and nightly ritual together. Review the Positioning Architect output, then connect it to Social Captions. To test a crew proposal, describe the work and click Propose crew.'}],['done',{}]]);
    if(path.endsWith('/proposals')){
      const document=structuredClone(state.canvas.document),brief=document.nodes.find(n=>n.type==='brief');
      const nodes=initial.specialists.filter(s=>s.outputType==='text').map((s,i)=>({id:uuid(),type:'specialist',title:s.name,specialistId:s.id,outputType:s.outputType,x:1100,y:i*312,settings:{tier:'auto'}}));
      document.nodes.push(...nodes);document.edges.push(...nodes.map(n=>edgeFor(document,brief.id,n.id)));
      const proposal={id:uuid(),summary:'Local test crew: positioning and social captions.',titles:nodes.map(n=>n.title),nodeIds:nodes.map(n=>n.id),document,base_revision:state.canvas.revision};
      state.proposals.push(proposal);save();return json({proposal});
    }
    if(path.endsWith('/apply')){
      const proposal=state.proposals.find(p=>p.id===path.split('/').at(-2));
      if(!proposal)return json({error:'Proposal not found'},404);
      if(!proposal.applied){if(proposal.base_revision!==state.canvas.revision)return json({error:'Canvas changed. Request a new proposal.',code:'CANVAS_CONFLICT'},409);state.canvas={...state.canvas,document:proposal.document,revision:state.canvas.revision+1};proposal.applied=true;save();}
      return json({canvas:state.canvas});
    }
    if(path.startsWith('/api/outputs/')){
      const output=state.runs.flatMap(r=>r.outputs).find(o=>o.id===path.split('/')[3]);
      if(!output)return json({error:'Output not found'},404);
      if(path.endsWith('/workflow'))output.workflow_status={submit_internal:'submitted_internal',internal_approve:'internally_approved',send_client:'client_review',client_approve:'client_approved',internal_changes:'changes_requested_internal',client_changes:'changes_requested_client'}[body.action]||output.workflow_status;
      else output.body.edited_text=body.text;
      save();return json({output});
    }
    if(path.startsWith('/api/canvases/')&&method==='PUT'){
      if(body.revision!==state.canvas.revision)return json({error:'Canvas changed. Reload the saved canvas.',code:'CANVAS_CONFLICT'},409);
      state.canvas={...state.canvas,document:body.document,revision:state.canvas.revision+1};save();return json({canvas:state.canvas});
    }
    if(path.startsWith('/api/canvases/')&&method==='GET')return json({canvas:state.canvas});
    return json({error:'This operation is unavailable in the local sandbox.'},400);
  };
  return ()=>{localStorage.removeItem(key);location.reload();};
}
