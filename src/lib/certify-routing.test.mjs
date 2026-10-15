import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerCertifyPath, ownerBrandFromCertify, certifyRoutePortal, canEnterCertify, brandCoreNavTarget, resolveCertifyRoute, certifyJobPath } from './certify-routing.js';

const user = { persona: 'user', portal: 'client', scope: 'workspace', qualifications: [] };
const owner = { persona: 'workspace_admin', portal: 'client', scope: 'workspace', qualifications: [], isOwner: true };
const contact = { persona: 'client', portal: 'client', role: 'client', scope: 'workspace' };
const cd = { persona: 'creative_director', portal: 'team', scope: 'platform', qualifications: ['steward'] };
const certifyingDesigner = { persona: 'designer', portal: 'team', scope: 'platform', qualifications: ['steward'] };
const designer = { persona: 'designer', portal: 'team', scope: 'platform', qualifications: ['designer'] };

test('owner confirmation links open Brand Book, not Certify', () => {
  assert.equal(ownerCertifyPath('brand-1'), 'brand-book');
  assert.equal(ownerBrandFromCertify('owner/brand-1'), 'brand-1');
  assert.equal(ownerBrandFromCertify('job-1'), null);
  assert.equal(certifyRoutePortal('owner/brand-1', true), 'team');
  assert.equal(certifyRoutePortal('owner/brand-1', false), 'team');
  assert.equal(certifyRoutePortal('job-1', true), 'team');
});

test('a user role cannot see or reach Certify, with the Certify flag on or off', () => {
  for (const certifyUx of [true, false]) {
    for (const actor of [user, owner, contact]) {
      assert.equal(canEnterCertify(actor), false);
      assert.equal(brandCoreNavTarget(actor), 'brand-book');
      for (const param of ['owner/brand-1', 'job-1', null]) {
        const decision = resolveCertifyRoute({ actor, param, certifyUx });
        assert.equal(decision.allow, false);
        assert.equal(decision.redirect, 'brand-book');
      }
    }
  }
});

test('an authorized creative director or certifying designer can open a Certify job', () => {
  for (const certifyUx of [true, false]) {
    for (const actor of [cd, certifyingDesigner]) {
      assert.equal(canEnterCertify(actor), true);
      assert.equal(resolveCertifyRoute({ actor, param: 'job-1', certifyUx }).allow, true);
      assert.equal(certifyJobPath(actor, 'job-1', true), 'certify/job-1');
    }
  }
  assert.equal(resolveCertifyRoute({ actor: cd, param: 'owner/brand-1', certifyUx: true }).redirect, 'team-review');
  assert.equal(canEnterCertify(designer), false);
  assert.equal(resolveCertifyRoute({ actor: designer, param: 'job-1', certifyUx: true }).redirect, 'team-review');
  assert.equal(certifyJobPath(designer, 'job-1', true), 'team-job/job-1');
  assert.equal(certifyJobPath(cd, 'job-1', false), 'team-job/job-1');
});
