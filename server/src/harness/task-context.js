// Loads everything a task needs, Layer 1 first (CREWS §0.1): certified Brand
// Core (production gate), up to 3 reference images (canonical first, then
// inspiration; S1), saved rules (Beat 5) and the inlined skill prompts.
import { loadBrandBio } from "../lib/load-brand-bio.js";
import { loadVisualAssets } from "../lib/visual-assets.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { buildLayer1 } from "./brand-core.js";
import { applyRules, loadRules } from "./rules.js";
import { TASKS } from "./registry.js";

export function pickReferences(loaded = [], certified = []) {
  const rank = { canonical: 0, inspiration: 1 };
  const pinned = new Map((certified || []).filter((r) => r?.sourceId).map((r) => [r.sourceId, r.role]));
  return (loaded || [])
    .map((r) => ({ ...r, role: pinned.get(r.id) || r.role }))
    .filter((r) => r.role in rank && r.url)
    .sort((a, b) => rank[a.role] - rank[b.role])
    .slice(0, 3);
}

export async function loadSkillPayloads(ids) {
  const { data } = await supabaseAdmin.from("specs").select("specialist_id, payload").in("specialist_id", ids).eq("active", true);
  return Object.fromEntries((data || []).map((row) => [row.specialist_id, row.payload]));
}

export async function loadTaskContext({ workspaceId, brandId, type }) {
  const { brand, bio, refusals } = await loadBrandBio({ workspaceId, brandId, requireCertified: true });
  let references = [];
  try {
    const assets = await loadVisualAssets(brand.id);
    references = pickReferences(assets.references, bio?.visual?.references || []);
  } catch (e) { console.warn(`[task] reference load failed: ${e.message}`); }
  const rules = await loadRules(brand.id);
  const layer1 = applyRules(buildLayer1({ brand, bio, refusals, references }), rules);
  const t = TASKS[type];
  const skillsPayloads = t ? await loadSkillPayloads(t.skills) : {};
  return { brand, bio, layer1, skillsPayloads };
}
