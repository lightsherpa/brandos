import test from 'node:test';
import assert from 'node:assert/strict';
import {CERTIFICATION_SECTIONS,validateCertificationReview} from './certification-review.js';
const bio={id:'bio-id',version:2};
const body={bioId:bio.id,version:2,statementVersion:'2',reviewedSections:[...CERTIFICATION_SECTIONS],statements:{authority:true,reflects:true,aspirationalMarked:true}};
test('confirmation binds every section and declaration to the displayed version',()=>{
 const r=validateCertificationReview({body,bio});assert.equal(r.ok,true);assert.deepEqual(r.review.reviewedSections,CERTIFICATION_SECTIONS);
});
test('a replaced version cannot be approved from an older screen',()=>{
 for(const change of [{bioId:'old-id'},{version:1}])assert.equal(validateCertificationReview({body:{...body,...change},bio}).code,'STALE_BIO');
});
test('omitted review, outdated flow and truthy declaration strings are rejected',()=>{
 for(const change of [{reviewedSections:['identity']},{reviewedSections:null},{statementVersion:'1'},{statements:{...body.statements,authority:'true'}}])assert.equal(validateCertificationReview({body:{...body,...change},bio}).ok,false);
});
