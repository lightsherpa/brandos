import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import { ALLOWED_UPLOAD_EXTS, BUCKET_MIME_TYPES, contentTypeForExt, validateUpload } from "./ingest-guards.js";
import { foundationStatus } from "./brand-foundation.js";
import { rasterizeSvgLogo, storeDiscoveredLogo } from "./discovered-logo.js";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="10"><rect width="40" height="10" fill="#ffd115"/></svg>';
const dataUrl = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
const base = (logo) => ({ visual: { logo, palette: [{ role: "primary", hex: "#ffd115" }], type: [{ kind: "Display", family: "Inter", provider: "google" }] } });

test("every allowed extension maps to a bucket MIME, and every bucket MIME has an extension", () => {
  const mapped = new Set([...ALLOWED_UPLOAD_EXTS].map(contentTypeForExt));
  assert.ok(!mapped.has(null));
  const bucket = new Set(BUCKET_MIME_TYPES.filter((m) => m !== "application/font-woff")); // alias for woff, accepted inbound only
  assert.deepEqual([...mapped].sort(), [...bucket].sort());
});
test("bucket MIME list matches the migrations (platform_integrity + font_mime)", () => {
  const sql = fs.readFileSync(new URL("../../../supabase/migrations/20260815005000_platform_integrity.sql", import.meta.url), "utf8")
    + fs.readFileSync(new URL("../../../supabase/migrations/20261013000000_bio_sources_font_mime.sql", import.meta.url), "utf8");
  for (const m of BUCKET_MIME_TYPES) assert.ok(sql.includes(`'${m}'`), m);
});
test("types the bucket would reject are refused up front (400, not a Storage 500)", () => {
  for (const f of ["a.gif", "a.doc", "a.csv", "a.rtf", "a.svg", "a.exe"]) assert.equal(validateUpload({ mime: "application/octet-stream", size: 5, filename: f }).ok, false, f);
  assert.equal(validateUpload({ mime: "", size: 5, filename: "deck.pptx" }).ok, true);
});
test("foundation counts only stored logos (sourceId), never URLs or inline SVG", () => {
  assert.equal(foundationStatus(base({ url: "https://brand.test/logo.png", conf: 90 })).logo, false);
  assert.equal(foundationStatus(base({ url: dataUrl, conf: 90 })).logo, false);
  assert.equal(foundationStatus(base({ sourceId: "s1", conf: 90 })).logo, true);
  assert.equal(foundationStatus(base({ conf: 90, variants: { dark: { sourceId: "s2" } } })).logo, true);
});
test("rasterizeSvgLogo returns a real PNG; unsafe SVG is refused", async () => {
  const png = await rasterizeSvgLogo(SVG);
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, "png"); assert.ok(meta.width > 0 && meta.height > 0);
  assert.equal(await rasterizeSvgLogo('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'), null);
  assert.equal(await rasterizeSvgLogo('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>'), null);
});
function fakeDb(existingId = null) {
  const calls = { uploads: [], inserts: [] };
  const q = { select() { return q; }, eq() { return q; },
    async maybeSingle() { return { data: existingId ? { id: existingId } : null, error: null }; },
    insert(v) { calls.inserts.push(v); return { select: () => ({ single: async () => ({ data: { id: "new-src" }, error: null }) }) }; } };
  return { calls, from: () => q, storage: { from: () => ({ upload: async (p, buf, opts) => { calls.uploads.push({ p, buf, opts }); return { data: {}, error: null }; } }) } };
}
test("inline SVG discovery stores a PNG bio_source and returns a sourceId logo", async () => {
  const db = fakeDb();
  const logo = await storeDiscoveredLogo({ db, brandId: "b", workspaceId: "w", logo: { url: dataUrl, source: "header SVG", conf: 90 } });
  assert.equal(logo.sourceId, "new-src"); assert.equal(logo.url, undefined);
  assert.equal(db.calls.uploads[0].opts.contentType, "image/png"); assert.match(db.calls.uploads[0].p, /^w\/b\/.+\.png$/);
  assert.equal((await sharp(db.calls.uploads[0].buf).metadata()).format, "png");
  const s = db.calls.inserts[0].signals;
  assert.equal(s.ext, "png"); assert.equal(s.asset_role, "logo"); assert.equal(s.rights_confirmed, false);
  assert.equal(foundationStatus(base(logo)).logo, true);
});
test("re-discovery of the same artwork reuses the stored PNG; URL logos pass through", async () => {
  const db = fakeDb("old-src");
  assert.equal((await storeDiscoveredLogo({ db, brandId: "b", workspaceId: "w", logo: { url: dataUrl, conf: 90 } })).sourceId, "old-src");
  assert.equal(db.calls.uploads.length, 0);
  const url = { url: "https://brand.test/logo.png", conf: 90 };
  assert.equal(await storeDiscoveredLogo({ db, brandId: "b", workspaceId: "w", logo: url }), url);
  assert.equal(await storeDiscoveredLogo({ db, brandId: "b", workspaceId: "w", logo: null }), null);
});
test("append_bio_version migration is additive and the loader passes p_expected_version", () => {
  const sql = fs.readFileSync(new URL("../../../supabase/migrations/20261013010000_append_bio_version_expected.sql", import.meta.url), "utf8");
  assert.match(sql, /p_expected_version integer default null/);
  assert.match(sql, /STALE_BIO_VERSION/);
  assert.match(sql, /grant execute on function append_bio_version\(uuid, jsonb, integer, uuid, text, integer\) to service_role/);
  const loader = fs.readFileSync(new URL("../../../scripts/load-cake-me-foundation.mjs", import.meta.url), "utf8");
  assert.match(loader, /p_expected_version: prev\.version/);
});
