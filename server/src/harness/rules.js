// Brand Core rules from "Save as rule" (Beat 5). Pure helpers + DB access.
import { supabaseAdmin } from "../lib/supabase.js";

export function normalizeRule({ kind, value, reason }) {
  const k = kind === "guideline" ? "guideline" : "banned_word";
  const v = String(value || "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (!v) { const e = new Error("Rule value is required"); e.status = 400; throw e; }
  return { kind: k, value: v, reason: reason ? String(reason).slice(0, 500) : null };
}

/** Folds saved rules into the Layer 1 pack: banned words join the don't-list,
    guidelines join the refusals the writer and reviewer read. */
export function applyRules(layer1, rules = []) {
  const active = (rules || []).filter((r) => r && r.active !== false);
  const banned = active.filter((r) => r.kind === "banned_word").map((r) => r.value);
  const guides = active.filter((r) => r.kind === "guideline").map((r) => r.value);
  return {
    ...layer1,
    voice: { ...layer1.voice, forbidden: [...new Set([...(layer1.voice?.forbidden || []), ...banned])] },
    refusals: [...new Set([...(layer1.refusals || []), ...guides])],
    rules: active.map((r) => ({ id: r.id, kind: r.kind, value: r.value, reason: r.reason, created_at: r.created_at })),
  };
}

export async function loadRules(brandId, db = supabaseAdmin) {
  const { data, error } = await db.from("brand_rules").select("id, kind, value, reason, created_at, active, source_task_id, source_item_index, created_by").eq("brand_id", brandId).eq("active", true).order("created_at", { ascending: true });
  // Fail closed: a run must never proceed without the brand's saved rules.
  if (error) throw Object.assign(new Error(`Brand rules unavailable: ${error.message}`), { status: 503, code: "BRAND_RULES_UNAVAILABLE" });
  return data || [];
}

export async function saveRule({ brandId, rule, source = {}, userId = null }, db = supabaseAdmin) {
  const r = normalizeRule(rule);
  const { data, error } = await db.from("brand_rules").insert({
    brand_id: brandId, ...r, source_task_id: source.taskId || null, source_item_index: source.index ?? null, source_check_id: source.checkId || null, created_by: userId,
  }).select("id, kind, value, reason, created_at, created_by, source_task_id, source_item_index").single();
  if (error) throw new Error(`Rule save failed: ${error.message}`);
  return data;
}
