// Portable read-only replay: actual renderer, embedded saved records and font.
// No Auth, API, provider, stylesheet or network dependency in the output file.
import {readFile,writeFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
process.env.VITE_SUPABASE_URL='http://127.0.0.1:57421';process.env.VITE_SUPABASE_ANON_KEY='public-replay-placeholder';
globalThis.window={};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 await server.ssrLoadModule('/src/portal-shared.jsx');
 const {BioReviewSection}=await server.ssrLoadModule('/src/portal-discovery.jsx');
 const sections={identity:'Essence',positioning:'Positioning & competition',audience:'Audience',voice:'Voice',visual:'Visual identity',strategic:'Do & don’t'};
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panes=[];
 for(const name of ['demo','cake-me','geoking']){
  const value=JSON.parse(await readFile(`public/demo/bio/${name}.json`,'utf8'));
  const body=value.unavailable?'<p role="alert">Source retrieval failed. No BIO was generated. Add readable public sources or brand materials.</p>':Object.entries(sections).map(([section,label])=>`<section><h2>${label}</h2><p class="state">${value.bio.certified?'Synthetic certification fixture':'Inferred — pending review'}</p>${renderToStaticMarkup(React.createElement(BioReviewSection,{payload:value.bio.payload,section}))}</section>`).join('');
  panes.push(`<article id="${name}" ${name==='demo'?'':'hidden'}><header><small>Brand Book · stored replay ${value.bio?'· BIO v'+value.bio.version:''}</small><h1>${escape(value.brandName)}</h1><p>${name==='demo'?'Synthetic demo: Owner review, director fixture review and acceptance passed.':name==='cake-me'?'Saved live result. This BIO has not received Owner or Creative Director approval.':'Retrieval failure preserved; no invented BIO.'}</p></header>${body}</article>`);
 }
 const font=(await readFile('public/caastor/assets/fonts/ibm-plex-sans-arabic-400.woff2')).toString('base64');
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BrandOS · BIO replay</title><style>@font-face{font-family:Plex;src:url(data:font/woff2;base64,${font}) format('woff2')}*{box-sizing:border-box}[hidden]{display:none!important}:root{--c-ink:#222a30;--c-dim:#66717b;--c-faint:#66717b;--c-bg:#fff;--c-line:#d8dee2;--c-line-2:#d8dee2;--font-sans:Plex,sans-serif;--font-mono:Plex,monospace;--green-600:#287250;--pink-500:#8f4e58;--orange-600:#8b6526}body{margin:0;background:#f4f5f2;color:var(--c-ink);font:15px/1.6 Plex,sans-serif}main{max-width:1050px;margin:auto;padding:36px 24px}nav{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--c-line);padding:16px 0}button{font:inherit;border:1px solid #ccd3d8;background:transparent;padding:8px 16px;cursor:pointer;color:var(--c-ink)}button[aria-pressed=true]{background:#2457d6;color:white;border-color:#2457d6}header{padding:30px 0;border-bottom:1px solid var(--c-line)}h1{font-size:38px;line-height:1.2;font-weight:400}h2{font-weight:500}section{padding:24px 0;border-bottom:1px solid var(--c-line)}small,.state{font-size:12px;color:var(--c-dim)}.card{background:white;border:1px solid var(--c-line)}.pill{border:1px solid var(--c-line);font-size:11px}.bio-competitive{overflow-wrap:anywhere}@media(max-width:600px){main{padding:16px}h1{font-size:29px}section>div[style*="grid"],section>div>div[style*="grid"]{grid-template-columns:minmax(0,1fr)!important}}</style><main><strong>BrandOS</strong><nav aria-label="Stored BIO runs"><button data-view="demo" aria-pressed="true">Demo bakery</button><button data-view="cake-me" aria-pressed="false">Cake-me · live result</button><button data-view="geoking" aria-pressed="false">Geoking · retrieval failure</button></nav>${panes.join('')}<footer><p class="state">Portable replay · no network or provider calls · October 10, 2026</p></footer></main><script>document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('article').forEach(article=>article.hidden=article.id!==button.dataset.view);document.querySelectorAll('[data-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));}));</script></html>`;
 await writeFile('public/demo/bio/replay.html',html);
 console.log('Portable BIO replay built from actual renderer and saved records.');
}finally{await server.close();}
