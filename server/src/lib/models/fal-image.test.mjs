import { test } from "node:test";
import assert from "node:assert/strict";
import { FAL_ROUTES, isImageRoute, resolveImageRequest } from "./fal-image.js";

test("gpt-image-2 route is registered with the correct fal endpoint", () => {
  const r = FAL_ROUTES["vendor/fal/gpt-image-2"];
  assert.ok(r, "vendor/fal/gpt-image-2 must exist in FAL_ROUTES");
  assert.equal(r.endpoint, "/openai/gpt-image-2");
});

test("gpt-image-2 payload builds the documented fal params", () => {
  const r = FAL_ROUTES["vendor/fal/gpt-image-2"];
  const body = r.payload({ prompt: "a cold brew on stone", size: "square_hd" });
  assert.equal(body.prompt, "a cold brew on stone");
  assert.equal(body.image_size, "square_hd");
  assert.equal(body.quality, "high");
  assert.equal(body.num_images, 1);
  assert.equal(body.output_format, "png");
});

test("gpt-image-2 payload defaults size to landscape_16_9", () => {
  const body = FAL_ROUTES["vendor/fal/gpt-image-2"].payload({ prompt: "x" });
  assert.equal(body.image_size, "landscape_16_9");
});

test("isImageRoute recognizes the gpt-image-2 route", () => {
  assert.equal(isImageRoute("vendor/fal/gpt-image-2"), true);
});

test("gpt-image-2 carries a longer per-route timeout than the 90s default", () => {
  // gpt-image-2 "high" completes in ~90-100s; the 90s default times out on it.
  assert.ok(FAL_ROUTES["vendor/fal/gpt-image-2"].timeout_ms > 90_000);
});

test("flux pro resolves references through documented ControlNet fields without dropping safety or size", () => {
  const route = FAL_ROUTES["vendor/fal/flux-1.1-pro"];
  assert.equal(route.referenceEndpoint, "/fal-ai/z-image/turbo/controlnet");
  assert.equal(route.referenceModel, "vendor/fal/z-image-turbo-controlnet");
  const body = route.referencePayload({ prompt:"new campaign", size:"portrait_4_3", referenceImageUrl:"https://example.com/reference.png" });
  assert.equal(body.image_url, "https://example.com/reference.png");
  assert.equal(body.image_size, "portrait_4_3");
  assert.equal(body.enable_safety_checker, true);
  assert.equal(body.preprocess, "none");
  assert.ok(body.control_scale > 0 && body.control_scale < 1);
  assert.deepEqual(resolveImageRequest({ route:"vendor/fal/flux-1.1-pro", referenceImageUrl:"https://example.com/reference.png" }), {
    usesReference:true,
    endpoint:"/fal-ai/z-image/turbo/controlnet",
    model:"vendor/fal/z-image-turbo-controlnet",
    costEstimateUsd:0.04,
    referenceCount:1,
  });
});

test("every image route resolves a reference endpoint when refs exist (S1)", () => {
  for (const route of ["vendor/fal/flux-1.1-pro", "vendor/fal/flux-schnell", "vendor/fal/gpt-image-2", "vendor/fal/gpt-image-2.5", "vendor/fal/nano-banana-2.1"]) {
    const r = resolveImageRequest({ route, referenceImageUrls: ["https://a.test/1.png", "https://a.test/2.png"] });
    assert.equal(r.usesReference, true, route);
  }
});

test("gpt-image-2.5 uses the Sunburst quality tier with up to 3 refs and high quality", () => {
  const cfg = FAL_ROUTES["vendor/fal/gpt-image-2.5"];
  assert.equal(cfg.endpoint, "/openai/gpt-image-2.5/sunburst/text-to-image");
  assert.equal(cfg.referenceEndpoint, "/openai/gpt-image-2.5/sunburst/edit");
  const body = cfg.referencePayload({ prompt: "p", aspect: "4:5", referenceImageUrls: ["1", "2", "3", "4"] });
  assert.equal(body.image_urls.length, 3);
  assert.equal(body.quality, "high");
  assert.deepEqual(body.image_size, { width: 1088, height: 1360 });
  assert.ok(cfg.timeout_ms <= 120_000);
});

test("nano-banana-2.1 fallback is the 2.1 model (not the retiring Nano Banana 2)", () => {
  const cfg = FAL_ROUTES["vendor/fal/nano-banana-2.1"];
  assert.equal(cfg.referenceEndpoint, "/google/nano-banana-2.1/edit");
  const body = cfg.referencePayload({ prompt: "p", aspect: "4:5", referenceImageUrls: ["1"] });
  assert.equal(body.aspect_ratio, "4:5");
  assert.equal(body.resolution, "2K");
});
