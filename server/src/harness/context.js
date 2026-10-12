// Per-step context allow-lists (HARNESS §2). Each step sees only the keys it
// is allowed to see; teammates' raw drafts are never reachable. assemble()
// throws if a caller tries to hand a step anything outside its list.

export const ALLOW = Object.freeze({
  writer:   ["task", "brief", "count", "layer1", "skills", "revision"],
  image:    ["image_brief", "palette", "imagery", "avoid", "references"],
  ocr:      ["image_url"],
  reviewer: ["task", "brief", "voice", "refusals", "palette", "imagery", "avoid", "items"],
});

const LAYER1_FOR = {
  writer: ["brand", "voice", "refusals", "positioning", "language", "palette", "imagery", "avoid"],
};

export function assemble(step, ctx = {}) {
  const allowed = ALLOW[step];
  if (!allowed) throw new Error(`No context allow-list for step ${step}`);
  const extra = Object.keys(ctx).filter((k) => !allowed.includes(k));
  if (extra.length) throw new Error(`Context for ${step} has keys outside its allow-list: ${extra.join(", ")}`);
  const out = {};
  for (const key of allowed) if (ctx[key] !== undefined) out[key] = ctx[key];
  if (out.layer1 && LAYER1_FOR[step]) {
    out.layer1 = Object.fromEntries(LAYER1_FOR[step].filter((k) => out.layer1[k] !== undefined).map((k) => [k, out.layer1[k]]));
  }
  return out;
}
