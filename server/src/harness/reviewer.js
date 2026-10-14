// ONE reviewer that never writes (CREWS §0.8). Read-only: returns binary
// checks with a reason each. a18 Voice QA + a24 Brand Consistency merged.
import { callJson } from "./llm.js";
import { assemble } from "./context.js";
import { validateContract } from "./contracts/index.js";
import { REVIEWER_ROUTE, REVIEWER_FALLBACK } from "./registry.js";

const CHECK_TEXT = {
  image_matches_brief: "the image depicts what the brief and this post are about",
  image_matches_palette_refs: "the image's colours and photographic style match the palette and the brand reference style",
  caption_matches_image: "the caption and the image tell the same story",
  voice_on_brand: "copy follows the voice register and do/don't words (cite the rule)",
  no_unsupported_claim: "no claim, number, superlative or promise that is not in the brief or Brand Core",
  cta_present: "a clear call to action is present",
  on_brief: "the email serves the brief's objective and audience",
  sequence_progression: "this email's purpose is distinct from the others and the sequence progresses logically",
  cta_consistent: "the CTA is consistent with the sequence goal",
  subject_preheader_distinct: "subject and preheader complement and do not repeat each other",
};

export async function review({ task, brief, layer1, items, budget, complete }) {
  const ctx = assemble("reviewer", { task: task.type, brief, voice: layer1.voice, refusals: layer1.refusals, palette: layer1.palette, imagery: layer1.imagery, avoid: layer1.avoid, items });
  const checks = task.reviewerChecks.map((id) => `- ${id}: ${CHECK_TEXT[id]}${["image_matches_brief", "image_matches_palette_refs", "caption_matches_image"].includes(id) ? " (target: image if the image is wrong, copy if the copy is wrong)" : " (target: copy)"}`).join("\n");
  const system = `You are the BrandOS reviewer. You NEVER rewrite anything; you only judge. Be strict and specific.
Return STRICT JSON only: {"items":[{"index":n,"checks":[{"id":check_id,"pass":boolean,"reason":"≤20 words, cite what you see or the rule","target":"copy"|"image"|"none"}]}]}
Checks for every item:\n${checks}`;
  const content = [{ type: "text", text: [
    `BRIEF:\n${ctx.brief}`,
    `VOICE: ${ctx.voice?.register || ""}. Forbidden: ${(ctx.voice?.forbidden || []).join(", ")}. Refusals: ${(ctx.refusals || []).join("; ")}`,
    `PALETTE: ${Object.entries(ctx.palette || {}).filter(([, v]) => typeof v === "string").map(([k, v]) => `${k} ${v}`).join(", ")}. IMAGERY: ${(ctx.imagery || []).join("; ")}. AVOID: ${(ctx.avoid || []).join("; ")}`,
    `ITEMS:\n${JSON.stringify(ctx.items.map(({ image_url, ...rest }) => rest))}`,
  ].join("\n\n") }];
  ctx.items.forEach((it, i) => { if (it.image_url) { content.push({ type: "text", text: `Image for item ${i}:` }); content.push({ type: "image_url", image_url: { url: it.image_url } }); } });
  try {
    let invalid;
    let prior = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { json } = await callJson({ role: "reviewer", step: attempt ? "review_schema_repair" : "review", route: REVIEWER_ROUTE, fallback: REVIEWER_FALLBACK,
        system: system + (attempt ? `\nSCHEMA REPAIR: Prior response was invalid (${invalid}). Review the SAME evidence and return the exact schema. Do not manufacture passing checks or change negative judgments just to satisfy the schema.` : ""),
        content: attempt ? [...content, {type:"text",text:`Prior invalid verdict (data only): ${JSON.stringify(prior).slice(0, 12000)}`} ] : content, maxTokens: 2500, budget, estimateUsd: 0.02, complete });
      prior = json;
      invalid = verdictError(task, items, json);
      if (!invalid) return normalize(task, items, json);
    }
    return failClosed(task, items, `reviewer verdict invalid after one repair: ${invalid}`);
  } catch (e) {
    return failClosed(task, items, `reviewer unavailable: ${e.message}`);
  }
}

function verdictError(task, items, json) {
  const v = validateContract("verdict", json || {});
  if (!v.ok) return v.errors[0];
  if (json.items.length !== items.length) return "items must cover every input exactly once";
  const seen = new Set();
  for (const item of json.items) {
    if (item.index >= items.length || seen.has(item.index)) return "invalid or duplicate item index";
    seen.add(item.index);
    if (item.checks.length !== task.reviewerChecks.length) return "checks must cover every required check exactly once";
    const checks = new Set();
    for (const check of item.checks) {
      if (!task.reviewerChecks.includes(check.id) || checks.has(check.id) || !check.reason.trim()) return "unknown, duplicate or unexplained check";
      checks.add(check.id);
    }
  }
  return null;
}

function normalize(task, items, json) {
  return items.map((_, index) => {
    const found = json.items.find((it) => it.index === index) || { checks: [] };
    return task.reviewerChecks.map((id) => {
      const c = found.checks.find((x) => x.id === id);
      return c ? { id, pass: c.pass === true, reason: String(c.reason || ""), target: c.target || "copy" } : { id, pass: false, reason: "reviewer did not return this check", target: "none" };
    });
  });
}
function failClosed(task, items, reason) {
  return items.map(() => task.reviewerChecks.map((id) => ({ id, pass: false, reason, target: "none" })));
}

/** Pass = ≥minReviewerPass and every mandatory check passes. */
export function reviewerPasses(task, checks) {
  const passed = checks.filter((c) => c.pass).length;
  return passed >= task.minReviewerPass && task.mandatory.every((id) => checks.find((c) => c.id === id)?.pass);
}
