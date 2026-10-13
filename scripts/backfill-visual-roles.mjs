#!/usr/bin/env node
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';

export function parseBackfillArgs(args) {
  const options={dryRun:true,only:null,input:null};
  for(const arg of args){
    if(arg==='--dry-run')options.dryRun=true;
    else if(arg==='--apply')options.dryRun=false;
    else if(arg.startsWith('--only='))options.only=arg.slice(7);
    else if(arg.startsWith('--input='))options.input=arg.slice(8);
    else throw Error(`Unknown argument: ${arg}`);
  }
  if(!options.only || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(options.only))throw Error('Required: --only=<brandId UUID>');
  if(options.input&&!options.dryRun)throw Error('--input is dry-run only');
  return options;
}
export function assertLocalBackfillTarget(rawUrl) {
  const url=new URL(rawUrl);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol))throw Error('Backfill may run only against local Supabase. Production and remote targets are blocked.');
}
export function legacyVisualChanges(rows,brandId){
  return rows.filter(row=>row.brand_id===brandId&&row.kind==='file_upload'&&row.bucket==='visual'&&row.raw_ref)
    .filter(row=>['png','jpg','jpeg','webp','gif'].includes(String(row.signals?.ext || row.src?.split('.').pop() || '').toLowerCase()))
    .filter(row=>!row.signals?.asset_role&&row.signals?.purpose!=='aspiration')
    .map(row=>({id:row.id,src:row.src,signals:{...row.signals,ext:String(row.signals?.ext || row.src.split('.').pop()).toLowerCase(),asset_kind:'image_reference',asset_role:'canonical',rights_confirmed:true,legacy_visual_backfill:true}}));
}
export async function runBackfill(args,env=process.env){
  const options=parseBackfillArgs(args);
  let rows,client;
  if(options.input){rows=JSON.parse(await readFile(options.input,'utf8'));if(!Array.isArray(rows))throw Error('Input must be a source-row array');}
  else{
    if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Set local SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    assertLocalBackfillTarget(env.SUPABASE_URL);
    const {createClient}=await import('@supabase/supabase-js');
    client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.from('bio_sources').select('id,brand_id,kind,bucket,src,signals,raw_ref').eq('brand_id',options.only).eq('bucket','visual').eq('kind','file_upload');
    if(error)throw Error(error.message);rows=data||[];
  }
  const changes=legacyVisualChanges(rows,options.only);
  console.log(JSON.stringify({dryRun:options.dryRun,brandId:options.only,count:changes.length,changes},null,2));
  if(!options.dryRun)for(const change of changes){
    const {error}=await client.from('bio_sources').update({signals:change.signals}).eq('id',change.id).eq('brand_id',options.only);
    if(error)throw Error(`Update failed for ${change.id}: ${error.message}`);
  }
  return changes;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){runBackfill(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});}
