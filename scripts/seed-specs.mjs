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
//   node --env-file=server/.env scripts/seed-specs.mjs --only=a07,a08 --keep-db-route
//   Add --dry-run to preview. Always back up specs; never run a full seed.
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
import { deepStrictEqual } from "node:assert";

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
   times out before the first token, or is rate-limited. Includes existing image-route fallbacks. */
const FALLBACK_MAP = {
  sonnet55:   "anthropic/claude-sonnet-4-6",
  haiku55:    "anthropic/claude-haiku-4-5-20251001",
  gemFlash38: "openrouter/google/gemini-2.5-flash",
  gptimage: "vendor/fal/flux-1.1-pro",
  flux: "vendor/fal/flux-schnell",
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
            : agent.dept === "Visual"          ? ["palette", "type"]
            : agent.dept === "Concept"         ? ["positioning", "audience"]
            : agent.dept === "Web & UX"        ? ["voice", "palette", "type"]
            : agent.dept === "Motion & Sound"  ? ["voice", "palette"]
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

const PROMPT_CONTRACT_FIELDS = [
  "role", "objective", "method", "outputContract", "voice", "tools", "refusals", "bioSlices",
];
const USAGE = "Usage: seed-specs.mjs --only=<ids> [--keep-db-route] [--dry-run]";

export function parseSeedOptions(args) {
  let only;
  let keepDbRoute = false;
  let dryRun = false;
  const usageError = message => {
    const error = new Error(`${message}. ${USAGE}`);
    error.exitCode = 2;
    throw error;
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--only" || arg.startsWith("--only=")) {
      if (only !== undefined) usageError("Duplicate --only");
      only = arg === "--only" ? args[++i] : arg.slice("--only=".length);
      if (!only || only.startsWith("--") || only.split(",").some(id => !id.trim())) usageError("Invalid --only ids");
    } else if (arg === "--keep-db-route" && !keepDbRoute) keepDbRoute = true;
    else if (arg === "--dry-run" && !dryRun) dryRun = true;
    else usageError(`Unknown or duplicate flag ${arg}`);
  }
  if (!only) usageError("Refusing full seed: --only is required");
  return { ids: new Set(only.split(",").map(id => id.trim())), keepDbRoute, dryRun };
}

function rowsForOptions(options, candidates) {
  const unknown = [...options.ids].filter(id => !candidates.some(row => row.specialist_id === id));
  if (unknown.length) throw new Error(`Unknown specialist ids: ${unknown.join(",")}`);
  return candidates.filter(row => options.ids.has(row.specialist_id));
}

export function selectRows(args, candidates = rows) {
  return rowsForOptions(parseSeedOptions(args), candidates);
}

export function buildScopedUpdates(selected, before, { keepDbRoute = false } = {}) {
  return selected.map(row => {
    const existing = before.find(item => item.specialist_id === row.specialist_id && item.version === row.version);
    if (!existing) throw new Error(`Scoped update requires existing spec ${row.specialist_id}`);
    if (keepDbRoute && (!existing.payload?.modelRouting || typeof existing.payload.modelRouting.primary !== "string")) {
      throw new Error(`Cannot preserve missing DB routing for ${row.specialist_id}`);
    }
    const changes = keepDbRoute
      ? Object.fromEntries(PROMPT_CONTRACT_FIELDS.filter(key => row.payload[key] !== undefined).map(key => [key, row.payload[key]]))
      : { modelRouting: row.payload.modelRouting };
    return { specialist_id: row.specialist_id, version: row.version, active: existing.active,
      payload: { ...existing.payload, ...changes } };
  });
}

export async function seedSpecs(args = process.argv.slice(2), {
  fetchImpl = fetch, env = process.env, logger = console,
} = {}) {
  const options = parseSeedOptions(args);
  const selected = rowsForOptions(options, rows);
  const printPreview = updates => {
    for (const row of updates) logger.log(`${row.specialist_id}\t${row.payload.modelRouting?.primary}\t${row.payload.modelRouting?.fallback ?? "-"}\t${(row.payload.bioSlices || []).join(",")}`);
    logger.log(`DRY RUN: ${updates.length} row(s), nothing written.${options.keepDbRoute ? " DB modelRouting preserved; only prompt/contract fields would change." : ""}`);
  };
  // Ordinary previews are offline. Route-preserving previews read the DB so
  // they display the actual primary/fallback, rather than the source routes.
  if (options.dryRun && !options.keepDbRoute) {
    printPreview(selected);
    return { dryRun: true, updates: selected };
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase service-role environment");
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
  const readRows = async () => {
    const result = await fetchImpl(`${SUPABASE_URL}/rest/v1/specs?select=*&order=specialist_id,version`, { headers });
    if (!result.ok) throw new Error(`Backup/verification failed: HTTP ${result.status}`);
    const data = await result.json();
    if (!Array.isArray(data) || !data.length || data.length >= 1000) throw new Error("Refusing empty or incomplete specs snapshot");
    return data;
  };
  const before = await readRows();
  const updates = buildScopedUpdates(selected, before, options);
  if (options.dryRun) {
    printPreview(updates);
    return { dryRun: true, before, updates };
  }
  const backupDir = join(REPO_ROOT, "backups");
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = join(backupDir, `specs-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(before, null, 2), { mode: 0o600, flag: "wx" });
  // Confirm a readable, complete backup exists before the first mutation.
  deepStrictEqual(JSON.parse(readFileSync(backupPath, "utf8")), before);
  logger.log(`Database backup confirmed: ${backupPath} (${before.length} rows)`);
  logger.log(`Seeding ${updates.length} row(s): ${updates.map(row => row.specialist_id).join(", ")}`);
  const result = await fetchImpl(`${SUPABASE_URL}/rest/v1/specs?on_conflict=specialist_id,version`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(updates),
  });
  if (!result.ok) throw new Error(`Upsert failed: HTTP ${result.status}`);
  const after = await readRows();
  const keys = new Set(selected.map(row => `${row.specialist_id}:${row.version}`));
  const untouched = list => list.filter(row => !keys.has(`${row.specialist_id}:${row.version}`));
  deepStrictEqual(untouched(after), untouched(before), "Non-selected specs changed during update; inspect backup");
  for (const expected of updates) {
    const actual = after.find(item => item.specialist_id === expected.specialist_id && item.version === expected.version);
    if (!actual) throw new Error(`Missing spec after seed: ${expected.specialist_id}`);
    // JSON serialization removes undefined values before PostgREST stores jsonb.
    deepStrictEqual(actual.payload, JSON.parse(JSON.stringify(expected.payload)), `Payload verification failed for ${expected.specialist_id}`);
    deepStrictEqual(actual.active, expected.active, `Live status changed for ${expected.specialist_id}`);
    if (options.keepDbRoute) {
      const previous = before.find(item => item.specialist_id === expected.specialist_id && item.version === expected.version);
      deepStrictEqual(actual.payload.modelRouting, previous.payload.modelRouting, `DB routing changed for ${expected.specialist_id}`);
    }
  }
  logger.log(`Upserted and verified ${selected.length} spec rows; all non-selected rows unchanged.${options.keepDbRoute ? " All selected DB modelRouting values unchanged." : ""}`);
  return { before, after, backupPath, updates };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await seedSpecs().catch(error => { console.error(error.message); process.exitCode = error.exitCode || 1; });
}
