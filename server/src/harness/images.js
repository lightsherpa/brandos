// Image step (CREWS §0.5-0.6). The ONLY step allowed to call image models.
// One image per slot, slots in parallel under a per-bundle semaphore (3),
// ~120s timeout, GPT Image 2.5 → Nano Banana 2.1 fallback, Brand Core refs
// + palette roles + imagery rules in every call, and a hard no-text negative.
import { generateWithFallback, generate, resolveImageRequest } from "../lib/models/fal-image.js";
import { assertToolAllowed } from "./tools.js";
import { assemble } from "./context.js";
import { ocrNoText } from "./ocr.js";
import { recordApiUsage } from "../lib/api-usage.js";
import { usageContext } from "./usage-context.js";
import crypto from "node:crypto";

export const IMAGE_PRIMARY = "vendor/fal/gpt-image-2.5";
export const IMAGE_FALLBACK = "vendor/fal/nano-banana-2.1";
export const IMAGE_TIMEOUT_MS = 120_000;
export const NO_TEXT_RULE = "No text, letters, numbers, words, logos, signage, labels, captions or watermarks anywhere in the image. No colour swatches, grids, collages or moodboards. Single photograph or background only. Any packaging or signage must be blank.";

// Keep writer-provided art direction from smuggling layout/copy instructions into
// an image call. Brand text is owned by renderSocialComposite, never the model.
export function photoDirection(value) {
  return String(value || "").split(/[.;\n]+/).filter(part => !/\b(text|letter(?:s|ing)?|words?|logos?|labels?|caption|headline|typograph\w*|watermark|swatch\w*|grids?|moodboard|collage|write|spell|print|overlay)\b/i.test(part)).join(". ").trim();
}

