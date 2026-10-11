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
    referencePayload: ({ prompt, size, referenceImageUrl }) => ({
      prompt,
      image_url: referenceImageUrl,
      image_size: size || "landscape_16_9",
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      acceleration: "regular",
      control_scale: 0.45,
      control_end: 0.8,
      preprocess: "none",
    }),
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
    cost_estimate_usd: 0.07,   // token-priced model; placeholder until real numbers land
    timeout_ms: 180_000,       // gpt-image-2 "high" runs ~90-100s; 90s default is too tight
  },
};

export function hasKey() {
  return Boolean(process.env.FAL_API_KEY);
}

export function isImageRoute(route) {
  return typeof route === "string" && route.startsWith("vendor/fal/");
}

export function resolveImageRequest({ route, referenceImageUrl = null }) {
  const cfg = FAL_ROUTES[route];
  if (!cfg) return null;
  const usesReference = Boolean(referenceImageUrl && cfg.referenceEndpoint && cfg.referencePayload);
  return {
    usesReference,
    endpoint: usesReference ? cfg.referenceEndpoint : cfg.endpoint,
    model: usesReference ? (cfg.referenceModel || route) : route,
    costEstimateUsd: usesReference ? (cfg.referenceCostEstimateUsd ?? cfg.cost_estimate_usd) : cfg.cost_estimate_usd,
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
export async function* generate({ route, prompt, size, referenceImageUrl = null }) {
  const key = process.env.FAL_API_KEY;
  if (!key) { yield { type: "error", message: "FAL_API_KEY not set" }; return; }
  const cfg = FAL_ROUTES[route];
  if (!cfg)  { yield { type: "error", message: `Unknown fal route: ${route}` }; return; }

  const resolved = resolveImageRequest({ route, referenceImageUrl });
  const useReference = resolved.usesReference;
  const endpoint = resolved.endpoint;
  const body = useReference
    ? cfg.referencePayload({ prompt, size, referenceImageUrl })
    : cfg.payload({ prompt, size });
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
    yield { type: "error", message: `fal submit HTTP ${submitRes.status}: ${text.slice(0, 300)}` };
    return;
  }
  const submitted = await submitRes.json();
  if (!submitted.status_url || !submitted.response_url) {
    yield { type: "error", message: `fal submit returned unexpected shape: ${JSON.stringify(submitted).slice(0, 200)}` };
    return;
  }

  yield { type: "progress", stage: "queued", pct: 15 };

  /* Poll the status URL. fal returns IN_QUEUE → IN_PROGRESS → COMPLETED. */
  const started = Date.now();
  const timeoutMs = cfg.timeout_ms || 90_000;   // per-route override; slow models (gpt-image-2) need more headroom
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
      };
      return;
    } else if (status.status === "FAILED") {
      yield { type: "error", message: `fal job failed: ${JSON.stringify(status).slice(0, 300)}` };
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

export async function* generateWithFallback({ route, fallback = null, prompt, size, referenceImageUrl = null }, gen = generate) {
  let failed = null;
  for await (const ev of gen({ route, prompt, size, referenceImageUrl })) {
    if (ev?.type === "error" && fallback && fallback !== route && isRetryableImageError(ev.message)) { failed = ev; break; }
    yield ev;
    if (ev?.type === "done" || ev?.type === "error") return;
  }
  if (!failed) return;
  console.warn(`[fal-image] primary ${route} failed (${failed.message}); falling back to ${fallback}`);
  yield { type: "progress", stage: "fallback", pct: 10 };
  for await (const ev of gen({ route: fallback, prompt, size, referenceImageUrl })) {
    yield ev?.type === "done" ? { ...ev, fallback_from: route } : ev;
  }
}
