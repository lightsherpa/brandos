import test from "node:test";
import assert from "node:assert/strict";
import { generateWithFallback, isRetryableImageError } from "./fal-image.js";

const fake = (script) => async function* ({ route }) { for (const ev of script[route] || [{ type: "error", message: `Unknown fal route: ${route}` }]) yield ev; };
const collect = async (it) => { const out = []; for await (const e of it) out.push(e); return out; };

test("retryable image errors", () => {
  for (const m of ["fal submit HTTP 429: busy", "fal submit HTTP 503", "fal job timed out after 90000ms", "fal job failed: {}"]) assert.equal(isRetryableImageError(m), true, m);
  for (const m of ["FAL_API_KEY not set", "fal submit HTTP 422: bad params"]) assert.equal(isRetryableImageError(m), false, m);
});
test("falls back on transient failure and tags fallback_from", async () => {
  const gen = fake({ p: [{ type: "progress", pct: 5 }, { type: "error", message: "fal submit HTTP 503" }], f: [{ type: "done", model: "f", asset_url: "u" }] });
  const out = await collect(generateWithFallback({ route: "p", fallback: "f", prompt: "x" }, gen));
  const done = out.find((e) => e.type === "done");
  assert.equal(done.model, "f"); assert.equal(done.fallback_from, "p");
  assert.ok(!out.some((e) => e.type === "error"));
});
test("no fallback on config error", async () => {
  const gen = fake({ p: [{ type: "error", message: "FAL_API_KEY not set" }], f: [{ type: "done" }] });
  const out = await collect(generateWithFallback({ route: "p", fallback: "f", prompt: "x" }, gen));
  assert.equal(out.at(-1).type, "error");
});
test("no fallback configured behaves like generate", async () => {
  const gen = fake({ p: [{ type: "done", model: "p" }] });
  const out = await collect(generateWithFallback({ route: "p", prompt: "x" }, gen));
  assert.equal(out.at(-1).model, "p"); assert.equal(out.at(-1).fallback_from, undefined);
});

test('thrown vendor network errors fall back internally without leaking provider details', async () => {
 const gen=async function*({route}){if(route==='p')throw Error('network https://provider.test?key=private');yield {type:'done',asset_url:'https://image.test/accepted',model:route};};
 const out=await collect(generateWithFallback({route:'p',fallback:'f',prompt:'photo'},gen));
 assert.equal(out.at(-1).fallback_from,'p');assert.ok(!JSON.stringify(out).includes('private'));
});
test('every vendor request carries the remaining overall deadline and expired requests never start',async()=>{
 const {fetchWithImageDeadline}=await import('./fal-image.js');
 let options;await fetchWithImageDeadline('https://provider.test',{},Date.now()+50,async(_url,opts)=>{options=opts;return {};});
 assert.ok(options.signal instanceof AbortSignal);
 let calls=0;await assert.rejects(fetchWithImageDeadline('https://provider.test',{},Date.now()-1,async()=>{calls++;}),/timed out/);assert.equal(calls,0);
 await assert.rejects(fetchWithImageDeadline('https://provider.test',{},Date.now()+50,async()=>{throw Error('sensitive-url');}),/network request failed/);
});
test('hung vendor fetch aborts within its remaining deadline',async()=>{
 const {fetchWithImageDeadline}=await import('./fal-image.js');const started=Date.now();
 await assert.rejects(fetchWithImageDeadline('https://provider.test',{},Date.now()+20,async(_url,{signal})=>new Promise((_resolve,reject)=>{
  const guard=setTimeout(()=>reject(Error('deadline did not abort')),500);
  signal.addEventListener('abort',()=>{clearTimeout(guard);reject(signal.reason);},{once:true});
 })),/timed out/);
 assert.ok(Date.now()-started<400);
});
