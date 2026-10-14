// Explicitly approved two-brand local test; no additional brands or paid retries.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const status=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
if(status.API_URL!=='http://127.0.0.1:57421')throw Error('Isolated local database required');
const owner=JSON.parse(await readFile('.bio-local/owner.json','utf8'));
const sb=createClient(status.API_URL,status.SERVICE_ROLE_KEY);
const {data:login,error}=await createClient(status.API_URL,status.ANON_KEY).auth.signInWithPassword({email:owner.email,password:'Bio-release-test-2026!'});if(error)throw error;
const api=(route,body)=>fetch(`http://127.0.0.1:8792${route}`,{method:'POST',headers:{Authorization:`Bearer ${login.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
await mkdir('output/bio-discovery',{recursive:true});
const results=[];
for(const {name,url,slug} of [{name:'Geoking · live release test',url:'https://geoking.com',slug:'geoking'},{name:'Cake-me · live release test',url:'https://thecake-me.com',slug:'cake-me'}]){
 let {data:brand}=await sb.from('brands').select('id').eq('workspace_id',owner.workspaceId).eq('name',name).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(!brand){const created=await sb.from('brands').insert({workspace_id:owner.workspaceId,name,url}).select('id').single();if(created.error)throw created.error;brand=created.data;}
 const {data:queued}=await sb.from('api_usage_events').select('workflow_id,occurred_at').eq('brand_id',brand.id).eq('feature','discovery.queue').eq('status','succeeded').order('occurred_at',{ascending:false}).limit(1).maybeSingle();
 const started=queued?new Date(queued.occurred_at).getTime():Date.now();let run;
 if(queued)run={discoveryId:queued.workflow_id,eventId:null};
 else{const response=await api('/api/discovery/start',{brandId:brand.id,url,references:[]});run=await response.json();if(!response.ok)throw new Error(`Could not start ${slug}: ${run.error}`);}
 console.log(`${slug}: discovery queued`);
 let bio=null;
 while(Date.now()-started<900000){
  const {data}=await sb.from('bios').select('*').eq('brand_id',brand.id).eq('discovery_id',run.discoveryId).maybeSingle();
  if(data){bio=data;break;}
  const {data:failed}=await sb.from('api_usage_events').select('id').eq('workflow_id',run.discoveryId).eq('feature','discovery.scrape').eq('status','failed').limit(1);
  const {count:readable}=await sb.from('bio_sources').select('id',{count:'exact',head:true}).eq('brand_id',brand.id).eq('kind','url_scrape');
  if(failed?.length&&!readable&&Date.now()-started>120000)break;
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
 const {data:sources}=await sb.from('bio_sources').select('id,kind,src,signals').eq('brand_id',brand.id);
 const {data:usage}=await sb.from('api_usage_events').select('feature,provider,resolved_model,status,latency_ms,input_tokens,output_tokens,reported_cost_usd,cost_source').eq('workflow_id',run.discoveryId);
 const result={name,url,brandId:brand.id,discoveryId:run.discoveryId,eventId:run.eventId,elapsedSeconds:Math.round((Date.now()-started)/1000),saved:!!bio,bio,sources,usage};
 await writeFile(`output/bio-discovery/${slug}-live.json`,JSON.stringify(result,null,2));results.push({slug,brandId:brand.id,discoveryId:run.discoveryId,saved:!!bio,elapsedSeconds:result.elapsedSeconds});
 await writeFile('output/bio-discovery/live-results.json',JSON.stringify(results,null,2));console.log(`${slug}: ${bio?'BIO persisted':'no BIO before test timeout'} (${result.elapsedSeconds}s)`);

}
