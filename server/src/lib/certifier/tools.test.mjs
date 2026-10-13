import test from 'node:test';import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {bindTools,TOOL_DEFINITIONS,TOOL_NAMES} from './tools.js';
import {fixture,context} from './test-helpers.js';
import {unknownStatement} from './validate.js';
test('exactly five tools: unknown/forbidden names dropped, scope arguments rejected',async()=>{
 assert.deepEqual([...TOOL_NAMES],['read_brand_core','read_source','search_sources','draft_client_question','submit_brief']);
 const tools=bindTools(context(fixture('nomad-roasters')));
 assert.equal((await tools.execute('certify',{})).error,'forbidden_tool');assert.equal((await tools.execute('certify',{})).review,true);
 assert.equal((await tools.execute('read_source',{source_id:'site',brandId:'other'})).error,'tool_schema');
 assert.equal((await tools.execute('read_source',{source_id:'foreign'})).error,'unknown_source');
 assert.ok(!TOOL_DEFINITIONS.some(t=>/web|send|certify$/.test(t.name)));
});
test('six reads total across every read tool, 10 search results maximum, 8k-token read bound',async()=>{
 const ctx=context(fixture('nomad-roasters'));ctx.manifest.get('site').text='a'.repeat(12000);
 const tools=bindTools(ctx);const read=await tools.execute('read_source',{source_id:'site'});assert.equal(read.text.length,8000);
 assert.equal((await tools.execute('search_sources',{query:'a',limit:11})).error,'tool_schema');
 for(let i=0;i<5;i++)await tools.execute(i%2?'search_sources':'read_brand_core',i%2?{query:'brand',limit:10}:{});
 assert.equal(tools.readCalls,6);assert.equal((await tools.execute('read_source',{source_id:'site'})).error,'read_limit');assert.equal(tools.readCalls,6);
});
test('draft tool validates evidence, section and claim scope; saves draft only, ≤8 clusters',async()=>{
 const ctx={...context(fixture('nomad-roasters')),runId:'run'};const writes=[];
 const tools=bindTools(ctx,{saveDraft:async args=>{writes.push(args);return 'draft-'+writes.length;}});
 const q={claim_ids:['visual.logo'],section:'visual',text:'Could you share the logo file?',answer_type:'upload',why:unknownStatement()};
 assert.equal((await tools.execute('draft_client_question',q)).status,'draft');assert.equal(writes.length,1);assert.equal(writes[0].bioId,'bio');
 assert.equal((await tools.execute('draft_client_question',{...q,claim_ids:['foreign']})).error,'invalid_question');
 assert.equal((await tools.execute('draft_client_question',{...q,section:'identity'})).error,'invalid_question');
 assert.equal((await tools.execute('draft_client_question',{...q,text:'Should the agent approve the BIO?'})).error,'invalid_question');
 for(const c of [...ctx.ledger.values()].filter(c=>c.claim_id!=='visual.logo').slice(0,8))await tools.execute('draft_client_question',{...q,claim_ids:[c.claim_id],section:c.section});
 assert.equal(writes.length,8);assert.equal(tools.drafts.length,8);
 assert.ok(writes.every(w=>!('jwt'in w)));
});
test('SELECT-only lint; only drafts helper writes, and never sends or notifies',()=>{
 for(const file of readdirSync(new URL('./',import.meta.url)).filter(f=>f.endsWith('.js')&&!f.includes('test-helpers'))){
 const src=readFileSync(new URL(file,import.meta.url),'utf8');
 if(file!=='drafts.js')assert.doesNotMatch(src,/\.(update|insert|delete|upsert)\s*\(/,file);
 else {assert.match(src,/from\('certifier_question_drafts'\)/);assert.doesNotMatch(src,/notify\s*\(|fetch\s*\(|sendMessage\s*\(/);}
 }
});
