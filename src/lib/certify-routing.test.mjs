import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerCertifyPath, ownerBrandFromCertify, certifyRoutePortal} from './certify-routing.js';

test('owner reviews stay in Certify with a brand-scoped route', () => {
  assert.equal(ownerCertifyPath('brand-1'), 'certify/owner/brand-1');
  assert.equal(ownerBrandFromCertify('owner/brand-1'), 'brand-1');
  assert.equal(ownerBrandFromCertify('job-1'), null);
  assert.equal(certifyRoutePortal('owner/brand-1', true), 'client');
  assert.equal(certifyRoutePortal('job-1', true), 'team');
  assert.equal(certifyRoutePortal('owner/brand-1', false), 'team');
});
