// Copy the saved local Cake Me v3 into a separate validation brand. Never
// changes the original brand and never connects to a hosted Supabase project.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const local=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
if(local.API_URL!=='http://127.0.0.1:54321')throw Error('Use only the existing CaastorOS stack on port 54321.');
const sb=createClient(local.API_URL,local.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const value=async query=>{const {data,error}=await query;if(error)throw Error(error.message);return data;};
const password=process.env.TEST_LOCAL_PASSWORD;
if(!password)throw Error('Set TEST_LOCAL_PASSWORD for the existing local test accounts.');
const original='35f265f0-0546-4a9a-b793-a49887ad7125';
const brand=await value(sb.from('brands').select('*').eq('id',original).single());
const versions=await value(sb.from('bios').select('*').eq('brand_id',original).lte('version',3).order('version'));
if(versions.at(-1)?.version!==3)throw Error('Saved local Cake Me v3 is required.');
const sources=await value(sb.from('bio_sources').select('*').eq('brand_id',original));
const id=randomUUID(),map=new Map(sources.map(s=>[s.id,randomUUID()]));
await value(sb.from('brands').insert({id,workspace_id:brand.workspace_id,name:'Cake Me · Certify UX v3',url:brand.url}));
const paths=[];
for(const source of sources){
  let raw=source.raw_ref;
  if(raw&&!/^https?:/i.test(raw)){
    const downloaded=await value(sb.storage.from('bio-sources').download(raw));
    raw=`${brand.workspace_id}/${id}/${map.get(source.id)}-${String(source.src).split('/').at(-1).replace(/[^\w.-]/g,'_')}`;
    await value(sb.storage.from('bio-sources').upload(raw,downloaded,{contentType:source.signals?.mime||downloaded.type||'application/octet-stream'}));paths.push(raw);
  }
  await value(sb.from('bio_sources').insert({id:map.get(source.id),brand_id:id,kind:source.kind,bucket:source.bucket,src:source.src,raw_ref:raw,signals:source.signals}));
}
function remap(v){
  if(typeof v==='string')return map.get(v)||v;
  if(Array.isArray(v))return v.map(remap);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='previewUrl').map(([k,x])=>[k,remap(x)]));
  return v;
}
let bio;
for(const version of versions)bio=await value(sb.from('bios').insert({brand_id:id,version:version.version,payload:remap(version.payload),score:version.score,certified:false,self_certified:false}).select('id,version').single());
const sessions={};
for(const [role,email] of [['owner','owner@vds.local'],['cd','cd@vds.local']]){
  const client=createClient(local.API_URL,local.ANON_KEY,{auth:{persistSession:false}});
  const data=await value(client.auth.signInWithPassword({email,password}));sessions[role]=data.session;
  await value(sb.from('notification_prefs').upsert({user_id:data.session.user.id,in_app:true,email:false}));
}
await mkdir('.mvp-local',{recursive:true});
await writeFile('.mvp-local/certify-ux-session.json',JSON.stringify({brandId:id,bioId:bio.id,version:3,sessions,paths}),{mode:0o600});
console.log(`Local v3 validation brand: ${id}; ${sources.length} sources, ${paths.length} files copied. Original Cake Me untouched.`);
