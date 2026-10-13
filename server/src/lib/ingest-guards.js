// Pure guards for untrusted client input at the ingest boundary.
//  - validateUpload: MIME/size/extension allow-list for evidence uploads,
//    so a huge or executable file can't be buffered into memory or parsed
//    by the compiler.
//  - assertPublicUrl: block SSRF (file://, localhost, RFC1918, link-local,
//    cloud metadata 169.254.169.254) before any server-side fetch/scrape
//    of a client-supplied URL.
// No I/O — testable with case tables.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

// Documents the compiler can read + images for the visual bucket.
export const ALLOWED_UPLOAD_EXTS = new Set([
  "pdf", "txt", "md", "markdown", "doc", "docx", "rtf", "csv",
  "png", "jpg", "jpeg", "webp", "gif", "svg",
  "otf", "ttf", "woff", "woff2",
]);
export const IMAGE_UPLOAD_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);
export const FONT_UPLOAD_EXTS = new Set(["otf", "ttf", "woff", "woff2"]);
const ALLOWED_MIME_PREFIXES = ["text/", "image/", "font/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "application/font-woff",
  "application/x-font-ttf",
  "application/x-font-opentype",
  "application/octet-stream", // some browsers send this for docs; the extension is the real gate
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
  if (!ALLOWED_UPLOAD_EXTS.has(ext)) return { ok: false, code: "EXT", message: `Unsupported file type .${ext || "?"}` };
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
  if (role === "logo" && !["svg", "png"].includes(normalizedExt)) return {ok:false,code:"LOGO_EXT",message:"Logos must be SVG or PNG"};
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
