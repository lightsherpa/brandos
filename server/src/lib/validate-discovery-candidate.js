// Reject renderer-incompatible candidates before persistence; do not repair evidence.
export function validateDiscoveryCandidate(bio){
 const fail=field=>{throw Object.assign(new Error(`Discovery candidate has invalid field ${field}; no BIO was saved`),{code:'BIO_INVALID_SCHEMA'});};
 for(const key of ['competitors','pointsOfDifference','pointsOfParity','researchGaps'])if(!Array.isArray(bio.positioning?.[key]))fail('positioning.'+key);
 for(const key of ['pointsOfParity','researchGaps'])if(bio.positioning[key].some(x=>typeof x!=='string'))fail('positioning.'+key);
 for(const [i,row] of bio.positioning.competitors.entries()){
  if(!row||typeof row!=='object'||Array.isArray(row))fail('positioning.competitors.'+i);
  for(const key of ['name','url','positioning','reasonToChoose','difference','source','sourceDate'])if(row[key]!=null&&typeof row[key]!=='string')fail('positioning.competitors.'+i+'.'+key);
  if(!['direct','indirect','status_quo'].includes(row.type))fail('positioning.competitors.'+i+'.type');
 }
 for(const row of bio.positioning.pointsOfDifference){if(!row||typeof row!=='object'||Array.isArray(row))fail('positioning.pointsOfDifference');for(const key of ['claim','proof','rationale','source'])if(row[key]!=null&&typeof row[key]!=='string')fail('positioning.pointsOfDifference.'+key);}
 if(typeof bio.aspirations?.direction!=='string'||!Array.isArray(bio.aspirations?.notYetTrue)||!Array.isArray(bio.aspirations?.references))fail('aspirations');
 return bio;
}
