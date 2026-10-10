// Isolated, provider-free local stack. Never uses the main checkout's hosted environment.
import {readFile,writeFile,mkdir,cp,chmod} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname,local='/tmp/caastoros-mvp-local';
await mkdir(`${local}/supabase`,{recursive:true});
let config=await readFile(`${root}supabase/config.toml`,'utf8');
config=config.replace('project_id = "CaastorOS"','project_id = "caastoros-mvp-integrated"');
for(const [a,b] of [[54321,57321],[54322,57322],[54320,57320],[54323,57323],[54324,57324],[54329,57329]])config=config.replaceAll(String(a),String(b));
config=config.replace('openai_api_key = "env(OPENAI_API_KEY)"','openai_api_key = ""').replace(/(\[(studio|analytics|edge_runtime)\]\nenabled = )true/g,'$1false');
config=config.replace('[auth.mfa.totp]\nenroll_enabled = false\nverify_enabled = false','[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true');
await writeFile(`${local}/supabase/config.toml`,config);await cp(`${root}supabase/migrations`,`${local}/supabase/migrations`,{recursive:true});await cp(`${root}supabase/seed.sql`,`${local}/supabase/seed.sql`);
function cli(args){const r=spawnSync('supabase',[...args,'--workdir',local],{encoding:'utf8'});if(r.status!==0)throw new Error(`Supabase ${args[0]} failed; inspect local service status. No remote target was used.`);return r.stdout;}
cli(['start']);cli(['migration','up','--local']);const status=JSON.parse(cli(['status','-o','json']));
if(new URL(status.API_URL).hostname!=='127.0.0.1')throw new Error('Refusing nonlocal target');
const api={SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,PORT:'8791',ALLOWED_ORIGINS:'http://127.0.0.1:5184,http://localhost:5184,http://127.0.0.1:5185,http://localhost:5185',INNGEST_DEV:'1',INNGEST_BASE_URL:'http://127.0.0.1:8291',NODE_ENV:'development',STEWARD_CALIBRATION_REQUIRED:'false'};
const web={VITE_SUPABASE_URL:status.API_URL,VITE_SUPABASE_ANON_KEY:status.ANON_KEY,VITE_API_BASE:'http://127.0.0.1:8791'};
for(const [file,values] of [['server/.env.mvp-local',api],['.env.mvp-local',web]]){await writeFile(`${root}${file}`,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');await chmod(`${root}${file}`,0o600);}
await mkdir(`${root}.mvp-local`,{recursive:true});
const require=createRequire(`${root}package.json`),{createClient}=require('@supabase/supabase-js');
const db=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let fixture;try{fixture=JSON.parse(await readFile(`${root}.mvp-local/fixture.json`,'utf8'));}catch{}
if(!fixture){
 const email='canvas-test@caastoros.local',password=randomBytes(24).toString('base64url');
 const {data:created,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Local MVP tester'}});if(error)throw error;
 const {data:profile,error:pe}=await db.from('users').select('id,workspace_id').eq('id',created.user.id).single();if(pe)throw pe;
 const {data:brand,error:be}=await db.from('brands').select('id').eq('workspace_id',profile.workspace_id).limit(1).single();if(be)throw be;
 fixture={userId:profile.id,workspaceId:profile.workspace_id,brandId:brand.id,email,password};
 await writeFile(`${root}.mvp-local/fixture.json`,JSON.stringify(fixture,null,2));await chmod(`${root}.mvp-local/fixture.json`,0o600);
}
async function check(query){const {data,error}=await query;if(error)throw error;return data;}
await check(db.from('workspaces').update({name:'Local MVP test',canvas_v2_enabled:true,tier:'03'}).eq('id',fixture.workspaceId));
await check(db.from('workspace_memberships').upsert({workspace_id:fixture.workspaceId,user_id:fixture.userId,role:'workspace_admin',is_owner:true,status:'active'},{onConflict:'workspace_id,user_id'}));
await check(db.from('brands').update({name:'Synthetic night serum',refusals:['Avoid unsupported medical claims.']}).eq('id',fixture.brandId));
const {data:bios}=await db.from('bios').select('id').eq('brand_id',fixture.brandId).limit(1);
if(!bios?.length)await check(db.from('bios').insert({brand_id:fixture.brandId,version:1,payload:{identity:{name:'Synthetic night serum',positioning:'Clinical clarity and a nightly ritual'},voice:{traits:['clear','calm'],rules:['Avoid unsupported medical claims']},refusals:['Avoid unsupported medical claims.']},score:80,certified:true,cert_kind:'onboarding',self_certified:true,certified_at:new Date().toISOString(),created_by:fixture.userId}));
await check(db.from('creative_workspace_policy').upsert({workspace_id:fixture.workspaceId,enabled:false,policy:{jevMode:'shadow',emailHtml:true}}));
console.log('Isolated Supabase ready at http://127.0.0.1:57321. Synthetic workspace prepared; media disabled and paid keys excluded.');
