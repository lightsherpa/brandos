// Resolve a certified Google Fonts selection to the exact public font faces.
// Runtime projection only: no BIO writes, substitutions or client-provided URLs.
import {createHash} from 'node:crypto';
import {GOOGLE_FONTS} from '../lib/brand-foundation.js';
const cache=new Map();
const MAX_CSS_BYTES=128*1024;
export function googleFontRequest(font) {
 if(font.provider!=='google'||!GOOGLE_FONTS.includes(font.family))throw new Error('Unsupported certified Google Font');
 const weights=[...new Set((Array.isArray(font.weights)?font.weights:[font.weight||'400']).map(String))].sort((a,b)=>Number(a)-Number(b));
 if(!weights.length||weights.some(w=>!/^[1-9]00$/.test(w)))throw new Error('Unsupported certified Google Font weight');
 const style=font.style||'normal';if(!['normal','italic'].includes(style))throw new Error('Unsupported certified Google Font style');
 const family=encodeURIComponent(font.family).replace(/%20/g,'+');
 return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${weights.map(w=>`${style==='italic'?1:0},${w}`).join(';')}&display=block`;
}
export function parseGoogleFontFaces(css,font) {
 const faces=[];
 for(const match of String(css).matchAll(/@font-face\s*\{([^}]+)\}/g)){
  const block=match[1];const property=name=>block.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`,'i'))?.[1]?.trim();
  const family=(property('font-family')||'').replace(/^['"]|['"]$/g,'');
  const weight=property('font-weight'),style=property('font-style');
  const url=property('src')?.match(/url\(['"]?([^'"\s)]+)['"]?\)/)?.[1];
  const unicode_range=property('unicode-range');
  let allowed=false;try{const u=new URL(url);allowed=u.protocol==='https:'&&u.hostname==='fonts.gstatic.com'&&!u.username&&!u.password&&!u.hash&&/^\/s\/[a-z0-9/_.-]+$/i.test(u.pathname);}catch{}
  if(family!==font.family||!allowed||!/^([1-9]00)( [1-9]00)?$/.test(weight||'')||!['normal','italic'].includes(style))throw new Error('Invalid Google Font face response');
  if(unicode_range&&!/^U\+[0-9A-F?]+(?:-[0-9A-F]+)?(?:\s*,\s*U\+[0-9A-F?]+(?:-[0-9A-F]+)?)*$/i.test(unicode_range))throw new Error('Invalid Google Font unicode range');
  faces.push({family,url,weight,style,...(unicode_range?{unicode_range}:{}),provider:'google',sourceId:`google-font:${font.family}:${createHash('sha256').update(url).digest('hex').slice(0,16)}`,
   license:'open_source',license_reference:`https://fonts.google.com/specimen/${encodeURIComponent(font.family).replace(/%20/g,'+')}/about`,rights_confirmed:true});
 }
 if(!faces.length)throw new Error('Certified Google Font unavailable');
 const requested=(Array.isArray(font.weights)?font.weights:[font.weight||'400']).map(Number),style=font.style||'normal';
 if(requested.some(w=>!faces.some(f=>{const [lo,hi=lo]=f.weight.split(' ').map(Number);return f.style===style&&w>=lo&&w<=hi;})))throw new Error('Certified Google Font style unavailable');
 return faces;
}
async function loadFaces(font,{fetchCss=fetch}={}) {
 const url=googleFontRequest(font);
 const response=await fetchCss(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0'}});
 if(!response.ok)throw new Error('Certified Google Font stylesheet unavailable');
 if(Number(response.headers.get('content-length'))>MAX_CSS_BYTES)throw new Error('Google Font stylesheet too large');
 const reader=response.body.getReader();const chunks=[];let size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_CSS_BYTES)throw new Error('Google Font stylesheet too large');chunks.push(Buffer.from(value));}}
 finally{await reader.cancel();}
 return parseGoogleFontFaces(Buffer.concat(chunks).toString('utf8'),font);
}
export async function hydrateGoogleFontAssets(layer1,{fetchCss,cacheEnabled=true}={}) {
 const requests=layer1.google_fonts||[];
 const resolved=await Promise.all(requests.map(async font=>{
  const key=googleFontRequest(font);const prior=cache.get(key);
  if(cacheEnabled&&prior&&prior.expires>Date.now())return prior.promise;
  const promise=loadFaces(font,{fetchCss});
  if(cacheEnabled){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{expires:Date.now()+3600000,promise});promise.catch(()=>cache.delete(key));}
  return promise;
 }));
 return {...layer1,font_assets:[...(layer1.font_assets||[]),...resolved.flat()]};
}
