import { bridgeReferences } from "../reference-bridge.js";
// ─────────────────────────────────────────────────────────────────────
// fal.ai — image generation adapter.
//
// fal is the "OpenRouter of images": one account, one key, many models
// (Flux 1.1 Pro / Flux schnell / Recraft / SDXL / Ideogram). Image
// runs DON'T stream tokens — they queue a job, take 5–30s, and return
// a single asset URL.
//
// Cost-optimization (per memory):
//   Flux 1.1 Pro  → ~$0.04/image  · top-tier · a20 Hero KV, a21 Editorial
//   Flux schnell  → ~$0.003/image · drafts/iteration · 13× cheaper
//   Recraft V3    → ~$0.03/image  · vector/logo · a19 Identity Drafts
//
// Adapter exposes generate() with normalized callbacks (onProgress,
// onDone, onError) so the runs route can emit unified SSE events.
// ─────────────────────────────────────────────────────────────────────

const QUEUE_BASE = "https://queue.fal.run";

/* Map our spec route → fal endpoint + payload shape. Each entry knows
   the model's quirks (image_size param, num_inference_steps, etc.). */
/* z-image controlnet conditions on ONE reference (the first canonical). */
function zImageReferencePayload({ prompt, size, referenceImageUrl = null, referenceImageUrls = [] }) {
  return {
    prompt,
    image_url: referenceImageUrls[0] || referenceImageUrl,
    image_size: size || "landscape_16_9",
    num_inference_steps: 8,
    num_images: 1,
    enable_safety_checker: true,
    output_format: "png",
    acceleration: "regular",
    control_scale: 0.45,
    control_end: 0.8,
    preprocess: "none",
  };
}

export const FAL_ROUTES = {
  "vendor/fal/flux-1.1-pro": {
    endpoint: "/fal-ai/flux-pro/v1.1",
    payload: ({ prompt, size = "landscape_16_9" }) => ({
      prompt,
      image_size: size,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      enable_safety_checker: true,
    }),
    referenceEndpoint: "/fal-ai/z-image/turbo/controlnet",
    referenceModel: "vendor/fal/z-image-turbo-controlnet",
    referenceCostEstimateUsd: 0.04,
    referencePayload: (args) => zImageReferencePayload(args),
    cost_estimate_usd: 0.04,
  },
  "vendor/fal/flux-schnell": {
    endpoint: "/fal-ai/flux/schnell",
    payload: ({ prompt, size = "landscape_16_9" }) => ({
      prompt,
      image_size: size,
      num_inference_steps: 4,
      enable_safety_checker: true,
    }),
    /* S1: schnell had no reference path, so a41/a35/a46/a48 ignored refs. */
    referenceEndpoint: "/fal-ai/z-image/turbo/controlnet",
    referenceModel: "vendor/fal/z-image-turbo-controlnet",
    referenceCostEstimateUsd: 0.04,
    referencePayload: (args) => zImageReferencePayload(args),
    cost_estimate_usd: 0.003,
  },
  "vendor/fal/recraft-v3": {
    endpoint: "/fal-ai/recraft-v3",
    payload: ({ prompt, size = "square_hd" }) => ({
      prompt,
      image_size: size,
      style: "digital_illustration",
    }),
    cost_estimate_usd: 0.03,
  },
  "vendor/fal/gpt-image-2": {
    endpoint: "/openai/gpt-image-2",
    payload: ({ prompt, size = "landscape_16_9" }) => ({
      prompt,
      image_size: size,
      quality: "high",
      num_images: 1,
      output_format: "png",
    }),
    /* S1: gpt-image-2 conditions on Brand Core refs through its edit endpoint. */
    referenceEndpoint: "/openai/gpt-image-2/edit",
    referenceModel: "vendor/fal/gpt-image-2-edit",
    referenceCostEstimateUsd: 0.08,
    referencePayload: ({ prompt, size, referenceImageUrls }) => ({
      prompt,
      image_urls: referenceImageUrls.slice(0, MAX_REFERENCES),
      image_size: size || "landscape_16_9",
      quality: "high",
      num_images: 1,
      output_format: "png",
    }),
    cost_estimate_usd: 0.07,   // token-priced model; placeholder until real numbers land
    timeout_ms: 180_000,       // gpt-image-2 "high" runs ~90-100s; 90s default is too tight
  },
  /* Hero image models (2026-10-12 task pipeline). Quality beats speed:
     GPT Image 2.5 Sunburst (the precision tier, not Flare) is primary and
     Nano Banana 2.1 (google/nano-banana-2.1, released Oct 6 2026; distinct
     from Nano Banana 2, which retires Oct 29) is the fallback. Both take
     Brand Core reference images through their edit endpoints. */
  "vendor/fal/gpt-image-2.5": {
    endpoint: "/openai/gpt-image-2.5/sunburst/text-to-image",
    payload: ({ prompt, size, aspect }) => ({
      prompt,
      image_size: aspect ? gptImageSize(aspect) : (size || "square_hd"),
      quality: "high",
      num_images: 1,
      output_format: "png",
    }),
    referenceEndpoint: "/openai/gpt-image-2.5/sunburst/edit",
    referenceModel: "vendor/fal/gpt-image-2.5-edit",
    referenceCostEstimateUsd: 0.07,
    referencePayload: ({ prompt, size, aspect, referenceImageUrls }) => ({
      prompt,
      image_urls: referenceImageUrls.slice(0, MAX_REFERENCES),
      image_size: aspect ? gptImageSize(aspect) : (size || "auto"),
      quality: "high",
      num_images: 1,
      output_format: "png",
    }),
    cost_estimate_usd: 0.053,
    timeout_ms: 120_000,
  },
  "vendor/fal/nano-banana-2.1": {
    endpoint: "/google/nano-banana-2.1",
    payload: ({ prompt, aspect }) => ({
      prompt,
      aspect_ratio: aspect || "1:1",
      resolution: "2K",
      num_images: 1,
      output_format: "png",
      thinking_level: "high",
    }),
    referenceEndpoint: "/google/nano-banana-2.1/edit",
    referenceModel: "vendor/fal/nano-banana-2.1-edit",
    referenceCostEstimateUsd: 0.066,
    referencePayload: ({ prompt, aspect, referenceImageUrls }) => ({
      prompt,
      image_urls: referenceImageUrls.slice(0, MAX_REFERENCES),
      aspect_ratio: aspect || "auto",
      resolution: "2K",
      num_images: 1,
      output_format: "png",
      thinking_level: "high",
    }),
    cost_estimate_usd: 0.062,
    timeout_ms: 120_000,
  },
};

