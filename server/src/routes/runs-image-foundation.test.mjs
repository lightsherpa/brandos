import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test';
const {imageFoundationGate}=await import('./runs.js');
const complete={visual:{logo:{url:'https://brand.test/logo.svg',conf:90},palette:[{hex:'#ffd115',role:'primary'}],type:[{family:'Inter',kind:'Display',provider:'google'}]}};
const quiet=async(fn)=>{const o=console.error;console.error=()=>{};try{return await fn();}finally{console.error=o;}};
test('runs.js image path: missing foundation → 409 FOUNDATION_INCOMPLETE, 0 credits',async()=>{
  const r=await imageFoundationGate({bio:{visual:{}},brandId:'b'},{validate:async()=>{throw Error('unreached');}});
  assert.equal(r.status,409);assert.equal(r.body.code,'FOUNDATION_INCOMPLETE');assert.equal(r.body.credits,0);assert.ok(r.body.missing.length>=1);
});
test('runs.js image path: invalid foundation assets → 409',async()=>{
  const r=await imageFoundationGate({bio:complete,brandId:'b'},{validate:async()=>'Logo file is not reachable'});
  assert.equal(r.status,409);assert.equal(r.body.error,'Logo file is not reachable');
});
test('runs.js image path: asset check error → 503 fail closed',async()=>{
  const r=await quiet(()=>imageFoundationGate({bio:complete,brandId:'b'},{validate:async()=>{throw Error('storage down');}}));
  assert.equal(r.status,503);assert.equal(r.body.code,'FOUNDATION_CHECK_UNAVAILABLE');assert.equal(r.body.credits,0);
});
test('runs.js image path: complete foundation → null (run proceeds)',async()=>{
  assert.equal(await imageFoundationGate({bio:complete,brandId:'b'},{validate:async()=>null}),null);
});
