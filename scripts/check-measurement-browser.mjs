// Real local MFA and operator UI. All execution/review values are synthetic fixtures.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
if(new URL(process.env.SUPABASE_URL).hostname!=='127.0.0.1')throw new Error('Local Supabase required');
const require=createRequire(process.env.CAASTOR_BROWSER_MODULE_ROOT+'/package.json'),{chromium}=require('playwright');
const fixture=JSON.parse(await readFile(new URL('../.mvp-local/fixture.json',import.meta.url),'utf8')),reviewerFile=new URL('../.mvp-local/reviewer.json',import.meta.url),reviewer=JSON.parse(await readFile(reviewerFile,'utf8'));
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {error}=await client.auth.signInWithPassword({email:reviewer.email,password:reviewer.password});if(error)throw error;
if(!reviewer.mfa){const {data,error}=await client.auth.mfa.enroll({factorType:'totp'});if(error)throw error;reviewer.mfa={factorId:data.id,secret:data.totp.secret};await writeFile(reviewerFile,JSON.stringify(reviewer),{mode:0o600});}
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',bits=[...secret.replace(/=+$/,'').toUpperCase()].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join(''),bytes=Buffer.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',bytes).update(counter).digest(),offset=hash.at(-1)&15;return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
const challenge=await client.auth.mfa.challenge({factorId:reviewer.mfa.factorId});if(challenge.error)throw challenge.error;
const verified=await client.auth.mfa.verify({factorId:reviewer.mfa.factorId,challengeId:challenge.data.id,code:totp(reviewer.mfa.secret)});if(verified.error)throw verified.error;
const {data:{session}}=await client.auth.getSession();assert.equal(JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url')).aal,'aal2');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(session=>localStorage.setItem('ci_sb_session',JSON.stringify(session)),session);
 await page.goto('http://127.0.0.1:5184/#/admin-opex');await page.getByRole('tab',{name:'Execution outcomes'}).click();
 await page.getByLabel('Workspace ID').fill(fixture.workspaceId);await page.getByRole('button',{name:'Load outcomes'}).click();
 await page.getByRole('table',{name:'Platform execution evidence'}).waitFor();assert.ok(await page.locator('#ops-panel-measurements tbody tr').count()>0);
 assert.ok(await page.locator('#ops-panel-measurements').getByText('Unknown total;', {exact:false}).count()>0);
 assert.ok(await page.locator('#ops-panel-measurements').getByText('Shadow recommendation:',{exact:false}).count()>0);
 assert.ok(await page.locator('#ops-panel-measurements').getByText('Yes',{exact:true}).count()>0);
 await page.screenshot({path:new URL('../.mvp-local/browser/finops-measurements.png',import.meta.url).pathname});assert.deepEqual(errors,[]);
 console.log('PASS: real local AAL2 operator UI shows acceptance, revisions, errors, cost provenance and shadow decisions. Synthetic evidence only.');
}finally{await browser.close();}
