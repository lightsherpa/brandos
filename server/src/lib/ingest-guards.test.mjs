import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUpload, validateVisualAssetMetadata, assertPublicUrl, MAX_UPLOAD_BYTES } from "./ingest-guards.js";

test("validateUpload accepts an allowed document", () => {
  const r = validateUpload({ mime: "application/pdf", size: 2048, filename: "brand-deck.pdf" });
  assert.equal(r.ok, true);
  assert.equal(r.ext, "pdf");
});

test("validateUpload accepts octet-stream when the extension is allowed", () => {
  const r = validateUpload({ mime: "application/octet-stream", size: 1000, filename: "notes.md" });
  assert.equal(r.ok, true);
});

test("validateUpload rejects an executable extension", () => {
  const r = validateUpload({ mime: "application/octet-stream", size: 1000, filename: "payload.exe" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "EXT");
});

test("validateUpload rejects oversize and empty files", () => {
  assert.equal(validateUpload({ mime: "application/pdf", size: MAX_UPLOAD_BYTES + 1, filename: "big.pdf" }).code, "TOO_LARGE");
  assert.equal(validateUpload({ mime: "application/pdf", size: 0, filename: "x.pdf" }).code, "EMPTY");
});

test("validateUpload rejects a disallowed mime even with an ok-ish name", () => {
  const r = validateUpload({ mime: "application/x-msdownload", size: 100, filename: "a.pdf" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "MIME");
});

test("validateUpload accepts licensed font binaries", () => {
  assert.equal(validateUpload({ filename: "BrandDisplay.woff2", mime: "font/woff2", size: 2048 }).ok, true);
  assert.equal(validateUpload({ filename: "BrandDisplay.otf", mime: "application/octet-stream", size: 2048 }).ok, true);
});

test("visual references require a role and rights confirmation", () => {
  assert.equal(validateVisualAssetMetadata({ ext: "png", assetRole: "canonical" }).code, "RIGHTS");
  // F1: an unlabelled image upload defaults to inspiration; a bad role is still rejected.
  assert.equal(validateVisualAssetMetadata({ ext: "png", rightsConfirmed: true }).metadata.asset_role, "inspiration");
  assert.equal(validateVisualAssetMetadata({ ext: "png", rightsConfirmed: true, assetRole: "hero" }).code, "ASSET_ROLE");
  assert.deepEqual(
    validateVisualAssetMetadata({ ext: "png", assetRole: "inspiration", rightsConfirmed: true }).metadata,
    { asset_kind: "image_reference", asset_role: "inspiration", rights_confirmed: true },
  );
});

test("font evidence requires family, licence, and rights", () => {
  assert.equal(validateVisualAssetMetadata({ ext: "woff2", rightsConfirmed: true, licenseType: "commercial" }).code, "FONT_FAMILY");
  assert.equal(validateVisualAssetMetadata({ ext: "woff2", rightsConfirmed: true, fontFamily: "Brand Sans" }).code, "FONT_LICENSE");
  assert.equal(validateVisualAssetMetadata({
    ext: "woff2", rightsConfirmed: true, fontFamily: "Brand Sans", fontUsage: "Display", licenseType: "commercial",
  }).metadata.asset_kind, "font");
});

test("assertPublicUrl allows public http(s)", () => {
  assert.doesNotThrow(() => assertPublicUrl("https://brand.example"));
  assert.doesNotThrow(() => assertPublicUrl("http://example.com/path?q=1"));
});

test("assertPublicUrl blocks non-http schemes", () => {
  for (const u of ["file:///etc/passwd", "ftp://host/x", "gopher://h"]) {
    assert.throws(() => assertPublicUrl(u), (e) => e.code === "BAD_SCHEME" || e.code === "BAD_URL");
  }
});

test("assertPublicUrl blocks internal hosts and private/metadata IPs", () => {
  const blocked = [
    "http://localhost:8787",
    "http://0.0.0.0",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.16.0.1",
    "http://127.0.0.1",
    "http://[::1]/",
  ];
  for (const u of blocked) {
    assert.throws(() => assertPublicUrl(u), (e) => /PRIVATE_|BAD_/.test(e.code || ""), `expected block: ${u}`);
  }
});

test("assertPublicUrl rejects garbage", () => {
  assert.throws(() => assertPublicUrl("not a url"), (e) => e.code === "BAD_URL" || e.code === "BAD_SCHEME");
});
