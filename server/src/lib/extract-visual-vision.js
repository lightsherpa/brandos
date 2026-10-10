// ─────────────────────────────────────────────────────────────────────
// Visual extraction (vision half) — imagery direction + avoid-list.
//
// One Gemini 2.5 Flash vision call (~$0.0014/BIO via OpenRouter) on the
// brand's homepage screenshot. Palette + type are handled deterministically
// from rawHtml elsewhere ($0) — NOT here. This call only describes the
// IMAGERY style (subjects, lighting, composition) and infers what the brand
// should AVOID, grounded in the already-synthesized voice + notList.
//
// Mirrors qa-vision.js exactly: same streamCompletion/router usage, same
// image_url content-block shape, same strict-JSON + defensive parse, same
// graceful degradation. On ANY failure it returns { imagery: [], avoid: [] }
// so the BIO stays valid if vision fails (Increment 4 degrades to []).
// ─────────────────────────────────────────────────────────────────────

import { streamCompletion } from "./models/router.js";

const VISUAL_VISION_SPEC = {
  payload: {
    name: "Visual Imagery Extractor",
    modelRouting: {
      primary: process.env.DISCOVERY_TEST_ROUTE === "haiku-sonnet" ? "openrouter/google/gemini-3.8-flash" : "openrouter/google/gemini-2.5-flash",
      reason: "one-shot vision read of brand imagery; cheap + reliable JSON",
    },
    cr_estimate: 1,
  },
};

export const VISUAL_VISION_SYSTEM = `You are a brand visual analyst. You read a brand's website and explicitly-labelled visual references, then describe the approved IMAGERY system.

Return STRICT JSON ONLY, no preamble, no fences. Shape:
{"imagery":string[],"avoid":string[]}

- imagery: 3–6 short phrases describing the brand's imagery direction — subjects, lighting, composition. Canonical references are evidence of the existing identity. Inspiration references are directional only: learn principles, never copy distinctive content.
- avoid: 2–4 short things the brand should AVOID. Treat references labelled AVOID as negative evidence only; never let them shape imagery.

Be specific and cite what you see ("hands holding mug, warm side-lit") not what you assume. Each phrase max 8 words.`;

export async function extractImageryAvoid({ screenshotUrl, referenceImages = [], voice = null, notList = [], telemetry = {} }) {
  if (!screenshotUrl && referenceImages.length === 0) {
    return { imagery: [], avoid: [] };
  }

  const voiceLine = voice
    ? `Brand voice: ${typeof voice === "string" ? voice : JSON.stringify(voice)}`
    : "";
  const notListLine = Array.isArray(notList) && notList.length
    ? `Brand avoids (notList): ${notList.join(" · ")}`
    : "";

  /* Multimodal user message — text seed + screenshot. Gemini Flash via
     OpenRouter accepts the same image_url shape as OpenAI. Pass the signed
     PNG URL straight through — do NOT download/base64 it. */
  const userContent = [
    {
      type: "text",
      text: [
        `Analyze this brand's visual evidence.`,
        voiceLine,
        notListLine,
        ``,
        `Reference roles are authoritative: CANONICAL means existing brand work, INSPIRATION means principles only, AVOID means negative evidence.`,
        `Describe the IMAGERY style as 3–6 short phrases (subjects, lighting, composition),`,
        `and infer 2–4 things the brand should AVOID, grounded in the voice + avoid list above.`,
        `Return the JSON only.`,
      ].filter(Boolean).join("\n"),
    },
  ];
  if (screenshotUrl) {
    userContent.push({ type:"text", text:"WEBSITE SCREENSHOT" });
    userContent.push({ type:"image_url", image_url:{ url:screenshotUrl } });
  }
  for (const reference of referenceImages.slice(0, 6)) {
    if (!reference?.url) continue;
    userContent.push({ type:"text", text:`${String(reference.role || "inspiration").toUpperCase()} REFERENCE — ${reference.name || "uploaded work"}` });
    userContent.push({ type:"image_url", image_url:{ url:reference.url } });
  }

  let text = "";
  try {
    for await (const ev of streamCompletion({
      spec: VISUAL_VISION_SPEC,
      system: VISUAL_VISION_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      maxTokens: process.env.DISCOVERY_TEST_ROUTE === "haiku-sonnet" ? 2000 : 300,
      telemetry: { operationKey: "discovery.compile", feature: "discovery.visual", ...telemetry },
    })) {
      if (ev.type === "token")      text += ev.text;
      else if (ev.type === "error") throw new Error(ev.message);
    }
  } catch {
    /* Vision failures shouldn't invalidate the BIO — the rest of the
       visual block (palette/type) is extracted deterministically. Degrade
       to empty arrays so synthesis stays valid. */
    return { imagery: [], avoid: [] };
  }

  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed;
  try { parsed = JSON.parse(stripped); }
  catch { return { imagery: [], avoid: [] }; }

  return {
    imagery: Array.isArray(parsed.imagery) ? parsed.imagery : [],
    avoid:   Array.isArray(parsed.avoid)   ? parsed.avoid   : [],
  };
}
