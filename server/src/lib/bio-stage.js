// bio-stage.js — the one place that decides where a BIO sits in the
// agreed certification journey (Notion, 2026-09-09):
//
//   Automated checks passed → Awaiting Creative Director review
//     → Awaiting your approval (only when the Creative Director changed it)
//     → Certified for production
//
// Pure functions so the gate is unit-testable without a database.

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
  if (!row || !row.certified) {
    return { code: "BIO_NOT_CERTIFIED", message: "This brand's BIO is waiting for Creative Director certification." };
  }
  if (isCertExpired(row, now)) {
    return { code: "BIO_NOT_CERTIFIED", message: "This brand's BIO certification has expired." };
  }
  if (awaitsClientAcceptance(row)) {
    return { code: "BIO_AWAITING_ACCEPTANCE", message: "Your Creative Director changed the BIO. Review and accept the changes to continue." };
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
  if (row.version !== version) return { code: "STALE_VERSION", error: "The BIO changed since you reviewed it. Reload and review again." };
  return null;
}
