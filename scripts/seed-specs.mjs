// ─────────────────────────────────────────────────────────────────────
// P0-006 · Seed the `specs` table from src/portal-data.js
//
// Reads CI_AGENTS (33 rows) + CI_DEPT_SPECS (6 dept templates) +
// CI_DEPT_META (per-dept capabilities/tier) from the existing
// browser-side mock file, and writes one `specs` row per specialist
// with `version=1` and `active=true` (for live status) or `active=false`
// (for `soon` status — they get a row so the directory still renders).
//
// Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-specs.mjs
//
// Idempotent: uses upsert on (specialist_id, version) so re-running is
// safe and just overwrites the v1 payload. To bump a version, edit the
// SPEC_VERSION constant below.
//
// Why eval portal-data.js instead of importing? It's a browser script
// that assigns to `window.*`. Refactoring to ESM exports is in-scope
// for a later phase (when P3 wires real specialist runs and the mocks
// become DB-backed). For now this seed is the one consumer that needs
// the data on the server side; the sandbox eval keeps the source of
// truth single.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PORTAL_DATA_PATH = join(REPO_ROOT, "src/portal-data.js");
const SPEC_VERSION = 1;

// ─── Sandbox-evaluate portal-data.js to extract CI_* globals ────────
const src = readFileSync(PORTAL_DATA_PATH, "utf8");
const fakeWindow = {};
const sandbox = { window: fakeWindow, localStorage: { getItem: () => null, setItem: () => {} } };
createContext(sandbox);
runInContext(src, sandbox);

const CI_AGENTS    = fakeWindow.CI_AGENTS;
const CI_DEPT_SPECS = fakeWindow.CI_DEPT_SPECS;
const CI_DEPT_META  = fakeWindow.CI_DEPT_META;
const CI_SPECIALIST_SPECS = fakeWindow.CI_SPECIALIST_SPECS || {};

if (!Array.isArray(CI_AGENTS) || CI_AGENTS.length === 0) {
  console.error("CI_AGENTS not found or empty after evaluating portal-data.js");
  process.exit(1);
}
if (!CI_DEPT_SPECS || !CI_DEPT_META) {
  console.error("CI_DEPT_SPECS or CI_DEPT_META missing");
  process.exit(1);
}

console.log(`Loaded ${CI_AGENTS.length} agents from portal-data.js`);
console.log(`Departments: ${Object.keys(CI_DEPT_SPECS).join(", ")}`);

// ─── Vendor-prefixed model routing (hybrid: Anthropic direct + OpenRouter for non-Claude) ──
// Per the hybrid decision in docs/2026-05-24-engineering-refinement.md:
//   anthropic/<model>   → direct SDK, preserves cache_control (60–80% input cost lever)
//   openrouter/<model>  → OpenAI-compatible API, used for GPT-5 / Gemini / non-Claude text
//   vendor/<short_key>  → non-text vendors (image/web/deck/search/audio) — handled by
//                          dedicated modules in P5+; the text router rejects this prefix.
const MODEL_MAP = {
  // Anthropic (text) — direct
  opus:        "anthropic/claude-opus-4-7",
  sonnet:      "anthropic/claude-sonnet-4-6",
  haiku:       "anthropic/claude-haiku-4-5-20251001",
  // Hero crew only (approved 2026-10-11): Claude 5.5 family, direct API ids (dashes)
  sonnet55:    "anthropic/claude-sonnet-5-5",
  haiku55:     "anthropic/claude-haiku-5-5",
  // Non-Claude text → OpenRouter
  gpt5:        "openrouter/openai/gpt-5",
  gemPro:      "openrouter/google/gemini-2.5-pro",
  gemFlash:    "openrouter/google/gemini-2.5-flash",
  gemFlash38:  "openrouter/google/gemini-3.8-flash",   /* hero crew only */
  // Image — all via fal.ai (one key, one bill, multiple models)
  gptimage:    "vendor/fal/gpt-image-2",      /* real GPT Image 2 via fal (openai/gpt-image-2) */
  flux:        "vendor/fal/flux-1.1-pro",     /* Pro — Hero, OOH, Identity, Pack: $0.04/img */
  fluxSchnell: "vendor/fal/flux-schnell",     /* Schnell — drafts, variants, social: $0.003/img (13× cheaper) */
  recraft:     "vendor/fal/recraft-v3",
  // Other non-text vendors — wired in later phases
  exa:         "vendor/exa",
  elevenlabs:  "vendor/elevenlabs",
  v0:          "vendor/v0",
  gamma:       "vendor/gamma",
  framer:      "vendor/framer",
};

