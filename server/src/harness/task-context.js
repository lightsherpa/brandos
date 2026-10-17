import {loadBriefReferences} from '../lib/brief-references.js';
// Loads everything a task needs, Layer 1 first (CREWS §0.1): certified Brand
// Core (production gate), up to 3 reference images (canonical first, then
// inspiration; S1), saved rules (Beat 5) and the inlined skill prompts.
import { loadBrandBio, loadBioForImage } from "../lib/load-brand-bio.js";
import { activeReferenceIds, scopedReferences, assertReferenceResolution } from "../lib/reference-intake.js";
import { loadVisualAssets } from "../lib/visual-assets.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { buildLayer1 } from "./brand-core.js";
import { applyRules, loadRules } from "./rules.js";
import { hydrateGoogleFontAssets } from "./google-font-assets.js";
import { TASKS } from "./registry.js";

export function pickReferences(loaded = [], certified = []) {
  return scopedReferences(loaded, certified);
}

export async function loadSkillPayloads(ids) {
  const { data } = await supabaseAdmin.from("specs").select("specialist_id, payload").in("specialist_id", ids).eq("active", true);
  return Object.fromEntries((data || []).map((row) => [row.specialist_id, row.payload]));
}

export async function loadTaskContext({ workspaceId, brandId, type, heroes = false, copyOnly = false, bioVersion,referenceIds=[],userId,briefId }) {
  const needsImages = !copyOnly && (type === "social_post" || (type === "email_sequence" && heroes));
  const { brand, bio, refusals } = needsImages
    ? await loadBioForImage({ workspaceId, brandId, bioVersion })
    : await loadBrandBio({ workspaceId, brandId, requireCertified: true, bioVersion });
  const pinned = bio?.visual?.references || [];
  const assets = await loadVisualAssets(brand.id, { sourceIds: activeReferenceIds(pinned) });
  if (needsImages) assertReferenceResolution(assets.references, pinned);
  const briefReferences=await loadBriefReferences({ids:referenceIds,brandId:brand.id,userId,briefId});
  const references = [...briefReferences,...pickReferences(assets.references, pinned)].slice(0,3);
  const provenance = { bioId: bio.id, bioVersion: bio.version, sourceIds: references.filter(r=>r.scope!=='brief').map(r => r.id), briefReferenceIds:briefReferences.map(r=>r.id) };
  const rules = await loadRules(brand.id);
  let layer1 = { ...applyRules(buildLayer1({ brand, bio, refusals, references }), rules), provenance };
  if (["1","true"].includes(process.env.CREW_CANVAS)) layer1 = await hydrateGoogleFontAssets(layer1);
  const t = TASKS[type];
  const skillsPayloads = t ? await loadSkillPayloads(t.skills) : {};
  return { brand, bio, layer1, skillsPayloads, provenance };
}
