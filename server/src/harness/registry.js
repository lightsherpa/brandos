// Task registry (PROMPT.md §1, CREWS §1-2). One writer per task; specialist
// prompts are inlined skills (max 2), never separate model calls.

export const WRITER_ROUTE = "anthropic/claude-sonnet-5-5";
export const WRITER_FALLBACK = "anthropic/claude-sonnet-4-6";
export const REVIEWER_ROUTE = "openrouter/google/gemini-3.8-flash";
export const REVIEWER_FALLBACK = "anthropic/claude-sonnet-4-6";

export const TASKS = Object.freeze({
  social_post: {
    label: "Social post",
    writer: "a16",
    skills: ["a37"],                 // Headlines → overlay line ≤8 words
    allowedSkills: ["a37", "a38", "a09", "a06"],
    imageTemplate: "a41",            // image-brief template only
    defaultCount: 3,
    aspect: "4:5",
    platform: "Instagram feed 4:5 (1080×1350)",
    reviewer: ["a18", "a24"],
    reviewerChecks: ["image_matches_brief", "image_matches_palette_refs", "caption_matches_image", "voice_on_brand", "no_unsupported_claim", "cta_present"],
    mandatory: ["voice_on_brand", "no_unsupported_claim"],
    minReviewerPass: 5,
    max_revisions: 1,
    render: "social_composite",
    stages: ["Planning", "Writing", "Imaging", "Checking", "Fixing", "Ready"],
  },
  email_sequence: {
    label: "Email sequence",
    writer: "a13",
    skills: ["a14", "a12"],          // Subject Lines + Conversion Copy, text only
    allowedSkills: ["a14", "a12", "a39", "a17"],
    imageTemplate: "a48",
    defaultCount: 3,
    aspect: "16:9",
    reviewer: ["a18"],
    reviewerChecks: ["on_brief", "voice_on_brand", "sequence_progression", "cta_consistent", "no_unsupported_claim", "subject_preheader_distinct"],
    mandatory: ["voice_on_brand", "no_unsupported_claim"],
    minReviewerPass: 5,
    max_revisions: 1,
    render: "mjml",
    stages: ["Planning", "Writing", "Imaging", "Checking", "Fixing", "Ready"],
  },
});

export function taskSpec(type) {
  const t = TASKS[type];
  if (!t) { const e = new Error(`Unknown task ${type}`); e.code = "UNKNOWN_TASK"; e.status = 400; throw e; }
  return t;
}

/* Text-only skill text from an agent spec. Image/visual-direction lines are
   stripped so a copy skill can never ask for art direction (a12 bug). */
export function skillText(id, payload = {}) {
  const method = (Array.isArray(payload.method) ? payload.method : []).filter((m) => !/visual ?direction|image|render text in-image/i.test(String(m)));
  const lines = [`[${id} ${payload.name || ""}] ${payload.role || payload.job || ""}`.trim()];
  if (payload.objective) lines.push(`Objective: ${payload.objective}`);
  if (method.length) lines.push(`Method: ${method.join(" · ")}`);
  if (Array.isArray(payload.refusals) && payload.refusals.length) lines.push(`Refuses: ${payload.refusals.slice(0, 4).join("; ")}`);
  return lines.join("\n");
}
