import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {extractLogo} from './extract-logo.js';
import {resolveVisualStyles} from './discovery-styles.js';
import {extractFonts} from './extract-visual-deterministic.js';
import {COMPUTED_STYLE_SCRIPT,computedStyleSamples} from './discovery-computed-styles.js';
import {collectDiscoveryVisuals} from './discovery-visuals.js';
import {discoveryMarket,readDiscoveryInstagram} from './discovery-source-context.js';
import {generateDiscoveryBrain} from './discovery-intelligence.js';
import {scrape,searchCompetitiveSources} from './firecrawl.js';
import {discoveryReviewReport} from './discovery-review.js';
import {SCORED_PATHS} from './bio-schema.js';

const icons='<link rel="icon" sizes="32x32" href="/favicon.png"><link rel="apple-touch-icon" href="/apple.png"><meta property="og:image" content="/og.jpg">';
test('logo prefers header image or inline SVG, then og:image, then apple icon; small and unknown favicons are rejected',()=>{
 assert.equal(extractLogo(icons+'<header><img class="logo" src="/brand.svg"></header>','https://brand.es').source,'header image');
 assert.equal(extractLogo(icons+'<nav><a class="logo">\n<svg><path fill="#123456"/></svg></a></nav>','https://brand.es').source,'header SVG');
 assert.equal(extractLogo(icons+'<header><a href="/"><img alt="La Más Bonita" data-src="/brand.png"></a></header>','https://brand.es').source,'header image');
 assert.equal(extractLogo(icons,'https://brand.es').source,'og:image');
 assert.equal(extractLogo(icons.replace(/<meta[^>]+>/,''),'https://brand.es').source,'apple-touch-icon');
 for(const sizes of ['', 'sizes="16x16"','sizes="32x32"','sizes="64x32"'])assert.equal(extractLogo(`<link rel="icon" ${sizes} href="/favicon.png">`,'https://brand.es'),null);
 assert.equal(extractLogo('<link rel="icon" sizes="64x64" href="/favicon.png">','https://brand.es').source,'site icon');
});

test('rendered logo/header/button/background usage outranks Bootstrap declaration frequency',async()=>{
 const html='<style>:root{--bs-primary:#0d6efd;--bs-danger:#dc3545;--bs-warning:#ffc107}.btn{color:#0d6efd}</style>'.repeat(40);
 const computedSamples=[{kind:'logo',colors:['rgb(75, 165, 170)'],area:2000},{kind:'header',colors:['#4ba5aa']},{kind:'button',colors:['#4ba5aa']},{kind:'background',colors:['#f2e8d8'],area:900000},{kind:'body',colors:['rgba(0,0,0,0)']}];
 const result=await resolveVisualStyles({html,url:'https://brand.es',computedSamples});
 assert.equal(result.palette[0].hex,'#4ba5aa');assert.ok(result.palette.some(c=>c.hex==='#f2e8d8'));
 assert.ok(!result.palette.some(c=>['#0d6efd','#dc3545','#ffc107'].includes(c.hex)));
 const fallback=await resolveVisualStyles({html:html+'<style>header{color:#4ba5aa}</style>',url:'https://brand.es'});
 assert.deepEqual(fallback.palette.map(c=>c.hex),['#4ba5aa']);
});