/* Fallback route per short key — used by router.js when the primary errors,
   times out before the first token, or is rate-limited. Hero keys only. */
const FALLBACK_MAP = {
  sonnet55:   "anthropic/claude-sonnet-4-6",
  haiku55:    "anthropic/claude-haiku-4-5-20251001",
  gemFlash38: "openrouter/google/gemini-2.5-flash",
};

function resolveRoute(shortKey) {
  if (MODEL_MAP[shortKey]) return MODEL_MAP[shortKey];
  console.warn(`Unknown model short key "${shortKey}" — defaulting to anthropic/claude-sonnet-4-6`);
  return "anthropic/claude-sonnet-4-6";
}

// ─── Build the spec payload per agent ──────────────────────────────
export function buildPayload(agent) {
  const deptSpec = CI_DEPT_SPECS[agent.dept] ?? {};
  const deptMeta = CI_DEPT_META[agent.dept] ?? {};
  /* Per-specialist override (CI_SPECIALIST_SPECS) — every key present
     in the override replaces the dept-template default. Arrays REPLACE
     wholesale (don't merge), so a specialist can shrink the refusal
     list deliberately. */
  const override = CI_SPECIALIST_SPECS[agent.id] ?? {};
  const pick = (k) => (override[k] !== undefined ? override[k] : deptSpec[k]);
  return {
    // Identity
    name: agent.name,
    code: agent.code,
    department: agent.dept,
    role_label: "L2 specialist",                  // used by public_specs view
    job: agent.job,
    public_description: agent.job,                 // safe to expose via `?ask=`
    // Visibility — internal specs (BIO Compiler, Audit & Ledger) are
    // infrastructure, not user-pickable. The directory filters them out.
    internal: agent.internal === true,
    // Spec — override wins over dept template per-field
    role: pick("role"),
    objective: pick("objective"),
    method: pick("method") ?? [],
    outputContract: pick("outputContract"),
    voice: pick("voice"),
    tools: pick("tools") ?? [],
    refusals: pick("refusals") ?? [],
    // Routing — vendor-prefixed route string the model router dispatches on
    modelRouting: { primary: resolveRoute(agent.model), fallback: FALLBACK_MAP[agent.model] ?? null, reason: `seeded from CI_AGENTS (model: ${agent.model})` },
    // Department-inherited
    capabilities: deptMeta.capabilities ?? [],
    turnaround: deptMeta.turnaround,
    tierFrom: deptMeta.tierFrom,
    bestFor: deptMeta.bestFor,
    deptComingSoon: deptMeta.comingSoon === true,
    // Estimates + status (status mirrors agent.status; active flag on the row reflects live-ness)
    cr_estimate: agent.cr,
    status: agent.status,
    // BIO slices per dept — what the specialist reads from the BIO at run time
    // Per-specialist override wins (hero crew contracts, 2026-10-11); else dept default.
    bioSlices: Array.isArray(override.bioSlices) ? override.bioSlices
            : agent.dept === "Copy"           ? ["voice", "forbidden"]
            : agent.dept === "Visual"          ? ["palette", "type", "imagery"]
            : agent.dept === "Concept"         ? ["positioning", "audience"]
            : agent.dept === "Web & UX"        ? ["voice", "palette", "type"]
            : agent.dept === "Motion & Sound"  ? ["voice", "imagery"]
            : agent.dept === "Strategy"        ? ["positioning", "audience", "goals", "strategic"]
            : agent.dept === "Research & Ops"  ? ["positioning"]
            :                                    ["positioning", "voice"],
  };
}

