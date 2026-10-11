// Offline: every CI_SPECIALIST_SPECS override and seed dept default uses real BIO slice keys; listed depts are fully overridden.
// Run: node scripts/test-specs-slices.mjs [ids,comma,separated]
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
const VALID = new Set(["audience", "forbidden", "goals", "palette", "positioning", "strategic", "type", "voice"]);
const src = readFileSync(new URL("../src/portal-data.js", import.meta.url), "utf8");
const w = {}; const sb = { window: w, localStorage: { getItem: () => null, setItem: () => {} } }; createContext(sb); runInContext(src, sb);
let fail = 0;
for (const [id, s] of Object.entries(w.CI_SPECIALIST_SPECS)) for (const k of s.bioSlices || []) if (!VALID.has(k)) { console.error(`FAIL ${id} slice ${k}`); fail++; }
const seed = readFileSync(new URL("./seed-specs.mjs", import.meta.url), "utf8");
const block = seed.slice(seed.indexOf("bioSlices:"), seed.indexOf("};", seed.indexOf("bioSlices:")));
for (const k of block.match(/"([a-z_]+)"/g).map((x) => x.slice(1, -1)).filter((x) => !["Copy", "Visual", "Concept", "Strategy"].includes(x))) if (!VALID.has(k)) { console.error(`FAIL seed default slice ${k}`); fail++; }
const want = (process.argv[2] || "a19,a20,a21,a22,a41,a42,a43,a44,a45,a46").split(",");
for (const id of want) { const s = w.CI_SPECIALIST_SPECS[id]; if (!s || !s.role || !s.outputContract || !(s.bioSlices || []).length || !(s.refusals || []).length) { console.error(`FAIL ${id} override incomplete`); fail++; } }
console.log(fail ? `${fail} failure(s)` : `OK: ${want.length} overrides complete; all slice keys valid`);
process.exit(fail ? 1 : 0);
