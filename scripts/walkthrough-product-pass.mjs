// Real local provider run. Explicit scope required; never seeds or sends email.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const brandId=process.argv.find(v=>v.startsWith('--only='))?.slice(7);
assert.match(brandId||'',/^[a-f0-9-]{36}$/,'Require --only=<existing local brand UUID>');
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json'));
const api='http://127.0.0.1:8796',dir='docs/brandos/test-runs/2026-10-15/product-pass';
await mkdir(dir,{recursive:true});
async function request(path,body){const r=await fetch(api+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${state.sessions.owner.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();assert.ok(r.ok,`${path}: ${r.status} ${JSON.stringify(json)}`);return json;}
const briefs={social_post:'Create one Instagram social post for Cake Me celebrating an everyday cheesecake moment. Use the joyful, friendly voice and the existing product references. No discounts or invented offers.',email_sequence:'Create one Cake Me email inviting readers to enjoy an everyday cheesecake moment. Use the joyful, friendly brand voice and certified product references. Include a photographic hero, subject, preheader, headline, body and CTA linking to https://thecake-me.com. No discounts, invented offers, unsupported claims or deadlines.'};
const type=process.env.WALK_TASK||'social_post';assert.ok(briefs[type]);
const before=performance.now();
const sharp=await request('/api/briefs/sharpen',{brandId,briefText:briefs[type]});
await writeFile(`${dir}/${type}-sharpen.json`,JSON.stringify(sharp,null,2)+'\n');
const job=await request('/api/tasks',{brandId,type,brief:[briefs[type],sharp.sharpenedBrief,...(sharp.refusals||[])].join('\n'),count:1,heroes:type==='email_sequence'});
console.log('Created scoped local task',type,job.id);
let task;
for(let n=0;n<240;n++){task=await request(`/api/tasks/${job.id}`);if(n%5===0)console.log(type,task.stage,task.status);if(task.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,2000));}
const proof={brandId,type,id:job.id,totalMs:Math.round(performance.now()-before),task};
await writeFile(`${dir}/${type}-run.json`,JSON.stringify(proof,null,2)+'\n');
for(const item of task.items||[])if(item.status==='ready'&&item.html)await writeFile(`${dir}/cake-me-${type}-${item.index+1}.html`,item.html);
console.log(type,task.status,proof.totalMs+'ms',JSON.stringify((task.items||[]).map(i=>({index:i.index,status:i.status,checks:i.checks,review:i.review}))));
assert.equal(task.status,'ready','Real task must pass all mandatory QA');
