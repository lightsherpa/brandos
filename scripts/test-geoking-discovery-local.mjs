// Calls the production compiler handler against the isolated local database.
// Step execution is direct, without Inngest delivery/retry testing.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
const url=new URL(process.env.SUPABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='57321')throw Error('Isolated local database required');
const output=new URL('../output/discovery-bio/geoking/',import.meta.url);await mkdir(output,{recursive:true});
const providerEnv=parseEnv(await readFile('/Users/oscarmottaquintana/Documents/Claudio/CaastorOS/server/.env','utf8'));
for(const name of ['FIRECRAWL_API_KEY','OPENROUTER_API_KEY']){if(!providerEnv[name])throw Error('Provider configuration missing: '+name);process.env[name]=providerEnv[name];}
const fixture=JSON.parse(await readFile(new URL('../.mvp-local/office-fixture.json',import.meta.url)));if(!fixture.synthetic)throw Error('Synthetic account required');
const client=createClient(url.href,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const login=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});if(login.error)throw login.error;
let brandId=process.env.GEOKING_TEST_BRAND_ID;
if(!brandId){
 const response=await fetch('http://127.0.0.1:8791/api/brands',{method:'POST',headers:{Authorization:'Bearer '+login.data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({name:'Geoking · discovery test'})});
 const data=await response.json();if(!response.ok)throw Error('Brand creation failed: '+data.error);brandId=data.brand.id;
}
const discoveryId=randomUUID();
const db=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const owned=await db.from('brands').select('workspace_id').eq('id',brandId).single();if(owned.error||owned.data.workspace_id!==fixture.workspaceId)throw Error('Test brand ownership mismatch');
await db.from('brands').update({url:'https://geoking.com'}).eq('id',brandId);
const report={brandId,workspaceId:fixture.workspaceId,discoveryId,url:'https://geoking.com',startedAt:new Date().toISOString(),execution:'production compiler handler; direct step runner, no automatic retries',steps:[],models:[],status:'running'};
const save=()=>writeFile(new URL('run.json',output),JSON.stringify(report,null,2)+'\n');await save();console.log(JSON.stringify({brandId,discoveryId,status:'started'}));
const {compileBio}=await import('../server/src/inngest/functions/compile-bio.js');
const step={run:async(name,fn)=>{const entry={name,startedAt:new Date().toISOString()};report.steps.push(entry);await save();console.log('Starting '+name);try{const result=await fn();entry.status='completed';entry.completedAt=new Date().toISOString();await save();console.log('Completed '+name);return result;}catch(error){entry.status='failed';entry.error=error.message;await save();throw error;}}};
const logger={info:(message,meta)=>{if(meta?.model)report.models.push(meta.model);},warn:(message,meta)=>{report.warnings||=[];report.warnings.push({message,error:meta?.error});}};
try{report.result=await compileBio.fn({event:{data:{brandId,url:report.url,workspaceId:fixture.workspaceId,discoveryId,references:[]}},step,logger});report.status='completed';}
catch(error){report.status='failed';report.error=error.message;}
const bio=await db.from('bios').select('id,version,payload,score,certified,self_certified,discovery_id').eq('brand_id',brandId).order('version',{ascending:false}).limit(1).maybeSingle();
if(bio.error)throw bio.error;
if(bio.data){await writeFile(new URL('bio.json',output),JSON.stringify(bio.data,null,2)+'\n');report.bio={id:bio.data.id,version:bio.data.version,score:bio.data.score,certified:bio.data.certified,discoveryId:bio.data.discovery_id};}
report.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({status:report.status,bio:report.bio,error:report.error}));if(report.status!=='completed')process.exitCode=1;
