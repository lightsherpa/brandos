import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {assertPublicUrl, MAX_UPLOAD_BYTES} from './ingest-guards.js';
import {extractLogo, safeLogoSvg} from './extract-logo.js';

// DNS checked and pinned for every hop, including redirects.
export async function headPublicLogo(url, redirects = 0) {
 const target = new URL(assertPublicUrl(url));
 if(target.username || target.password)throw Error('Logo credentials are forbidden');
 const addresses = await dns.lookup(target.hostname, {all:true});
 if(!addresses.length)throw Error('Logo DNS returned no addresses');
 for(const {address} of addresses)assertPublicUrl(`https://${address.includes(':')?'['+address+']':address}/`);
 const chosen = addresses[0];
 return new Promise((resolve,reject)=>{
  const request=(target.protocol==='https:'?https:http).request(target, {
   method:'HEAD', timeout:8000, headers:{Accept:'image/*'}, family:chosen.family,
   lookup:(_host,options,cb)=>options.all?cb(null,[chosen]):cb(null,chosen.address,chosen.family),
  }, response=>{
   response.resume();
   if([301,302,303,307,308].includes(response.statusCode)){
    if(redirects>=2 || !response.headers.location)return reject(Error('Logo redirect limit'));
    headPublicLogo(new URL(response.headers.location,target).href,redirects+1).then(resolve,reject);return;
   }
   resolve({status:response.statusCode,headers:response.headers});
  });
  request.on('timeout',()=>request.destroy(Error('Logo HEAD timeout')));
  request.on('error',reject);request.end();
 });
}

export async function verifyDiscoveredLogo(logo, {head=headPublicLogo} = {}) {
 if(!logo?.url)return null;
 try{
  if(logo.url.startsWith('data:image/svg+xml,')){
   const svg=decodeURIComponent(logo.url.slice('data:image/svg+xml,'.length));
   return Buffer.byteLength(svg)<=MAX_UPLOAD_BYTES && safeLogoSvg(svg)?logo:null;
  }
  const url=assertPublicUrl(logo.url);
  const result=await head(url);
  const mime=String(result.headers['content-type'] || '').toLowerCase();
  const length=String(result.headers['content-length'] || '');
  if(result.status!==200 || !/^image\//.test(mime) || !/^\d+$/.test(length))return null;
  const size=Number(length);
  return size>0 && size<=MAX_UPLOAD_BYTES?logo:null;
 }catch{return null;}
}
export async function discoverLogo(html,url,options) {
 return verifyDiscoveredLogo(extractLogo(html,url),options);
}
