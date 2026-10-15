// Local, reversible UI proof. The fixture never connects to Supabase or writes production data.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
await mkdir('.mvp-local',{recursive:true});
const directory=await mkdtemp('.mvp-local/brand-core-inputs-');
const proof='docs/brandos/test-runs/2026-10-15/certify-ux';
await mkdir(proof,{recursive:true});
const vite=await createServer({server:{port:5197,strictPort:true},logLevel:'silent',define:{'import.meta.env.VITE_UI_FIXTURE':'"1"','import.meta.env.VITE_BRAND_CORE_INPUTS':'"1"'}});
let browser;
try{
 await writeFile(`${directory}/index.html`,'<html lang="en" data-theme="light" data-palette="plex-registry" data-density="cozy"><head><link rel="stylesheet" href="/caastor/ds-tokens.css"><link rel="stylesheet" href="/caastor/portal.css"><link rel="stylesheet" href="/caastor/caastor-tokens.css"><link rel="stylesheet" href="/caastor/plex-registry.css"></head><body style="padding:32px"><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
 await writeFile(`${directory}/fixture.jsx`,`import React from 'react';import {createRoot} from 'react-dom/client';import {FoundationStrip as BrandCoreInputs} from '/src/brand-foundation.jsx';import {setLocale} from '/src/lib/i18n.js';window.changeLocale=setLocale;function Fixture(){const[payload,setPayload]=React.useState({visual:{palette:[{role:'primary',group:'primary',hex:'#f4a1bc',name:'Cake pink'}],type:[]}});return <BrandCoreInputs brandId="fixture-cakeme" payload={payload} onSave={async visual=>{window.savedVisual=visual;setPayload({visual});}}/>}createRoot(document.getElementById('root')).render(<Fixture/>);`);
 await vite.listen();
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://localhost:5197/${directory}/index.html`);
 await page.getByRole('button',{name:'Edit Brand Core inputs',exact:true}).click();
 const pickers=page.locator('.bci-picker input');
 const sharp=createRequire(new URL('../server/package.json',import.meta.url))('sharp');
 const sample=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" rx="20" fill="#f4a1bc"/><text x="50%" y="48%" text-anchor="middle" font-size="52" font-family="sans-serif" fill="#402735">Cake Me</text><text x="50%" y="70%" text-anchor="middle" font-size="20" font-family="sans-serif" fill="#402735">UI test fixture</text></svg>')).png().toBuffer();
 const reference=(i)=>({name:`reference-${i}.png`,mimeType:'image/png',buffer:sample});
 await pickers.nth(1).setInputFiles(Array.from({length:11},(_,i)=>reference(i)));
 await page.getByText('Choose up to 10 reference images per upload.',{exact:true}).waitFor();
 assert.equal(await page.locator('.bci-upload').count(),0);
 await pickers.nth(1).setInputFiles(Array.from({length:10},(_,i)=>reference(i)));
 for(let i=0;i<10;i++){
  const row=page.locator('.bci-upload').filter({has:page.getByText(`reference-${i}.png`,{exact:true})});
  await row.locator('select').selectOption(['product','lifestyle','usage'][i%3]);
  await row.getByRole('button',{name:'Upload',exact:true}).click();
 }
 await page.getByText('The brand owns or has a licence to use these logos.',{exact:true}).locator('input').check();
 await pickers.nth(0).setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await page.locator('.bci-upload').filter({hasText:'bad.svg'}).getByRole('button',{name:'Upload',exact:true}).click();
 await page.getByText(/bad.svg: This format is unsupported/).waitFor();
 // New uploads remain usable while the failed item and its Retry remain visible.
 await pickers.nth(0).setInputFiles(Array.from({length:8},(_,i)=>({...reference(i),name:`logo-${i}.png`})));
 const uses=['primary','secondary','mark','small','light','dark','monochrome','primary'];
 for(let i=0;i<8;i++){
  const row=page.locator('.bci-upload').filter({has:page.getByText(`logo-${i}.png`,{exact:true})});
  await row.locator('select').selectOption(uses[i]);await row.getByRole('button',{name:'Upload',exact:true}).click();
 }
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'+ Add colour',exact:true}).nth(i%5).click();
 await page.getByLabel('Font family',{exact:true}).fill('Cake Me family');
 await page.getByText('The brand holds the commercial rights to use this font family.',{exact:true}).locator('input').check();
 const font=await readFile('public/caastor/assets/fonts/instrument-sans.ttf');
 await pickers.nth(2).setInputFiles(['Regular','Bold','BoldItalic'].map(name=>({name:`Cake-${name}.ttf`,mimeType:'font/ttf',buffer:font})));
 for(const name of ['Regular','Bold','BoldItalic'])await page.locator('.bci-upload').filter({has:page.getByText(`Cake-${name}.ttf`,{exact:true})}).getByRole('button',{name:'Upload',exact:true}).click();
 await page.locator('.bci-font-preview p').first().waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.bci-font-preview p')].length===3&&[...document.querySelectorAll('.bci-font-preview p')].every(el=>el.textContent.includes('quick brown')));
 for(const label of ['I am authorised to confirm rights for this brand.','The brand owns or holds a licence for these photos.','The licence permits using these photos to generate brand assets.'])await page.getByText(label,{exact:true}).locator('input').check();
 await page.locator('.bci-upload').filter({hasText:'bad.svg'}).getByRole('button',{name:'Remove',exact:true}).click();
 await page.locator('.bci-toast button[aria-label="Dismiss"]').evaluateAll(buttons=>buttons.forEach(button=>button.click()));
 for(const locale of ['en','es','ar']){
  await page.evaluate(locale=>window.changeLocale(locale),locale);
  for(const width of [1280,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${locale} ${width} has horizontal overflow`);
   await page.screenshot({path:`${proof}/slice1-inputs-editor-${locale}-${width}.png`,fullPage:true});
  }
 }
 await page.evaluate(()=>window.changeLocale('en'));
 await page.getByRole('button',{name:'Save Brand Core',exact:true}).click();
 await page.getByRole('button',{name:'Edit Brand Core inputs',exact:true}).waitFor();
 const saved=await page.evaluate(()=>window.savedVisual);
 assert.equal(Object.keys(saved.logo.variants).length,8);assert.equal(saved.references.length,10);assert.equal(saved.palette.length,7);assert.equal(saved.type.length,3);
 assert.deepEqual(saved.type.map(font=>[font.weight,font.style]),[['400','normal'],['700','normal'],['700','italic']]);
 assert.equal(saved.references.some(ref=>ref.pendingRights),false);
 assert.deepEqual([...new Set(saved.references.map(ref=>ref.tag))],['product','lifestyle','usage']);
 for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${proof}/slice1-inputs-saved-en-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);
 console.log('PASS Brand Core inputs: 10-image boundary, individual tags, 8 logo variants, 7 colours, 3 family weights/styles, live previews, failed-upload recovery, save, en/es/ar at 1280/1440.');
}finally{await browser?.close();await vite.close();await rm(directory,{recursive:true,force:true});}
