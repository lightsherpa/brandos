// Complete the real local CD review queued by the same-brand owner walkthrough.
import assert from 'node:assert/strict';
import{readFile,writeFile}from'node:fs/promises';
const brandId=process.argv.find(x=>x.startsWith('--only='))?.slice(7),dir='docs/brandos/test-runs/2026-10-15/product-pass';
const ownerProof=JSON.parse(await readFile(`${dir}/certify-live-proof.json`));assert.equal(brandId,ownerProof.brandId);
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json')),api='http://127.0.0.1:8796';
async function request(path){const r=await fetch(api+path,{headers:{Authorization:`Bearer ${state.sessions.cd.access_token}`}});const body=await r.json();assert.ok(r.ok,JSON.stringify(body));return body;}
const jobs=(await request('/api/steward/jobs')).jobs.filter(j=>j.brand_id===brandId);assert.equal(jobs.length,1);
const job=await request(`/api/steward/jobs/${jobs[0].id}`);assert.equal(job.job.bio.version,ownerProof.version);
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const errors=[],screenshots=[];
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(({session,brandId})=>{if(window.top!==window)return;localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',brandId);localStorage.setItem('locale','en');},{session:state.sessions.cd,brandId});
await page.goto(`http://127.0.0.1:5196/#/team-job/${jobs[0].id}`);await page.waitForURL(`**/#/certify/${jobs[0].id}`);await page.locator('.certify-queue button').first().waitFor();
for(const claim of job.certify.claims){await page.locator(`[data-claim-id="${claim.claim_id}"]`).click();await page.locator('.certify-detail-drawer').getByRole('button',{name:'Confirm',exact:true}).click();}
for(const criterion of job.rubric.criteria.filter(c=>c.source==='human'))await page.getByLabel(`Score ${criterion.id}`,{exact:true}).selectOption('4');
await page.getByRole('button',{name:'Review confirmation',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Certify Brand Core',exact:true}).count(),1);
for(const locale of['en','es','ar']){await page.evaluate(async value=>(await import('/src/lib/i18n.js')).setLocale(value),locale);for(const width of[1280,1440]){await page.setViewportSize({width,height:1000});const file=`certify-cd-live-final-${locale}-${width}.png`;await page.screenshot({path:`${dir}/${file}`,fullPage:true});screenshots.push(file);}}
await page.evaluate(async()=>(await import('/src/lib/i18n.js')).setLocale('en'));const response=page.waitForResponse(r=>r.url()===`${api}/api/steward/jobs/${jobs[0].id}`&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Certify Brand Core',exact:true}).click();const r=await response,result=await r.json();assert.ok(r.ok(),JSON.stringify(result));assert.equal(result.status,'completed');await page.getByText('Certified',{exact:false}).first().waitFor();for(const width of[1280,1440]){await page.setViewportSize({width,height:1000});const file=`certify-cd-live-confirmed-${width}.png`;await page.screenshot({path:`${dir}/${file}`,fullPage:true});screenshots.push(file);}
const final=await request(`/api/steward/jobs/${jobs[0].id}`);assert.equal(final.job.bio.certified,true);assert.deepEqual(errors,[]);await writeFile(`${dir}/certify-cd-live-proof.json`,JSON.stringify({brandId,jobId:jobs[0].id,version:final.job.bio.version,claims:job.certify.claims.length,result,screenshots,errors},null,2)+'\n');console.log(JSON.stringify({version:final.job.bio.version,claims:job.certify.claims.length,certified:true,screenshots:screenshots.length,errors}));
}finally{await browser.close();}
