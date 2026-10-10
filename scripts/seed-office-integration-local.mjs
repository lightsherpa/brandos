// Creates a NEW isolated synthetic office workspace; never uses a real client.
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {edgeFor} from '../src/canvas/document.js';
const url=new URL(process.env.SUPABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='57321')throw Error('Isolated integrated localhost stack required');
if(['ANTHROPIC_API_KEY','OPENROUTER_API_KEY','FAL_KEY'].some(k=>process.env[k]))throw Error('Provider keys must be absent');
const db=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const client=createClient(url.href,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const query=async q=>{const {data,error}=await q;if(error)throw Error(error.message);return data;};
const email='office-integration-'+randomBytes(5).toString('hex')+'@caastoros.local',password=randomBytes(24).toString('base64url');
const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Synthetic office tester'}});if(error)throw error;
const profile=await query(db.from('users').select('id,workspace_id').eq('id',data.user.id).single());
const brand=(await query(db.from('brands').select('id').eq('workspace_id',profile.workspace_id).limit(1)))[0];
await query(db.from('workspaces').update({name:'Synthetic office integration',canvas_v2_enabled:true,tier:'03'}).eq('id',profile.workspace_id));
await query(db.from('workspace_memberships').upsert({workspace_id:profile.workspace_id,user_id:profile.id,role:'workspace_admin',is_owner:true,status:'active'},{onConflict:'workspace_id,user_id'}));
await query(db.from('brands').update({name:'Synthetic office brand',refusals:['No unsupported claims.']}).eq('id',brand.id));
await query(db.from('bios').insert({brand_id:brand.id,version:1,payload:{identity:{name:'Synthetic office brand'},voice:{traits:['clear'],rules:['No unsupported claims.']}},score:80,certified:true,cert_kind:'onboarding',self_certified:true,certified_at:new Date().toISOString(),created_by:profile.id}));
await query(db.from('creative_workspace_policy').upsert({workspace_id:profile.workspace_id,enabled:false,policy:{emailHtml:true,jevMode:'shadow'}}));
await query(db.from('api_budgets').upsert({scope_type:'workspace',scope_key:profile.workspace_id,monthly_budget_usd:20,per_request_ceiling_usd:1,active:true},{onConflict:'scope_type,scope_key'}));
for(const route of ['anthropic/claude-sonnet-4-6','anthropic/claude-opus-4-7','openrouter/google/gemini-2.5-flash'])await query(db.from('canvas_text_qualifications').upsert({workspace_id:profile.workspace_id,route,version:1,enabled:true,verified_at:new Date(Date.now()-60000).toISOString(),valid_until:new Date(Date.now()+86400000).toISOString(),evidence:{sourceUrl:'http://127.0.0.1/synthetic-only',artifact:'office-provider-free-fixture',synthetic:true},bounds:{endpoint:route.startsWith('anthropic/')?'https://api.anthropic.com/v1/messages':'https://openrouter.ai/api/v1/chat/completions',contextTokens:100000,maxOutputTokens:65536,inputUsdPerMillionMax:.01,outputUsdPerMillionMax:.01,requestFeeUsdMax:.001,provider:'synthetic',hardOutputCap:true,allFeesIncluded:true,fullContextBillingBound:true}},{onConflict:'workspace_id,route'}));
const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
async function api(path,body,method=body?'POST':'GET'){
 const res=await fetch('http://127.0.0.1:8791'+path,{method,headers:{Authorization:'Bearer '+login.data.session.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await res.json();if(!res.ok)throw Error(path+': '+JSON.stringify(value));return value;
}
const {canvas}=await api('/api/canvases',{brandId:brand.id,creationKey:randomUUID(),context:{title:'Synthetic office integration brief',rawBrief:'Local office integration only. No provider generated these outputs.',specialistIds:['a01','a20','a18']}});
const document=structuredClone(canvas.document),image=document.nodes.find(n=>n.specialistId==='a20'),text=document.nodes.find(n=>n.specialistId==='a01'),pending=document.nodes.find(n=>n.specialistId==='a18');
if(!image||!text||!pending)throw Error('Seeded specialists unavailable');
text.title='Synthetic positioning';image.title='Synthetic image';pending.title='Synthetic pending email';
const video={...image,id:randomUUID(),title:'Synthetic video stub',outputType:'video',x:image.x+344,y:image.y,pickedRunId:undefined,pickedOutputId:undefined};document.nodes.push(video);document.edges.push(edgeFor(document,document.nodes.find(n=>n.type==='brief').id,video.id));
const runIds=[],outputIds=[];
for(const [node,kind,body,status,workflow] of [[text,'copy',{text:'Synthetic copy output. No generation occurred.'},'flagged','internally_approved'],[image,'image',{asset_url:'/agency-office/generated/decor/DECOR-03-abstract-art.png'},'approved','client_approved'],[video,'video',{asset_url:'data:video/mp4;base64,',synthetic:true},'approved','draft']]){
 const runId=randomUUID(),outputId=randomUUID();
 await query(db.from('runs').insert({id:runId,brief_id:canvas.brief_id,specialist_id:node.specialistId,spec_version:1,bio_version:1,status:'completed',started_at:new Date().toISOString(),ended_at:new Date().toISOString(),canvas_id:canvas.id,canvas_node_id:node.id,model_used:'synthetic-office/no-provider'}));
 await query(db.from('outputs').insert({id:outputId,run_id:runId,brief_id:canvas.brief_id,kind,body,status,workflow_status:workflow,rationale:'Local office presentation fixture only'}));
 node.pickedRunId=runId;node.pickedOutputId=outputId;node.stale=node===text;runIds.push(runId);outputIds.push(outputId);
}
const pendingRunId=randomUUID();await query(db.from('runs').insert({id:pendingRunId,brief_id:canvas.brief_id,specialist_id:pending.specialistId,spec_version:1,bio_version:1,status:'queued',canvas_id:canvas.id,canvas_node_id:pending.id,model_used:'synthetic-office/no-provider'}));runIds.push(pendingRunId);
await api('/api/canvases/'+canvas.id,{document,revision:canvas.revision},'PUT');
const quotes=await api('/api/canvases/'+canvas.id+'/quotes',{nodeIds:[text.id]});
const ledger=await query(db.from('ledger').select('id,credits').eq('workspace_id',profile.workspace_id));
const fixture={email,password,userId:profile.id,workspaceId:profile.workspace_id,brandId:brand.id,briefId:canvas.brief_id,canvasId:canvas.id,textNodeId:text.id,pendingNodeId:pending.id,pendingRunId,videoNodeId:video.id,runIds,outputIds,before:{runCount:runIds.length,ledgerCount:ledger.length,credits:ledger.reduce((s,r)=>s+r.credits,0)},synthetic:true};
await mkdir(new URL('../.mvp-local/',import.meta.url),{recursive:true});await writeFile(new URL('../.mvp-local/office-fixture.json',import.meta.url),JSON.stringify(fixture,null,2),{mode:0o600});
console.log(JSON.stringify({created:'new synthetic office workspace',runCount:runIds.length,outputCount:outputIds.length,quoteTotal:quotes.total,providerCalls:0}));
