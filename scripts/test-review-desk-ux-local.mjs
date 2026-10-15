import {reviewComponents} from '../src/lib/review-output.js';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const config=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));assert.equal(config.API_URL,'http://127.0.0.1:54321');
const statePath='.mvp-local/certify-ux-session.json',run=JSON.parse(await readFile(statePath));
const sb=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const value=async q=>{const {data,error}=await q;if(error)throw Error(error.message);return data;};
const sources=await value(sb.from('bio_sources').select('raw_ref,signals').eq('brand_id',run.brandId));
const images=sources.filter(s=>s.signals?.mime?.startsWith('image/')&&s.raw_ref&&!s.raw_ref.startsWith('http'));
const urls=await Promise.all(images.slice(0,2).map(async s=>(await value(sb.storage.from('bio-sources').createSignedUrl(s.raw_ref,3600))).signedUrl));assert.ok(urls.length===2);
const title='Cake Me · local component review';
if(!run.outputId){
 const brief=await value(sb.from('briefs').insert({brand_id:run.brandId,title,type:'one_off',mode:'auto',status:'active',payload:{request:'Synthetic component-editing test; no provider used.'}}).select('id').single());
 const spec=(await value(sb.from('specs').select('specialist_id,version').eq('active',true).limit(1)))[0];
 const r=await value(sb.from('runs').insert({brief_id:brief.id,specialist_id:spec.specialist_id,spec_version:spec.version,bio_version:3,status:'completed'}).select('id').single());
 const body={items:[{copy:{headline:'Today deserves a cheesecake 💛',body:'Made for moments worth sharing.',cta:'Find your cake'},image:{asset_url:urls[0]}},{html:'<!doctype html><html><body style="background:#fff9ed;padding:32px;font:20px Georgia;color:#231f20"><h1>Today deserves a cheesecake 💛</h1><p>Share a little happiness.</p><a href="https://thecake-me.com">Find your cake</a></body></html>'}],internal:{debug:'MUST_NOT_APPEAR'}};
 const output=await value(sb.from('outputs').insert({run_id:r.id,brief_id:brief.id,kind:'task',body,status:'qa_passed',workflow_status:'draft'}).select('id').single());run.outputId=output.id;await writeFile(statePath,JSON.stringify(run),{mode:0o600});
}
const initial=await value(sb.from('outputs').select('body').eq('id',run.outputId).single());const priorEdits=initial.body.component_edits?.length||0;const copyPath=reviewComponents(initial.body).find(c=>c.type==='copy').path;
const proof='docs/brandos/test-runs/2026-10-15/certify-ux';await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const errors=[],shots=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(({session,brand})=>{if(window.top!==window)return;localStorage.setItem('ci_sb_session',JSON.stringify(session));localStorage.setItem('ci_current_brand_id',brand);localStorage.setItem('locale','en');},{session:run.sessions.cd,brand:run.brandId});
 async function saveReplacement(){const response=page.waitForResponse(r=>r.url().endsWith(`/api/outputs/${run.outputId}`)&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Save replacement',exact:true}).click();const res=await response;assert.ok(res.ok(),await res.text());await page.locator('section[aria-label="Selected output"] form').waitFor({state:'detached'});}
 const locale=async lang=>page.evaluate(async l=>(await import('/src/lib/i18n.js')).setLocale(l),lang);
 async function shot(name){for(const lang of ['en','es','ar']){await locale(lang);for(const width of [1280,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${proof}/${name}-${lang}-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);shots.push(`${name}-${lang}-${width}.png`);}}await locale('en');}
 await page.goto('http://127.0.0.1:5198/#/team-review');await page.getByRole('button',{name:/^All ·/}).click();await page.getByRole('button',{name:new RegExp(title)}).first().click();await page.locator('iframe[title^="Email"]').waitFor();assert.equal(await page.getByText('MUST_NOT_APPEAR').count(),0);assert.ok(await page.locator('textarea').count()<=1,'No JSON editor appears in component review');await shot('review-desk-rendered');
 await page.getByRole('button',{name:'Replace',exact:true}).first().click();await page.getByLabel('Replacement content',{exact:true}).fill('A small moment, made sweeter.');await shot('component-replacement');await saveReplacement();await page.getByText('A small moment, made sweeter.',{exact:true}).first().waitFor();
 // Edit image and email independently; each request uses the existing authenticated API.
 const imageCard=page.locator('article').filter({has:page.locator('img')}).last();await imageCard.getByRole('button',{name:'Replace',exact:true}).click();await page.getByLabel('Replacement image URL',{exact:true}).fill(urls[1]);await saveReplacement();await page.getByText('Replacement saved',{exact:true}).waitFor();
 const emailCard=page.locator('article').filter({has:page.locator('iframe')}).last();await emailCard.getByRole('button',{name:'Replace',exact:true}).click();await page.getByLabel('Replacement content',{exact:true}).fill('<!doctype html><html><body><h1>A little happiness, ready to share.</h1><p>Cake Me local email replacement test.</p></body></html>');await saveReplacement();await page.getByText('Replacement saved',{exact:true}).waitFor();
 const saved=await value(sb.from('outputs').select('body').eq('id',run.outputId).single());assert.equal(saved.body.component_edits.length,priorEdits+3);assert.equal(copyPath.reduce((v,k)=>v[k],saved.body),'A small moment, made sweeter.');assert.equal(saved.body.items[0].image.asset_url,urls[1]);assert.match(saved.body.items[1].html,/A little happiness/);await shot('component-replacements-saved');
 await page.goto('http://127.0.0.1:5198/#/team');await page.getByText('Brand drift check',{exact:true}).first().waitFor();assert.equal(await page.getByText('drift_check',{exact:true}).count(),0);await shot('brand-review-queue');
 assert.deepEqual(errors,[]);await writeFile(`${proof}/review-desk-walkthrough.json`,JSON.stringify({outputId:run.outputId,fixture:'Synthetic local copy/image/email components, real auth and API replacement with persisted audit',componentEdits:3,screenshots:shots,errors},null,2)+'\n');console.log(`PASS rendered review desk:3 replacements persisted;${shots.length} screenshots, no page errors.`);
}finally{await browser.close();}
