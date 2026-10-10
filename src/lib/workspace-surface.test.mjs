import test from 'node:test';import assert from 'node:assert/strict';
import {readWorkspaceSurface,writeWorkspaceSurface} from './workspace-surface.js';
test('office is the default while an explicit canvas preference survives',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 assert.equal(readWorkspaceSurface(storage),'office');writeWorkspaceSurface(storage,'canvas');assert.equal(readWorkspaceSurface(storage),'canvas');writeWorkspaceSurface(storage,'office');assert.equal(readWorkspaceSurface(storage),'office');writeWorkspaceSurface(storage,'invalid');assert.equal(readWorkspaceSurface(storage),'office');
});
test('unavailable browser storage cannot break opening a workspace',()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readWorkspaceSurface(storage),'office');assert.doesNotThrow(()=>writeWorkspaceSurface(storage,'canvas'));
});
