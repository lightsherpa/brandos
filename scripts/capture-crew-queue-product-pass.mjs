// Read-only proof against the existing local stack. No fixtures or data writes.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.CERTIFY_TEST_WEB||'http://127.0.0.1:5196';assert.equal(new URL(base).hostname,'127.0.0.1');
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json'));
const brandId=process.env.CREW_PROOF_BRAND_ID||state.brandId;
const directory='docs/brandos/test-runs/2026-10-15/product-pass';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const errors=[],screenshots=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({session,brand})=>{if(window.top!==window)return;localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',brand);localStorage.setItem('locale','en');},{session:state.sessions.cd,brand:brandId});
 await page.goto(`${base}/#/team`);await page.locator('.tqueue').waitFor();await page.waitForTimeout(600);
 const queueRows=await page.locator('.tqueue tbody tr').count();
 assert.equal(await page.getByText('drift_check',{exact:true}).count(),0);
 assert.equal(await page.locator('.agency-office,.boutique-office,.office-floor').count(),0);
 for(const locale of ['en','es','ar']){await page.evaluate(async lang=>(await import('/src/lib/i18n.js')).setLocale(lang),locale);for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});const name=`queue-labels-${locale}-${width}.png`;await page.screenshot({path:`${directory}/${name}`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflow`);screenshots.push(name);}}
 assert.deepEqual(errors,[]);
 await writeFile(`${directory}/queue-proof.json`,JSON.stringify({base,brandId,queueRows,screenshots,errors,mutations:'None: real auth and GET requests only'},null,2)+'\n');
 console.log(JSON.stringify({queueRows,screenshots:screenshots.length,errors}));
}finally{await browser.close();}
