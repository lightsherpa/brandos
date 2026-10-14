// Read certified assets with pinned DNS, bounded bytes, no redirects or credentials.
// Only the configured Supabase Storage origin may use local HTTP.
import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import sharp from 'sharp';
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;
function publicAddress(address) {
 if(isIP(address)===6) return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0|10|20):/i.test(address);
 if(isIP(address)!==4) return false;
 const [a,b]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&[0,168].includes(b))||(a===100&&b>=64&&b<=127)||(a===198&&[18,19,51].includes(b))||(a===203&&b===0));
}
function storageUrl(u, origin) {
 try {const base=new URL(origin);return u.origin===base.origin && /^\/storage\/v1\/object\/(?:sign|public)\/bio-sources\//.test(u.pathname) && !/%(?:2e|2f|5c)/i.test(u.pathname) && !u.pathname.includes('\\');}catch{return false;}
}
export function isAllowedAssetUrl(value,{storageOrigin=process.env.SUPABASE_URL}={}) {
 try {const u=new URL(value);if(u.username||u.password||u.hash)return false;
 if(storageUrl(u,storageOrigin))return ['http:','https:'].includes(u.protocol);
 return u.protocol==='https:' && (!isIP(u.hostname.replace(/^\[|\]$/g,'')) || publicAddress(u.hostname.replace(/^\[|\]$/g,'')));
 }catch{return false;}
}
function detectType(bytes, kind) {
 if(kind==='font') {
 const sig=bytes.subarray(0,4).toString('latin1');
 if(sig==='wOFF')return 'font/woff';if(sig==='wOF2')return 'font/woff2';if(sig==='OTTO')return 'font/otf';if(bytes.subarray(0,4).equals(Buffer.from([0,1,0,0])))return 'font/ttf';
 } else {
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
 if(kind==='logo' && /<svg[\s>]/i.test(bytes.toString('utf8'))) {
 const s=bytes.toString('utf8');
 if(/<!DOCTYPE|<!ENTITY|<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|@import/i.test(s))throw new Error('Asset type unsafe SVG');
 return 'image/svg+xml';
 }
 }
 throw new Error('Asset type unsupported');
}
export async function fetchAsset(value,{storageOrigin=process.env.SUPABASE_URL,maxBytes=MAX_ASSET_BYTES,kind='image',lookup=dnsLookup,timeoutMs=15000}={}) {
 if(!isAllowedAssetUrl(value,{storageOrigin}))throw new Error('Asset URL denied');
 const u=new URL(value);const local=storageUrl(u,storageOrigin);
 const hostname=u.hostname.replace(/^\[|\]$/g,'');
 const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});
 if(!addresses.length||(!local&&addresses.some(a=>!publicAddress(a.address))))throw new Error('Asset private address denied');
 const pinned=addresses[0];
 const bytes=await new Promise((resolve,reject)=>{
 const req=(u.protocol==='https:'?https:http).get(u,{lookup:(_host,_opts,cb)=>_opts?.all ? cb(null,[pinned]) : cb(null,pinned.address,pinned.family)},res=>{
 if(res.statusCode>=300&&res.statusCode<400){res.resume();reject(new Error('Asset redirect denied'));return;}
 if(res.statusCode!==200){res.resume();reject(new Error('Asset fetch failed'));return;}
 if(Number(res.headers['content-length'])>maxBytes){res.destroy();reject(new Error('Asset size exceeded'));return;}
 let total=0;const chunks=[];res.on('data',chunk=>{total+=chunk.length;if(total>maxBytes){res.destroy();reject(new Error('Asset size exceeded'));}else chunks.push(chunk);});res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',()=>reject(new Error('Asset fetch failed')));
 });const deadline=setTimeout(()=>req.destroy(new Error('Asset fetch timeout')),timeoutMs);req.on('close',()=>clearTimeout(deadline));req.setTimeout(timeoutMs,()=>req.destroy(new Error('Asset fetch timeout')));req.on('error',()=>reject(new Error('Asset fetch failed')));
 });
 const type=detectType(bytes,kind);
 if(type.startsWith('image/')&&type!=='image/svg+xml') {
 try {const meta=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();if(!meta.width||!meta.height)throw new Error();}catch{throw new Error('Asset image invalid');}
 }
 return {bytes,type,dataUrl:`data:${type};base64,${bytes.toString('base64')}`};
}
export async function bridgeReferences(urls,options={}) {return Promise.all(urls.map(async url=>(await fetchAsset(url,options)).dataUrl));}
