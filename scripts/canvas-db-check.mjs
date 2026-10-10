import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout} from 'node:timers/promises';
const container=`caastoros-canvas-check-${process.pid}`;
const run=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr || r.error?.message || 'Local database check failed');return r.stdout;};
let started=false;
try {
  run(['run','--rm','--name',container,'-e','POSTGRES_PASSWORD=canvas-local-test','-d','postgres:17-alpine']);started=true;
  let ready=false;for(let i=0;i<30;i++){const r=spawnSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);if(r.status===0){ready=true;break;}await setTimeout(300);}
  if(!ready)throw new Error('Local PostgreSQL did not become ready.');
  for(const path of ['scripts/canvas-db-bootstrap.sql','supabase/migrations/20261004000000_canvas_workspace.sql','scripts/canvas-db-check.sql'])run(['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1'],readFileSync(path,'utf8'));
  console.log('Canvas migration, tenant RLS, proposal replay/conflict and active-run uniqueness passed in isolated PostgreSQL.');
} finally {if(started)spawnSync('docker',['rm','-f',container],{stdio:'ignore'});}
