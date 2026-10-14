import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spriteFrame,spriteOffset,studioEvents} from './studio-state.js';
test('every animation tick selects a complete sprite cell',()=>{
 for(const action of ['idle','walk','work'])for(let tick=0;tick<60;tick++){
  assert.equal(Math.abs(spriteOffset(action,tick)%36),0);
  assert.ok(spriteFrame(action,tick)>=0&&spriteFrame(action,tick)<=4);
 }
 assert.deepEqual([0,1,2,3].map(t=>spriteFrame('work',t)),[3,4,3,4]);
});
test('existing saved state and streaming tokens do not replay assignments',()=>{
 const crew=[{node:{id:'copy',outputText:'token'},state:'running'}];
 assert.deepEqual(studioEvents(null,crew),[]);
 assert.deepEqual(studioEvents(new Map([['copy','running']]),crew),[]);
});
test('copy-to-design handoff requires an explicit source; failure is not delivery',()=>{
 assert.deepEqual(studioEvents(new Map([['design','queued']]),[{node:{id:'design',inputFrom:'copy'},state:'running'}]),[{from:'copy',to:'design',kind:'handoff'}]);
 assert.deepEqual(studioEvents(new Map([['design','queued']]),[{node:{id:'design'},state:'running'}]),[{from:'brandolph',to:'design',kind:'assignment'}]);
 assert.deepEqual(studioEvents(new Map([['design','running']]),[{node:{id:'design'},state:'failed'}]),[]);
});
