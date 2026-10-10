// Dedicated release-test stack. Credentials stay in process memory.
import {execFileSync} from 'node:child_process';
const target=process.argv[2]||'web';
const status=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
if(status.API_URL!=='http://127.0.0.1:57421')throw new Error('Isolated BIO stack required');
Object.assign(process.env,{SUPABASE_URL:status.API_URL,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:status.ANON_KEY});
if(target==='web'){
 Object.assign(process.env,{VITE_SUPABASE_URL:status.API_URL,VITE_SUPABASE_ANON_KEY:status.ANON_KEY,VITE_API_BASE:'http://127.0.0.1:8792'});
 const {createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:5185,strictPort:true}});await server.listen();server.printUrls();
}else if(target==='api'){
 Object.assign(process.env,{PORT:'8792',RESEND_API_KEY:'',INNGEST_EVENT_KEY:'local-dev-key',INNGEST_SIGNING_KEY:'',INNGEST_DEV:'1',INNGEST_BASE_URL:'http://127.0.0.1:8292',NODE_ENV:'development',APP_URL:'http://127.0.0.1:5185',ALLOWED_ORIGINS:'http://127.0.0.1:5185,http://localhost:5185'});
 if(process.env.DISCOVERY_PAID_TEST==='1'){if(!process.env.FIRECRAWL_API_KEY||!process.env.OPENROUTER_API_KEY)throw new Error('Paid test requires configured providers');}
 await import('../server/src/index.js');
}else throw new Error('Choose web or api');
