// bio-stage.js — the one place that decides where a BIO sits in the
// agreed certification journey (Notion, 2026-09-09):
//
//   Automated checks passed → Awaiting Creative Director review
//     → Awaiting your approval (only when the Creative Director changed it)
//     → Certified for production
//
// Pure functions so the gate is unit-testable without a database.

import { SELF_CERT_MIN_SCORE } from "./self-cert-floor.js";

export function isCertExpired(row, now = new Date()) {
  return !!row?.cert_valid_until && new Date(row.cert_valid_until) <= now;
}

export function awaitsClientAcceptance(row) {
  return !!row?.certified && !!row?.client_acceptance_required && !row?.client_accepted_at;
}

/**
 * Production readiness of a certified BIO row (the highest certified version).
 * Brief analysis, crew assembly, generation and human craft all share this.
 * @returns {null | {code:string, message:string}}  null = ready
 */
export function productionBlocker(row, now = new Date()) {
  if(row?.payload?.sourceIntegrity?.status==="quarantined")return {code:"BIO_SOURCE_QUARANTINED",message:"This Brand Core contains sources from another brand and cannot be used."};
  const cd = !!row?.certified;
  const selfReady = !!row?.self_certified && Number(row?.score) >= SELF_CERT_MIN_SCORE;
  if (!row || (!cd && !selfReady)) {
    return { code: "BIO_NOT_CERTIFIED", message: "This brand's Brand Core is waiting for Creative Director certification." };
  }
  if (isCertExpired(row, now)) {
    return { code: "BIO_NOT_CERTIFIED", message: "This brand's Brand Core certification has expired." };
  }
  if (cd && awaitsClientAcceptance(row)) {
    return { code: "BIO_AWAITING_ACCEPTANCE", message: "Your Creative Director changed the Brand Core. Review and accept the changes to continue." };
  }
  return null;
}

/**
 * Newest BIO a specialist run may use. Creative Director certification
 * qualifies at any score. A self-certified version qualifies only at or
 * above the self-cert floor. Expired rows are skipped. A newer certified
 * row that still needs client acceptance is returned so the caller can
 * block on it instead of silently using an older version.
 */
export function selectProductionBio(rows, now = new Date()) {
  const ranked = (Array.isArray(rows) ? rows : []).filter(Boolean)
    .sort((a, b) => (Number(b?.version) || 0) - (Number(a?.version) || 0));
  for (const row of ranked) {
    if (isCertExpired(row, now)) continue;
    if (row.certified) return row;
    if (row.self_certified && Number(row.score) >= SELF_CERT_MIN_SCORE) return row;
  }
  return null;
}

/**
 * User-facing stage of the LATEST BIO version.
 * @param {object|null} row            latest bios row
 * @param {boolean} reviewPending      an open Creative Director review job exists for it
 */
export function bioStage(row, reviewPending = false, now = new Date()) {
  if (!row) return "no_bio";
  if (row.certified) {
    if (isCertExpired(row, now)) return "expired";
    if (awaitsClientAcceptance(row)) return "awaiting_your_approval";
    return "certified";
  }
  if (reviewPending) return "awaiting_review";
  if (row.self_certified) return "checks_passed";
  return "draft";
}

/**
 * Can the user accept the Creative Director's changes on `version`?
 * `row` is the brand's highest certified BIO version.
 * @returns {null | {code:string, error:string}}  null = accept allowed
 */
export function acceptanceError(row, version) {
  if (!awaitsClientAcceptance(row)) return { code: "NOTHING_TO_ACCEPT", error: "Nothing is waiting for your approval" };
  if (row.version !== version) return { code: "STALE_VERSION", error: "The Brand Core changed since you reviewed it. Reload and review again." };
  return null;
}
