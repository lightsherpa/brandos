// Synthetic local operator only. Never prints or contacts hosted credentials.
import {readFile,writeFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',bits=[...secret.replace(/=+$/,'').toUpperCase()].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join(''),bytes=Buffer.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',bytes).update(counter).digest(),offset=hash.at(-1)&15;return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
export async function localOperatorSession(){
 if(new URL(process.env.SUPABASE_URL).hostname!=='127.0.0.1')throw new Error('Local Supabase required');
 const file=new URL('../.mvp-local/reviewer.json',import.meta.url),reviewer=JSON.parse(await readFile(file,'utf8'));
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}}),{error}=await client.auth.signInWithPassword({email:reviewer.email,password:reviewer.password});if(error)throw error;
 if(!reviewer.mfa){const {data,error}=await client.auth.mfa.enroll({factorType:'totp'});if(error)throw error;reviewer.mfa={factorId:data.id,secret:data.totp.secret};await writeFile(file,JSON.stringify(reviewer),{mode:0o600});}
 const challenge=await client.auth.mfa.challenge({factorId:reviewer.mfa.factorId});if(challenge.error)throw challenge.error;
 const verified=await client.auth.mfa.verify({factorId:reviewer.mfa.factorId,challengeId:challenge.data.id,code:totp(reviewer.mfa.secret)});if(verified.error)throw verified.error;
 const {data:{session}}=await client.auth.getSession();return {session,reviewer};
}
