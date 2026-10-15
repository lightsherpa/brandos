// Intentionally resolves credentials from the local CLI only, never a project .env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const local = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
const url = new URL(local.API_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error('Local Supabase required');
process.env.SUPABASE_URL = url.origin;
process.env.SUPABASE_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY;
const admin = createClient(url.origin, local.SERVICE_ROLE_KEY);
const anon = createClient(url.origin, local.ANON_KEY);
const { renderEmail } = await import('../server/src/harness/render.js');
const { checkAndRender, publicItem } = await import('../server/src/harness/pipeline.js');
const migration = readFileSync(new URL('../supabase/migrations/20261015000000_email_assets.sql', import.meta.url), 'utf8');
const sql = input => execFileSync('docker', ['exec', '-i', 'supabase_db_CaastorOS', 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' });
test('local migration replay, real export upload, public fetch, retry and denied browser writes', async () => {
  sql(migration); sql(migration);
  assert.equal(sql("select count(*) from storage.buckets where id='email-assets' and name='email-assets' and public;").trim(), '1');
  // Unique pixels produce a unique content hash, so cleanup never removes existing assets.
  const sharp = createRequire(new URL('../server/package.json', import.meta.url))('sharp');
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: `#${randomUUID().replaceAll('-', '').slice(0, 6)}` } }).png().toBuffer();
  const source = `email-hosting-test/${randomUUID()}.png`;
  const uploaded = await admin.storage.from('bio-sources').upload(source, bytes, { contentType: 'image/png' });
  assert.ifError(uploaded.error);
  const signed = await admin.storage.from('bio-sources').createSignedUrl(source, 60);
  assert.ifError(signed.error);
  const layer1 = { brand: { name: 'Local test' }, logo: { url: signed.data.signedUrl }, palette: { primary: '#111111', ink: '#111111', surface: '#ffffff' }, fonts: { display: 'Arial', body: 'Arial' }, voice: { forbidden: [] } };
  const email = { subject: 'Local test', preheader: 'An email asset hosting local integration test.', headline: 'Local export', body_blocks: ['Testing local image hosting.'], cta: { label: 'View', url: 'https://example.com' } };
  let hostedPath;
  try {
    const it = { index: 0, copy: email };
    await checkAndRender({ type: 'email_sequence', task: { heroes: false }, it, layer1, language: 'en' });
    const saved = publicItem(it);
    assert.equal(saved.transport.delivery_ready, true);
    assert.equal(saved.export.delivery_ready, true);
    assert.equal(saved.transport.outbound_sending_enabled, false);
    hostedPath = saved.transport.assets[0].path;
    assert.match(hostedPath, /^sha256\/[a-f0-9]{64}\.png$/);
    assert.ok(saved.transport_html.includes(saved.transport.assets[0].url));
    assert.ok(!saved.transport_html.includes(signed.data.signedUrl));
    const response = await fetch(saved.transport.assets[0].url);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const retry = await renderEmail({ email, layer1 });
    assert.equal(retry.transport.delivery_ready, true);
    assert.equal(retry.transport.assets[0].path, hostedPath);
    const denied = await anon.storage.from('email-assets').upload(`denied-${randomUUID()}.png`, bytes, { contentType: 'image/png' });
    assert.ok(denied.error, 'anonymous uploads must be denied');
    const { hostEmailAssets } = await import('../server/src/harness/email-assets.js');
    const failed = await renderEmail({ email, layer1, hostAssets: html => hostEmailAssets(html, { storage: anon.storage }) });
    assert.equal(failed.transport.delivery_ready, false);
    assert.equal(failed.transport.requires_asset_hosting, true);
  } finally {
    await admin.storage.from('bio-sources').remove([source]);
    if (hostedPath) await admin.storage.from('email-assets').remove([hostedPath]);
  }
});
