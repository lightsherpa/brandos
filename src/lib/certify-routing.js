export { canEnterCertify, brandCoreNavTarget, resolveCertifyRoute, certifyJobPath } from "../../server/src/lib/certify-access.js";

// Owner confirmation used to open Certify. It now stays on Brand Book.
export const ownerCertifyPath = () => "brand-book";

export const ownerBrandFromCertify = (param) => param?.startsWith("owner/") ? decodeURIComponent(param.slice(6)) : null;

// Certify is never a client-portal route, whether or not VITE_CERTIFY_UX is on.
export function certifyRoutePortal() {
  return "team";
}