export function composeTaskImagePrompt(ctx) {
  const { image_brief: b, palette = {}, imagery = [], avoid = [], references = [] } = ctx;
  const roleHex = (b.palette_roles || []).map((r) => palette[r] ? `${r} ${palette[r]}` : null).filter(Boolean);
  const lines = [
    references.length ? `Use the ${references.length} attached reference image(s) as the brand's visual style: match their photographic look, materials, colour grade and lighting. Do not copy their text or logos.` : null,
    `Single photograph subject: ${photoDirection(b.subject) || "brand product in a natural scene"}`,
    photoDirection(b.composition) ? `Composition: ${photoDirection(b.composition)}` : null,
    photoDirection(b.light) ? `Light: ${photoDirection(b.light)}` : null,
    `Brand palette (dominant colours in the scene): ${roleHex.length ? roleHex.join(", ") : Object.entries(palette).filter(([k, v]) => typeof v === "string" && ["primary", "accent", "ink", "surface"].includes(k)).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    imagery.length ? `Imagery style: ${imagery.map(photoDirection).filter(Boolean).join("; ")}.` : null,
    avoid.length ? `Avoid: ${avoid.join("; ")}.` : null,
    `Leave calm negative space for typography that will be added later in code.`,
    NO_TEXT_RULE,
    `Negative: text, letters, logo, typography, watermark, labels, swatches, grid, collage, moodboard.`,
  ];
  return lines.filter(Boolean).join("\n");
}

async function runOnce({ route, fallback, prompt, aspect, refs, gen }) {
  let done = null, error = null;
  for await (const ev of generateWithFallback({ route, fallback, prompt, aspect, referenceImageUrls: refs, timeoutMs: IMAGE_TIMEOUT_MS }, gen)) {
    if (ev.type === "done") done = ev; else if (ev.type === "error") error = ev.message;
  }
  return { done, error };
}

/**
 * Generate one slot. QA fail → at most two corrected retries; fail closed.
 * Returns { slot, asset_url, width, height, model, ocr, attempts[], ms, cost_usd }.
 */
export async function generateSlot({ slot, imageBrief, layer1, budget, gen = generate, ocr = ocrNoText, complete, onEvent = () => {}, recordUsage = recordApiUsage }) {
  assertToolAllowed("image", IMAGE_PRIMARY);
  assertToolAllowed("image", IMAGE_FALLBACK);
  const ctx = assemble("image", { image_brief: imageBrief, palette: layer1.palette, imagery: layer1.imagery, avoid: layer1.avoid, references: layer1.references });
  const prompt = composeTaskImagePrompt(ctx);
  const refs = ctx.references.map((r) => r.url);
  const attempts = [];
  const started = Date.now();
  const tryModel = async (route, fallback, why, correction = "") => {
    const est = resolveImageRequest({ route, referenceImageUrls: refs })?.costEstimateUsd || 0.07;
    budget?.reserve("image", est);
    onEvent({ type: "image_attempt", slot, route, why });
    const t0 = Date.now();
    const { done, error } = await runOnce({ route, fallback, prompt: prompt + correction, aspect: imageBrief.aspect, refs, gen });
    const cost = done ? (done.cost_usd || est) : 0;
    const u = usageContext();
    // Usage logging must never undo spend: on failure, log and carry on so the run still finalizes (charges).
    await Promise.resolve().then(() => recordUsage({
      requestId: crypto.randomUUID(), parentRunId: u.runId || null, workspaceId: u.workspaceId || null, brandId: u.brandId || null,
      actorUserId: u.userId || null, specialistId: u.specialistId || null, feature: "task.image", provider: "fal", service: "image",
      requestedModel: route, resolvedModel: done?.model || route, operation: "task.image", status: done ? "succeeded" : "failed",
      latencyMs: Date.now() - t0, images: done ? 1 : 0, estimatedCostUsd: cost, costSource: done ? "rate_card_estimate" : "unpriced",
      errorCode: done ? null : "PROVIDER_ERROR", metadata: { slot, why, fallback_from: done?.fallback_from || null, reference_count: done?.reference_count ?? 0 },
    })).catch((err) => console.error(`[task-images] usage record failed run=${u.runId || "-"} slot=${slot}: ${err?.message || err}`));
    budget?.record({ kind: "image", step: "imaging", slot, model: done?.model || route, cost_usd: cost, ms: Date.now() - t0, fallback_from: done?.fallback_from || null, uses_reference: done?.uses_reference ?? false, error });
    const attempt = { route, model: done?.model || null, fallback_from: done?.fallback_from || null, ms: Date.now() - t0, error, asset_url: done?.asset_url || null, width: done?.width, height: done?.height, uses_reference: done?.uses_reference ?? false, reference_count: done?.reference_count ?? 0 };
    if (done) {
      try { attempt.ocr = await ocr({ imageUrl: done.asset_url, palette: layer1.palette, budget, complete }); }
      catch { attempt.ocr = { pass: false, reason: "Image quality check unavailable" }; }
      // Missing or malformed QA is a rejection, including injected QA adapters.
      if (attempt.ocr?.pass !== true) attempt.ocr = { ...attempt.ocr, pass: false, reason: attempt.ocr?.reason || "Image quality check did not pass" };
    }
    attempts.push(attempt);
    return attempt;
  };
  let best = await tryModel(IMAGE_PRIMARY, IMAGE_FALLBACK, "primary");
  for (let retry = 1; best.asset_url && best.ocr?.pass !== true && retry <= 2; retry++) {
    onEvent({ type: "image_retry", slot, attempt: retry, reason: "image_quality", message_key: "image_redoing" });
    try {
      best = await tryModel(IMAGE_PRIMARY, IMAGE_FALLBACK, "qa_regenerate", `\nCORRECTION ${retry}: The previous image failed visual quality checks. Start a new single photograph with plain, unmarked surfaces. Remove all lettering, logos, graphic panels, colour chips and layout grids. Do not imitate reference typography. Follow the brand palette for backgrounds, props and styling. ${NO_TEXT_RULE}`);
    } catch (e) { best = { error: e.message }; break; }
  }
  const accepted = !!best.asset_url && best.ocr?.pass === true;
  // Never return rejected URLs, even in attempt history (persisted/SSE callers
  // must not accidentally expose a failed image as a downloadable artifact).
  const safeAttempts = attempts.map(({ asset_url, ...attempt }) => attempt);
  return { slot, prompt, ...best, asset_url: accepted ? best.asset_url : null,
    rejected: !accepted, error: accepted ? null : (best.error || "Image quality check failed. Please retry."),
    attempts: safeAttempts, ms: Date.now() - started };
}
