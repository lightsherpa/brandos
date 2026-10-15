// Presentation boundary only. Keep original claim values/tokens for API gates
// and original URLs in resource attributes; never print implementation data.
const SOURCE={en:'Source evidence',es:'Fuente',ar:'مصدر الأدلة'};
export const privateField=key=>/^(id|.*_id|sourceId|sourceIds|raw_ref|.*url|.*path|storage.*|token|.*token|provider|bucket|objectKey|fileKey|evidence_token)$/i.test(key);
export function displayText(value,locale='en'){
 const source=SOURCE[locale]||SOURCE.en;
 return String(value??'')
  .replace(/\bBearer\s+[^\s]+/gi,source)
  .replace(/https?:\/\/[^\s<>"']+/gi,source)
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g,source)
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,source)
  .replace(/(?:[A-Za-z0-9_.%-]+\/)+[A-Za-z0-9_.%-]+(?:\?[^\s]*)?/g,source)
  .replace(/\b(?:token|signature|apikey|authorization|source_?id|raw_ref)\s*[:=]\s*[^\s,;]+/gi,source)
  .replace(/\b[a-f0-9]{32,}\b/gi,source).replace(/\bclient-stated\b/gi,({en:'Brand team',es:'Equipo de marca',ar:'فريق العلامة'}[locale]||'Brand team')).replace(/\bclient edit\b/gi,({en:'Brand team update',es:'Actualización del equipo de marca',ar:'تحديث فريق العلامة'}[locale]||'Brand team update')).trim();
}
export function previewValue(value,locale='en'){
 if(value==null)return '';
 if(Array.isArray(value))return value.map(v=>previewValue(v,locale)).filter(Boolean).join(' · ');
 if(typeof value!=='object')return displayText(value,locale);
 if(value.family)return [displayText(value.family,locale),displayText(value.kind||value.usage||'',locale),value.license==='commercial'?({en:'commercial',es:'comercial',ar:'تجاري'}[locale]||'commercial'):''].filter(Boolean).join(' · ');
 const entries=Object.entries(value).filter(([key])=>!privateField(key)&&!['conf','confidence','weight','weights','style','styles'].includes(key));
 return entries.map(([,v])=>previewValue(v,locale)).filter(Boolean).join(' · ');
}
export const safeHref=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?value:null;}catch{return null;}};
