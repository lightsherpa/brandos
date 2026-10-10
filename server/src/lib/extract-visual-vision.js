// ─────────────────────────────────────────────────────────────────────
// Visual extraction (vision half) — imagery direction + avoid-list.
//
// A bounded Gemini 3.8 Flash vision call (with one Sonnet 5.5 fallback) on the
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

import {completeDiscoveryStep} from "./discovery-models.js";

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

  try {
    const result=await completeDiscoveryStep({step:"vision",system:VISUAL_VISION_SYSTEM,messages:[{role:"user",content:userContent}],telemetry,parse:text=>{
      const parsed=JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim());
      if(!Array.isArray(parsed.imagery)||!Array.isArray(parsed.avoid))throw new Error("Invalid visual observations");
      return {imagery:parsed.imagery.filter(x=>typeof x==='string'),avoid:parsed.avoid.filter(x=>typeof x==='string')};
    }});
    return result.value;
  }catch{return {imagery:[],avoid:[],limitations:["Imagery interpretation failed after bounded fallback; no photographic style inferred."]};}
}
