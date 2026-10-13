// Pure guards for untrusted client input at the ingest boundary.
//  - validateUpload: MIME/size/extension allow-list for evidence uploads,
//    so a huge or executable file can't be buffered into memory or parsed
//    by the compiler.
//  - assertPublicUrl: block SSRF (file://, localhost, RFC1918, link-local,
//    cloud metadata 169.254.169.254) before any server-side fetch/scrape
//    of a client-supplied URL.
// No I/O — testable with case tables.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

// Exactly the bio-sources bucket allowed_mime_types (see BUCKET_MIME_TYPES):
// anything else would be accepted here and then 500 at Storage, so it 400s instead.
export const BUCKET_MIME_TYPES = Object.freeze([
  "application/font-woff", "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "font/otf", "font/ttf", "font/woff", "font/woff2",
  "image/jpeg", "image/png", "image/webp", "text/markdown", "text/plain",
]);
export const ALLOWED_UPLOAD_EXTS = new Set([
  "pdf", "txt", "md", "markdown", "docx", "pptx",
  "png", "jpg", "jpeg", "webp",
  "otf", "ttf", "woff", "woff2",
]);
export const IMAGE_UPLOAD_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);
export const SVG_UNSUPPORTED_MESSAGE = "SVG files aren't supported. Export the logo as a PNG (transparent background works best) and upload that.";
/* Stored content type comes from the validated extension, never the browser. */
export const CONTENT_TYPE_BY_EXT = Object.freeze({
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown", markdown: "text/markdown",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
});
export const contentTypeForExt = (ext) => CONTENT_TYPE_BY_EXT[String(ext || "").toLowerCase()] || null;
const FONT_MIMES = new Set(["font/ttf", "font/otf", "font/woff", "font/woff2", "font/sfnt", "application/font-woff"]);
export const FONT_UPLOAD_EXTS = new Set(["otf", "ttf", "woff", "woff2"]);
const ALLOWED_MIME_PREFIXES = ["text/", "image/", "font/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/font-woff",
  "application/octet-stream", // some browsers send this for docs (never accepted for fonts)
  "",
]);

/**
 * @param {{ mime?: string, size?: number, filename?: string }} f
 * @returns {{ ok: true, ext: string } | { ok: false, code: string, message: string }}
 */
export function validateUpload({ mime = "", size = 0, filename = "" } = {}) {
  if (!Number.isFinite(size) || size <= 0) return { ok: false, code: "EMPTY", message: "Empty file" };
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "TOO_LARGE", message: `File exceeds ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB` };
  }
  const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
  const m = String(mime || "").toLowerCase();
  if (ext === "svg" || m === "image/svg+xml") return { ok: false, code: "SVG_UNSUPPORTED", message: SVG_UNSUPPORTED_MESSAGE };
  if (!ALLOWED_UPLOAD_EXTS.has(ext)) return { ok: false, code: "EXT", message: `Unsupported file type .${ext || "?"}` };
  if (FONT_UPLOAD_EXTS.has(ext) && !FONT_MIMES.has(m)) return { ok: false, code: "MIME", message: `Fonts must be uploaded as font/${ext === "otf" ? "otf" : ext} (got ${m || "no content-type"})` };
  const mimeOk = ALLOWED_MIME_EXACT.has(m) || ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p));
  if (!mimeOk) return { ok: false, code: "MIME", message: `Unsupported content-type ${m}` };
  return { ok: true, ext };
}

const VISUAL_ROLES = new Set(["canonical", "inspiration", "font", "logo"]);
const FONT_LICENSES = new Set(["commercial", "open_source", "custom", "system"]);

/* Visual evidence carries intent and rights at ingest time. A file merely
   existing in Storage must never make it eligible for model conditioning. */
