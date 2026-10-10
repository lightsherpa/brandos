import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(process.env.CAASTOR_BROWSER_MODULE_ROOT+'/package.json'),{chromium,webkit}=require('playwright');
const config=JSON.parse(await readFile(new URL('../.mvp-local/fixture.json',import.meta.url),'utf8')),result=JSON.parse(await readFile(new URL('../.mvp-local/integration-result.json',import.meta.url),'utf8'));
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data,error}=await client.auth.signInWithPassword({email:config.email,password:config.password});if(error)throw error;
const out=new URL('../.mvp-local/browser/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const reports=[];
const base=process.env.CAASTOR_BROWSER_BASE_URL||'http://127.0.0.1:5184';
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
  await page.addInitScript(({session,context})=>{localStorage.setItem('ci_sb_session',JSON.stringify(session));sessionStorage.setItem('ci_run_context',JSON.stringify(context));},{session:data.session,context:{mode:'view',briefId:result.briefId,brandId:result.brandId,canvasId:result.canvasId}});
  await page.goto(base+'/#/home');await page.locator('.app').waitFor();
  assert.equal(await page.evaluate(()=>typeof window.BriefsLibrary),'undefined');
  assert.equal(await page.evaluate(()=>typeof window.BioViewer),'undefined');
  await page.evaluate(()=>location.hash='#/briefs');await page.waitForFunction(()=>typeof window.BriefsLibrary==='function');await page.locator('.route-view h1').waitFor();
  await page.evaluate(()=>location.hash='#/bio');await page.waitForFunction(()=>typeof window.BioViewer==='function');await page.locator('.route-view').getByText('Synthetic night serum',{exact:false}).first().waitFor();
  await page.evaluate(()=>location.hash='#/canvas');await page.locator('.cvs-workspace').waitFor();
  assert.ok(await page.locator('.cvs-node').count()>=4);
  const node=page.locator('.cvs-node').filter({has:page.getByRole('heading',{name:'Local checked positioning',exact:true})});
  await node.getByRole("heading").click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Browser verified positioning');
  await page.getByText('Saved',{exact:true}).waitFor();await page.waitForTimeout(1000);
  await page.reload();await page.getByRole('heading',{name:'Browser verified positioning',exact:true}).waitFor();
  await page.screenshot({path:out+engineName+'-platform.png'});
  const rename=page.locator('.cvs-node').filter({has:page.getByRole('heading',{name:'Browser verified positioning',exact:true})});await rename.getByRole("heading").click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Local checked positioning');await page.waitForTimeout(1200);
  await page.goto('http://127.0.0.1:5184/docs/mockups/design-system/index.html');await page.getByRole('heading',{name:'Controls and states'}).waitFor();
  await page.getByRole('button',{name:'Open approval dialog'}).focus();await page.getByRole('button',{name:'Open approval dialog'}).press('Enter');await page.getByRole('dialog',{name:'Approve generation'}).waitFor();
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Deny');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='Open approval dialog');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Open approval dialog');
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:out+engineName+'-reference-'+theme+'-'+width+'.png',fullPage:true});
   }
  }
  await page.getByRole('button',{name:'Open approval dialog'}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='Open approval dialog');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.ds-control').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  assert.deepEqual(errors,[]);reports.push({engine:engineName,passed:true,base,scope:'Authenticated home → lazy Briefs → lazy BIO → Canvas save/reload; component reference themes/responsive/dialog keyboard and pointer focus/reduced motion.'});
 }catch(error){for(const page of browser.contexts().flatMap(c=>c.pages())){await page.screenshot({path:out+engineName+'-failure.png'});console.error((await page.locator('.route-view').innerText().catch(()=>'' )).slice(0,1600));}throw error;}finally{await browser.close();}
}
await writeFile(out+'result.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
