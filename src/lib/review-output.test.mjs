import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewComponents,reviewKind} from './review-output.js';
import {reviewDeskCopy} from './review-desk-copy.js';
test('serialized task envelopes render copy, email and images without operational JSON',()=>{
 const body=JSON.stringify({task_id:'secret-id',metrics:{text:'internal metrics'},items:[{index:0,copy:{subject:'Welcome',body:'Freshly baked'},html:'<h1>Welcome</h1>',image:{asset_url:'https://brand.test/cake.png'},checks:[{text:'internal check'}]}]});
 const components=reviewComponents(body);
 assert.deepEqual(components.map(c=>c.type),['copy','copy','email','image']);
 assert.deepEqual(components[0].path,['items',0,'copy','subject']);
 assert.ok(!components.some(c=>c.value.includes('internal')));
});
test('plain text is rendered while a structured body never becomes raw JSON copy',()=>{
 assert.equal(reviewComponents('Finished copy')[0].value,'Finished copy');
 assert.equal(reviewComponents({text:'{"internal":"hidden"}',unknown:'internal'}).length,0);
 assert.equal(reviewComponents({text:'Original',edited_text:'Edited'})[0].value,'Edited');
});
test('each locale has labels and explanations with literal Brand Core',()=>{
 for(const locale of ['en','es','ar']){
  assert.ok(reviewKind('drift_check',locale).description);
  assert.ok(!reviewKind('drift_check',locale).label.includes('_'));
  assert.ok(reviewKind('onboarding',locale).label.includes('Brand Core'));
  assert.ok(reviewDeskCopy(locale).replace);
  assert.ok(reviewKind('unknown_internal_code',locale).label);
 }
});
test('specialist deliverable clusters render every copy component and art direction',()=>{
 const components=reviewComponents({kind:'deliverables',deliverables:[{title:'One',body:'Caption one',visualDirection:'Cake close-up'},{title:'Two',body:'Caption two'}]});
 assert.equal(components.length,5);assert.deepEqual(components[1].path,['deliverables',0,'body']);
});
test('review desk workflow copy covers every state and control in all locales',()=>{
 const baseline=reviewDeskCopy('en');
 for(const locale of ['es','ar']){
  const translated=reviewDeskCopy(locale);
  assert.deepEqual(Object.keys(translated).sort(),Object.keys(baseline).sort());
  assert.deepEqual(Object.keys(translated.states).sort(),Object.keys(baseline.states).sort());
  for(const key of ['attention','eyebrow','approve','requestChanges','waiting','transitionError','clientFeedback','independentHelp']){
   assert.ok(translated[key]);assert.notEqual(translated[key],baseline[key]);
  }
  for(const state of Object.keys(baseline.states))assert.notEqual(translated.states[state],baseline.states[state]);
 }
});
