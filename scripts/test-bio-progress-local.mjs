// Progress failure contract against isolated real database and API. No providers.
import {execFileSync} from 'node:child_process';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
const local=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));assert.equal(local.API_URL,'http://127.0.0.1:57421');
Object.assign(process.env,{SUPABASE_URL:local.API_URL,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:local.ANON_KEY});
const sb=createClient(local.API_URL,local.SERVICE_ROLE_KEY),owner=JSON.parse(await readFile('.bio-local/owner.json','utf8'));
const {compileBio}=await import('../server/src/inngest/functions/compile-bio.js');const {recordDiscoveryStage}=await import('../server/src/lib/discovery-run.js');
const login=await createClient(local.API_URL,local.ANON_KEY).auth.signInWithPassword({email:owner.email,password:'Bio-release-test-2026!'});if(login.error)throw login.error;
const {data:brand,error}=await sb.from('brands').insert({workspace_id:owner.workspaceId,name:'Disposable discovery failure fixture'}).select('id').single();if(error)throw error;
try{
 const discoveryId=randomUUID(),original={discoveryId,brandId:brand.id,workspaceId:owner.workspaceId};
 await recordDiscoveryStage({...original,stage:'research'});
 await compileBio.onFailureFn({event:{data:{event:{name:'discovery/start',data:original}}},error:new Error('Brand retrieval failed: private provider payload'),step:{run:async(_,fn)=>fn()}});
 const response=await fetch(`http://127.0.0.1:8792/api/discovery/${discoveryId}/status`,{headers:{Authorization:'Bearer '+login.data.session.access_token}}),value=await response.json();
 assert.equal(response.status,200);assert.equal(value.run.status,'failed');assert.equal(value.run.stage,'research');assert.equal(value.run.error_code,'SOURCE_UNREADABLE');assert.ok(!JSON.stringify(value).includes('private provider payload'));
 assert.equal((await fetch(`http://127.0.0.1:8792/api/discovery/${discoveryId}/status`)).status,401);
 console.log('PASS progress failure: actual stage preserved, terminal code sanitized, unauthenticated read blocked.');
 // Import historical test outcomes explicitly: these ran before progress migration.
 for(const slug of ['geoking','cake-me']){
  const result=JSON.parse(await readFile(`output/bio-vds/${slug}-live.json`,'utf8'));
  await recordDiscoveryStage({discoveryId:result.discoveryId,brandId:result.brandId,workspaceId:owner.workspaceId,stage:result.saved?'done':'scrape',status:result.saved?'completed':'failed',bioId:result.bio?.id||null,errorCode:result.saved?null:'SOURCE_UNREADABLE'});
 }
}finally{await sb.from('brands').delete().eq('id',brand.id);}
