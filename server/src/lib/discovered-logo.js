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

/* Inline header SVGs are never stored or certified as SVG. They are rasterized
   to PNG (sharp, librsvg: no scripts, no external fetches; safeLogoSvg already
   rejects active/external content) and stored as a brand bio_source, so the
   foundation rule only ever counts stored PNG logos (sourceId). */
export const DISCOVERED_LOGO_WIDTH = 1024;
export async function rasterizeSvgLogo(svg) {
 if(typeof svg!=='string'||Buffer.byteLength(svg)>MAX_UPLOAD_BYTES||!safeLogoSvg(svg))return null;
 try{
  const {default:sharp}=await import('sharp');
  const png=await sharp(Buffer.from(svg),{density:300,limitInputPixels:50_000_000,failOn:'error'})
   .resize({width:DISCOVERED_LOGO_WIDTH,fit:'inside'}).png().toBuffer();
  const meta=await sharp(png).metadata();
  return meta.format==='png'&&meta.width&&meta.height&&png.length<=MAX_UPLOAD_BYTES?png:null;
 }catch{return null;}
}
export function inlineSvgOf(logo) {
 return typeof logo?.url==='string'&&logo.url.startsWith('data:image/svg+xml,')?decodeURIComponent(logo.url.slice('data:image/svg+xml,'.length)):null;
}
// Returns the logo to put in visual.logo: stored PNG {sourceId,...} for inline SVG,
// the original for URL logos, null if the SVG cannot be rasterized.
// Rights are NOT confirmed: an owner must confirm before certification (validateFoundationAssets).
export async function storeDiscoveredLogo({db,brandId,workspaceId,logo}) {
 const svg=inlineSvgOf(logo);
 if(!svg)return logo||null;
 const png=await rasterizeSvgLogo(svg);
 if(!png)return null;
 const {createHash,randomUUID}=await import('node:crypto');
 const name=`discovered-logo-${createHash('sha256').update(png).digest('hex').slice(0,12)}.png`;
 const out=id=>({sourceId:id,source:`${logo.source||'header SVG'} (rasterized PNG)`,conf:logo.conf??90});
 // Idempotent across Inngest step retries and re-discoveries of the same artwork.
 const {data:existing,error:findErr}=await db.from('bio_sources').select('id').eq('brand_id',brandId).eq('kind','file_upload').eq('bucket','visual').eq('src',name).maybeSingle();
 if(findErr)throw Error(`discovered logo lookup: ${findErr.message}`);
 if(existing)return out(existing.id);
 const objectPath=`${workspaceId}/${brandId}/${randomUUID()}-${name}`;
 const up=await db.storage.from('bio-sources').upload(objectPath,png,{contentType:'image/png',upsert:false});
 if(up.error)throw Error(`discovered logo storage: ${up.error.message}`);
 const {data:row,error}=await db.from('bio_sources').insert({brand_id:brandId,kind:'file_upload',bucket:'visual',src:name,raw_ref:objectPath,
  signals:{ext:'png',mime:'image/png',size:png.length,asset_role:'logo',asset_kind:'logo',logo_variant:'light',purpose:'current',origin:'discovery_inline_svg',rights_confirmed:false}}).select('id').single();
 if(error)throw Error(`discovered logo source: ${error.message}`);
 return out(row.id);
}