export const MAX_REFERENCES = 3;

/* GPT Image 2.5 takes explicit sizes (multiples of 16, 655k–8.3M px). */
const GPT_SIZES = { "4:5": { width: 1088, height: 1360 }, "1:1": { width: 1024, height: 1024 }, "9:16": { width: 1088, height: 1936 }, "16:9": { width: 1536, height: 864 } };
export function gptImageSize(aspect) { return GPT_SIZES[aspect] || GPT_SIZES["1:1"]; }

export function hasKey() {
  return Boolean(process.env.FAL_API_KEY);
}

export function isImageRoute(route) {
  return typeof route === "string" && route.startsWith("vendor/fal/");
}

export function normalizeReferenceUrls({ referenceImageUrl = null, referenceImageUrls = null } = {}) {
  const list = Array.isArray(referenceImageUrls) ? referenceImageUrls : (referenceImageUrl ? [referenceImageUrl] : []);
  return [...new Set(list.filter((u) => typeof u === "string" && u))].slice(0, MAX_REFERENCES);
}

export function resolveImageRequest({ route, referenceImageUrl = null, referenceImageUrls = null }) {
  const cfg = FAL_ROUTES[route];
  if (!cfg) return null;
  const refs = normalizeReferenceUrls({ referenceImageUrl, referenceImageUrls });
  const usesReference = Boolean(refs.length && cfg.referenceEndpoint && cfg.referencePayload);
  return {
    usesReference,
    endpoint: usesReference ? cfg.referenceEndpoint : cfg.endpoint,
    model: usesReference ? (cfg.referenceModel || route) : route,
    costEstimateUsd: usesReference ? (cfg.referenceCostEstimateUsd ?? cfg.cost_estimate_usd) : cfg.cost_estimate_usd,
    referenceCount: usesReference ? refs.length : 0,
  };
}

/**
 * Generate an image via fal.ai. Async generator yielding normalized events:
 *   { type: "progress", stage, pct }   while waiting / polling
 *   { type: "done", asset_url, model, cost_usd, seed, dimensions }
 *   { type: "error", message }
 *
 * @param {object} args
 * @param {string} args.route   - "vendor/fal/flux-1.1-pro" etc.
 * @param {string} args.prompt  - composed prompt (BIO + brief + spec method)
 * @param {string} [args.size]  - "square_hd" | "landscape_16_9" | "portrait_4_3" | ...
 */
