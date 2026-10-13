import test from "node:test";
import assert from "node:assert/strict";
import { contentTypeForExt, validateUpload, SVG_UNSUPPORTED_MESSAGE } from "./ingest-guards.js";
import { withUploadType } from "../../../src/lib/upload-type.js";
test("contentTypeForExt maps by extension", () => {
  for (const [e, t] of [["ttf","font/ttf"],["otf","font/otf"],["woff","font/woff"],["woff2","font/woff2"],["png","image/png"],["jpg","image/jpeg"],["webp","image/webp"],["pdf","application/pdf"]]) assert.equal(contentTypeForExt(e), t);
  assert.equal(contentTypeForExt("svg"), null); assert.equal(contentTypeForExt("exe"), null);
});
test("withUploadType relabels fonts by extension", () => {
  const f = withUploadType(new File([new Uint8Array(4)], "Fraunces.TTF", { type: "application/octet-stream" }));
  assert.equal(f.type, "font/ttf"); assert.equal(f.name, "Fraunces.TTF");
  const g = new File([new Uint8Array(1)], "a.png", { type: "image/png" }); assert.equal(withUploadType(g), g);
});
test("server svg message", () => { assert.match(SVG_UNSUPPORTED_MESSAGE, /SVG/); });
test("fonts need a real font MIME; svg rejected", () => {
  for (const mime of ["application/octet-stream", "application/x-font-ttf", "font/x-font-ttf", ""]) assert.equal(validateUpload({ mime, size: 10, filename: "F.ttf" }).ok, false, mime);
  assert.equal(validateUpload({ mime: "font/ttf", size: 10, filename: "F.ttf" }).ok, true);
  const svg = validateUpload({ mime: "image/svg+xml", size: 10, filename: "logo.svg" });
  assert.equal(svg.ok, false); assert.equal(svg.code, "SVG_UNSUPPORTED");
});
