import {assignEvidenceColourRoles} from './colour-roles.js';
import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import {assertPublicUrl} from './ingest-guards.js';
import {extractPalette,extractFonts,firstRealFamily,normalizeColor} from './extract-visual-deterministic.js';

// Pin the checked public address for the connection; redirects are checked anew.
export async function readPublicStylesheet(url,redirects=0,mimePattern=/text\/css|text\/plain/i){
 const target=new URL(assertPublicUrl(url));
 const addresses=await dns.lookup(target.hostname,{all:true});
 if(!addresses.length)throw new Error('Stylesheet DNS returned no addresses');
 for(const {address} of addresses)assertPublicUrl(`https://${address.includes(':')?'['+address+']':address}/`);
 const chosen=addresses[0];
 return new Promise((resolve,reject)=>{
  const request=(target.protocol==='https:'?https:http).get(target,{family:chosen.family,lookup:(_host,options,cb)=>options.all?cb(null,[chosen]):cb(null,chosen.address,chosen.family),timeout:8000,headers:{Accept:'text/css'}},response=>{
   if([301,302,303,307,308].includes(response.statusCode)){
    response.resume();if(redirects>=2||!response.headers.location)return reject(new Error('Stylesheet redirect limit'));
    readPublicStylesheet(new URL(response.headers.location,target).href,redirects+1,mimePattern).then(resolve,reject);return;
   }
   if(response.statusCode!==200){response.resume();return reject(new Error('Stylesheet request failed'));}
   const mime=String(response.headers['content-type']||'');
   if(!mimePattern.test(mime)){response.resume();return reject(new Error('Unsupported stylesheet content type'));}
   let bytes=0,chunks=[];
   response.on('data',chunk=>{bytes+=chunk.length;if(bytes>1000000){response.destroy(new Error('Stylesheet size limit'));return;}chunks.push(chunk);});
   response.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));response.on('error',reject);
  });
  request.on('timeout',()=>request.destroy(new Error('Stylesheet timeout')));request.on('error',reject);
 });
}

