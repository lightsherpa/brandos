// Brand identity is pinned by the selected record, never by a model's guess.
export function websiteHost(value) {
  if (!value) return null;
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}
export function discoveryWebsiteError(brand, url) {
  const expected = websiteHost(brand?.url), supplied = websiteHost(url);
  if (expected && supplied && expected !== supplied) return {
    code: "BRAND_SOURCE_MISMATCH",
    error: `This website does not belong to the selected brand (${brand.name}). Select or add its own brand before starting Discovery.`,
  };
  return null;
}
export function bioIntegrityError(bio, brand) {
  const identity = bio?.payload?.sourceIdentity;
  if (bio?.payload?.sourceIntegrity?.status === "quarantined") return {
    code: "BIO_SOURCE_QUARANTINED",
    error: "This BIO contains sources from another brand and has been withheld. The original record is preserved. Start a clean Discovery for this brand.",
  };
  if (identity && (identity.brandId !== brand.id || discoveryWebsiteError(brand, identity.primaryUrl))) return {
    code: "BIO_BRAND_MISMATCH", error: "The BIO does not match the selected brand. It cannot be displayed or used.",
  };
  return null;
}
