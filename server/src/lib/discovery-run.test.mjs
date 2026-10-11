import test from 'node:test';import assert from 'node:assert/strict';import {publicDiscoveryError} from './discovery-run.js';
test('terminal progress exposes a useful error class without provider payloads',()=>{
 assert.equal(publicDiscoveryError(new Error('Brand retrieval failed: secret provider response')),'SOURCE_UNREADABLE');
 assert.equal(publicDiscoveryError(new Error('Approved budget exhausted')),'BUDGET_BLOCKED');
 assert.equal(publicDiscoveryError(new Error('Compiler JSON truncated')),'INTERPRETATION_FAILED');
 assert.equal(publicDiscoveryError(new Error('unexpected private detail')),'DISCOVERY_FAILED');
});
