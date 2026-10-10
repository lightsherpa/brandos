import test from 'node:test';
import assert from 'node:assert/strict';
import {watchDiscoveryBio} from './discovery-progress.js';
const flush = () => new Promise(resolve => setImmediate(resolve));

test('discovery still advances when BIO finishes after the former 90 second cutoff', async () => {
  let tick, reads = 0, completed = 0, cancelled = 0;
  watchDiscoveryBio({discoveryId:'new-run', read:async()=>({discovery_id:++reads >= 44 ? 'new-run':'older-run'}), onStatus:()=>{}, onComplete:()=>completed++, schedule:fn=>(tick=fn,1), cancel:()=>cancelled++});
  await flush();
  for(let i=0;i<43;i++) await tick(); // 129 seconds, matching the real completed run
  assert.equal(completed,1);
  assert.equal(cancelled,1);
  await tick();
  assert.equal(reads,44);
});

test('a temporary read failure recovers without starting another generation', async () => {
  let tick, reads=0, completed=0;
  const statuses=[];
  watchDiscoveryBio({discoveryId:'run',read:async()=>{if(++reads===1)throw new Error('offline');return {discovery_id:'run'};},onStatus:v=>statuses.push(v),onComplete:()=>completed++,schedule:fn=>(tick=fn,1),cancel:()=>{}});
  await flush();await tick();
  assert.deepEqual(statuses,[true,false]);assert.equal(completed,1);
});

test('leaving the screen ignores a pending response and duplicate polls do not overlap', async () => {
  let tick, resolve, reads=0, completed=0;
  const stop=watchDiscoveryBio({discoveryId:'run',read:()=>{reads++;return new Promise(r=>resolve=r);},onStatus:()=>{},onComplete:()=>completed++,schedule:fn=>(tick=fn,1),cancel:()=>{}});
  await tick();assert.equal(reads,1);
  stop();resolve({discovery_id:'run'});await flush();
  assert.equal(completed,0);
});

 test('terminal worker failure stops polling and exposes recovery without generating again',async()=>{let cancelled=0,failed=null;watchDiscoveryBio({discoveryId:'run',read:async()=>{throw Object.assign(new Error('SOURCE_UNREADABLE'),{terminal:true});},onStatus:()=>{},onComplete:()=>assert.fail('Must not complete'),onFailure:e=>failed=e.message,schedule:()=>1,cancel:()=>cancelled++});await new Promise(r=>setTimeout(r,0));assert.equal(failed,'SOURCE_UNREADABLE');assert.equal(cancelled,1);});
