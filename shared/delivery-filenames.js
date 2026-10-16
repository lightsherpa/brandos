import {deliveryCopy} from '../src/locales/grouped-deliverables-copy.js';

const clean = (value,fallback) => String(value||'').normalize('NFC')
 .replace(/[^\p{L}\p{N}\s_-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,80)||fallback;
export function deliveryFilename(brief,piece,locale='en',pieces=[]) {
 const copy=deliveryCopy(locale);
 const number=pieces.filter(p=>p.type===piece.type).length>1?` ${piece.index+1}`:'';
 return `${clean(brief.title,copy.brief)} - ${clean(copy[piece.type],copy.legacy)}${number}.html`;
}
export function deliveryArchiveName(brief,piece,locale='en',pieces=[]) {
 return piece?deliveryFilename(brief,piece,locale,pieces).replace(/\.html$/,'.zip'):
  `${clean(brief.title,deliveryCopy(locale).brief)} - ${deliveryCopy(locale).delivery}.zip`;
}
export function attachmentHeader(filename) {
 const ascii=filename.normalize('NFKD').replace(/[^\x20-\x7e]/g,'').replace(/["\\]/g,'')||'Delivery.zip';
 const encoded=encodeURIComponent(filename).replace(/['()*]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);
 return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
