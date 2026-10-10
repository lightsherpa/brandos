// Controlled core-workflow replay. No database writes, certification or retries.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {mapAndScrape,scrape,searchCompetitiveSources} from '../server/src/lib/firecrawl.js';
import {generateDiscoveryBrain} from '../server/src/lib/discovery-intelligence.js';
import {streamCompletion} from '../server/src/lib/models/router.js';
import {parseCompiledBio} from '../server/src/lib/parse-compiled-bio.js';
import {scoreBioBreakdown} from '../server/src/lib/score-bio.js';
import {extractPalette,extractFonts} from '../server/src/lib/extract-visual-deterministic.js';
import {VISUAL_VISION_SYSTEM} from '../server/src/lib/extract-visual-vision.js';

if(new URL(process.env.SUPABASE_URL).port!=='57321')throw Error('Local configuration required');
const env=parseEnv(await readFile('/Users/oscarmottaquintana/Documents/Claudio/CaastorOS/server/.env','utf8'));
for(const name of ['FIRECRAWL_API_KEY','OPENROUTER_API_KEY']){if(!env[name])throw Error('Missing provider configuration');process.env[name]=env[name];}
const {COMPILER_SYSTEM}=await import('../server/src/inngest/functions/compile-bio.js');
const output=new URL('../output/discovery-bio/geoking-comparison/',import.meta.url);
await mkdir(output,{recursive:true});
const save=(name,data)=>writeFile(new URL(name,output),JSON.stringify(data,null,2)+'\n');
const models=['google/gemini-3.1-pro-preview','google/gemini-3.8-flash','google/gemini-3.5-flash-lite','anthropic/claude-haiku-5.5','anthropic/claude-sonnet-5.5','anthropic/claude-opus-5.5'];
const nativeFetch=globalThis.fetch;
const retrieval=[];
const telemetry=[];
globalThis.fetch=async(input,init={})=>{
 const start=Date.now();
 const response=await nativeFetch(input,{...init,signal:init.signal||AbortSignal.timeout(240000)});
 if(String(input).startsWith('https://api.firecrawl.dev/')){
  const entry={endpoint:new URL(input).pathname,status:response.status,elapsedMs:Date.now()-start};retrieval.push(entry);
  telemetry.push(response.clone().json().then(j=>{entry.reportedCredits=j.creditsUsed??j.credits_used??null;}).catch(()=>{}));
 }
 return response;
};
const catalog=await (await fetch('https://openrouter.ai/api/v1/models')).json();
const prices=models.map(id=>{const model=catalog.data.find(m=>m.id===id);if(!model)throw Error('Model unavailable: '+id);return {id,name:model.name,created:model.created,pricing:model.pricing};});
await save('catalog.json',{checkedAt:new Date().toISOString(),models:prices});
let frozen;
try{frozen=JSON.parse(await readFile(new URL('sources.json',output),'utf8'));console.log('Reusing frozen sources');}
catch{
 console.log('Gathering shared brand, research and visual sources');
 const brand=await mapAndScrape('https://geoking.com',{max:6,formats:['markdown']});
 const researchQuery='Local marketing software local SEO reputation management alternatives competitors physical locations';
 const external=await searchCompetitiveSources(researchQuery);
 const visual=await scrape('https://geoking.com',{formats:['rawHtml','screenshot'],onlyMainContent:false}).catch(()=>null);
 await Promise.all(telemetry);
 frozen={checkedAt:new Date().toISOString(),brand,external,researchQuery,visual,retrieval};await save('sources.json',frozen);
}
if(!frozen.external.length)throw Error('No competitive sources; cannot compare researched synthesis');
const evidence=frozen.brand.map(page=>`## SOURCE: ${page.url}${page.title ? ` (${page.title})` : ""}\n\n${page.markdown}`).join('\n\n').slice(0,48000);
const hash=createHash('sha256').update(JSON.stringify(frozen)).digest('hex');
await writeFile(new URL('compiler-system.txt',output),COMPILER_SYSTEM);
const report={startedAt:new Date().toISOString(),sourceHash:hash,maxTokens:12000,productionMaxTokens:5000,method:'Parallel two-pass production prompts and generateDiscoveryBrain with frozen brand and external evidence; shared fixed research query; per-branch Flash vision; no database writes or queue test; one sample per model; no retries',sharedRetrieval:frozen.retrieval,runs:[]};
let writeQueue=Promise.resolve();
const persist=()=>{const snapshot=JSON.stringify(report,null,2)+'\n';writeQueue=writeQueue.then(()=>writeFile(new URL('comparison.json',output),snapshot));return writeQueue;};
await persist();
async function branch(model){
 const slug=model.split('/')[1];const dir=new URL(slug+'/',output);await mkdir(dir,{recursive:true});
 const run={model,status:'running',startedAt:new Date().toISOString(),calls:[]};report.runs.push(run);await persist();
 const started=Date.now();let pass=0;
 async function call(route,system,content,limit,label){
  const item={label,model:route,maxTokens:limit,startedAt:new Date().toISOString()};run.calls.push(item);await persist();
  await writeFile(new URL(label+'-input.json',dir),JSON.stringify({system,content},null,2));
  let text='';const then=Date.now();
  try{
   for await(const ev of streamCompletion({spec:{payload:{modelRouting:{primary:'openrouter/'+route}}},system,messages:[{role:'user',content}],maxTokens:limit})){
    if(ev.type==='token')text+=ev.text;
    if(ev.type==='receipt')item.receipt=ev.id;
    if(ev.type==='done'){item.usage=ev.usage;item.stopReason=ev.stopReason;}
    if(ev.type==='error')throw Error(ev.message);
   }
   await writeFile(new URL(label+'-raw.txt',dir),text);item.characters=text.length;
   return parseCompiledBio(text,{stopReason:item.stopReason});
  }finally{item.elapsedMs=Date.now()-then;await persist();}
 }
 try{
  const bio=await generateDiscoveryBrain({evidence,synthesize:content=>call(model,COMPILER_SYSTEM,content,12000,++pass===1?'interpretation':'synthesis'),research:async query=>{run.derivedResearchQuery=query;return frozen.external;}});
  bio.discoverySources={references:[],unreadable:[],instagram:null};
  const visual=frozen.visual;
  bio.visual={palette:extractPalette(visual?.rawHtml||''),type:extractFonts(visual?.rawHtml||''),imagery:[],avoid:[]};
  if(visual?.screenshot){
   const text=["Analyze this brand's homepage screenshot.",`Brand voice: ${JSON.stringify(bio.voice)}`,bio.strategic?.notList?.length?`Brand avoids (notList): ${bio.strategic.notList.join(' · ')}`:'',"Describe the IMAGERY style as 3–6 short phrases (subjects, lighting, composition),","and infer 2–4 things the brand should AVOID, grounded in the voice + avoid list above.","Return the JSON only."].filter(Boolean).join('\n');
   try{const v=await call('google/gemini-3.8-flash',VISUAL_VISION_SYSTEM,[{type:'text',text},{type:'image_url',image_url:{url:visual.screenshot}}],300,'vision');bio.visual.imagery=Array.isArray(v.imagery)?v.imagery:[];bio.visual.avoid=Array.isArray(v.avoid)?v.avoid:[];}
   catch(error){run.visualWarning=error.message;}
  }else run.visualWarning='No screenshot returned; visual imagery omitted';
  run.coverageMetric=scoreBioBreakdown(bio);run.competitorCount=bio.positioning?.competitors?.length||0;run.status='completed';
  await writeFile(new URL('bio.json',dir),JSON.stringify(bio,null,2)+'\n');
 }catch(error){run.status='failed';run.error=error.message;run.errorCode=error.code||null;}
 run.elapsedMs=Date.now()-started;run.finishedAt=new Date().toISOString();
 run.modelCostUsd=run.calls.every(c=>typeof c.usage?.cost_usd==='number')?run.calls.reduce((sum,c)=>sum+c.usage.cost_usd,0):null;
 await persist();console.log(JSON.stringify({model,status:run.status,costUsd:run.modelCostUsd,seconds:run.elapsedMs/1000,error:run.error}));
}
await Promise.allSettled(models.map(branch));
report.finishedAt=new Date().toISOString();await persist();
console.log('Comparison complete');
