import test from 'node:test';
import assert from 'node:assert/strict';
import { CERTIFIER_SUPPORT_NAME } from '../lib/certifier-support-name.js';
import { reviewCopy } from './review-copy.js';

for (const locale of ['en', 'es', 'ar']) {
  test(`Certify ${locale} keeps Stewart's personal name and Brand Core product name`, () => {
    const copy = reviewCopy(locale);
    assert.equal(copy.support, CERTIFIER_SUPPORT_NAME);
    assert.match(copy.certify, /Brand Core/);
    assert.match(copy.confirmation, /Brand Core/);
    assert.match(copy.ownerText, /Brand Core/);
  });
}

test('unsupported locale falls back to the approved English support copy', () => {
  assert.deepEqual(reviewCopy('unknown'), reviewCopy('en'));
});
