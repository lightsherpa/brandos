import {foundationError} from "./brand-foundation.js";
import {validateFoundationAssets, loadLogoRights} from "./foundation-assets.js";
import {resolveFoundationForUse} from "./visual-assets.js";
import {scoreBio} from "./score-bio.js";
// Loads a brand + its active BIO from Supabase, and enforces the
// certification gate at the data layer (the only place it can live — the
// assembly runner is a client-side loop, so per-run loading is the gate).
//
// Two tiers, per the two-stage certification model:
//   • production (specialist runs, human craft)  → requireCertified: reads the
//     newest certified version with a foundation, or newest certification
//     for text work when no version has a foundation. Creative Director certification qualifies at
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
 * @param {boolean} [opts.requireFoundation=false] image/compositor gate only
 */
/* degradeRights: read-only callers (Brandolph Q&A) keep working if the logo-rights
   lookup fails; rights-dependent parts (foundation status, live score) are skipped
   and bio.rightsUnavailable is set. Production paths never pass it: they fail closed (503). */
export async function loadBrandBio({ workspaceId, brandId, requireCertified = false, requireSelfCertified = false, requireFoundation = false, degradeRights = false, bioVersion }) {
  if (bioVersion !== undefined && (!Number.isInteger(bioVersion) || bioVersion < 1)) throw bioError("BIO_VERSION_INVALID", "A positive exact BIO version is required", 400);
  let rightsUnavailable = false;
  const rightsFor = async (...payloads) => {
    try { return await loadLogoRights(brandRow.id, ...payloads); }
    catch (error) { if (!degradeRights || requireCertified) throw error; rightsUnavailable = true; return []; }
  };
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
  const {data:latest,error:latestError}=await supabaseAdmin.from("bios").select("payload,version").eq("brand_id",brandRow.id).order("version",{ascending:false}).limit(1).maybeSingle();
  if(latestError)throw bioError("BIO_UNAVAILABLE","Brand Core integrity check unavailable",503);
  const integrity=latest&&bioIntegrityError(latest,brandRow);
  if(integrity)throw bioError(integrity.code,integrity.error);
  // A reference update cannot silently generate from the older certified set.
  if (requireCertified && bioVersion === undefined && latest?.payload?.reference_intake) bioVersion = latest.version;
  // Resolve the gated BIO version.
  const bioColumns = "id, version, payload, score, certified, certified_by, certified_at, cert_kind, cert_valid_until, self_certified, self_certified_at, client_acceptance_required, client_accepted_at, client_accepted_by";
  let bioRow;
  let bioErr;
  let logoRights = [];
  if (requireCertified) {
    // Newest CD certification, or a newer self-cert at the floor. Expired
    // rows are skipped in selectProductionBio. Acceptance still blocks.
    const { data: rawRows, error } = await supabaseAdmin
      .from("bios")
      .select(bioColumns)
      .eq("brand_id", brandRow.id)
      .or(`certified.eq.true,and(self_certified.eq.true,score.gte.${SELF_CERT_MIN_SCORE})`)
      .order("version", { ascending: false });
    bioErr = error;
    if (!error) {
      // One rights set, used for selection AND the checks below.
      logoRights = await rightsFor(...(rawRows || []).map(row => row.payload));
      const rows = (rawRows || []).filter(row => (bioVersion === undefined || row.version === bioVersion) && (!row.payload?.reference_intake || row.certified === true));
      const withFoundation = rows.filter(row => !foundationError(row.payload, { logoRights }));
      if (requireFoundation) {
        // Image work: never fall back to a version without a rights-confirmed foundation.
        bioRow = selectProductionBio(withFoundation);
        const newest = bioRow ? null : selectProductionBio(rows || []);
        if (newest) { const f = foundationError(newest.payload, { logoRights }); throw Object.assign(bioError(f.code, f.error), { missing: f.missing, logoStatus: f.logoStatus, needsRights: f.needsRights, credits: 0, state: f.state }); }
      } else {
        // Text work doesn't need a foundation: prefer one, filtered by the same rights set.
        bioRow = selectProductionBio(withFoundation) || selectProductionBio(rows || []);
      }
    }
  } else {
    let bioQuery = supabaseAdmin
      .from("bios")
      .select(bioColumns)
      .eq("brand_id", brandRow.id);
    if (bioVersion !== undefined) bioQuery = bioQuery.eq("version", bioVersion);
    if (requireSelfCertified) bioQuery = bioQuery.eq("self_certified", true);
    const result = await bioQuery
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    bioRow = result.data;
    bioErr = result.error;
  }
  if (bioErr) throw new Error(`Brand Core lookup failed: ${bioErr.message}`);

  if (!bioRow) {
    let err;
    if (requireCertified) {
      err = bioError("BIO_NOT_CERTIFIED", `Brand Core for brand ${brandRow.id} has no certified version a run can use`);
    } else if (requireSelfCertified) {
      err = bioError("NOT_SELF_CERTIFIED", `Brand Core for brand ${brandRow.id} has not been self-certified`);
    } else {
      err = bioError("NO_BIO", `Brand ${brandRow.id} has no Brand Core yet — run Discovery`);
    }
    throw err;
  }

  if (!requireCertified) logoRights = await rightsFor(bioRow.payload);
  let runtimeVisual=bioRow.payload?.visual;
  if(requireCertified){
    const blocker=productionBlocker(bioRow);if(blocker)throw bioError(blocker.code,blocker.message);
    const foundation=foundationError(bioRow.payload,{logoRights});
    if(requireFoundation && foundation)throw Object.assign(bioError(foundation.code,foundation.error),{missing:foundation.missing,credits:0,state:foundation.state});
    if(requireFoundation){
      const invalid=await validateFoundationAssets(brandRow.id,runtimeVisual,runtimeVisual);
      if(invalid)throw bioError('FOUNDATION_INCOMPLETE',invalid);
      runtimeVisual=await resolveFoundationForUse(brandRow.id,runtimeVisual);
    }else if(!foundation){
      // Text work must remain usable even if a visual upload is unavailable.
      try{runtimeVisual=await resolveFoundationForUse(brandRow.id,runtimeVisual);}catch{}
    }
  }

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
      ...(runtimeVisual?{visual:runtimeVisual}:{}),
      id:                bioRow.id,
      version:           bioRow.version,
      score:             rightsUnavailable ? bioRow.score : scoreBio(bioRow.payload, { logoRights }),
      logoRights,
      ...(rightsUnavailable ? { rightsUnavailable: true } : {}),
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

/** Image/compositor preflight; never use for copy-only work. */
export function loadBioForImage({workspaceId,brandId,bioVersion}) {
 return loadBrandBio({workspaceId,brandId,requireCertified:true,requireFoundation:true,bioVersion});
}
