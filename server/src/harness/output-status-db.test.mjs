// Self-owned disposable PostgreSQL only: no existing stack or DB URL accepted.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const name=`vds-output-qa-test-${process.pid}`;
function command(args,input){return new Promise((resolve,reject)=>{const p=spawn('docker',args);let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(Error(err)):resolve(out.trim()));p.stdin.end(input);});}
const sql=text=>command(['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],text);
test('qa_passed migration preserves real human decisions and changes only automatic task approval',async()=>{
 await command(['run','--rm','-d','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 try {
  for(let attempt=0;;attempt++){try{await sql('select 1;');break;}catch(error){if(attempt>=40)throw error;await new Promise(r=>setTimeout(r,200));}}
  await sql(`create table outputs(id text primary key,kind text,status text not null constraint outputs_status_check check(status in ('pending','approved','flagged','rejected','needs_review')),workflow_status text,internal_reviewed_by uuid,internal_reviewed_at timestamptz,client_reviewed_by uuid,client_reviewed_at timestamptz);
    insert into outputs(id,kind,status,workflow_status) values('auto','task','approved','draft'),('rerun','task_rerun','approved','draft'),('legacy','text','approved','draft'),('returned','task','approved','changes_requested_client'),('forged','task','approved','internally_approved');
    insert into outputs values('human','task','approved','internally_approved','00000000-0000-0000-0000-000000000001',now(),null,null),('client','task','approved','client_approved',null,null,'00000000-0000-0000-0000-000000000002',now()),('waiting','task','approved','client_review','00000000-0000-0000-0000-000000000001',now(),null,null);`);
  await assert.rejects(sql("insert into outputs(id,kind,status) values('new','task','qa_passed');"),/outputs_status_check/);
  const migration=await readFile(new URL('../../../supabase/migrations/20261014050000_output_qa_passed.sql',import.meta.url),'utf8');
  await sql(`begin; ${migration} commit;`);await sql(`begin; ${migration} commit;`);
  const statuses=Object.fromEntries((await sql('select id||\':\'||status from outputs order by id;')).split('\n').map(line=>line.split(':')));
  assert.deepEqual(statuses,{auto:'qa_passed',client:'approved',forged:'qa_passed',human:'approved',legacy:'approved',rerun:'qa_passed',returned:'qa_passed',waiting:'approved'});
  await sql("insert into outputs(id,kind,status) values('new','task','qa_passed');");
 }finally{await command(['rm','-f',name]);}
});
