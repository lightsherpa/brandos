import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryWebsiteError,bioIntegrityError} from './brand-source-integrity.js';
import {prepareClientBioEditPayload} from './bio-evidence.js';
const geoking={id:'geo',name:'Geoking',url:'https://geoking.com'};
test('Cake-me primary site cannot replace Geoking; same-site paths and www are accepted',()=>{
 assert.equal(discoveryWebsiteError(geoking,'https://thecake-me.com').code,'BRAND_SOURCE_MISMATCH');
 assert.equal(discoveryWebsiteError(geoking,'https://www.geoking.com/about'),null);
 assert.equal(discoveryWebsiteError({...geoking,url:null},'https://geoking.com'),null);
});
test('stored BIO lineage rejects wrong brand id and wrong primary domain',()=>{
 assert.equal(bioIntegrityError({payload:{sourceIdentity:{brandId:'cake',primaryUrl:'https://geoking.com'}}},geoking).code,'BIO_BRAND_MISMATCH');
 assert.equal(bioIntegrityError({payload:{sourceIdentity:{brandId:'geo',primaryUrl:'https://thecake-me.com'}}},geoking).code,'BIO_BRAND_MISMATCH');
 assert.equal(bioIntegrityError({payload:{sourceIdentity:{brandId:'geo',primaryUrl:'https://www.geoking.com'}}},geoking),null);
});
test('client edits cannot clear quarantine or forge source lineage',()=>{
 const previous={sourceIntegrity:{status:'quarantined'},sourceIdentity:{brandId:'geo',primaryUrl:'https://geoking.com'}};
 const edited=prepareClientBioEditPayload({sourceIntegrity:{status:'valid'},sourceIdentity:{brandId:'cake'}},previous);
 assert.deepEqual(edited.sourceIntegrity,previous.sourceIntegrity);
 assert.deepEqual(edited.sourceIdentity,previous.sourceIdentity);
 assert.equal(bioIntegrityError({payload:edited},geoking).code,'BIO_SOURCE_QUARANTINED');
});
