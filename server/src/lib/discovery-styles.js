import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import {assertPublicUrl} from './ingest-guards.js';
import {extractPalette,extractFonts} from './extract-visual-deterministic.js';

// Pin the checked public address for the connection; redirects are checked anew.
export async function readPublicStylesheet(url,redirects=0){
 const target=new URL(assertPublicUrl(url));
 const addresses=await dns.lookup(target.hostname,{all:true});
 if(!addresses.length)throw new Error('Stylesheet DNS returned no addresses');
 for(const {address} of addresses)assertPublicUrl(`https://${address.includes(':')?'['+address+']':address}/`);
 const chosen=addresses[0];
 return new Promise((resolve,reject)=>{
  const request=(target.protocol==='https:'?https:http).get(target,{family:chosen.family,lookup:(_host,options,cb)=>options.all?cb(null,[chosen]):cb(null,chosen.address,chosen.family),timeout:8000,headers:{Accept:'text/css'}},response=>{
   if([301,302,303,307,308].includes(response.statusCode)){
    response.resume();if(redirects>=2||!response.headers.location)return reject(new Error('Stylesheet redirect limit'));
    readPublicStylesheet(new URL(response.headers.location,target).href,redirects+1).then(resolve,reject);return;
   }
   if(response.statusCode!==200){response.resume();return reject(new Error('Stylesheet request failed'));}
   const mime=String(response.headers['content-type']||'');
   if(!/text\/css|text\/plain/i.test(mime)){response.resume();return reject(new Error('Unsupported stylesheet content type'));}
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
 return [...new Set(links)].slice(0,6);
}
function luminance(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return Math.round((Math.max(x,y)+.05)/(Math.min(x,y)+.05)*100)/100;}
export function paletteWithRoles(css){
 return extractPalette(css).map(color=>{
  const occurrences=[];
  for(const rule of css.match(/[^{}]+\{[^{}]*\}/g)||[]){if(rule.toLowerCase().includes(color.hex))occurrences.push(rule.slice(0,260));}
  const evidence=occurrences.join(' '),rgb=color.hex.slice(1).match(/../g).map(x=>parseInt(x,16));
  const role=/--[^:;]*(?:primary|brand|main)[^:;]*:/i.test(evidence)?'primary':/--[^:;]*(?:accent|highlight|cta)[^:;]*:/i.test(evidence)?'accent':/background(?:-color)?\s*:/i.test(evidence)?'background':Math.max(...rgb)-Math.min(...rgb)<24?'neutral':'accent';
  return {...color,role,roleStatus:'inferred',evidence:occurrences.slice(0,2)};
 });
}
export async function resolveVisualStyles({html,url,read=readPublicStylesheet}){
 const sheets=[],failures=[],queue=stylesheetLinks(html,url),seen=new Set();let total=0;
 while(queue.length&&seen.size<6){
  const href=queue.shift();if(seen.has(href))continue;seen.add(href);
  try{
   const css=await read(href);total+=Buffer.byteLength(css);if(total>3000000)throw new Error('Combined stylesheet limit');
   sheets.push({url:href,css});
   for(const match of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)){try{queue.push(assertPublicUrl(new URL(match[1],href).href));}catch{}}
  }catch{failures.push(href);}
 }
 const css=String(html||'')+'\n'+sheets.map(s=>s.css).join('\n');
 const palette=paletteWithRoles(css),type=extractFonts(css);
 const contrastPairs=palette.flatMap((a,i)=>palette.slice(i+1).map(b=>({foreground:a.hex,background:b.hex,ratio:contrastRatio(a.hex,b.hex),normalTextAA:contrastRatio(a.hex,b.hex)>=4.5})));
 return {palette,type,contrastPairs,stylesheets:sheets.map(({url})=>url),unreadableStylesheets:failures,method:'html-and-linked-css-declarations',computed:false};
}
