import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestedCrew,crewRoles,crewDeliverables,crewCopy} from './crew-canvas.js';
test('Canvas resolves exactly one requested task and does not scatter mixed briefs',()=>{
 assert.equal(requestedCrew({taskType:'email'}),'email_sequence');
 assert.equal(requestedCrew({deliveryPlan:{deliverableGroups:[{type:'social_post'}]}}),'social_post');
 assert.equal(requestedCrew({deliveryPlan:{deliverableGroups:[{type:'social_post'},{type:'email'}]}}),null);
 assert.deepEqual(crewRoles('social_post'),['copy','image','compositor','qa']);
 assert.deepEqual(crewRoles('email_sequence',false),['copy','html','qa']);
 assert.deepEqual(crewRoles('email_sequence',true),['copy','html','hero','qa']);
});
test('right rail contains only completed actual HTML deliverables',()=>{
 assert.deepEqual(crewDeliverables({items:[{status:'queued'},{status:'flagged',html:'bad'},{status:'ready',html:'good'},{status:'approved',html:'approved'}]}).map(i=>i.html),['good','approved']);
});
test('new Canvas copy is complete in en/es/ar and preserves Brand Core',()=>{
 const keys=Object.keys(crewCopy('en')).sort();
 for(const lang of ['en','es','ar']){assert.deepEqual(Object.keys(crewCopy(lang)).sort(),keys);assert.ok(crewCopy(lang).intro.includes('Brand Core'));assert.ok(Object.values(crewCopy(lang)).every(v=>v.length));}
});
