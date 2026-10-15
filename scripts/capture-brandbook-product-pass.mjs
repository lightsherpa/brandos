// Read-only browser proof. Reuses existing local auth + stack; never seeds or submits certification.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.CERTIFY_TEST_WEB||'http://127.0.0.1:5196';assert.equal(new URL(base).hostname,'127.0.0.1');
const state=JSON.parse(await readFile('.mvp-local/certify-ux-session.json'));
const bookBrand=process.env.BRAND_BOOK_PROOF_BRAND_ID||state.brandId,pendingBrand=process.env.CERTIFY_PROOF_BRAND_ID||state.brandId;
const directory='docs/brandos/test-runs/2026-10-15/product-pass';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const errors=[],screenshots=[];
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({session,brand})=>{if(window.top!==window)return;localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',brand);localStorage.setItem('locale','en');},{session:state.sessions.owner,brand:bookBrand});
async function settleFonts(){await page.waitForFunction(()=>!document.querySelector('.book2')||[...document.querySelectorAll('.book2-specimen')].every(el=>el.querySelectorAll('.book2-type-line').length===7));}
async function capture(name){for(const locale of ['en','es','ar']){await page.evaluate(async lang=>(await import('/src/lib/i18n.js')).setLocale(lang),locale);await settleFonts();for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${directory}/${name}-${locale}-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${locale} ${width} overflow`);screenshots.push(`${name}-${locale}-${width}.png`);}}await page.evaluate(async()=>(await import('/src/lib/i18n.js')).setLocale('en'));await settleFonts();}
try{
 await page.goto(`${base}/#/brand-book`);await page.locator('.book2-cover').waitFor();await page.waitForFunction(()=>document.fonts.status==='loaded');await page.locator('.book2-lockups img').first().waitFor();await page.waitForTimeout(1000);await capture('brand-book');
 const specimens=await page.locator('.book2-type-line').count();assert.ok(specimens>=7,'At least one actual loaded brand font renders H1–H6 and body');
 const fontChecks=await page.locator('.book2-specimen').evaluateAll(elements=>elements.map(el=>{const family=el.style.getPropertyValue('--book-specimen-family');return {label:el.querySelector('strong').textContent,expected:family,computed:getComputedStyle(el.querySelector('.book2-type-line p')).fontFamily,loaded:[...document.fonts].some(face=>face.status==='loaded'&&face.family.replaceAll('"','')===family.replaceAll('"','')),available:document.fonts.check(`16px ${family}`)};}));
 for(const font of fontChecks){assert.equal(font.computed.replaceAll('"',''),font.expected.replaceAll('"',''),`${font.label} must render its actual family`);assert.ok(font.loaded&&font.available,`${font.label} FontFace must be loaded`);}
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const documentNode=await cdp.send('DOM.getDocument');
 for(let i=0;i<fontChecks.length;i++){const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:documentNode.root.nodeId,selector:`.book2-specimen:nth-of-type(${i+1}) .book2-type-line p`});fontChecks[i].rendered=(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;assert.ok(fontChecks[i].rendered.some(font=>font.isCustomFont&&font.glyphCount>0&&font.familyName===fontChecks[i].label),`${fontChecks[i].label} actual rendered glyph font`);}
 await page.goto(`${base}/#/certify/owner/${pendingBrand}`);await page.locator('.bio-cert-section-action').waitFor();await capture('certify-cta');
 // Only local React state changes: review each section and open final confirmation, without submitting.
 await page.locator('.bio-cert-section-action .btn--primary').click({clickCount:1});
 for(let n=1;n<await page.locator('.bio-cert-review-grid nav button').count();n++){const primary=page.locator('.bio-cert-section-action .btn--primary');if((await primary.textContent()).includes('Section confirmed'))break;await primary.click();}
 const next=page.locator('.bio-cert-primary-footer .btn--primary');
 let finalVisible=false;if(await next.isEnabled()){await next.click();await page.locator('.bio-cert-declarations input').evaluateAll(inputs=>inputs.forEach(input=>input.click()));await capture('certify-final-confirmation');finalVisible=true;}
 assert.deepEqual(errors,[]);await writeFile(`${directory}/brandbook-certify-proof.json`,JSON.stringify({base,bookBrand,pendingBrand,specimens,fontChecks,finalVisible,screenshots,errors,mutations:'None: no API writes, seeding or submission'},null,2)+'\n');console.log(JSON.stringify({screenshots:screenshots.length,specimens,finalVisible,errors}));
}finally{await browser.close();}
