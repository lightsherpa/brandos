import { test } from "node:test";
import assert from "node:assert/strict";
import { certifiedVisualSourceIds, classifyVisualSources, mergeTypographyFromAssets, pinCertifiedReferences, selectGenerationReference } from "./visual-assets.js";

const row = (ext, role, extra = {}) => ({
  id: `${ext}-${role}`,
  src: `asset.${ext}`,
  raw_ref: `workspace/asset.${ext}`,
  signals: { ext, asset_role: role, rights_confirmed: true, ...extra },
});

test("classifyVisualSources excludes assets without confirmed rights", () => {
  const blocked = row("png", "canonical");
  blocked.signals.rights_confirmed = false;
  const out = classifyVisualSources([blocked, row("jpg", "inspiration")]);
  assert.equal(out.references.length, 1);
  assert.equal(out.references[0].signals.asset_role, "inspiration");
});

test("classifyVisualSources keeps fonts separate from image references", () => {
  const font = row("woff2", "canonical", { asset_kind:"font", font_family:"Brand Sans", license_type:"commercial" });
  const out = classifyVisualSources([font, row("png", "canonical")]);
  assert.equal(out.fonts.length, 1);
  assert.equal(out.references.length, 1);
});

test("uploaded typography wins over website extraction for the same family", () => {
  const merged = mergeTypographyFromAssets(
    [{ kind:"Display", family:"Brand Sans", license:"unknown" }, { kind:"Body", family:"System Serif" }],
    [{ id:"font-1", signals:{ font_family:"Brand Sans", font_usage:"Display", license_type:"commercial", license_reference:"ORDER-1" } }],
  );
  assert.equal(merged.filter((font) => font.family === "Brand Sans").length, 1);
  assert.equal(merged[0].license, "commercial");
});

test("generation conditioning uses canonical work only, never inspiration or avoid", () => {
  assert.equal(selectGenerationReference([{ role:"inspiration", url:"i" }, { role:"canonical", url:"c" }]).url, "c");
  assert.equal(selectGenerationReference([{ role:"inspiration", url:"i" }]), null);
  assert.equal(selectGenerationReference([{ role:"avoid", url:"a" }]), null);
});

test("production references are pinned to certified BIO source ids and roles", () => {
  const loaded = [
    { id:"certified", role:"inspiration", url:"safe" },
    { id:"new-upload", role:"canonical", url:"bypass" },
  ];
  assert.deepEqual(
    pinCertifiedReferences(loaded, [{ sourceId:"certified", role:"canonical" }]),
    [{ id:"certified", role:"canonical", url:"safe" }],
  );
});

test("active visual evidence protection covers image references and licensed fonts", () => {
  assert.deepEqual(
    [...certifiedVisualSourceIds({ references:[{ sourceId:"image-1" }], type:[{ sourceId:"font-1" }] })].sort(),
    ["font-1", "image-1"],
  );
});
