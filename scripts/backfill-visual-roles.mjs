#!/usr/bin/env node
// S1 backfill: legacy visual-bucket image uploads have no signals.asset_role
// and no rights_confirmed (they predate ingest-guards), so they never reach
// generation. This lists them and, only with --apply, sets
// asset_role='canonical' and rights_confirmed=true.
//
//   node --env-file=server/.env scripts/backfill-visual-roles.mjs --only=<brandId>[,<brandId>] [--role=canonical|inspiration] [--apply]
//
// Dry-run is the default. --only is required (no workspace-wide writes).
// Production writes need Oscar's approval; do not pass --apply against prod
// without it.
import { createClient } from "@supabase/supabase-js";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;

export function parseArgs(argv) {
  const out = { only: [], apply: false, role: "canonical" };
  for (const a of argv) {
    if (a.startsWith("--only=")) out.only = a.slice(7).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--apply") out.apply = true;
    else if (a === "--dry-run") out.apply = false;
    else if (a.startsWith("--role=")) out.role = a.slice(7);
  }
  if (!out.only.length) throw new Error("--only=<brandId> is required");
  if (!["canonical", "inspiration"].includes(out.role)) throw new Error("--role must be canonical or inspiration");
  return out;
}

export function rowsToBackfill(rows = []) {
  return rows.filter((r) => r.bucket === "visual" && r.kind === "file_upload" && !r.signals?.asset_role && IMAGE_EXT.test(String(r.src || r.raw_ref || "")));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  console.log(`[backfill] target ${new URL(process.env.SUPABASE_URL).host} · ${args.apply ? "APPLY" : "dry-run"} · role=${args.role}`);
  for (const brandId of args.only) {
    const { data, error } = await db.from("bio_sources").select("id, src, raw_ref, bucket, kind, signals").eq("brand_id", brandId);
    if (error) throw error;
    const todo = rowsToBackfill(data || []);
    console.log(`[backfill] brand ${brandId}: ${todo.length} row(s)`);
    for (const r of todo) {
      console.log(`  - ${r.id} ${r.src}`);
      if (!args.apply) continue;
      const signals = { ...(r.signals || {}), asset_kind: "image_reference", asset_role: args.role, rights_confirmed: true, backfilled_at: new Date().toISOString() };
      const { error: upErr } = await db.from("bio_sources").update({ signals }).eq("id", r.id);
      if (upErr) throw upErr;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
