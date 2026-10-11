// Provider-free regression against the real isolated API and database.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const local=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(local.API_URL,'http://127.0.0.1:57421');
const sb=createClient(local.API_URL,local.SERVICE_ROLE_KEY),owner=JSON.parse(await readFile('.bio-local/owner.json','utf8'));
const login=await createClient(local.API_URL,local.ANON_KEY).auth.signInWithPassword({email:owner.email,password:'Bio-release-test-2026!'});if(login.error)throw login.error;
const {data:brand,error}=await sb.from('brands').insert({workspace_id:owner.workspaceId,name:'Disposable Geoking isolation check',url:'https://geoking.com'}).select('id').single();if(error)throw error;
const headers={Authorization:'Bearer '+login.data.session.access_token,'Content-Type':'application/json'};
try {
 const mismatch=await fetch('http://127.0.0.1:8792/api/discovery/start',{method:'POST',headers,body:JSON.stringify({brandId:brand.id,url:'https://thecake-me.com'})});
 assert.equal(mismatch.status,409);assert.equal((await mismatch.json()).code,'BRAND_SOURCE_MISMATCH');
 assert.equal((await sb.from('brands').select('url').eq('id',brand.id).single()).data.url,'https://geoking.com');
 assert.equal((await sb.from('discovery_runs').select('id').eq('brand_id',brand.id)).data.length,0);
 Object.assign(process.env,{SUPABASE_URL:local.API_URL,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:local.ANON_KEY});
 const {compileBio}=await import('../server/src/inngest/functions/compile-bio.js');
 const steps=[];
 await assert.rejects(()=>compileBio.fn({event:{data:{brandId:brand.id,workspaceId:owner.workspaceId,url:'https://thecake-me.com'}},step:{run:async(name,fn)=>{steps.push(name);return fn();}},logger:{info(){}}}),e=>e.code==='BRAND_SOURCE_MISMATCH');
 assert.deepEqual(steps,['validate-brand-identity']);
 const {error:appendError}=await sb.rpc('append_bio_version',{p_brand_id:brand.id,p_payload:{sourceIntegrity:{status:'quarantined'}},p_score:0,p_created_by:null,p_discovery_id:null});if(appendError)throw appendError;
 const blocked=await fetch(`http://127.0.0.1:8792/api/bios/${brand.id}`,{headers});assert.equal(blocked.status,409);assert.equal((await blocked.json()).code,'BIO_SOURCE_QUARANTINED');
 const retry=await fetch('http://127.0.0.1:8792/api/discovery/start',{method:'POST',headers,body:JSON.stringify({brandId:brand.id,url:'https://geoking.com'})});assert.equal(retry.status,409);
 Object.assign(process.env,{SUPABASE_URL:local.API_URL,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:local.ANON_KEY});
 const {loadBrandBio}=await import('../server/src/lib/load-brand-bio.js');
 for(const flags of [{},{requireSelfCertified:true},{requireCertified:true}])await assert.rejects(()=>loadBrandBio({workspaceId:owner.workspaceId,brandId:brand.id,...flags}),e=>e.code==='BIO_SOURCE_QUARANTINED');
 console.log('PASS: foreign website rejected before queue; URL unchanged; quarantined BIO blocked from view, retry, briefing and production. No provider calls.');
} finally {await sb.from('brands').delete().eq('id',brand.id);}
