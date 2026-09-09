// Real HTTP/PostgreSQL verification. Requires a disposable local Supabase stack.
// node scripts/test-brief-drafts-local.mjs --api http://localhost:8887 --env /path/local.env --fixtures /path/users.json
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const flags = Object.fromEntries(Array.from({ length: Math.floor((process.argv.length - 2) / 2) }, (_, i) => [process.argv[2 + i * 2], process.argv[3 + i * 2]]));
assert(flags['--api'] && flags['--env'] && flags['--fixtures'], 'Required: --api --env --fixtures');
const env = Object.fromEntries(readFileSync(flags['--env'], 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
function local(value) {
  const url = new URL(value);
  assert(['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password, 'Refusing non-loopback endpoint');
  return url.origin;
}
const api = local(flags['--api']);
const db = local(env.SUPABASE_URL);
const [alice, bob] = JSON.parse(readFileSync(flags['--fixtures'], 'utf8'));
assert(alice.secondBrandId && alice.workspaceId !== bob.workspaceId, 'Need two workspaces and a second brand for first user');
let checks = 0;
function check(value, label) { assert(value, label); checks++; console.log(`PASS ${label}`); }
async function request(url, { token, key, body, method = 'GET' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers.apikey = key;
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error' });
  return { status: response.status, data: await response.json() };
}
const admin = path => request(`${db}/rest/v1/${path}`, { token: env.SUPABASE_SERVICE_ROLE_KEY, key: env.SUPABASE_SERVICE_ROLE_KEY });
async function snapshot() {
  const rows = await Promise.all(['runs', 'ledger', 'briefs'].map(async table => { const r = await admin(`${table}?select=*`); assert.equal(r.status, 200); return r.data.sort((a, b) => String(a.id).localeCompare(String(b.id))); }));
  return JSON.stringify(rows);
}
for (const user of [alice, bob]) {
  const login = await request(`${db}/auth/v1/token?grant_type=password`, { method: 'POST', key: env.SUPABASE_ANON_KEY, body: { email: user.email, password: user.password } });
  check(login.status === 200 && login.data.user.id === user.userId, `${user.name} real GoTrue password login`);
  user.accessToken = login.data.access_token;
}
const before = await snapshot();
const bios = await admin(`bios?brand_id=eq.${alice.secondBrandId}&select=id`);
check(bios.status === 200 && bios.data.length === 0, 'test brand has no BIO');
const id = randomUUID();
const payload = input => ({ input, mode: 'flow', answers: { 0: 'Entered answer' }, qStep: 1, sharpData: null });
const body = (revision, input) => ({ brandId: alice.secondBrandId, workspaceId: alice.workspaceId, ownerUserId: alice.userId, revision, mutationId: randomUUID(), payload: payload(input) });
const put = (user, content) => request(`${api}/api/briefs/drafts/${id}`, { method: 'PUT', token: user.accessToken, body: content });
const list = (user, brandId, ownerUserId = user.userId) => request(`${api}/api/briefs/drafts?${new URLSearchParams({ brandId, ownerUserId })}`, { token: user.accessToken });
const initial = body(0, 'Local integration initial draft');
const saved = await put(alice, initial);
check(saved.status === 200 && saved.data.draft.id === id && saved.data.draft.revision === 1, 'create draft without certified BIO');
const retry = await put(alice, initial);
check(retry.status === 200 && retry.data.draft.revision === 1, 'lost acknowledgment retry is idempotent');
const listed = await list(alice, alice.secondBrandId);
check(listed.status === 200 && listed.data.drafts.some(d => d.id === id && d.payload.answers[0] === 'Entered answer'), 'list restores input and entered answers');
const otherBrand = await list(alice, alice.brandId);
check(otherBrand.status === 200 && !otherBrand.data.drafts.some(d => d.id === id), 'same workspace brand isolation');
const outsider = await list(bob, alice.secondBrandId);
check(outsider.status === 403, 'other workspace cannot list draft');
const forgedOwner = await list(bob, alice.secondBrandId, alice.userId);
check(forgedOwner.status === 403, 'other user cannot impersonate owner');
const forbiddenWrite = await put(bob, { ...body(1, 'forbidden'), ownerUserId: bob.userId });
check(forbiddenWrite.status === 403, 'other workspace cannot overwrite draft');
const mismatch = await put(alice, { ...body(1, 'wrong workspace'), workspaceId: bob.workspaceId });
check(mismatch.status === 409, 'workspace mismatch rejected');
const contenders = await Promise.all([put(alice, body(1, 'Concurrent A')), put(alice, body(1, 'Concurrent B'))]);
check(contenders.map(r => r.status).sort().join(',') === '200,409', 'concurrent revision has exactly one winner');
const edited = await put(alice, body(2, 'Final retained input'));
check(edited.status === 200 && edited.data.draft.id === id && edited.data.draft.revision === 3, 'edit preserves draft identity');
const stale = await put(alice, body(1, 'stale content'));
check(stale.status === 409 && stale.data.code === 'DRAFT_CONFLICT', 'stale revision rejected');
const unauth = await request(`${api}/api/briefs/drafts?brandId=${alice.secondBrandId}&ownerUserId=${alice.userId}`);
check(unauth.status === 401, 'API requires a real session');
for (const [name, token, expected] of [['anon', env.SUPABASE_ANON_KEY, 401], ['authenticated', alice.accessToken, 403]]) {
  const direct = await request(`${db}/rest/v1/brief_drafts?select=id`, { key: env.SUPABASE_ANON_KEY, token });
  check(direct.status === expected, `${name} direct table access denied`);
}
const record = await admin(`brief_drafts?id=eq.${id}&select=*`);
check(record.status === 200 && record.data.length === 1 && record.data[0].payload.input === 'Final retained input' && record.data[0].revision === 3, 'service role confirms durable final row');
check(await snapshot() === before, 'no run, ledger, or production brief mutations');
console.log(`${checks} real integration checks passed. Local test draft retained for inspection.`);
