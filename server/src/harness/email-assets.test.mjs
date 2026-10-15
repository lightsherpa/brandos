import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hostEmailAssets } from './email-assets.js';
const bytes = Buffer.from('test-image');
const hash = createHash('sha256').update(bytes).digest('hex');
const fetchAsset = async () => ({ bytes, type: 'image/png' });
const fixture = (upload = async () => ({ error: null })) => ({ from(bucket) {
  assert.equal(bucket, 'email-assets');
  return { upload, getPublicUrl: path => ({ data: { publicUrl: `https://storage.test/storage/v1/object/public/email-assets/${path}` } }) };
} });
test('uploads unique sources using content hashes and rewrites only image URLs', async () => {
  const calls = [];
  const html = '<a href="https://img.test/a?x=1&amp;y=2"><img src="https://img.test/a?x=1&amp;y=2"><IMG alt="hero" SRC=\'https://img.test/a?x=1&amp;y=2\'></a>';
  const result = await hostEmailAssets(html, { fetchAsset: async (url) => { assert.equal(url, 'https://img.test/a?x=1&y=2'); return fetchAsset(); }, storage: fixture(async (...args) => { calls.push(args); return {}; }) });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [`sha256/${hash}.png`, bytes, { contentType: 'image/png', cacheControl: '31536000', upsert: false }]);
  assert.equal(result.delivery_ready, true);
  assert.equal(result.requires_asset_hosting, false);
  assert.equal(result.outbound_sending_enabled, false);
  assert.match(result.html, /href="https:\/\/img.test/);
  assert.equal(result.html.split(`sha256/${hash}.png`).length, 3);
});
test('duplicate immutable objects are reusable on retries', async () => {
  const r = await hostEmailAssets('<img src="https://img.test/a">', { fetchAsset, storage: fixture(async () => ({ error: { statusCode: '409' } })) });
  assert.equal(r.delivery_ready, true);
});
test('upload or fetch failure leaves the entire original HTML unready, including partial success', async () => {
  const html = '<img src="https://img.test/a"><img src="https://img.test/b">';
  let calls = 0;
  const r = await hostEmailAssets(html, { fetchAsset, storage: fixture(async () => ({ error: ++calls === 2 ? { statusCode: '500', message: 'secret' } : null })) });
  assert.equal(r.html, html);
  assert.equal(r.delivery_ready, false);
  assert.equal(r.outbound_sending_enabled, false);
  assert.deepEqual(r.assets, []);
  assert.doesNotMatch(JSON.stringify(r), /secret/);
  assert.equal((await hostEmailAssets(html, { fetchAsset: async () => { throw Error('fetch'); } })).delivery_ready, false);
});
test('empty HTML fails closed; an image-free email needs no upload', async () => {
  assert.equal((await hostEmailAssets('')).delivery_ready, false);
  assert.equal((await hostEmailAssets('<p>Hello</p>', { storage: { from() { throw Error('no upload expected'); } } })).delivery_ready, true);
});
test('non-image assets and missing public URLs fail closed', async () => {
  const html = '<img src="https://img.test/a">';
  assert.equal((await hostEmailAssets(html, { fetchAsset: async () => ({ bytes, type: 'text/html' }) })).delivery_ready, false);
  const storage = { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: {} }) }) };
  assert.equal((await hostEmailAssets(html, { fetchAsset, storage })).delivery_ready, false);
});
