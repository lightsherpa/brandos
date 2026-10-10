// Rendered local sandbox checks: translated controls, stable state, real target geometry.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.CAASTOR_BROWSER_MODULE_ROOT+'/package.json');
const {chromium,webkit}=require('playwright'),out=new URL('../.mvp-local/browser/',import.meta.url).pathname;
await mkdir(out,{recursive:true});let checks=0;const report=[];
for(const [engineName,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [390,768,1024,1440]){
   const coarse=width<=1024,page=await browser.newPage({viewport:{width,height:900},hasTouch:coarse}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('locale','en'));
   await page.goto('http://127.0.0.1:5184/docs/mockups/canvas-v2/index.html?demo=1');await page.locator('.cvs-workspace').waitFor();
   for(const [locale,labels] of Object.entries({es:{inspector:'Inspector',run:'Ejecutar',name:'Nombre',close:'Cerrar panel',search:'Buscar especialistas'},ar:{inspector:'المفتش',run:'تشغيل',name:'الاسم',close:'إغلاق اللوحة',search:'البحث عن المختصين'}})){
    await page.evaluate(locale=>window.__canvasLocale.setLocale(locale),locale);
    assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');checks++;
    const select=coarse?page.locator('.cvs-mobile-list>button').filter({hasText:'Positioning Architect'}):page.locator('[data-canvas-node]').filter({hasText:'Positioning Architect'});
    await select.click();await page.locator('.cvs-panel').waitFor();
    // Use catalog values as the contract; proper names and authored content are preserved.
    const texts=await page.evaluate(async()=>{const {t}=window.__canvasLocale;return {name:t('canvas.name'),close:t('common.closePanel'),run:t('canvas.run_bab705'),connect:t('canvas.connect_from')};});
    const name=page.getByLabel(texts.name,{exact:true});await name.waitFor();assert.equal(await name.count(),1);checks++;
    const long='إطلاق مصل العناية بالبشرة المسائي مع مراجعة الأدلة المعتمدة وملاحظات الفريق '.repeat(2).slice(0,155);
    await name.fill(long);await page.getByLabel(texts.close,{exact:true}).click();
    const renamed=coarse?page.locator('.cvs-mobile-list>button').filter({hasText:long}):page.locator('[data-canvas-node]').filter({hasText:long});await renamed.click();
    if(coarse){
     const targets=await page.locator('.cvs-header button,.cvs-panel button,.cvs-panel input:not([type=radio]),.cvs-panel select,.cvs-tiers label').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length&&!e.disabled).map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.slice(0,40),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
     assert.ok(targets.length>5);assert.deepEqual(targets.filter(t=>t.width<43.9||t.height<43.9),[],JSON.stringify(targets));checks++;
     assert.equal(await page.locator('.cvs-world').isVisible(),false);checks++;
    }
    assert.ok(await page.locator('.cvs-panel select').filter({has:page.locator('option[value=""]')}).count()>0);
    const run=page.locator('.cvs-panel button.btn--primary').first();await run.click();await page.getByRole('dialog').waitFor();
    const approve=await page.evaluate(async()=>window.__canvasLocale.t('canvas.approve_and_run'));
    await page.getByRole('button',{name:approve,exact:true}).click();await page.locator('.cvs-node-caption [data-state="ready"]').waitFor({state:'attached'});checks++;
    const notice=page.locator('.cvs-toast span');await notice.waitFor();assert.ok(await notice.evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)*3+1));checks++;
    await page.getByLabel(texts.close,{exact:true}).click();
    // Physical Delete key must keep working after switching to Arabic/Spanish.
    await page.locator('.cvs-workspace').focus();const before=await page.locator('[data-canvas-node]').count();await page.keyboard.press('Delete');assert.equal(await page.locator('[data-canvas-node]').count(),before-1);await page.keyboard.press('Control+z');assert.equal(await page.locator('[data-canvas-node]').count(),before);checks++;
    await page.evaluate(()=>document.body.style.zoom='2');
    const overflow=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify({width,locale,...overflow}));checks++;
    const addLabel=await page.evaluate(async()=>window.__canvasLocale.t('canvas.add_specialist'));
    // On narrow/coarse layouts use the unscaled list action.
    if(coarse){await page.locator('.cvs-mobile-actions').getByRole('button',{name:addLabel,exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('dialog').locator('input[type=search]').isVisible());await page.keyboard.press('Escape');checks++;}
    await page.screenshot({path:out+`${engineName}-canvas-${locale}-${width}-zoom200.png`});
    await page.evaluate(()=>document.body.style.zoom='');
    // Reset authored node name for the next language.
    await renamed.click();await name.fill('Positioning Architect');await page.getByLabel(texts.close,{exact:true}).click();
    report.push({engine:engineName,width,locale,coarse,zoom:200});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
}
await writeFile(out+'canvas-locales.json',JSON.stringify({checks,scenarios:report,providerCalls:0},null,2));console.log(`PASS: ${checks} rendered locale/touch/zoom checks in Chromium and WebKit.`);
