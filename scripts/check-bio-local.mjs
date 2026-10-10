// Captures local CLI credentials in memory; never prints or writes them.
import {execFileSync, spawnSync} from 'node:child_process';
const status=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
if(status.API_URL!=='http://127.0.0.1:57421')throw new Error('Refusing checks outside the isolated BIO stack');
const env={...process.env,SUPABASE_URL:status.API_URL,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:status.ANON_KEY};
for(const script of ['scripts/test-cert-flow.mjs','scripts/test-discovery-flow.mjs']){
 const result=spawnSync(process.execPath,[script],{env,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
const result=spawnSync('docker',['exec','-i','supabase_db_caastoros-bio-vds','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:execFileSync('cat',['scripts/check-bio-attestation-transaction.sql']),stdio:['pipe','inherit','inherit']});
process.exit(result.status||0);
