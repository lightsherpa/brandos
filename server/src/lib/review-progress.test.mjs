import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {normalizeProgressWrite,projectReviewProgress,reviewClosed} from './review-progress.js';
const ledger={bio_version:3,claims:[{claim_id:'logo',evidence_token:'current'},{claim_id:'voice',evidence_token:'voice-current'}]};
const body=()=>({bio_version:3,expected_revision:0,request_id:randomUUID(),decisions:{logo:{state:'confirmed',evidence_token:'current'},voice:{state:'fixed',evidence_token:'voice-current',value:['Warm']}},active_id:'voice',mode:'ask',question:'What changed?',scores:{C3:{score:3,confidence:2}},notes:'Review notes'});
test('snapshot survives projection with decisions, cursor, rubric, notes and inline draft intact',()=>{
 const b=body(),{state}=normalizeProgressWrite(b,ledger),out=projectReviewProgress({state,revision:4},ledger,{status:'in_review'});
 assert.equal(out.progress.revision,4);for(const key of ['decisions','active_id','mode','question','scores','notes'])assert.deepEqual(out.progress[key],b[key]);assert.equal(out.closed,false);
});
test('evidence invalidation drops only stale claim decisions and retains notes and other decisions',()=>{
 const state=normalizeProgressWrite(body(),ledger).state;const changed={...ledger,claims:[{claim_id:'logo',evidence_token:'new'},ledger.claims[1]]};
 const out=projectReviewProgress({state,revision:2},changed,{status:'in_review'});assert.deepEqual(out.invalidated_claim_ids,['logo']);assert.equal(out.progress.decisions.logo,undefined);assert.equal(out.progress.decisions.voice.state,'fixed');assert.equal(out.progress.notes,state.notes);assert.deepEqual(out.progress.scores,state.scores);
});
test('version guard, bounded drafts, unknown claims, invalid rubric and forged Done are rejected',()=>{
 for(const patch of [{bio_version:2},{expected_revision:-1},{request_id:'bad'},{decisions:{unknown:{state:'confirmed',evidence_token:'current'}}},{active_id:'foreign'},{mode:'done'},{question:'x'.repeat(4001)},{scores:{C3:{score:5}}},{scores:{C3:{score:3,confidence:3}}}])assert.throws(()=>normalizeProgressWrite({...body(),...patch},ledger));
 assert.throws(()=>normalizeProgressWrite({...body(),bio_version:2},ledger),e=>e.code==='STALE_PROGRESS_VERSION'&&e.status===409);
 assert.doesNotThrow(()=>normalizeProgressWrite({...body(),scores:{C3:{confidence:2}}},ledger));
});
test('same snapshot hash ignores object key order; changed payload produces another hash',()=>{
 const a=body(),b={...a,decisions:{voice:a.decisions.voice,logo:a.decisions.logo}};
 assert.equal(normalizeProgressWrite(a,ledger).requestHash,normalizeProgressWrite(b,ledger).requestHash);assert.notEqual(normalizeProgressWrite(a,ledger).requestHash,normalizeProgressWrite({...b,notes:'Other'},ledger).requestHash);
});
test('completed and declined refresh preserve terminal state; eligible second Lead retains their own review',()=>{
 const row={state:normalizeProgressWrite(body(),ledger).state,revision:2};
 assert.equal(projectReviewProgress(row,ledger,{status:'completed'}).progress.mode,'done');assert.equal(projectReviewProgress(row,ledger,{status:'rejected'}).progress.mode,'rejected');
 const pending={status:'pending_lead_review',assigned_to:'first'};
 assert.equal(projectReviewProgress(row,ledger,pending,{id:'first',roles:['lead_steward']}).progress.mode,'submitted');
 assert.equal(reviewClosed(pending,{id:'second',roles:['lead_steward']}),false);assert.equal(reviewClosed({status:'changes_requested'}),false);
});
