export const ownerCertifyPath = brandId => `certify/owner/${encodeURIComponent(brandId)}`;
export const ownerBrandFromCertify = param => param?.startsWith('owner/') ? decodeURIComponent(param.slice(6)) : null;
export function certifyRoutePortal(param, enabled) {
  return enabled && param?.startsWith('owner/') ? 'client' : 'team';
}
