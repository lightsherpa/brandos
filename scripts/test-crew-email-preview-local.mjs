// Real saved email proof. No fixtures, provider calls, backend or data writes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const dir='docs/brandos/test-runs/2026-10-15/product-pass';
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json'));
const run=JSON.parse(await readFile(`${dir}/email_sequence-run.json`));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({session,run})=>{if(window.top!==window)return;localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',run.brandId);localStorage.setItem('locale','en');sessionStorage.setItem('ci_run_context',JSON.stringify({brandId:run.brandId,taskId:run.id,taskType:'email_sequence',title:'Cake Me email preview proof',ts:run.id,composedBrief:run.task.brief}));},{session:state.sessions.owner,run});
 await page.goto('http://127.0.0.1:5196/#/canvas');await page.locator('.crew-email iframe').waitFor();
 const measurements=[];
 for(const width of [1280,1440]){
  await page.setViewportSize({width,height:1000});
  await page.waitForFunction(()=>{const f=document.querySelector('.crew-email iframe');return f?.contentDocument?.body&&f.clientHeight>=f.contentDocument.body.scrollHeight;});
  const measured=await page.locator('.crew-email iframe').evaluate(frame=>{const doc=frame.contentDocument;const cta=doc.querySelector('.cta-primary a');return{frameHeight:frame.clientHeight,contentHeight:doc.body.scrollHeight,ctaBottom:cta?.getBoundingClientRect().bottom,ctaText:cta?.textContent?.trim(),sandbox:frame.getAttribute('sandbox')};});
  assert.ok(measured.frameHeight>=measured.contentHeight);assert.ok(measured.ctaText);assert.ok(measured.ctaBottom<=measured.frameHeight,'CTA must be inside the visible full email preview');assert.equal(measured.sandbox,'allow-same-origin');assert.equal(await page.locator('.crew-email .crew-artifact__select').count(),0,'Email preview must remain accessible without a click shield');measurements.push({width,...measured});
 }
 assert.deepEqual(errors,[]);await writeFile(`${dir}/email-preview-fit-proof.json`,JSON.stringify({taskId:run.id,measurements,errors,mutations:'None; existing saved email and read-only browser checks'},null,2)+'\n');console.log(JSON.stringify({measurements,errors}));
}finally{await browser.close();}
