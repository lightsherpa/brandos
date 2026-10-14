// Human rights confirmation and immutable version selection for product imagery.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateReferenceConfirmation(body={}) {
 if(!Number.isInteger(body.expectedVersion)||body.expectedVersion<1||!UUID.test(body.requestId||''))return {code:'REFERENCE_REQUEST_INVALID',error:'An exact version and request UUID are required'};
 if(!Array.isArray(body.sourceIds)||!body.sourceIds.length||body.sourceIds.length>12||new Set(body.sourceIds).size!==body.sourceIds.length||body.sourceIds.some(id=>!UUID.test(id)))return {code:'REFERENCE_SOURCES_REQUIRED',error:'Choose between one and twelve distinct uploaded references'};
 if(!['authority','ownsOrLicensed','generationAllowed'].every(key=>body.rights?.[key]===true))return {code:'REFERENCE_RIGHTS_REQUIRED',error:'Confirm authority, ownership or licence, and permission for generation'};
 return null;
}
export function activeReferenceIds(certified=[]) {
 return (Array.isArray(certified)?certified:[]).filter(r=>r?.sourceId&&r.status!=='superseded'&&['canonical','inspiration'].includes(r.role)).map(r=>r.sourceId);
}
export function scopedReferences(loaded=[],certified=[]) {
 const pins=new Map((Array.isArray(certified)?certified:[]).filter(r=>r?.sourceId&&r.status!=='superseded'&&['canonical','inspiration'].includes(r.role)).map(r=>[r.sourceId,r]));
 return (loaded||[]).filter(r=>pins.has(r.id)&&r.url&&r.signals?.rights_confirmed===true).map(r=>({...r,sourceId:r.id,role:pins.get(r.id).role})).sort((a,b)=>Number(a.role!=='canonical')-Number(b.role!=='canonical')).slice(0,3);
}
export function assertReferenceResolution(loaded,certified) {
 const ids=new Set((loaded||[]).filter(r=>r.url&&r.signals?.rights_confirmed===true).map(r=>r.id));
 if(activeReferenceIds(certified).some(id=>!ids.has(id)))throw Object.assign(new Error('A reference pinned to this Brand Core cannot be resolved'),{code:'REFERENCE_UNAVAILABLE',status:409});
}
