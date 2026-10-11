// Offline check for the hero prompts/contracts slice. Run: node scripts/test-hero-specs.mjs
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
const src = readFileSync(new URL("../src/portal-data.js", import.meta.url), "utf8");
const w = {}; createContext({ window: w, localStorage: { getItem: () => null, setItem: () => {} } });
const sb = { window: w, localStorage: { getItem: () => null, setItem: () => {} } }; createContext(sb); runInContext(src, sb);
const S = w.CI_SPECIALIST_SPECS; let fail = 0;
const must = { a16: ["D-URGENCY", "≤125", "VISUAL DIRECTION"], a13: ["HEADLINE", "≤600"], a14: ["≤60", "preheader"], a12: [], a37: [] };
const VALID_SLICES = new Set(["audience", "forbidden", "goals", "palette", "positioning", "strategic", "type", "voice"]);
for (const [id, needles] of Object.entries(must)) {
  const s = S[id]; if (!s) { console.error(`FAIL ${id} missing override`); fail++; continue; }
  for (const k of ["role", "objective", "method", "outputContract", "refusals", "bioSlices"]) if (!s[k] || (Array.isArray(s[k]) && !s[k].length)) { console.error(`FAIL ${id}.${k}`); fail++; }
  for (const sl of s.bioSlices || []) if (!VALID_SLICES.has(sl)) { console.error(`FAIL ${id} unknown slice ${sl}`); fail++; }
  const blob = JSON.stringify(s);
  for (const n of needles) if (!blob.includes(n)) { console.error(`FAIL ${id} lacks "${n}"`); fail++; }
}
const seed = readFileSync(new URL("./seed-specs.mjs", import.meta.url), "utf8");
if (!seed.includes("Array.isArray(override.bioSlices)")) { console.error("FAIL seed bioSlices override"); fail++; }
console.log(fail ? `${fail} failure(s)` : "OK: hero overrides a12 a13 a14 a16 a37 complete; bioSlices valid; seed honours override");
process.exit(fail ? 1 : 0);
