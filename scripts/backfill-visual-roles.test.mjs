import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseBackfillArgs,assertLocalBackfillTarget,legacyVisualChanges} from './backfill-visual-roles.mjs';
const id='35f265f0-0546-4a9a-b793-a49887ad7125';
test('backfill is dry-run by default, scoped to one brand and blocked remotely',()=>{
 assert.equal(parseBackfillArgs([`--only=${id}`]).dryRun,true);
 assert.throws(()=>parseBackfillArgs([]),/--only/);assert.throws(()=>parseBackfillArgs(['--only=all']),/--only/);
 assert.throws(()=>assertLocalBackfillTarget('https://production.supabase.co'),/blocked/);
 assert.doesNotThrow(()=>assertLocalBackfillTarget('http://127.0.0.1:54321'));
 assert.throws(()=>parseBackfillArgs([`--only=${id}`,'--apply','--input=rows.json']),/dry-run/);
});
test('only legacy current visual uploads change; metadata and idempotence are preserved',()=>{
 const base={brand_id:id,kind:'file_upload',bucket:'visual',raw_ref:'local/image.png',src:'image.png',signals:{upload_id:'upload'}};
 const rows=[{...base,id:'a'},{...base,id:'b',src:'font.woff2'},{...base,id:'c',brand_id:'other'},{...base,id:'d',signals:{asset_role:'logo'}},{...base,id:'e',signals:{purpose:'aspiration'}}];
 const changes=legacyVisualChanges(rows,id);assert.equal(changes.length,1);assert.equal(changes[0].signals.upload_id,'upload');assert.equal(changes[0].signals.rights_confirmed,true);assert.equal(changes[0].signals.asset_role,'canonical');
 assert.equal(legacyVisualChanges([{...base,signals:changes[0].signals}],id).length,0);
});
