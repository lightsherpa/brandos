import { createHash } from 'node:crypto';
import { fetchAsset as safeFetchAsset } from '../lib/reference-bridge.js';
const cssString=value=>String(value).replace(/[^a-zA-Z0-9 _-]/g,'');
export async function embedExportAssets(html,{layer1,imageUrl=null,fetchAsset=safeFetchAsset}={}) {
 const assets=[];let css='';
 if(layer1.logo?.sourceId && !(layer1.font_assets || []).some(f=>f.family===layer1.fonts?.display))throw new Error('Export requires licensed display font');
 const embed=async(url,role,kind,sourceId)=>{const a=await fetchAsset(url,{kind});assets.push({role,sourceId:sourceId||null,type:a.type,bytes:a.bytes.length,sha256:createHash('sha256').update(a.bytes).digest('hex')});return a.dataUrl;};
 if(layer1.logo?.url) {const data=await embed(layer1.logo.url,'logo','logo',layer1.logo.sourceId);html=html.split(layer1.logo.url.replaceAll('&','&amp;')).join(data).split(layer1.logo.url).join(data);}
 if(imageUrl) {const data=await embed(imageUrl,'generated_image','image');html=html.split(imageUrl.replaceAll('&','&amp;')).join(data).split(imageUrl).join(data);}
 for(const f of layer1.font_assets||[]) {
 if(!f.sourceId||!["commercial","open_source","custom","system"].includes(f.license)||!f.license_reference||f.rights_confirmed!==true)throw new Error('Export font must have licensed source evidence');
 const data=await embed(f.url,'font','font',f.sourceId);
 Object.assign(assets.at(-1),{family:f.family,license:f.license,license_reference:f.license_reference,rights_confirmed:true});
 css+=`@font-face{font-family:'${cssString(f.family)}';src:url('${data}');font-style:${f.style === 'italic' ? 'italic' : 'normal'};font-weight:${/^(?:[1-9]00)(?: [1-9]00)?$/.test(String(f.weight)) ? f.weight : '400'};font-display:block;}`;
 }
 html=html.replace('</head>',`<style>${css}</style></head>`);
 return {html,stable:true,assets};
}
// Browser is injected or dynamically loaded by the CLI; no renderer can fetch
// network resources while creating a stable PNG, including CSS font requests.
export async function exportSocialPng(html,{chromium,width=1080,height=1350}={}) {
 if(/(?:src|href)\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(html))throw new Error('PNG requires embedded assets');
 if(!chromium)throw new Error('PNG browser runtime unavailable');
 const browser=await chromium.launch({headless:true,timeout:20000});
 try {const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});await page.route('**/*',route=>route.abort());await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">${html}`,{waitUntil:'load',timeout:15000});
 await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Export fonts timeout')),15000))]);if([...document.fonts].some(f=>f.status==='error'))throw new Error('Export font failed');await Promise.all([...document.images].map(async im=>{if(!im.complete)await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;});if(!im.naturalWidth)throw new Error('Export image failed');}));});
 return await page.screenshot({type:'png',timeout:15000,clip:{x:0,y:0,width,height}});
 }finally{await browser.close();}
}
