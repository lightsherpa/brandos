// Read-only proof of the browser-completed local Cake Me walkthrough.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const run=JSON.parse(await readFile('.mvp-local/certify-friction-run.json'));
const auth=JSON.parse(await readFile('.mvp-local/certify-ux-session.json'));
assert.equal(run.api,'http://127.0.0.1:8796');
async function get(role,path,expected=200){const r=await fetch(run.api+path,{headers:{Authorization:`Bearer ${auth.sessions[role].access_token}`}});assert.equal(r.status,expected,`${role} ${path}`);return r.json();}
const data=await get('cd',`/api/steward/jobs/${run.jobId}`);
assert.equal(data.job.status,'completed');assert.equal(data.job.bio.certified,true);assert.equal(data.job.bio.version,run.bioVersion);assert.equal(data.job.brand_id,run.brandId);
const {progress,closed,job_status}=await get('cd',`/api/steward/jobs/${run.jobId}/progress`);
assert.equal(closed,true);assert.equal(job_status,'completed');assert.equal(Object.keys(progress.decisions).length,data.certify.claims.length);assert.ok(Object.values(progress.decisions).every(d=>['confirmed','fixed'].includes(d.state)));assert.equal(progress.mode,'done');assert.ok(['C3','C4','C5','C6','C7'].every(id=>progress.scores[id]?.score===4));
const assist=data.copilot.strategyAssist.claims.find(c=>c.field_path==='identity.positioning');assert.equal(assist.reasonCode,'supported');assert.ok(assist.citations.some(c=>c.quote.includes('For this local review')));
await get('owner',`/api/steward/jobs/${run.jobId}`,403);await get('owner',`/api/steward/jobs/${run.jobId}/progress`,403);
const proof={brandId:run.brandId,jobId:run.jobId,bioVersion:run.bioVersion,status:data.job.status,certified:data.job.bio.certified,closed,progressRevision:progress.revision,decisions:Object.keys(progress.decisions).length,scores:progress.scores,terminalModePersisted:progress.mode==='done',clientAnswerCitations:assist.citations.length,ownerJobAccess:403,ownerProgressAccess:403,supabase:'http://127.0.0.1:54321',source:run.source};
await writeFile('docs/brandos/test-runs/2026-10-15/certify-friction/final-api-proof.json',JSON.stringify(proof,null,2)+'\n');
console.log(`PASS: completed/certified v${run.bioVersion}, ${proof.decisions} persisted human decisions, confirmation and scores durable, client citation present, owner endpoints denied.`);
