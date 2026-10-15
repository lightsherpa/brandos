// Run with Playwright installed, or set PLAYWRIGHT_MODULE_PATH to its bundled entry.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'vite';
import { buildClaimLedger } from '../server/src/lib/claim-ledger.js';
import { DEFAULT_RUBRIC } from '../server/src/lib/evaluate-certification.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
await mkdir('.mvp-local', {recursive:true});
const directory = await mkdtemp('.mvp-local/certifier-s1-');
const vite = await createServer({server:{port:5191,strictPort:true},logLevel:'silent'});
let browser;
try {
  await vite.listen();
  const base = 'http://localhost:5191';
  const image = `${base}/${directory}/logo.svg`;
  await writeFile(`${directory}/logo.svg`, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><rect width="400" height="160" fill="#ffd115"/><text x="30" y="108" font-size="70" fill="#161616">Cake Me</text></svg>');
  const payload = {visual:{logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#ffd115'},{role:'ink',hex:'#161616'},{role:'surface',hex:'#fff9ef'},{role:'accent',hex:'#f26fa5'}],type:[{kind:'Display',family:'Instrument Sans',provider:'google'}]},identity:{positioning:'Cakes made for a moment of joy'},confidence:{'identity.positioning':{conf:92,source:'https://cake.test/about'}},evidence:{'identity.positioning':'Cakes made for a moment of joy.'}};
  const sources = [{id:'logo',kind:'file_upload',src:'logo.png',signals:{mime:'image/png',asset_role:'logo',ext:'png',rights_confirmed:true},evidence_url:image}, {id:'site',kind:'url_scrape',src:'https://cake.test/about',signals:{snippet:'Cakes made for a moment of joy.',screenshotUrl:image}}];
  const data = {job:{id:'job',brand_id:'brand',status:'in_review',brand:{name:'Cake Me'},bio:{id:'bio',version:2,payload}},sources,rubric:DEFAULT_RUBRIC,certify:{enabled:true,logoRights:['logo'],...buildClaimLedger({brandId:'brand',bioVersion:2,payload,sources,brandUrl:'https://cake.test'})}};
  await writeFile(`${directory}/index.html`, `<html><head><link rel="stylesheet" href="/caastor/tokens.css"><link rel="stylesheet" href="/caastor/portal.css"></head><body><div style="margin-left:248px" id="root"></div><script type="module" src="/${directory}/fixture.jsx"></script></body></html>`);
  await writeFile(`${directory}/fixture.jsx`, `import React from 'react';import {createRoot} from 'react-dom/client';import {CertifyReview} from '/src/certify/CertifyView.jsx';const data=${JSON.stringify(data)};function Fixture(){const [messages,setMessages]=React.useState([]);const thread={enabled:true,messages,addDraft:async(fields,body)=>{window.lastDraft={fields,body};const claim=data.certify.claims.find(c=>c.field_path===fields[0]);setMessages(prev=>[...prev,{id:'draft',author_role:'cd',claim_ids:[claim.claim_id],field_paths:fields,bio_version:2,body}]);},editDraft:async()=>{},dropDraft:async()=>setMessages([]),send:async()=>{}};return <CertifyReview data={data} thread={thread} onBack={()=>{}} onReload={()=>{}} onSubmit={async body=>{window.lastReview=body;return {status:'pending_lead_review'};}}/>}createRoot(document.getElementById('root')).render(<Fixture/>);`);
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const errors = [];page.on('pageerror',e=>errors.push(e.message));
  for (const width of [1440,1280,1180]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}/${directory}/index.html`);
    await page.getByRole('button',{name:'Start review',exact:true}).click();
    await page.getByRole('button',{name:'Positioning',exact:false}).first().click();
    const columns = await page.locator('.certify-claim-columns').evaluate(el=>[...el.children].map(c=>{const r=c.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}));
    assert.ok(columns.every(c=>c.width>=260 && c.right<=width),`${width}px columns too narrow/out of bounds: ${JSON.stringify(columns)}`);
    assert.ok(columns[1].x >= columns[0].right-1,'Evidence must stay beside its claim on the laptop');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.getByRole('button',{name:'Submit human review',exact:true}).isDisabled(),true);
    await page.locator('.certify-claim-card').focus();await page.keyboard.press('a');

    assert.match(await page.getByLabel('Question',{exact:true}).inputValue(),/positioning/);
    await page.keyboard.press('Escape');
    await page.getByLabel('Question',{exact:true}).waitFor({state:'detached'});
    await page.locator('.certify-claim-card').focus();await page.keyboard.press('a');
    await page.getByRole('button',{name:'Add to S3 drafts',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.lastDraft.fields),['identity.positioning']);
    assert.ok(await page.getByText('Asked',{exact:false}).count());
    assert.equal(await page.getByRole('button',{name:'Submit human review',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Remove',exact:true}).click();
    await page.locator('.certify-claim-card').focus();await page.keyboard.press('f');
    await page.getByLabel('Value',{exact:true}).fill('Joy made tangible');
    await page.getByRole('button',{name:'Save fix',exact:true}).click();
    await page.getByRole('button',{name:'Positioning',exact:false}).first().click();
    assert.match(await page.locator('.certify-claim-value').innerText(),/Joy made tangible/);
    await page.getByRole('button',{name:/^Fix/}).focus();await page.keyboard.press('Enter');
    await page.getByLabel('Value',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.certify-claim-card').focus();await page.keyboard.press('Enter');
    // Re-confirming a fix must retain the reviewed value and its patch.
    await page.getByRole('button',{name:'Positioning',exact:false}).first().click();
    assert.match(await page.locator('.certify-claim-value').innerText(),/Joy made tangible/);
    for (let i=0;i<data.certify.claims.length;i++) {
      await page.locator('.certify-claim-card').focus();await page.keyboard.press('Enter');
    }
    for (const c of DEFAULT_RUBRIC.criteria.filter(c=>c.source==='human')) await page.getByLabel(`Score ${c.id}`,{exact:true}).selectOption('4');
    assert.equal(await page.getByRole('button',{name:'Submit human review',exact:true}).isEnabled(),true);
    await page.getByRole('button',{name:'Submit human review',exact:true}).click();
    const review = await page.evaluate(()=>window.lastReview);
    assert.equal(review.claimReview.bio_version,2);assert.equal(review.bioPatch.identity.positioning,'Joy made tangible');
    assert.equal(Object.keys(review.claimReview.decisions).length,data.certify.claims.length);
    assert.match(await page.locator('.certify-announcement').innerText(),/second human review/);
    console.log(`PASS ${width}px: side-by-side evidence, keyboard Confirm/Fix/Ask, S3 prefill, locked seal, full human review submission`);
  }
  assert.deepEqual(errors,[]);
} finally {
  await browser?.close();await vite.close();await rm(directory,{recursive:true,force:true});
}
