#!/usr/bin/env node
// Load Cake Me's Brand Core foundation into ONE brand (approved by Oscar 2026-10-13 11:34).
// Dry-run by default. Requires --only=<brandId> matching CAKE_ME_ID; refuses anything else.
//   node --env-file=server/.env scripts/load-cake-me-foundation.mjs --only=35f265f0-0546-4a9a-b793-a49887ad7125 --assets=/tmp/cakeme --actor=<owner uuid> [--apply]
// Steps (mirrors the UI routes): upload 3 logos + Fraunces (bio_sources, rights confirmed) →
// tag the 3 role-less reference PNGs canonical → append a new Brand Core version (append_bio_version)
// → self-certify it through selfCertifyBio (v2 review) → verify foundation + score.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const CAKE_ME_ID = "35f265f0-0546-4a9a-b793-a49887ad7125";
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const only = arg("only"), assets = arg("assets"), actor = arg("actor"), apply = process.argv.includes("--apply");
if (only !== CAKE_ME_ID) { console.error(`Refusing: --only=${CAKE_ME_ID} is required (got ${only || "none"})`); process.exit(2); }
if (!assets || !actor) { console.error("--assets and --actor are required"); process.exit(2); }
const { supabaseAdmin: db } = await import("../server/src/lib/supabase.js");
const { validateVisualAssetMetadata } = await import("../server/src/lib/ingest-guards.js");
const { foundationUploadError } = await import("../server/src/lib/foundation-upload.js");
const { validateFoundationAssets } = await import("../server/src/lib/foundation-assets.js");
const { foundationStatus } = await import("../server/src/lib/brand-foundation.js");
const { prepareClientBioEditPayload } = await import("../server/src/lib/bio-evidence.js");
const { scoreBio } = await import("../server/src/lib/score-bio.js");
const { selfCertifyBio } = await import("../server/src/lib/self-certify.js");
const { CERTIFICATION_SECTIONS } = await import("../server/src/lib/certification-review.js").catch(() => ({}));

const log = (...a) => console.log(apply ? "[apply]" : "[dry-run]", ...a);
const { data: brand } = await db.from("brands").select("id, name, workspace_id").eq("id", only).single();
if (!/^cake[\s-]?me$/i.test(brand?.name || "")) { console.error("Refusing: brand is not Cake Me"); process.exit(2); }
const { data: prev } = await db.from("bios").select("id, version, payload, score").eq("brand_id", only).order("version", { ascending: false }).limit(1).single();
log(`brand ${brand.name} · current v${prev.version} stored score ${prev.score} · displayed ${scoreBio(prev.payload)} · foundation ${JSON.stringify(foundationStatus(prev.payload).missing)}`);

const FILES = [
  { key: "primary", file: "logos/logo-wordmark-primary.png", role: "logo", logoVariant: "light" },  // Golden Pop wordmark (a light-coloured logo)
  { key: "onDark", file: "logos/logo-wordmark-on-dark.png", role: "logo", logoVariant: "light" },   // white logo → dark backgrounds
  { key: "ink", file: "logos/logo-wordmark-ink.png", role: "logo", logoVariant: "dark" },           // graphite logo → light backgrounds
  { key: "fraunces", file: "Fraunces.ttf", role: "font", fontFamily: "Fraunces", fontUsage: "Display", licenseType: "open_source", licenseReference: "SIL OFL 1.1 (Google Fonts) — stand-in for Meaty Nineties" },
];
const ids = {};
for (const f of FILES) {
  const buf = fs.readFileSync(path.join(assets, f.file));
  const ext = path.extname(f.file).slice(1).toLowerCase();
  const meta = validateVisualAssetMetadata({ ext, assetRole: f.role, logoVariant: f.logoVariant, rightsConfirmed: true, fontFamily: f.fontFamily, fontUsage: f.fontUsage, licenseType: f.licenseType, licenseReference: f.licenseReference });
  if (!meta.ok) throw Error(`${f.file}: ${meta.message}`);
  const bad = await foundationUploadError(buf, ext, meta.metadata);
  if (bad) throw Error(`${f.file}: ${bad.error}`);
  const name = path.basename(f.file);
  const { data: existing } = await db.from("bio_sources").select("id").eq("brand_id", only).eq("kind", "file_upload").eq("bucket", "visual").eq("src", name).maybeSingle();
  if (existing) { ids[f.key] = existing.id; log(`reuse ${name} → ${existing.id}`); continue; }
  if (!apply) { ids[f.key] = `dry-${f.key}`; log(`would upload ${name} (${buf.length} B) ${JSON.stringify(meta.metadata)}`); continue; }
  const objectPath = `${brand.workspace_id}/${only}/${crypto.randomUUID()}-${name}`;
  const mime = ext === "png" ? "image/png" : "font/ttf";
  const up = await db.storage.from("bio-sources").upload(objectPath, buf, { contentType: mime, upsert: false });
  if (up.error) throw Error(`storage ${name}: ${up.error.message}`);
  const { data: uploadRow, error: uErr } = await db.from("uploads").insert({ workspace_id: brand.workspace_id, user_id: actor, brand_id: only, url: objectPath, mime, bucket_hint: "visual" }).select("id").single();
  if (uErr) throw Error(`uploads ${name}: ${uErr.message}`);
  const { data: src, error: sErr } = await db.from("bio_sources").insert({ brand_id: only, kind: "file_upload", bucket: "visual", src: name, raw_ref: objectPath,
    signals: { size: buf.length, mime, upload_id: uploadRow.id, ext, purpose: "current", ...meta.metadata, rights_confirmed_by: actor, rights_confirmed_at: new Date().toISOString(), loaded_by: "scripts/load-cake-me-foundation.mjs" } }).select("id").single();
  if (sErr) throw Error(`bio_sources ${name}: ${sErr.message}`);
  ids[f.key] = src.id; log(`uploaded ${name} → ${src.id}`);
}

