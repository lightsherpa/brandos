import {isReadableSource} from './firecrawl.js';
import {sourceBlock} from './discovery-intelligence.js';

const regionNames = new Intl.DisplayNames(['en'], {type:'region'});
const languageNames = new Intl.DisplayNames(['en'], {type:'language'});
const COUNTRY_ALIASES = {spain:'ES',españa:'ES',espana:'ES',france:'FR',francia:'FR',germany:'DE',deutschland:'DE',italy:'IT',italia:'IT',portugal:'PT','united kingdom':'GB','united states':'US',méxico:'MX',mexico:'MX'};
const LANGUAGE_ALIASES={spanish:'es',español:'es',english:'en',french:'fr',german:'de',portuguese:'pt',italian:'it'};
function displayName(names,code){try{return code?names.of(code):'';}catch{return '';}}
function countryCode(value) {
 const text=String(typeof value==='object'?value?.name||value?.['@id']||'':value||'').trim();
 if(/^[a-z]{2}$/i.test(text))return text.toUpperCase();
 return COUNTRY_ALIASES[text.toLowerCase()]||'';
}
export function discoveryMarket({url,html='',metadata={},evidence=''}={}) {
 let address={};
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{
   const walk=value=>{
    if(!value||typeof value!=='object')return;
    if(value.address && typeof value.address==='object')address={...address,...value.address};
    if([].concat(value['@type']||[]).includes('PostalAddress'))address={...address,...value};
    for(const child of Object.values(value))walk(child);
   };walk(JSON.parse(match[1]));
  }catch{}
 }
 let tld='';try{tld=new URL(url).hostname.split('.').at(-1);}catch{}
 const tldCountry=/^[a-z]{2}$/i.test(tld)?(tld==='uk'?'GB':tld.toUpperCase()):'';
 const text=html.replace(/<[^>]*>/g,' ')+' '+evidence;
 const namedCountry=Object.keys(COUNTRY_ALIASES).find(name=>new RegExp(`\\b${name}\\b`,'i').test(text));
 const country=countryCode(address.addressCountry)||tldCountry||(namedCountry?COUNTRY_ALIASES[namedCountry]:'');
 const rawLanguage=(html.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]||metadata.language||'').split(/[-_]/)[0].toLowerCase();
 const language=LANGUAGE_ALIASES[rawLanguage]||(/^[a-z]{2,3}$/.test(rawLanguage)?rawLanguage:'');
 const city=String(address.addressLocality||html.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)/i)?.[1]||text.match(/\b\d{5}\s+([\p{L} .'-]+?)(?:[,\n]|\s+(?:España|Spain|Portugal|France))/u)?.[1]||'').trim();
 return {country,city,language,countryName:displayName(regionNames,country),languageName:displayName(languageNames,language)};
}
export function instagramProfile(raw) {
 const text=String(raw||'').trim();if(!text)return null;
 try{
  const url=new URL(/^https?:\/\//i.test(text)?text:`https://www.instagram.com/${text.replace(/^@/,'')}/`);
  if(!/^(?:www\.)?instagram\.com$/i.test(url.hostname))return null;
  const handle=url.pathname.split('/').filter(Boolean)[0];
  if(!handle||!/^[\w.]{1,30}$/.test(handle)||['p','reel','reels','stories','accounts','explore','share'].includes(handle))return null;
  return `https://www.instagram.com/${handle}/`;
 }catch{return null;}
}
export async function readDiscoveryInstagram({instagram,html='',markdown='',scrape,telemetry={}}) {
 const linked=[...`${html}\n${markdown}`.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>\)]+/gi)].map(m=>instagramProfile(m[0]));
 const urls=[...new Set([instagramProfile(instagram),...linked].filter(Boolean))].slice(0,3);
 const sources=[],blocks=[],failures=[];
 for(const url of urls){
  const source={url,kind:'instagram',purpose:'current',checkedAt:new Date().toISOString(),status:'unreadable'};
  try{
   const page=await scrape(url,{formats:['markdown'],onlyMainContent:false,telemetry});
   const loginOnly=/log\s*in|iniciar sesi[oó]n/i.test(page.markdown||'') && /password|forgot|sign up|contrase[ñn]a/i.test(page.markdown||'') && !/followers|following|posts|seguidores|publicaciones/i.test(page.markdown||'');
   if(loginOnly||!isReadableSource(page)||/log in to (?:continue|instagram)|login required|challenge required|access denied/i.test(page.markdown)||/^\s*(?:#\s*)?(?:Login|Log in|Instagram)\s*$/i.test(page.markdown))throw Error('Profile blocked or unreadable');
   source.status='read';source.markdownChars=page.markdown.length;
   blocks.push(sourceBlock({...source,markdown:page.markdown}));
  }catch(error){if(error?.code==='TEST_BUDGET_EXHAUSTED')throw error;source.reason='Instagram profile blocked or unreadable';failures.push(`Instagram could not be read: ${url}`);}
  sources.push(source);
 }
 return {sources,blocks,failures};
}
