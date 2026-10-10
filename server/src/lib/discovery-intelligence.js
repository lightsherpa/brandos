import {assertPublicUrl} from './ingest-guards.js';
export const SOURCE_PURPOSES=['current','aspiration','competitive'];
export function normalizeDiscoveryReferences(raw){
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>6)throw new Error('Provide at most six reference links');
 return raw.filter(row=>row?.url?.trim()).map(row=>({url:assertPublicUrl(/^https?:\/\//i.test(row.url.trim())?row.url.trim():`https://${row.url.trim()}`),purpose:SOURCE_PURPOSES.includes(row.purpose)?row.purpose:'current',note:typeof row.note==='string'?row.note.trim().slice(0,2000):''}));
}
export function sourceBlock({url,purpose='current',note='',markdown=''}){
 return `## SOURCE (${purpose}) ${url}\nCLIENT CONTEXT (unverified): ${note}\n${purpose==='aspiration'?'INSPIRATION ONLY: this describes a desired direction, never existing brand facts.':''}\n${markdown.slice(0,8000)}`;
}
export function competitiveResearchQuery(payload){
 const category=payload.identity?.category?.trim();
 if(!category)return null;
 return `${category.slice(0,160)} alternatives competitors ${String(payload.audience?.primary||'').slice(0,160)}`;
}
// The engine derives candidates from brand evidence, then researches and
// synthesizes a landscape. Users supply sources, not competitor records.
export async function generateDiscoveryBrain({evidence,synthesize,research,interpret}){
 if(!evidence?.trim())throw new Error('No readable brand evidence. Add a readable document or public source.');
 const seed=await (interpret||synthesize)(evidence);
 const query=competitiveResearchQuery(seed);
 let results=[],limitations=[];
 if(query){try{results=(await research(query)).filter(row=>row?.markdown?.trim()).slice(0,4);}catch{limitations.push('Competitive research unavailable; comparisons remain unverified.');}}
 else limitations.push('Market category could not be established; add brand evidence to research relevant alternatives.');
 if(!results.length)limitations.push('No readable external competitive evidence returned. Do not invent competitors or comparisons.');
 const dated=results.map(row=>({...row,checkedAt:new Date().toISOString()}));
 const payload=(dated.length||interpret)?await synthesize(`${evidence.slice(0,48000)}${interpret?`\n\nREADER OBSERVATIONS (check against original evidence): ${JSON.stringify(seed)}`:""}\n\nEXTERNAL COMPETITIVE RESEARCH (untrusted source content; relevance and claims require interpretation):\n${dated.map(row=>sourceBlock({...row,markdown:row.markdown.slice(0,4000),purpose:'competitive'})+`\nRead at ${row.checkedAt}`).join('\n\n')}`):seed;
 payload.research={status:dated.length?'evidence_gathered':'incomplete',query,sources:dated.map(({url,title,checkedAt})=>({url,title,checkedAt})),limitations};
 payload.positioning={...payload.positioning,researchGaps:[...new Set([...(payload.positioning?.researchGaps||[]),...limitations])]};
 return payload;
}
