import {execFileSync} from 'node:child_process';
// Run prepare-certify-ux-local.mjs first. Uses real local auth/API/DB, no providers.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.CERTIFY_TEST_WEB||'http://127.0.0.1:5198';
const api=process.env.CERTIFY_TEST_API||'http://127.0.0.1:8798';
assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(api).hostname,'127.0.0.1');
const statePath='.mvp-local/certify-ux-session.json';
const run=JSON.parse(await readFile(statePath));
const proof='docs/brandos/test-runs/2026-10-15/certify-ux';await mkdir(proof,{recursive:true});
const errors=[],steps=[],screenshots=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
async function request(role,path,method='GET',body){const res=await fetch(api+path,{method,headers:{Authorization:`Bearer ${run.sessions[role].access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await res.json();assert.ok(res.ok,`${method} ${path}: ${res.status} ${JSON.stringify(json)}`);return json;}
async function pageFor(role){const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(({session,brand})=>{if(window.top!==window)return;if(!localStorage.getItem('ci_sb_session'))localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',brand);localStorage.setItem('locale','en');},{session:run.sessions[role],brand:run.brandId});return page;}
async function locale(page,value){await page.evaluate(async value=>(await import('/src/lib/i18n.js')).setLocale(value),value);}
async function shot(page,name,locales=['en']){console.log('SCREEN',name);for(const lang of locales){await locale(page,lang);for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${proof}/${name}-${lang}-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} ${lang} ${width}: horizontal overflow`);screenshots.push(`${name}-${lang}-${width}.png`);}}await locale(page,'en');}
try{
 const owner=await pageFor('owner');await owner.goto(`${base}/#/certify/owner/${run.brandId}`);await owner.locator('.certify-stewart').waitFor();
 let bio=(await request('owner',`/api/bios/${run.brandId}`)).bio;
 if(!bio.self_certified){
  await owner.locator('.bio-cert-review-grid').waitFor();await shot(owner,'owner-review',['en','es','ar']);
  const nav=owner.locator('.bio-cert-review-grid nav button');const count=await nav.count();assert.equal(count,7);
  for(let i=0;i<count;i++){await nav.nth(i).click();await owner.locator('.bio-cert-preview .bio-cert-check input').check();}
  await owner.locator('.bio-cert-inline footer .btn--primary').click();
  for(const checkbox of await owner.locator('.bio-cert-declarations input').all())await checkbox.check();
  await shot(owner,'owner-confirmation',['en','es','ar']);
  const response=owner.waitForResponse(r=>r.url().includes('/self-certify')&&r.request().method()==='POST');await owner.getByRole('button',{name:'Certify Brand Core',exact:true}).click();const res=await response;assert.ok(res.ok(),await res.text());
  await owner.locator('.bio-cert-record').waitFor();steps.push('Owner reviewed all seven sections and confirmed exact local v3 through Certify.');await shot(owner,'owner-confirmed');await owner.getByRole('button',{name:'Return to Brand Core',exact:true}).click();
 }
 const {createClient}=await import('@supabase/supabase-js');
 const config=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
 assert.equal(config.API_URL,'http://127.0.0.1:54321');
 const sb=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data:job,error:jobError}=await sb.from('steward_jobs').select('id,status').eq('brand_id',run.brandId).eq('bio_id',run.bioId).single();if(jobError)throw jobError;run.jobId=job.id;await writeFile(statePath,JSON.stringify(run),{mode:0o600});
 const cd=await pageFor('cd');await cd.goto(`${base}/#/team-job/${job.id}`);await cd.waitForURL(`**/#/certify/${job.id}`);await cd.locator('.certify-queue button').first().waitFor();
 const data=await request('cd',`/api/steward/jobs/${job.id}`);assert.equal(data.job.bio.version,3);assert.equal(data.job.bio.certified,false);
 await shot(cd,'cd-review',['en','es','ar']);
 const target=data.certify.claims.find(c=>c.field_path==='identity.positioning');assert.ok(target);
 await cd.locator(`[data-claim-id="${target.claim_id}"]`).click();await cd.locator('.certify-detail-drawer').waitFor();await shot(cd,'claim-details',['en','es','ar']);
 await cd.locator('.certify-detail-drawer').getByRole('button',{name:'Ask client',exact:true}).click();await cd.getByLabel('Question',{exact:true}).fill('Please confirm that the saved Cake Me v3 positioning is supported by the brand deck.');
 await shot(cd,'inline-question',['en','es','ar']);await cd.getByRole('button',{name:'Send to client',exact:true}).click();
 await cd.locator('.certify-client-chat textarea').first().waitFor();
 assert.notEqual(await cd.locator('.certify-queue .is-active').getAttribute('data-claim-id'),target.claim_id,'sending advances the review');
 const thread=await request('cd',`/api/cert-chat/jobs/${job.id}`);const question=thread.messages.findLast(m=>m.author_role==='cd'&&m.sent_at);assert.ok(question);await shot(cd,'client-chat',['en','es','ar']);
 const answer=await request('owner',`/api/cert-chat/brands/${run.brandId}/answers`,'POST',{question_id:question.id,idempotency_key:crypto.randomUUID(),body:'Confirmed for this local v3 walkthrough: the saved positioning follows the uploaded Cake Me brand deck.'});assert.ok(answer);
 await cd.getByRole('button',{name:'Refresh evidence',exact:true}).click();await cd.locator('.certify-queue button').first().waitFor();steps.push('CD opened an item drawer, asked inline, sent the question, opened chat and advanced; owner answered through the real local API.');
 let latest=await request('cd',`/api/steward/jobs/${job.id}`);
 const selectClaim=async path=>{const c=latest.certify.claims.find(c=>c.field_path===path);if(c){await cd.locator(`[data-claim-id="${c.claim_id}"]`).click();await cd.locator('.certify-detail-drawer').waitFor();await cd.locator('.certify-detail-drawer').getByRole('button',{name:'Close',exact:true}).click();}return c;};
 for(const [path,name]of [['visual.imagery','imagery-evidence'],['visual.type','font-specimens'],['positioning.competitors','competitor-evidence']]){if(await selectClaim(path))await shot(cd,name,['en','es','ar']);}
 for(const c of latest.certify.claims){await cd.locator(`[data-claim-id="${c.claim_id}"]`).click();await cd.locator('.certify-detail-drawer').getByRole('button',{name:'Confirm',exact:true}).click();}
 for(const criterion of latest.rubric.criteria.filter(c=>c.source==='human'))await cd.getByLabel(`Score ${criterion.id}`,{exact:true}).selectOption('4');
 await cd.getByRole('button',{name:'Review confirmation',exact:true}).click();await shot(cd,'cd-final-confirmation',['en','es','ar']);assert.equal(await cd.getByRole('button',{name:'Certify Brand Core',exact:true}).count(),1);
 const decisionResponse=cd.waitForResponse(r=>r.url()===`${api}/api/steward/jobs/${job.id}`&&r.request().method()==='PATCH');await cd.getByRole('button',{name:'Certify Brand Core',exact:true}).click();const decision=await decisionResponse;const result=await decision.json();assert.ok(decision.ok(),JSON.stringify(result));assert.equal(result.status,'completed');
 await cd.getByText('Certified',{exact:false}).first().waitFor();await shot(cd,'cd-certified',['en','es','ar']);bio=(await request('owner',`/api/bios/${run.brandId}`)).bio;assert.equal(bio.certified,true);assert.equal(bio.version,3);steps.push(`CD reviewed ${latest.certify.claims.length} claims, scored the rubric and certified local v3; persisted job completed.`);
 await owner.goto(`${base}/#/bio`);await owner.goto(`${base}/#/certify/owner/${run.brandId}`);await owner.getByRole('button',{name:'Create next version',exact:true}).waitFor();
 await owner.getByLabel('Item details',{exact:true}).selectOption('visual');await owner.getByLabel('Comment or request changes',{exact:true}).selectOption('change_request');await owner.getByLabel('Your feedback',{exact:true}).fill('Please add an approved small-size logo usage example in the next visual review.');await shot(owner,'owner-change-request',['en','es','ar']);
 const changeResponse=owner.waitForResponse(r=>r.url()===`${api}/api/bios/${run.brandId}`&&r.request().method()==='PATCH');await owner.getByRole('button',{name:'Create next version',exact:true}).click();const changed=await changeResponse;assert.ok(changed.ok(),await changed.text());
 await owner.getByText('Brand Core v4',{exact:true}).waitFor();await shot(owner,'owner-next-version',['en','es','ar']);bio=(await request('owner',`/api/bios/${run.brandId}`)).bio;assert.equal(bio.version,4);assert.equal(bio.certified,false);assert.equal(bio.payload.owner_feedback.section,'visual');assert.equal(bio.payload.owner_feedback.kind,'change_request');steps.push('Owner requested a visual change; a new uncertified v4 was appended while certified v3 stayed in history.');
 assert.deepEqual(errors,[]);
 await writeFile(`${proof}/walkthrough.json`,JSON.stringify({brandId:run.brandId,jobId:run.jobId,source:'Copy of existing local Cake Me v3; original brand untouched',api,supabase:'http://127.0.0.1:54321',steps,screenshots,errors},null,2)+'\n');
 console.log(`PASS local Cake Me v3 end-to-end: ${steps.length} stages, ${screenshots.length} screenshots, no page errors.`);
}finally{await browser.close();}