export function stylesheetLinks(html,base){
 const links=[];
 for(const tag of String(html||'').match(/<link\b[^>]*>/gi)||[]){
  if(!/\brel\s*=\s*["'][^"']*stylesheet/i.test(tag))continue;
  const href=tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(href){try{links.push(assertPublicUrl(new URL(href.replace(/&amp;/g,'&'),base).href));}catch{}}
 }
 return [...new Set(links)].sort((a,b)=>stylesheetPriority(b)-stylesheetPriority(a)).slice(0,6);
}
function luminance(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return Math.round((Math.max(x,y)+.05)/(Math.min(x,y)+.05)*100)/100;}
export function stylesheetPriority(url){
 const path=new URL(url).pathname;
 if(/fonts\.googleapis|use\.typekit|\/fonts\/|google-fonts/i.test(url))return 90;
 if(/uploads\/elementor\/css\/post-|brand|custom|global/i.test(path))return 100;
 if(/cookie|consent/i.test(path))return -10;
 return /themes/i.test(path)?20:0;
}
// Framework defaults are not brand evidence merely because a bundle defines them.
const FRAMEWORK_COLORS = new Set(['#0d6efd','#6610f2','#6f42c1','#d63384','#dc3545','#fd7e14','#ffc107','#198754','#20c997','#0dcaf0','#6c757d','#212529','#f8f9fa']);
export function removeFrameworkPalette(css) {
 return css.replace(/--(?:bs|bootstrap|tw)-[\w-]+\s*:[^;{}]+;?/gi,'')
  .replace(/#[0-9a-f]{6}\b/gi, hex => FRAMEWORK_COLORS.has(hex.toLowerCase()) ? 'transparent' : hex);
}
function resolveVariables(css) {
 const variables=new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)].map(m=>[m[1],m[2].trim()]));
 const resolve=(value,seen=new Set())=>value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,(all,key,fallback)=>{
  if(seen.has(key))return fallback||'';
  return resolve(variables.get(key)||fallback||'',new Set([...seen,key]));
 });
 return css.replace(/var\(\s*--[\w-]+\s*(?:,\s*[^()]*)?\)/g,value=>resolve(value));
}
function usagePalette(samples) {
 const weights={logo:12,header:8,button:6,background:4,display:2,body:1},counts=new Map(), evidence=new Map(),brandWeights=new Map();
 for(const sample of samples){
  for(const token of sample.colors||[]){
   if(/rgba\([^)]*,\s*0(?:\.0*)?\s*\)/i.test(token))continue;
   const hex=normalizeColor(token);if(!hex||['#000000','#ffffff','#161616'].includes(hex))continue;
   const weight=(weights[sample.kind]||1)*(sample.kind==='background'?Math.max(1,Math.min(4,Number(sample.area||0)/100000)):1);
   counts.set(hex,(counts.get(hex)||0)+weight);
   evidence.set(hex,[...(evidence.get(hex)||[]),`computed ${sample.kind}: ${token}`].slice(0,8));
   if(['logo','header','button'].includes(sample.kind))brandWeights.set(hex,(brandWeights.get(hex)||0)+weight);
  }
 }
 const weighted=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5);
 // Feed the existing naming/role inference in usage order, not stylesheet frequency.
 return assignEvidenceColourRoles(extractPalette(weighted.map(([hex],i)=>`${hex} `.repeat(6-i)).join('')).map(c=>({...c,evidence:evidence.get(c.hex)||[],brandWeight:brandWeights.get(c.hex)||0,usageStatus:'computed'})));
}
export function paletteWithRoles(css,html=""){
 css=removeFrameworkPalette(css);
 const declarations=[...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)[;}]/g)].map(m=>({property:m[1],value:m[2].trim()}));
 const branded=declarations.filter(d=>/--(?:brand|primary|accent|background)/i.test(d.property));
 const weighted=branded.map(d=>`${d.property}:${d.value};`).join('\n').repeat(10)+css;
 const seen=new Set();
 const classes=new Set([...html.matchAll(/\bclass=["']([^"']+)["']/gi)].flatMap(m=>m[1].split(/\s+/)));
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1].trim(),body:m[2]}));
 return assignEvidenceColourRoles(extractPalette(weighted).map(color=>{
  const evidence=declarations.filter(d=>d.value.toLowerCase().includes(color.hex)).slice(0,8);
  const named=evidence.find(d=>/--.*(?:primary|brand)/i.test(d.property));
  const accent=evidence.find(d=>/--.*(?:accent|highlight|cta)/i.test(d.property));
  const role=named?'primary':accent?'accent':color.role;
  const chosen=['primary','ink','surface'].includes(role)&&seen.has(role)?'accent':role;seen.add(chosen);
  const used=rules.filter(r=>r.body.toLowerCase().includes(color.hex)&&!/@|:root/.test(r.selector)&&(!html||[...r.selector.matchAll(/\.([\w-]+)/g)].some(m=>classes.has(m[1]))||/\b(header|nav|button)\b/.test(r.selector)));
  const semantic=used.filter(r=>/logo|topbar|header|nav|button|\bbtn\b/i.test(r.selector));
  return {...color,role:chosen,roleStatus:'inferred',usageStatus:'declared-not-computed',brandWeight:named?100:semantic.length*8,evidence:[...semantic,...used].slice(0,4).map(r=>`${r.selector.slice(0,160)}: ${color.hex}`).concat(evidence.slice(0,2).map(d=>`${d.property}: ${d.value}`))};
 }));
}
export async function resolveVisualStyles({html,url,read=readPublicStylesheet,computedSamples=[]}){
 const sheets=[],failures=[],queue=stylesheetLinks(html,url),seen=new Set();let total=0;
 while(queue.length&&seen.size<6){
  const href=queue.shift();if(seen.has(href))continue;seen.add(href);
  try{
   const css=await read(href);total+=Buffer.byteLength(css);if(total>3000000)throw new Error('Combined stylesheet limit');
   sheets.push({url:href,css});
   for(const match of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)){try{queue.push(assertPublicUrl(new URL(match[1],href).href));}catch{}}
  }catch{failures.push(href);}
 }
 const inline=[...String(html||'').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).filter(css=>!/(?:cdc-cookie|cookie-consent)/i.test(css)).join('\n');
 const inlineAttributes=[...String(html||'').matchAll(/\bstyle=["']([^"']+)["']/gi)].map(m=>`.inline{${m[1]}}`).join('\n');
 const prioritySheets=sheets.filter(s=>stylesheetPriority(s.url)>=90);
 const css=resolveVariables((prioritySheets.length?prioritySheets:sheets).filter(s=>!/bootstrap|tailwind/i.test(s.url)).map(s=>s.css).join('\n')+'\n'+inline+'\n'+inlineAttributes);
 // Literal declarations on content selectors outrank unused builder defaults.
 const used=[];
 for(const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(/@font-face/.test(rule[1]))continue;
  const family=rule[2].match(/(?:^|;)\s*font-family\s*:\s*([^;}]+)/i)?.[1];
  const realFamily=firstRealFamily(family);
  if(!realFamily)continue;
  used.push({kind:/heading|headline|hero|display|h[1-6]\b/i.test(rule[1])?'Display':'Body',family:realFamily,sourceProperty:'font-family',selector:rule[1].trim().slice(0,160)});
 }
 const declared=[...css.matchAll(/(--[\w-]*font-family)\s*:\s*["']([^"']+)["']/gi)].filter(m=>!m[1].startsWith('--e-global-typography')).map(m=>({kind:/primary|heading|display/i.test(m[1])?'Display':'Body',family:m[2],sourceProperty:m[1]}));
 const computedFonts=computedSamples.map(sample=>({kind:sample.kind==='display'?'Display':'Body',family:firstRealFamily(sample.fontFamily),usageStatus:'computed'})).filter(f=>f.family).sort((a,b)=>(a.kind==='Display'?0:1)-(b.kind==='Display'?0:1));
 const fonts=[...computedFonts,...used,...declared,...extractFonts(css+'\n'+sheets.map(s=>(s.css.match(/@font-face\s*\{[^{}]*\}/gi)||[]).join('\n')).join('\n'))].filter(f=>firstRealFamily(f.family));
 const observedPalette=usagePalette(computedSamples);
 const declaredPalette=paletteWithRoles(css,html);
 const primary=observedPalette.find(c=>c.role==='primary')||declaredPalette.find(c=>c.role==='primary');
 const seenRoles=new Set();
 const palette=[...(primary?[primary]:[]),...observedPalette,...declaredPalette].filter((c,i,all)=>all.findIndex(x=>x.hex===c.hex)===i).slice(0,5).map(c=>{
  let role=c===primary?'primary':c.role==='primary'?'accent':c.role;
  if(['primary','ink','surface'].includes(role)){if(seenRoles.has(role))role='accent';else seenRoles.add(role);}
  return {...c,role};
 });
 const type=fonts.filter((f,i)=>fonts.findIndex(x=>x.family.toLowerCase()===f.family.toLowerCase())===i).slice(0,4).map(f=>({...f,usageStatus:f.usageStatus||'declared-not-computed'}));
 const contrastPairs=palette.flatMap((a,i)=>palette.slice(i+1).map(b=>({foreground:a.hex,background:b.hex,ratio:contrastRatio(a.hex,b.hex),normalTextAA:contrastRatio(a.hex,b.hex)>=4.5})));
 return {palette,type,contrastPairs,stylesheets:sheets.map(({url})=>url),unreadableStylesheets:failures,method:computedSamples.length?'computed-styles-and-css':'html-and-linked-css-declarations',computed:computedSamples.length>0};
}
