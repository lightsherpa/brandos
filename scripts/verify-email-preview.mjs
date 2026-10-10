import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {renderEmail} from '../server/src/lib/creative/email-html.js';
const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw new Error('Set PLAYWRIGHT_MODULE to the installed playwright module');
const {chromium}=await import(modulePath);
const dir=new URL('../output/creative-qa/',import.meta.url);await mkdir(dir,{recursive:true});
const email=renderEmail({subject:'A slower morning, from Acme',preheader:'Meet the new daily ritual.',blocks:[{type:'heading',text:'Make room for a slower morning.'},{type:'text',text:'Good things deserve a little time. Discover our latest collection, made to bring warmth and simplicity to your daily routine.'},{type:'divider'},{type:'heading',text:'Thoughtfully made. Ready for every day.'},{type:'text',text:'Explore the materials, meet the makers, and find your next everyday favourite.'},{type:'button',text:'Explore the collection',url:'https://example.com/collection'},{type:'footer',text:'Acme · Madrid, Spain\nCreated with care.'}]},{requiredContent:['Acme'],forExport:true});
await writeFile(new URL('email.html',dir),email.html);
const browser=await chromium.launch({headless:true});
try{for(const width of [375,600]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.setContent(email.html);await page.screenshot({path:new URL(`email-${width}.png`,dir).pathname,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`${width}: horizontal overflow`);
 assert.equal(await page.locator('a').getAttribute('href'),'https://example.com/collection');await page.close();
}console.log('PASS: desktop/mobile email screenshots, no horizontal overflow, CTA URL. Browser rendering only; no email-client claim.');}finally{await browser.close();}