export function validateVisualAssetMetadata({
  ext = "",
  assetRole = "inspiration",
  logoVariant = "light",
  rightsConfirmed = false,
  fontFamily = "",
  fontUsage = "",
  licenseType = "",
  licenseReference = "",
} = {}) {
  const normalizedExt = String(ext).toLowerCase().replace(/^\./, "");
  const isFont = FONT_UPLOAD_EXTS.has(normalizedExt);
  const isImage = IMAGE_UPLOAD_EXTS.has(normalizedExt);
  const role = String(assetRole || "inspiration").trim();
  if (!VISUAL_ROLES.has(role) || (role === "font" && !isFont)) return {ok:false,code:"ASSET_ROLE",message:"Choose logo, canonical, inspiration or font"};
  if (!rightsConfirmed) {
    return { ok: false, code: "RIGHTS", message: "Confirm that this brand has the right to use this visual asset" };
  }
  if (role === "logo" && normalizedExt === "svg") return {ok:false,code:"SVG_UNSUPPORTED",message:SVG_UNSUPPORTED_MESSAGE};
  if (role === "logo" && normalizedExt !== "png") return {ok:false,code:"LOGO_EXT",message:"Logos must be PNG"};
  if (isFont) {
    const family = String(fontFamily).trim();
    const license = String(licenseType).trim();
    const usage = String(fontUsage || "Display").trim();
    if (!/^(Display|Body|Both)$/i.test(usage)) return {ok:false,code:"FONT_USAGE",message:"Choose Display, Body or Both"};
    if (!family) return { ok: false, code: "FONT_FAMILY", message: "Font family name is required" };
    if (!FONT_LICENSES.has(license)) return { ok: false, code: "FONT_LICENSE", message: "Choose a supported font licence type" };
    return {
      ok: true,
      metadata: {
        asset_kind: "font",
        asset_role: "font",
        rights_confirmed: true,
        font_family: family,
        font_usage: usage[0].toUpperCase() + usage.slice(1).toLowerCase(),
        license_type: license,
        license_reference: String(licenseReference).trim(),
      },
    };
  }
  if (role === "logo" && !["light", "dark"].includes(logoVariant)) return { ok:false, code:"LOGO_VARIANT", message:"Choose a light or dark logo variant (light logo for dark backgrounds, dark logo for light backgrounds)" };
  return {
    ok: true,
    metadata: {
      ...(role === "logo" ? { logo_variant:logoVariant } : {}),
      asset_kind: role === "logo" ? "logo" : isImage ? "image_reference" : "visual_document",
      asset_role: role,
      rights_confirmed: true,
    },
  };
}

const PRIVATE_V4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

/**
 * Throws (with .code) if the URL is not a public http(s) endpoint.
 * ponytail: literal-host guard only — add a DNS-resolve-then-check layer
 * if we ever fetch a client URL from our OWN network (today scraping goes
 * through Firecrawl, an external service).
 * @returns {string} the normalized href when public
 */
export function assertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw)); }
  catch { const e = new Error("Invalid URL"); e.code = "BAD_URL"; throw e; }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    const e = new Error(`Blocked URL scheme ${u.protocol}`); e.code = "BAD_SCHEME"; throw e;
  }
  const host = u.hostname.toLowerCase();
  // WHATWG URL keeps IPv6 hosts bracketed ("[::1]") — strip for IP checks.
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (host === "localhost" || bare === "0.0.0.0" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    const e = new Error("Blocked internal host"); e.code = "PRIVATE_HOST"; throw e;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare) && PRIVATE_V4.some((re) => re.test(bare))) {
    const e = new Error("Blocked private IP"); e.code = "PRIVATE_IP"; throw e;
  }
  if (bare === "::1" || bare.startsWith("fc") || bare.startsWith("fd") || bare.startsWith("fe80")) {
    const e = new Error("Blocked private IPv6"); e.code = "PRIVATE_IP"; throw e;
  }
  return u.href;
}

/* Storage policy rejections (bucket MIME list / size limit) are the client's
   file, not a server fault. Matched on the storage error's status/code only,
   never its message text. storage-js StorageApiError: status = HTTP status,
   statusCode = body.statusCode || body.code (e.g. "415", "413", "InvalidMimeType"). */
const STORAGE_REJECT_CODES = new Set(["413", "415", "InvalidMimeType", "invalid_mime_type", "EntityTooLarge", "entity_too_large"]);
export function isStorageRejection(error) {
  if (!error || typeof error !== "object") return false;
  return [413, 415].includes(Number(error.status)) || STORAGE_REJECT_CODES.has(String(error.statusCode ?? "")) || STORAGE_REJECT_CODES.has(String(error.code ?? ""));
}
