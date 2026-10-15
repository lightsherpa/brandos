import { crewCanvasEnabled } from "./crew-canvas.js";
// The ONE writer call per task (CREWS §0.2). Output is a typed Message Spec,
// validated against the task contract before anything downstream reads it.
import { callJson } from "./llm.js";
import { assemble } from "./context.js";
import { validateContract, ContractError } from "./contracts/index.js";
import { WRITER_ROUTE, WRITER_FALLBACK } from "./registry.js";
import { SOCIAL_LIMITS } from "./checks/social.js";
import { EMAIL_LIMITS } from "./checks/email.js";

const IMAGE_BRIEF_SHAPE = `{"subject": what is photographed (concrete, on-brief), "composition": framing, "light": lighting, "palette_roles": ["primary"|"accent"|"ink"|"surface"...], "ref_ids": ["ref1"...], "negative": "no text, no letters, no logo", "aspect": "ASPECT"}`;

const SHAPES = {
  social_post: (n, aspect) => `{"task":"social_post","language": ISO code,"smp": single-minded proposition from the brief,"posts":[ exactly ${n} × {"angle": distinct angle,"overlay_line": ${crewCanvasEnabled() ? "required nonempty" : "optional"} ≤8 words for code typesetting,"caption": ≤${SOCIAL_LIMITS.caption} chars with first line ≤${SOCIAL_LIMITS.firstLine} chars and NO hashtags inside,"hashtags": ≤${SOCIAL_LIMITS.hashtags} items with #,"cta": short call to action,"claims": [factual claims you made, each must come from the brief or Brand Core],"image_brief": ${IMAGE_BRIEF_SHAPE.replace("ASPECT", aspect)} } ]}`,
  email_sequence: (n, aspect, heroes) => `{"task":"email_sequence","language": ISO code,"smp": single-minded proposition,"emails":[ exactly ${n} × {"day_offset": integer days after start,"purpose": distinct purpose (welcome/value/convert...),"subject": ≤${EMAIL_LIMITS.subjectSoft} chars,"preheader": ${EMAIL_LIMITS.preheaderMin}–${EMAIL_LIMITS.preheaderMax} chars and not repeating the subject,"headline": ≤${EMAIL_LIMITS.headline} chars,"body_blocks": 1–4 short paragraphs, ≤${EMAIL_LIMITS.bodyWords} words total,"cta":{"label": ≤28 chars,"url": absolute https URL},"claims": [factual claims made]${heroes ? `,"hero_image_brief": ${IMAGE_BRIEF_SHAPE.replace("ASPECT", aspect)}` : ""} } ]}`,
};

export function buildWriterPrompt(ctx) {
  const { task, brief, count, layer1, skills = [], revision } = ctx;
  const l1 = layer1;
  const system = [
    `You are the single writer for a BrandOS ${task.label} task for ${l1.brand?.name}. Output ONE JSON object and nothing else.`,
    `You write copy and describe photographs. You never generate images and you never put words inside images: all type and the logo are set later in code, so every image_brief must describe a scene with no text, signage, labels or logos.`,
    `Brand Core (Layer 1):`,
    `- Positioning: ${l1.positioning || "(none)"}`,
    `- Voice register: ${l1.voice?.register || "(none)"}${l1.voice?.rhythm ? ` · Rhythm: ${l1.voice.rhythm}` : ""}`,
    l1.voice?.signatures?.length ? `- Signature phrases / habits: ${l1.voice.signatures.join(" | ")}` : null,
    l1.voice?.examples?.length ? `- Quoted examples of real brand copy: ${l1.voice.examples.map((e) => `"${typeof e === "string" ? e : e.text || ""}"`).join(" ")}` : null,
    `- NEVER use these words: ${(l1.voice?.forbidden || []).join(", ") || "(none)"}`,
    l1.refusals?.length ? `- The brand refuses: ${l1.refusals.join("; ")}` : null,
    `- Palette roles: ${Object.entries(l1.palette || {}).filter(([k, v]) => typeof v === "string").map(([k, v]) => `${k} ${v}`).join(", ")}`,
    l1.imagery?.length ? `- Imagery direction: ${l1.imagery.join("; ")}` : null,
    l1.avoid?.length ? `- Imagery to avoid: ${l1.avoid.join("; ")}` : null,
    `Rules: Use only facts in the brief or Brand Core. Do not invent prices, stats, dates, awards, quotes or superlatives. No fake urgency. Write in the brief's language (default ${l1.language || "en"}).`,
    skills.length ? `Specialist skills to apply inside this one call:\n${skills.join("\n")}` : null,
    `Return exactly this JSON shape:\n${SHAPES[task.type](count, task.aspect, task.heroes)}`,
  ].filter(Boolean).join("\n");
  let user = `BRIEF:\n${brief}`;
  if (revision) user += `\n\nREVISION (targeted). Previous JSON:\n${JSON.stringify(revision.previous)}\nFix ONLY these items and keep everything else identical:\n${revision.fixes.map((f) => `- item ${f.index}: ${f.reasons.join("; ")}`).join("\n")}`;
  return { system, user };
}

export async function writeSpec({ task, brief, count, layer1, skills, revision = null, budget, complete }) {
  const ctx = assemble("writer", { task, brief, count, layer1, skills, revision });
  const { system, user } = buildWriterPrompt(ctx);
  const { json, ms } = await callJson({ role: "writer", step: revision ? "fixing" : "writing", route: WRITER_ROUTE, fallback: WRITER_FALLBACK, system, content: user, maxTokens: 4000, budget, estimateUsd: 0.06, complete });
  if (!json) throw new ContractError(task.type, ["writer returned no JSON"]);
  const v = validateContract(task.type, json);
  if (!v.ok) throw new ContractError(task.type, v.errors);
  return { spec: json, ms };
}
