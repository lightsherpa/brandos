import assert from 'node:assert/strict';
import{readFile,writeFile}from'node:fs/promises';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const dir='docs/brandos/test-runs/2026-10-15/product-pass',base='http://127.0.0.1:5196';
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json'));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const errors=[],screenshots=[],artifacts=[];
try{for(const type of ['social_post','email_sequence']){
 const run=JSON.parse(await readFile(`${dir}/${type}-run.json`));assert.equal(run.task.status,'ready');
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({session,run,type})=>{if(window.top!==window)return;localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',run.brandId);localStorage.setItem('locale','en');sessionStorage.setItem('ci_run_context',JSON.stringify({brandId:run.brandId,taskId:run.id,taskType:type,title:type==='social_post'?'Cake Me · everyday cheesecake':'Cake Me · a little everyday joy',ts:run.id,composedBrief:run.task.brief}));},{session:state.sessions.owner,run,type});
 await page.goto(`${base}/#/canvas`);await page.locator('.crew-artifact iframe').first().waitFor();await page.waitForTimeout(1200);
 assert.equal(await page.getByText('Re-run with…',{exact:false}).count(),0);assert.equal(await page.locator('.agency-office').count(),0);
 assert.equal(await page.locator('.crew-delivery-link').count(),run.task.items.length);
 for(const locale of ['en','es','ar']){await page.evaluate(async lang=>(await import('/src/lib/i18n.js')).setLocale(lang),locale);for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});const file=`canvas-${type}-${locale}-${width}.png`;await page.screenshot({path:`${dir}/${file}`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${file}: overflow`);screenshots.push(file);}}
 await page.evaluate(async()=>(await import('/src/lib/i18n.js')).setLocale('en'));
 await page.locator('.crew-component').first().click();await page.locator('.crew-editor').waitFor();for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});const file=`canvas-${type}-component-${width}.png`;await page.screenshot({path:`${dir}/${file}`,fullPage:true});screenshots.push(file);}
 await page.close();
 for(const item of run.task.items){assert.ok(item.html);assert.ok(item.image?.ocr?.pass,'Raw image passes OCR and palette QA');assert.ok(item.export?.stable,'Assets and real brand fonts embedded');const html=`cake-me-${type}-${item.index+1}.html`;artifacts.push(html);if(type==='social_post'){const exportPage=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});await exportPage.route('**/*',route=>route.abort());await exportPage.setContent(item.html,{waitUntil:'load'});await exportPage.evaluate(async()=>{await document.fonts.ready;for(const font of document.fonts)if(font.status==='error')throw Error('Font failed');for(const image of document.images)if(!image.complete||!image.naturalWidth)throw Error('Image failed');});const png='cake-me-social-post.png';await exportPage.screenshot({path:`${dir}/${png}`,clip:{x:0,y:0,width:1080,height:1350}});artifacts.push(png);await exportPage.close();}}
 }
 assert.deepEqual(errors,[]);await writeFile(`${dir}/canvas-proof.json`,JSON.stringify({screenshots,artifacts,errors,agencyOffice:false},null,2)+'\n');console.log(JSON.stringify({screenshots:screenshots.length,artifacts,errors}));
}finally{await browser.close();}
