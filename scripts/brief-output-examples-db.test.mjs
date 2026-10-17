import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {localTestDatabase} from './lib/local-test-database.mjs';
const local=localTestDatabase('output_examples');
if(!local)throw Error('Disposable local database required: use npm test');
const sql=query=>execFileSync('docker',['exec','-i',local.container,'psql','-U','postgres','-d',local.database,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'}).trim();
test.before(()=>{
 local.create();
 sql(`create table users(id uuid primary key);create table brands(id uuid primary key);create table briefs(id uuid primary key,brand_id uuid references brands);create table outputs(id uuid primary key,brief_id uuid,workflow_status text,client_reviewed_by uuid,client_reviewed_at timestamptz);
 create table bios(id uuid primary key default gen_random_uuid(),brand_id uuid,version integer,payload jsonb,score integer,certified boolean default false,self_certified boolean default false,created_by uuid,discovery_id text,unique(brand_id,version));
 create table brief_drafts(id uuid primary key);create schema storage;create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 sql(readFileSync(new URL('../supabase/migrations/20261013010000_append_bio_version_expected.sql',import.meta.url),'utf8'));
 sql('alter default privileges in schema public grant all on tables to anon,authenticated;');
 const migration=readFileSync(new URL('../supabase/migrations/20261017191634_brief_outputs_to_brand_core.sql',import.meta.url),'utf8');sql(migration);sql(migration);
});
function fixture(){const brand=randomUUID(),brief=randomUUID(),user=randomUUID(),output=randomUUID(),ref=randomUUID();sql(`insert into users values('${user}');insert into brands values('${brand}');insert into briefs values('${brief}','${brand}');insert into outputs values('${output}','${brief}','client_approved','${user}',now());insert into bios(brand_id,version,payload,score,certified,self_certified) values('${brand}',3,'{"visual":{"references":[]}}',96,true,true);insert into brief_references(id,brand_id,owner_id,brief_id,storage_path,name) values('${ref}','${brand}','${user}','${brief}','${ref}.png','reference.png');`);return{brand,brief,user,output,ref};}
const promote=(f,output=f.output)=>`select row_to_json(propose_brand_output_example('${f.brand}','${f.brief}','social_post-1',array['${output}'::uuid],'{"type":"social_post","text":"approved output","assetRef":{"bucket":"bio-sources","path":"output.png"}}','${f.user}'));`;
test('atomic accepted-output promotion appends one pending candidate and preserves the certified version',()=>{
 const f=fixture(),first=JSON.parse(sql(promote(f))),again=JSON.parse(sql(promote(f)));assert.equal(first.id,again.id);assert.equal(first.addition_status,'pending');assert.deepEqual(first.reference_ids,[f.ref]);assert.deepEqual(first.output_ids,[f.output]);
 const rows=JSON.parse(sql(`select json_agg(t order by version) from(select version,certified,self_certified,payload from bios where brand_id='${f.brand}')t;`));
 assert.equal(rows.length,2);assert.equal(rows[0].certified,true);assert.deepEqual(rows[0].payload,{visual:{references:[]}});assert.equal(rows[1].certified,false);assert.equal(rows[1].self_certified,false);assert.deepEqual(rows[1].payload.approved_output_examples,[first.id]);assert.deepEqual(rows[1].payload.visual.references,[]);
 assert.equal(first.snapshot.assetRef.path,'output.png');assert.notEqual(first.snapshot.assetRef.path,`${f.ref}.png`);
});
test('migration replays after data exists without dropping pending additions or certified BIOs',()=>{
 const f=fixture(),before=JSON.parse(sql(promote(f)));
 sql(readFileSync(new URL('../supabase/migrations/20261017191634_brief_outputs_to_brand_core.sql',import.meta.url),'utf8'));
 assert.equal(JSON.parse(sql(promote(f))).id,before.id);
 assert.equal(sql(`select count(*) from bios where brand_id='${f.brand}';`),'2');
 assert.equal(sql("select count(*) from pg_policy where polname='brief_references_service_only';"),'1');
});
test('draft hash uniqueness deduplicates bytes and RESTRICT prevents late-upload orphan files',()=>{
 const f=fixture(),draft=randomUUID(),hash='a'.repeat(64);sql(`insert into brief_drafts values('${draft}');insert into brief_references(brand_id,owner_id,draft_id,sha256,storage_path,name) values('${f.brand}','${f.user}','${draft}','${hash}','${draft}.png','photo');`);
 assert.throws(()=>sql(`insert into brief_references(brand_id,owner_id,draft_id,sha256,storage_path,name) values('${f.brand}','${f.user}','${draft}','${hash}','${draft}-duplicate.png','renamed');`),/brief_references_draft_hash_idx/);
 assert.throws(()=>sql(`delete from brief_drafts where id='${draft}';`),/foreign key constraint/);
 sql(`delete from brief_references where draft_id='${draft}';delete from brief_drafts where id='${draft}';`);
 assert.throws(()=>sql(`insert into brief_references(brand_id,owner_id,draft_id,sha256,storage_path,name) values('${f.brand}','${f.user}','${draft}','${hash}','${draft}-late.png','late upload');`),/foreign key constraint/);
});
test('rejected, missing and cross-brief outputs roll back the addition and candidate',()=>{
 for(const change of ['unapproved','foreign','missing']){const f=fixture();if(change==='unapproved')sql(`update outputs set workflow_status='client_review' where id='${f.output}';`);if(change==='foreign')sql(`update outputs set brief_id='${randomUUID()}' where id='${f.output}';`);assert.throws(()=>sql(promote(f,change==='missing'?randomUUID():f.output)),/APPROVED_OUTPUT_REQUIRED/);assert.equal(sql(`select count(*) from bios where brand_id='${f.brand}';`),'1');assert.equal(sql(`select count(*) from brand_output_examples where brand_id='${f.brand}';`),'0');}
});
test('browser roles cannot read/write raw reference/example rows or execute the privileged promotion',()=>{
 for(const role of ['anon','authenticated'])for(const table of ['brief_references','brand_output_examples'])for(const op of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(sql(`select has_table_privilege('${role}','${table}','${op}');`),'f');
 for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege('${role}','propose_brand_output_example(uuid,uuid,text,uuid[],jsonb,uuid)','EXECUTE');`),'f');
 assert.equal(sql("select bool_and(relrowsecurity) from pg_class where oid in ('brief_references'::regclass,'brand_output_examples'::regclass);"),'t');
 assert.equal(sql("select public from storage.buckets where id='brief-references';"),'f');
});
test.after(()=>local.drop());