test('computed typography resolves nested CSS variables and never saves var() or generic families',async()=>{
 const html='<style>:root{--a:var(--b);--b:"Brand Serif"}h1{font-family:var(--a)}body{font-family:var(--missing),system-ui}p{font-family:cursive}</style>';
 const result=await resolveVisualStyles({html,url:'https://brand.es',computedSamples:[{kind:'display',fontFamily:'"Rendered Brand", sans-serif',colors:[]},{kind:'body',fontFamily:'var(--bad), serif',colors:[]}]});
 assert.equal(result.type[0].family,'Rendered Brand');assert.equal(result.type[0].usageStatus,'computed');
 assert.ok(result.type.some(f=>f.family==='Brand Serif'));
 assert.ok(!result.type.some(f=>/var\(|serif$|system-ui|cursive/i.test(f.family)&&f.family!=='Brand Serif'));
 assert.deepEqual(extractFonts('<style>h1{font-family:var(--unresolved)}body{font-family:serif}</style>'),[]);
});

test('visual scraping requests computed styles and consumes browser results',async()=>{
 const el={getBoundingClientRect:()=>({width:100,height:30}),querySelectorAll:()=>[]};
 const value=vm.runInNewContext(COMPUTED_STYLE_SCRIPT,{document:{querySelectorAll:selector=>selector==='h1,h2,h3'?[el]:[]},getComputedStyle:()=>({fontFamily:'"Resolved Serif", serif',color:'rgb(75,165,170)',backgroundColor:'rgba(0,0,0,0)',display:'block',visibility:'visible'})});
 const page={rawHtml:'<html></html>',actions:{javascriptReturns:[{type:'executeJavascript',value}]}};
 assert.equal(computedStyleSamples(page)[0].fontFamily,'"Resolved Serif", serif');
 const result=await collectDiscoveryVisuals({url:'https://brand.es',scrape:async(_url,options)=>{assert.equal(options.actions[0].script,COMPUTED_STYLE_SCRIPT);return page;},readImagery:async()=>({})});
 assert.equal(result.sources[0].visual.type[0].family,'Resolved Serif');assert.equal(result.sources[0].styles.computed,true);
});

const marketHtml='<html lang="es-ES"><script type="application/ld+json">{"@type":"Restaurant","address":{"addressLocality":"Valencia","addressCountry":"ES"}}</script></html>';
test('competitive research uses site country, city and language in the query and synthesis scope',async()=>{
 const market=discoveryMarket({url:'https://lamasbonita.es',html:marketHtml});
 assert.deepEqual(market,{country:'ES',city:'Valencia',language:'es',countryName:'Spain',languageName:'Spanish'});
 assert.equal(discoveryMarket({url:'https://brand.fr',html:'<html lang="fr">'}).country,'FR');
 assert.equal(discoveryMarket({url:'https://brand.es',metadata:{language:'Spanish'}}).language,'es');
 assert.equal(discoveryMarket({url:'https://brand.es',metadata:{language:'not a locale'}}).language,'');
 assert.equal(discoveryMarket({url:'https://brand.com',html:marketHtml}).country,'ES');
 let called=false;
 const payload=await generateDiscoveryBrain({evidence:'Local bakery',market,interpret:async()=>({identity:{category:'Pastelerías'},audience:{primary:'Vecinos'}}),research:async(query,scope)=>{called=true;assert.match(query,/Valencia Spain Spanish/);assert.equal(scope.country,'ES');return [{url:'https://local.es',markdown:'Valencia bakery'}];},synthesize:async evidence=>{assert.match(evidence,/Only include competitors serving this country and city/);assert.match(evidence,/Valencia/);return {positioning:{}};}});
 assert.ok(called);assert.equal(payload.research.market.city,'Valencia');
});

function provider(t,handler){
 const previousFetch=globalThis.fetch,previousKey=process.env.FIRECRAWL_API_KEY;process.env.FIRECRAWL_API_KEY='test-only';
 globalThis.fetch=async(url,opts)=>String(url).startsWith('https://api.firecrawl.dev/')?handler(url,JSON.parse(opts.body)):new Response('[]',{headers:{'content-type':'application/json'}});
 t.after(()=>{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=previousKey;});
}
test('Firecrawl receives localized search options instead of defaulting to US',async t=>{
 provider(t,async(_url,body)=>{assert.equal(body.country,'ES');assert.equal(body.lang,'es');assert.equal(body.location,'Valencia,Spain');return {ok:true,json:async()=>({success:true,data:{web:[]}})};});
 await searchCompetitiveSources('pastelerías Valencia',discoveryMarket({url:'https://brand.es',html:marketHtml}));
});
test('Firecrawl forwards browser actions to the scrape provider',async t=>{
 provider(t,async(_url,body)=>{assert.deepEqual(body.actions,[{type:'executeJavascript',script:COMPUTED_STYLE_SCRIPT}]);return {ok:true,json:async()=>({success:true,data:{rawHtml:'<html/>'}})};});
 await scrape('https://brand.es',{actions:[{type:'executeJavascript',script:COMPUTED_STYLE_SCRIPT}]});
});

test('linked Instagram profile is fetched once and contributes readable evidence',async()=>{
 const calls=[];
 const result=await readDiscoveryInstagram({instagram:'@lamasbonitavalencia',html:'<a href="https://www.instagram.com/lamasbonitavalencia/?hl=es">Instagram</a>',scrape:async url=>{calls.push(url);return {markdown:'La Más Bonita — cafetería en Valencia',metadata:{statusCode:200}};}});
 assert.deepEqual(calls,['https://www.instagram.com/lamasbonitavalencia/']);assert.equal(result.sources[0].status,'read');assert.match(result.blocks[0],/cafetería en Valencia/);assert.deepEqual(result.failures,[]);
});
test('blocked Instagram is recorded as an unread source, including provider login pages',async()=>{
 for(const response of [null,{markdown:'Log in to Instagram'},{markdown:'# Instagram\nLog In\nPassword\nForgot password?\nSign up'},{markdown:'Brand',metadata:{statusCode:403}}]){
  const result=await readDiscoveryInstagram({markdown:'[Instagram](https://instagram.com/lamasbonitavalencia/)',scrape:async()=>{if(!response)throw Error('403');return response;}});
  assert.equal(result.sources[0].status,'unreadable');assert.ok(result.sources[0].checkedAt);assert.match(result.failures[0],/Instagram could not be read/);assert.deepEqual(result.blocks,[]);
 }
});

test('review confidence gate fails without rights and passes the fully sourced version',()=>{
 const payload={confidence:{}};
 for(const [section,key] of SCORED_PATHS){payload[section]??={};payload[section][key]='recorded';payload.confidence[`${section}.${key}`]={conf:100,source:`source-${section}-${key}`};}
 payload.visual={logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#4ba5aa'}],type:[{kind:'Display',family:'Inter',provider:'google'}]};
 assert.equal(discoveryReviewReport(payload,['logo']).meetsFloor,true);
 const pending=discoveryReviewReport(payload,[]);assert.equal(pending.meetsFloor,false);assert.equal(pending.score,79);
 assert.deepEqual(pending.reasons.map(r=>r.code),['LOGO_RIGHTS_UNCONFIRMED']);
});

test('JSON-LD logo outranks og:image, while header remains first',()=>{
 const structured='<script type="application/ld+json">{"@type":"Organization","logo":"/official-logo.png"}</script>';
 assert.equal(extractLogo(icons+structured,'https://brand.es').source,'Organization.logo');
 assert.equal(extractLogo(icons+structured+'<header><img class="logo" src="/header.png"></header>','https://brand.es').source,'header image');
});
test('country detection prioritizes address, then ccTLD, then text',()=>{
 assert.equal(discoveryMarket({url:'https://brand.fr',html:marketHtml+'Canada Germany'}).country,'ES');
 assert.equal(discoveryMarket({url:'https://brand.fr',evidence:'Exporting to Spain'}).country,'FR');
 assert.equal(discoveryMarket({url:'https://brand.com',evidence:'Valencia, Spain'}).country,'ES');
});
