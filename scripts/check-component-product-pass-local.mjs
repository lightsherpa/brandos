import assert from 'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';
const dir='docs/brandos/test-runs/2026-10-15/product-pass',file=`${dir}/social_post-run.json`,run=JSON.parse(await readFile(file));
assert.equal(process.argv.find(x=>x.startsWith('--only='))?.slice(7),run.brandId,'Explicit scope must match the real social task');
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json')),api='http://127.0.0.1:8796';
async function request(path,body){const r=await fetch(api+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${state.sessions.owner.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();assert.ok(r.ok,JSON.stringify(json));return json;}
const before=await request(`/api/tasks/${run.id}`);assert.equal(before.status,'ready');const started=performance.now();
const result=await request(`/api/tasks/${run.id}/items/0/component`,{component:'caption',action:'replace',value:'Some Tuesdays need two forks. 💛\n\nTag the person you would share this cheesecake moment with. 🩷'});assert.equal(result.item.status,'ready');
const after=await request(`/api/tasks/${run.id}`);const old=before.items[0],next=after.items[0];assert.notEqual(next.copy.caption,old.copy.caption);
const other=copy=>Object.fromEntries(Object.entries(copy).filter(([key])=>key!=='caption'));
assert.deepEqual(other(next.copy),other(old.copy));assert.equal(next.image.asset_url,old.image.asset_url);assert.equal(after.provenance.bioVersion,3);
assert.equal(result.metrics.cost.by_step?.imaging||0,0);assert.equal(result.metrics.ledger.filter(row=>row.kind==='image').length,0);
await writeFile(`${dir}/component-proof.json`,JSON.stringify({taskId:run.id,brandId:run.brandId,component:'caption',action:'replace',rejectedRegeneration:'Earlier 422 preserved the original ready artifact; quality gate was not bypassed.',elapsedMs:Math.round(performance.now()-started),imageUnchanged:true,otherFieldsUnchanged:true,pinnedVersion:after.provenance.bioVersion,metrics:result.metrics,before:old.copy.caption,after:next.copy.caption},null,2)+'\n');
run.task=after;await writeFile(file,JSON.stringify(run,null,2)+'\n');await writeFile(`${dir}/cake-me-social_post-1.html`,next.html);console.log(JSON.stringify({ready:true,imageUnchanged:true,otherFieldsUnchanged:true,imageCalls:0,elapsedMs:Math.round(performance.now()-started)}));