// Tag the role-less reference PNGs canonical (rights confirmed by Oscar).
const { data: refs } = await db.from("bio_sources").select("id, src, signals").eq("brand_id", only).eq("kind", "file_upload").eq("bucket", "visual").in("src", ["53.png", "56.png", "58.png"]);
if ((refs || []).length !== 3) throw Error(`expected 3 reference PNGs, found ${(refs || []).length}`);
for (const r of refs) {
  if (r.signals?.asset_role === "canonical" && r.signals?.rights_confirmed === true) { log(`ref ${r.src} already canonical`); continue; }
  if (r.signals?.asset_role) throw Error(`ref ${r.src} already has role ${r.signals.asset_role}; not overwriting`);
  const signals = { ...(r.signals || {}), asset_role: "canonical", asset_kind: "image_reference", rights_confirmed: true, rights_confirmed_by: actor, rights_confirmed_at: new Date().toISOString() };
  if (apply) { const { error } = await db.from("bio_sources").update({ signals }).eq("id", r.id).eq("brand_id", only); if (error) throw Error(`tag ${r.src}: ${error.message}`); }
  log(`${apply ? "tagged" : "would tag"} ${r.src} canonical`);
}

// New Brand Core version.
const visual = { ...(prev.payload.visual || {}) };
const ROLE = { "#ffd115": ["primary", "Golden Pop"], "#ff4375": ["accent", "Berrybeat"], "#ffffff": ["surface", "Milkdrop"], "#3f3f3f": ["ink", "Graphite Whisper"] };
const others = (visual.palette || []).filter((c) => !ROLE[c.hex?.toLowerCase()]).map(({ role, ...c }) => c);
visual.palette = [...Object.entries(ROLE).map(([hex, [role, name]]) => ({ hex: hex.toUpperCase(), name, role, roleStatus: "confirmed" })), ...others];
visual.logo = { sourceId: ids.primary, source: "logo-wordmark-primary.png", conf: 100,
  variants: { light: { sourceId: ids.onDark, source: "logo-wordmark-on-dark.png", conf: 100 }, dark: { sourceId: ids.ink, source: "logo-wordmark-ink.png", conf: 100 } } };
visual.type = [
  { family: "Fraunces", kind: "Display", sourceId: ids.fraunces, note: "Stand-in for Meaty Nineties (commercial, not licensed here)" },
  { family: "Lato", kind: "Body", provider: "google" },
  { family: "Inter", kind: "Label", provider: "google" },
];
visual.references = refs.map((r) => ({ sourceId: r.id, name: r.src, role: "canonical" }));
const payload = prepareClientBioEditPayload({ ...prev.payload, visual }, prev.payload);
const status = foundationStatus(payload);
log(`new payload: foundation ${status.certifiable ? "PASS" : "FAIL " + status.missing.join(",")} · score ${scoreBio(payload)}`);
if (!apply) { console.log(JSON.stringify(payload.visual, null, 1)); process.exit(0); }
const assetErr = await validateFoundationAssets(only, payload.visual, prev.payload.visual);
if (assetErr) throw Error(`foundation assets: ${assetErr}`);
const { data: row, error: aErr } = await db.rpc("append_bio_version", { p_brand_id: only, p_payload: payload, p_score: scoreBio(payload), p_created_by: actor, p_discovery_id: null });
if (aErr) throw Error(`append_bio_version: ${aErr.message}`);
const { data: nb } = await db.from("bios").select("id, version, payload").eq("brand_id", only).order("version", { ascending: false }).limit(1).single();
log(`appended v${nb.version} (${nb.id})`);
const sections = CERTIFICATION_SECTIONS || ["identity", "voice", "visual", "audience", "proof"];
const cert = await selfCertifyBio({ brandId: only, bioId: nb.id, payload: nb.payload, userId: actor, statements: { authority: true, reflects: true, aspirationalMarked: true }, fieldMarks: {}, statementVersion: "2",
  review: { reviewedSections: [...sections], statements: { authority: true, reflects: true, aspirationalMarked: true } } });
log(`self-certify: ${JSON.stringify(cert)}`);
if (!cert.ok) process.exit(1);
const { data: fin } = await db.from("bios").select("version, score, certified, self_certified, payload").eq("brand_id", only).order("version", { ascending: false }).limit(1).single();
console.log(JSON.stringify({ version: fin.version, stored_score: fin.score, displayed_score: scoreBio(fin.payload), self_certified: fin.self_certified, foundation: foundationStatus(fin.payload) }));
