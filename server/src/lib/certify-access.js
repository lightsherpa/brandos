// Certify is an internal review surface. Creative directors and certifying
// designers (steward / lead_steward) may open it. Brand owners, brand
// contacts and other workspace users read Brand Book instead.
const CERTIFY_PERSONAS = new Set(["creative_director"]);
const CERTIFIER_ROLES = new Set(["steward", "lead_steward"]);
const END_USER_PERSONAS = new Set(["user", "workspace_admin", "client"]);

export function canEnterCertify(actor) {
  if (!actor || actor._pending) return false;
  if (actor.scope === "workspace" || END_USER_PERSONAS.has(actor.persona)) return false;
  if (CERTIFY_PERSONAS.has(actor.persona)) return true;
  const roles = [...(actor.qualifications || []), ...(actor.roles || [])];
  return roles.some((role) => CERTIFIER_ROLES.has(role));
}

// Client dock "Brand Core" entry. End users land on Brand Book.
// Team reviewers keep the working Brand Core editor when they use that nav.
export function brandCoreNavTarget(actor) {
  const portal = actor?.portal || actor?.role || "client";
  if (portal === "team" && canEnterCertify(actor)) return "bio";
  return "brand-book";
}

// Typed URLs, owner-confirmation links and deep links.
// `certifyUx` is accepted so callers can pass VITE_CERTIFY_UX through, but
// the flag never grants Certify to someone the role gate refuses.
export function resolveCertifyRoute({ actor, portal, param, certifyUx = false } = {}) {
  void certifyUx;
  const surface = portal || actor?.portal || actor?.role || "client";
  if (actor?._pending) return { allow: false, redirect: null, pending: true };
  const ownerPath = typeof param === "string" && param.startsWith("owner/");
  if (!ownerPath && surface === "team" && canEnterCertify(actor)) return { allow: true, redirect: null };
  return { allow: false, redirect: surface === "team" ? "team-review" : "brand-book" };
}

export function certifyJobPath(actor, jobId, certifyUx = false) {
  const id = encodeURIComponent(String(jobId));
  if (!certifyUx || !resolveCertifyRoute({ actor, param: id, certifyUx }).allow) return `team-job/${id}`;
  return `certify/${id}`;
}
