// Loads a brand + its active BIO from Supabase, and enforces the
// certification gate at the data layer (the only place it can live — the
// assembly runner is a client-side loop, so per-run loading is the gate).
//
// Two tiers, per the two-stage certification model:
//   • production (specialist runs, human craft)  → requireCertified: reads the
//     newest certified version. Creative Director certification qualifies at
//     any score; a self-certified version qualifies only at score >= 80.
//     Throws BIO_NOT_CERTIFIED (409) otherwise.
//   • briefing (sharpener, brief authoring)       → requireSelfCertified: reads
//     the highest SELF-certified version; throws NOT_SELF_CERTIFIED (409).
//   • read-only (Brandolph Q&A)                   → neither flag: latest version;
//     throws NO_BIO (409) if the brand has no BIO at all.
//
// Missing BIO data always fails closed. A request is never answered with a
// different brand's fixture or fallback content.
//
// Returns { brand, bio, refusals } shaped for prompt.js consumption; the bio
// is always run through normalizeBio, so every consumer gets a CanonicalBio.

import {bioIntegrityError} from "./brand-source-integrity.js";
import { supabaseAdmin } from "./supabase.js";
import { productionBlocker, selectProductionBio } from "./bio-stage.js";
import { SELF_CERT_MIN_SCORE } from "./self-cert-floor.js";
import { normalizeBio } from "./bio-schema.js";

function bioError(code, message, status = 409) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  return e;
}

/**
 * @param {object} opts
 * @param {string} opts.workspaceId              caller's workspace (from auth middleware)
 * @param {string} [opts.brandId]                specific brand; defaults to first brand in workspace
 * @param {boolean} [opts.requireCertified=false]      production gate — highest human-certified version
 * @param {boolean} [opts.requireSelfCertified=false]  briefing gate — highest self-certified version
 */
export async function loadBrandBio({ workspaceId, brandId, requireCertified = false, requireSelfCertified = false }) {
  // Resolve brand
  let brandRow;
  if (brandId) {
    const { data, error } = await supabaseAdmin
      .from("brands")
      .select("id, name, url, workspace_id, refusals, default_locale, output_locales")
      .eq("id", brandId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(`Brand lookup failed: ${error.message}`);
    if (!data) throw new Error(`Brand ${brandId} not found in workspace`);
    brandRow = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("brands")
      .select("id, name, url, workspace_id, refusals, default_locale, output_locales")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Brand lookup failed: ${error.message}`);
    if (!data) throw new Error(`No brands in workspace ${workspaceId}`);
    brandRow = data;
  }

  // Check latest lineage even when an older certified version is requested.
  const {data:latest,error:latestError}=await supabaseAdmin.from("bios").select("payload").eq("brand_id",brandRow.id).order("version",{ascending:false}).limit(1).maybeSingle();
  if(latestError)throw bioError("BIO_UNAVAILABLE","BIO integrity check unavailable",503);
  const integrity=latest&&bioIntegrityError(latest,brandRow);
  if(integrity)throw bioError(integrity.code,integrity.error);
  // Resolve the gated BIO version.
  const bioColumns = "id, version, payload, score, certified, certified_by, certified_at, cert_kind, cert_valid_until, self_certified, self_certified_at, client_acceptance_required, client_accepted_at, client_accepted_by";
  let bioRow;
  let bioErr;
  if (requireCertified) {
    // Newest CD certification, or a newer self-cert at the floor. Expired
    // rows are skipped in selectProductionBio. Acceptance still blocks.
    const { data: rows, error } = await supabaseAdmin
      .from("bios")
      .select(bioColumns)
      .eq("brand_id", brandRow.id)
      .or(`certified.eq.true,and(self_certified.eq.true,score.gte.${SELF_CERT_MIN_SCORE})`)
      .order("version", { ascending: false })
      .limit(20);
    bioErr = error;
    bioRow = selectProductionBio(rows || []);
  } else {
    let bioQuery = supabaseAdmin
      .from("bios")
      .select(bioColumns)
      .eq("brand_id", brandRow.id);
    if (requireSelfCertified) bioQuery = bioQuery.eq("self_certified", true);
    const result = await bioQuery
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    bioRow = result.data;
    bioErr = result.error;
  }
  if (bioErr) throw new Error(`BIO lookup failed: ${bioErr.message}`);

  if (!bioRow) {
    let err;
    if (requireCertified) {
      err = bioError("BIO_NOT_CERTIFIED", `BIO for brand ${brandRow.id} has no certified version a run can use`);
    } else if (requireSelfCertified) {
      err = bioError("NOT_SELF_CERTIFIED", `BIO for brand ${brandRow.id} has not been self-certified`);
    } else {
      err = bioError("NO_BIO", `Brand ${brandRow.id} has no BIO yet — run Discovery`);
    }
    throw err;
  }

  if(requireCertified){const blocker=productionBlocker(bioRow);if(blocker)throw bioError(blocker.code,blocker.message);}

  return {
    brand: {
      id: brandRow.id,
      name: brandRow.name,
      url: brandRow.url,
      tagline: bioRow.payload?.identity?.positioning,
      default_locale: brandRow.default_locale,
      output_locales: brandRow.output_locales,
    },
    bio: normalizeBio({
      ...bioRow.payload,
      id:                bioRow.id,
      version:           bioRow.version,
      score:             bioRow.score,
      certified:         bioRow.certified,
      certified_by:      bioRow.certified_by,
      certified_at:      bioRow.certified_at,
      cert_kind:         bioRow.cert_kind,
      cert_valid_until:  bioRow.cert_valid_until,
      self_certified:    bioRow.self_certified,
      self_certified_at: bioRow.self_certified_at,
    }),
    refusals: Array.isArray(brandRow.refusals) ? brandRow.refusals : [],
  };
}

/**
 * Production gate — specialist runs and human craft MUST go through this.
 * Reads the newest certified BIO: Creative Director certification, or a
 * self-certified version whose score is at least 80. Throws
 * BIO_NOT_CERTIFIED (409) when neither exists. This is the moat contract.
 */
export function loadBioForRun({ workspaceId, brandId }) {
  return loadBrandBio({ workspaceId, brandId, requireCertified: true });
}

/**
 * Briefing gate — the sharpener and brief authoring go through this. Reads
 * the highest self-certified BIO version; throws NOT_SELF_CERTIFIED (409)
 * if the client has not self-certified.
 */
export function loadBioForBriefing({ workspaceId, brandId }) {
  return loadBrandBio({ workspaceId, brandId, requireSelfCertified: true });
}