// ─── Upsert into specs via REST (service-role bypasses RLS) ────────
export const rows = Array.from(CI_AGENTS, (agent) => ({
  specialist_id: agent.id,
  version:       SPEC_VERSION,
  active:        agent.status === "live",
  payload:       buildPayload(agent),
}));

export function selectRows(args, candidates = rows) {
  if (args.length === 0) return candidates;
  if (args.length !== 2 || args[0] !== "--only" || !args[1]) {
    throw new Error("Usage: seed-specs.mjs [--only a02,a12,a13,a14,a16,a18,a24,a37]");
  }
  const ids = new Set(args[1].split(","));
  const unknown = [...ids].filter(id => !candidates.some(row => row.specialist_id === id));
  if (unknown.length) throw new Error(`Unknown specialist ids: ${unknown.join(",")}`);
  return candidates.filter(row => ids.has(row.specialist_id));
}

export function buildScopedUpdates(selected, before) {
  return selected.map(row => {
    const existing = before.find(item => item.specialist_id === row.specialist_id && item.version === row.version);
    if (!existing) throw new Error(`Scoped update requires existing spec ${row.specialist_id}`);
    return { specialist_id: row.specialist_id, version: row.version, active: existing.active,
      payload: { ...existing.payload, modelRouting: row.payload.modelRouting } };
  });
}

export async function seedSpecs(args = process.argv.slice(2)) {
  const selected = selectRows(args);
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase service-role environment");
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
  // REST equivalent of SELECT specialist_id, payload->'modelRouting' FROM specs.
  // Save the full rows too, so this backup can restore all payload fields.
  const readRows = async () => {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/specs?select=*&order=specialist_id,version`, { headers });
    if (!result.ok) throw new Error(`Backup/verification failed: HTTP ${result.status}`);
    return result.json();
  };
  const before = await readRows();
  // Scoped upgrades preserve existing spec customizations and live status.
  const updates = args.length ? buildScopedUpdates(selected, before) : selected;
  if (before.length >= 1000) throw new Error("Refusing incomplete backup: REST pagination required");
  const backupDir = join(REPO_ROOT, ".work", "hero-models");
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = join(backupDir, `specs-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(before, null, 2), { mode: 0o600 });
  console.log(`Database backup: ${backupPath}`);
  const result = await fetch(`${SUPABASE_URL}/rest/v1/specs?on_conflict=specialist_id,version`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(updates),
  });
  if (!result.ok) throw new Error(`Upsert failed: HTTP ${result.status}`);
  const after = await readRows();
  const keys = new Set(selected.map(row => `${row.specialist_id}:${row.version}`));
  const untouched = list => list.filter(row => !keys.has(`${row.specialist_id}:${row.version}`));
  if (JSON.stringify(untouched(before)) !== JSON.stringify(untouched(after))) {
    throw new Error("Non-selected specs changed during update; inspect backup before proceeding");
  }
  for (const row of selected) {
    const actual = after.find(item => item.specialist_id === row.specialist_id && item.version === row.version);
    if (JSON.stringify(actual?.payload?.modelRouting) !== JSON.stringify(row.payload.modelRouting)) {
      // PostgreSQL jsonb key order can differ, compare fields explicitly.
      if (!actual || Object.entries(row.payload.modelRouting).some(([key, value]) => actual.payload.modelRouting[key] !== value)) {
        throw new Error(`Routing verification failed for ${row.specialist_id}`);
      }
    }
  }
  console.log(`Upserted and verified ${selected.length} spec rows; all non-selected rows unchanged.`);
  return { before, after, backupPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await seedSpecs().catch(error => { console.error(error.message); process.exitCode = 1; });
}