export async function* generate({ route, prompt, size, aspect = null, referenceImageUrl = null, referenceImageUrls = null, timeoutMs = null }) {
  // Retired generators cannot be reached by old specialists or user overrides.
  if (/\/(?:flux|recraft)/i.test(String(route))) {
    yield { type: "error", message: "Image route retired; use the guarded task image pipeline" }; return;
  }
  const key = process.env.FAL_API_KEY;
  if (!key) { yield { type: "error", message: "FAL_API_KEY not set" }; return; }
  const cfg = FAL_ROUTES[route];
  if (!cfg)  { yield { type: "error", message: `Unknown fal route: ${route}` }; return; }

  let refs = normalizeReferenceUrls({ referenceImageUrl, referenceImageUrls });
  if (refs.length && !cfg.referenceEndpoint) { yield { type: "error", message: "Image route does not support references; generation refused" }; return; }
  try { refs = await bridgeReferences(refs); } catch { yield { type: "error", message: "Reference bridge failed; generation refused" }; return; }
  const resolved = resolveImageRequest({ route, referenceImageUrls: refs });
  const useReference = resolved.usesReference;
  const endpoint = resolved.endpoint;
  const body = useReference
    ? cfg.referencePayload({ prompt, size, aspect, referenceImageUrls: refs })
    : cfg.payload({ prompt, size, aspect });
  const resolvedModel = resolved.model;
  const resolvedCostUsd = resolved.costEstimateUsd;

  yield { type: "progress", stage: "submitting", pct: 5 };

  /* Submit to fal queue. Returns { request_id, status_url, response_url, cancel_url }. */
  const submitRes = await fetch(`${QUEUE_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    yield { type: "error", message: `fal submit HTTP ${submitRes.status}` };
    return;
  }
  const submitted = await submitRes.json();
  if (!submitted.status_url || !submitted.response_url) {
    yield { type: "error", message: "fal submit returned unexpected shape" };
    return;
  }

  yield { type: "progress", stage: "queued", pct: 15 };

  /* Poll the status URL. fal returns IN_QUEUE → IN_PROGRESS → COMPLETED. */
  const started = Date.now();
  timeoutMs = timeoutMs || cfg.timeout_ms || 90_000;   // per-route override; slow models (gpt-image-2) need more headroom
  let pct = 15;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusRes = await fetch(submitted.status_url, {
      headers: { "Authorization": `Key ${key}` },
    });
    if (!statusRes.ok) continue;
    const status = await statusRes.json();
    if (status.status === "IN_QUEUE") {
      pct = Math.min(40, pct + 4);
      yield { type: "progress", stage: "queued", pct };
    } else if (status.status === "IN_PROGRESS") {
      pct = Math.min(85, pct + 10);
      yield { type: "progress", stage: "generating", pct };
    } else if (status.status === "COMPLETED") {
      /* Fetch the result from response_url */
      const resultRes = await fetch(submitted.response_url, {
        headers: { "Authorization": `Key ${key}` },
      });
      if (!resultRes.ok) {
        yield { type: "error", message: `fal result HTTP ${resultRes.status}` };
        return;
      }
      const result = await resultRes.json();
      const img = result.images?.[0];
      if (!img?.url) {
        yield { type: "error", message: "fal result has no image URL" };
        return;
      }
      yield {
        type: "done",
        asset_url:  img.url,
        width:      img.width,
        height:     img.height,
        content_type: img.content_type,
        model:      resolvedModel || route,
        endpoint,
        cost_usd:   resolvedCostUsd ?? cfg.cost_estimate_usd,
        seed:       result.seed,
        prompt_used: prompt,
        uses_reference: useReference,
        reference_count: resolved.referenceCount,
      };
      return;
    } else if (status.status === "FAILED") {
      yield { type: "error", message: "fal job failed" };
      return;
    }
  }
  yield { type: "error", message: `fal job timed out after ${timeoutMs}ms` };
}

/* Image fallback (2026-10-11 harness slice). Same policy as the text router:
   switch to `fallback` only when the primary fails before producing an image,
   on transient errors (HTTP 429/5xx, fal job FAILED/timeout, network) or an
   unknown route. Config errors (missing key, 4xx other than 429) are returned. */
const IMAGE_RETRYABLE = /\b(429|500|502|503|504)\b|timed out|job failed|network|ECONNRESET|ETIMEDOUT|Unknown fal route/i;
export function isRetryableImageError(message) { return IMAGE_RETRYABLE.test(String(message || "")); }

export async function* generateWithFallback({ route, fallback = null, prompt, size, aspect = null, referenceImageUrl = null, referenceImageUrls = null, timeoutMs = null }, gen = generate) {
  let failed = null;
  for await (const ev of gen({ route, prompt, size, aspect, referenceImageUrl, referenceImageUrls, timeoutMs })) {
    if (ev?.type === "error" && fallback && fallback !== route && isRetryableImageError(ev.message)) { failed = ev; break; }
    yield ev;
    if (ev?.type === "done" || ev?.type === "error") return;
  }
  if (!failed) return;
  console.warn(`[fal-image] primary ${route} failed (${failed.message}); falling back to ${fallback}`);
  yield { type: "progress", stage: "fallback", pct: 10 };
  for await (const ev of gen({ route: fallback, prompt, size, aspect, referenceImageUrl, referenceImageUrls, timeoutMs })) {
    yield ev?.type === "done" ? { ...ev, fallback_from: route } : ev;
  }
}
