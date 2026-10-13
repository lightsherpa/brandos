// OCR_NOTEXT gate (CREWS §1.3, PLAN-VERIFIED S2). Vision OCR via Gemini Flash:
// the model transcribes every legible token with a confidence. Pass = zero
// tokens of length ≥2 at confidence ≥60. Runs on the raw image, before any
// compositing. Fails closed: an OCR error is a fail, never a silent pass.
import { callJson } from "./llm.js";
import { assemble } from "./context.js";

export const OCR_ROUTE = "openrouter/google/gemini-3.8-flash";
export const OCR_FALLBACK = "openrouter/google/gemini-2.5-flash";
const SYSTEM = `You are an OCR engine. Transcribe EVERY legible piece of text in the image: words, letters, numbers, logos with letterforms, signage, labels, packaging text, watermarks. Return STRICT JSON only: {"tokens":[{"text":string,"confidence":0-100}]}. If there is no legible text, return {"tokens":[]}. Do not describe the image.`;

export function evaluateOcrTokens(tokens = [], { minLength = 2, minConfidence = 60 } = {}) {
  const hits = (Array.isArray(tokens) ? tokens : []).filter((t) => String(t?.text || "").replace(/\s/g, "").length >= minLength && Number(t?.confidence ?? 100) >= minConfidence);
  return { pass: hits.length === 0, hits: hits.map((t) => String(t.text)).slice(0, 8) };
}

export async function ocrNoText({ imageUrl, budget, complete }) {
  const ctx = assemble("ocr", { image_url: imageUrl });
  try {
    const { json } = await callJson({
      role: "ocr", step: "ocr", route: OCR_ROUTE, fallback: OCR_FALLBACK, system: SYSTEM, maxTokens: 600, budget, estimateUsd: 0.002, complete,
      content: [{ type: "text", text: "Transcribe all legible text. JSON only." }, { type: "image_url", image_url: { url: ctx.image_url } }],
    });
    if (!json || !Array.isArray(json.tokens)) return { pass: false, hits: [], reason: "OCR returned no parseable result (fail closed)" };
    const r = evaluateOcrTokens(json.tokens);
    return { ...r, reason: r.pass ? "0 legible text tokens" : `Text found in image: ${r.hits.join(", ")}` };
  } catch (e) {
    return { pass: false, hits: [], reason: `OCR unavailable (fail closed): ${e.message}` };
  }
}
