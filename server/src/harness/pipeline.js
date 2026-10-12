// Task pipeline (CREWS §0, HARNESS steps 1-5): Planning → Writing → Imaging
// → Checking → Fixing → Ready/Flagged. One card per deliverable item, results
// stream as each item finishes. All model access goes through the guarded
// helpers (writer/reviewer/ocr = text, images = image step only).
import { taskSpec, skillText } from "./registry.js";
import { createBudget, createSemaphore, BudgetExceededError } from "./budget.js";
import { writeSpec } from "./writer.js";
import { generateSlot } from "./images.js";
import { review, reviewerPasses } from "./reviewer.js";
import { renderEmail, renderSocialComposite } from "./render.js";
import { checkSocialCopy, checkSocialImage } from "./checks/social.js";
import { checkEmailCopy, checkEmailHtml } from "./checks/email.js";
import { ocrNoText } from "./ocr.js";
import { result, findBanned } from "./checks/common.js";

export const STAGES = ["Planning", "Writing", "Imaging", "Checking", "Fixing", "Ready"];
/* Rough wait estimates shown to the user (seconds), from E2E timings. */
export const ETA_SECONDS = { social_post: 150, email_sequence: 60, email_sequence_heroes: 150 };

const hardFails = (checks) => checks.filter((c) => !c.pass && c.severity !== "soft");

export async function runTask({ type, brief, layer1, count, heroes = false, skillsPayloads = {}, onEvent = () => {}, deps = {} }) {
  const base = taskSpec(type);
  const task = { ...base, type, heroes: type === "email_sequence" ? !!heroes : true };
  const n = Math.min(3, Math.max(1, Number(count) || base.defaultCount));
  const budget = createBudget(type);
  const sem = createSemaphore(budget.limits.imageConcurrency);
  const t0 = Date.now();
  const timings = {};
  const mark = (stage) => { timings[stage] = Date.now() - t0; onEvent({ type: "stage", stage, at_ms: timings[stage] }); };
  const items = Array.from({ length: n }, (_, index) => ({ index, status: "queued", stage: "Planning", checks: [], review: [], revisions: 0 }));
  const emitItem = (it) => onEvent({ type: "item", item: publicItem(it) });
  const complete = deps.complete; const gen = deps.gen; const ocr = deps.ocr || ocrNoText;
  const imageFor = (it) => (type === "social_post" ? it.copy.image_brief : it.copy.hero_image_brief);

  // ── Planning ── Layer 1 first, skills inlined (max 2), text-only.
  mark("Planning");
  if (layer1.foundation_missing?.length) onEvent({ type: "notice", message: `Brand Core foundation missing: ${layer1.foundation_missing.join(", ")}` });
  // Beat 4: a don't-list word in the brief itself is caught and shown.
  const briefHits = findBanned(brief, layer1.voice.forbidden);
  const briefCheck = result("BRIEF_BANNED", briefHits.length === 0, briefHits.length ? `Brief uses don't-list word(s): ${briefHits.join(", ")}. Kept out of the copy.` : "Brief is clean against the don't-list", "soft", "none");
  if (briefHits.length) onEvent({ type: "notice", message: briefCheck.reason, check: briefCheck });
  const skills = base.skills.filter((id) => base.allowedSkills.includes(id)).slice(0, 2).map((id) => skillText(id, skillsPayloads[id] || {}));

  // ── Writing ──
  mark("Writing");
  items.forEach((it) => { it.status = "writing"; it.stage = "Writing"; emitItem(it); });
  let spec;
  try {
    ({ spec } = await writeSpec({ task, brief, count: n, layer1, skills, budget, complete }));
  } catch (e) {
    if (e instanceof BudgetExceededError) throw e;
    onEvent({ type: "notice", message: `Writer output rejected (${e.message}); retrying once` });
    ({ spec } = await writeSpec({ task, brief, count: n, layer1, skills, budget, complete }));
  }
  const list = type === "social_post" ? spec.posts : spec.emails;
  items.splice(list.length);
  list.forEach((copy, i) => { items[i].copy = copy; });

  // ── Imaging + per-item code checks, streamed as each item finishes ──
  mark("Imaging");
  const finishItem = async (it) => { it.status = "checking"; it.stage = "Checking"; emitItem(it); await checkAndRender({ type, task, it, layer1, language: spec.language, briefCheck }); emitItem(it); };
  const imageStep = async (it) => {
    it.status = "imaging"; it.stage = "Imaging"; emitItem(it);
    try { it.image = await sem(() => generateSlot({ slot: it.index, imageBrief: imageFor(it), layer1, budget, gen, ocr, complete, onEvent })); }
    catch (e) { it.image = { error: e.message }; }
  };
  await Promise.all(items.map(async (it) => {
    if (type === "social_post" || task.heroes) await imageStep(it);
    await finishItem(it);
  }));

  // ── Checking: one read-only reviewer pass over all items ──
  mark("Checking");
  const reviewItems = (subset) => subset.map((it) => ({ copy: it.copy, image_url: it.image?.asset_url || null }));
  const verdicts = await review({ task, brief, layer1, items: reviewItems(items), budget, complete });
  items.forEach((it, i) => { it.review = verdicts[i]; });

  // ── Fixing: at most 1 targeted revision per item ──
  const needsFix = items.filter((it) => hardFails(it.checks).length || !reviewerPasses(task, it.review));
  if (needsFix.length) {
    mark("Fixing");
    const copyFixes = []; const imageFixes = [];
    for (const it of needsFix) {
      const failed = [...hardFails(it.checks), ...it.review.filter((c) => !c.pass)];
      it.before = { copy: it.copy, image_url: it.image?.asset_url || null, html: it.html || null, failed };
      it.status = "fixing"; it.stage = "Fixing"; it.revisions = 1; emitItem(it);
      const imgReasons = failed.filter((c) => c.target === "image").map((c) => `${c.id}: ${c.reason}`);
      const copyReasons = failed.filter((c) => c.target === "copy").map((c) => `${c.id}: ${c.reason}`);
      if (copyReasons.length) copyFixes.push({ index: it.index, reasons: copyReasons });
      if (imgReasons.length && (type === "social_post" || task.heroes)) imageFixes.push(it);
    }
    try {
      if (copyFixes.length) {
        const { spec: revised } = await writeSpec({ task, brief, count: list.length, layer1, skills, budget, complete, revision: { previous: spec, fixes: copyFixes } });
        const rl = type === "social_post" ? revised.posts : revised.emails;
        for (const f of copyFixes) {
          const it = items[f.index]; const next = rl[f.index];
          if (!next) continue;
          // Targeted: only copy fields change; the image brief stays unless the image is also being fixed.
          const keepImage = type === "social_post" ? { image_brief: it.copy.image_brief } : (it.copy.hero_image_brief ? { hero_image_brief: it.copy.hero_image_brief } : {});
          it.copy = { ...next, ...(imageFixes.includes(it) ? {} : keepImage) };
        }
      }
      await Promise.all(imageFixes.map((it) => imageStep(it)));
      const touched = [...new Set([...copyFixes.map((f) => items[f.index]), ...imageFixes])];
      await Promise.all(touched.map((it) => finishItem(it)));
      if (touched.length) {
        const re = await review({ task, brief, layer1, items: reviewItems(touched), budget, complete });
        touched.forEach((it, i) => { it.review = re[i]; });
      }
    } catch (e) {
      onEvent({ type: "notice", message: `Revision stopped: ${e.message}` });
    }
  }

  // ── Ready / Flagged ──
  for (const it of items) {
    const ok = hardFails(it.checks).length === 0 && reviewerPasses(task, it.review);
    it.status = ok ? "ready" : "flagged"; it.stage = ok ? "Ready" : "Flagged"; it.needs_review = !ok;
    emitItem(it);
  }
  mark("Ready");
  const out = {
    type, status: items.every((it) => it.status === "ready") ? "ready" : "flagged",
    needs_review: items.some((it) => it.needs_review),
    spec, items: items.map(publicItem),
    metrics: { total_ms: Date.now() - t0, stage_ms: timings, cost: budget.summary(), ledger: budget.ledger, models: [...new Set(budget.ledger.map((r) => r.model))] },
  };
  console.log(`[task-pipeline] ${type} ${out.status} in ${(out.metrics.total_ms / 1000).toFixed(1)}s, $${out.metrics.cost.total_usd} (${out.metrics.cost.calls} calls)`);
  return out;
}

/** Code checks + render for one item (shared by runTask and rerunItem). */
export async function checkAndRender({ type, task, it, layer1, language, briefCheck }) {
  const pre = briefCheck ? [briefCheck] : [];
  if (type === "social_post") {
    it.checks = [...pre, ...checkSocialCopy(it.copy, { banned: layer1.voice.forbidden }), ...checkSocialImage(it.image, { aspect: task.aspect })];
    if (it.image?.asset_url) it.html = renderSocialComposite({ post: it.copy, imageUrl: it.image.asset_url, layer1, aspect: task.aspect });
  } else {
    const r = await renderEmail({ email: it.copy, layer1, heroUrl: it.image?.asset_url || null, language });
    it.html = r.html;
    it.html_bytes = Buffer.byteLength(r.html || "", "utf8");
    it.checks = [...pre, ...checkEmailCopy(it.copy, { banned: layer1.voice.forbidden }), ...checkEmailHtml({ html: r.html, mjmlErrors: r.mjmlErrors, tokens: r.tokens })];
    if (task.heroes) it.checks.push(it.image?.asset_url ? result("OCR_NOTEXT", it.image.ocr?.pass === true, it.image.ocr?.reason || "OCR not run", "hard", "image") : result("IMAGE", false, it.image?.error || "No hero image", "hard", "image"));
  }
  return it;
}

/**
 * Beat 5 re-run: regenerate ONLY one flagged deliverable, and only its copy
 * (the existing image is reused), with the newly saved rules loaded.
 */
export async function rerunItem({ type, brief, layer1, spec, item, heroes = false, ruleIds = [], skillsPayloads = {}, deps = {}, onEvent = () => {} }) {
  const base = taskSpec(type);
  const task = { ...base, type, heroes: type === "email_sequence" ? !!heroes : true };
  const budget = createBudget(type, { maxImageCalls: 0 });
  const t0 = Date.now();
  const skills = base.skills.slice(0, 2).map((id) => skillText(id, skillsPayloads[id] || {}));
  const failed = [...hardFails(item.checks || []), ...(item.review || []).filter((c) => !c.pass)].map((c) => `${c.id}: ${c.reason}`);
  const newRules = (layer1.rules || []).filter((r) => ruleIds.includes(r.id)).map((r) => `apply saved rule: ${r.kind === "banned_word" ? `never use "${r.value}"` : r.value}${r.reason ? ` (${r.reason})` : ""}`);
  const it = { index: item.index, copy: item.copy, image: item.image, revisions: (item.revisions || 0), before: { copy: item.copy, image_url: item.image?.asset_url || null, failed: [...hardFails(item.checks || []), ...(item.review || []).filter((c) => !c.pass)] } };
  onEvent({ type: "item", item: { ...publicItem(it), status: "fixing", stage: "Fixing" } });
  const { spec: revised } = await writeSpec({ task, brief, count: (type === "social_post" ? spec.posts : spec.emails).length, layer1, skills, budget, complete: deps.complete, revision: { previous: spec, fixes: [{ index: item.index, reasons: [...newRules, ...failed] }] } });
  const next = (type === "social_post" ? revised.posts : revised.emails)[item.index];
  if (next) it.copy = type === "social_post" ? { ...next, image_brief: item.copy.image_brief } : { ...next, ...(item.copy.hero_image_brief ? { hero_image_brief: item.copy.hero_image_brief } : {}) };
  const briefHits = findBanned(brief, layer1.voice.forbidden);
  const briefCheck = result("BRIEF_BANNED", briefHits.length === 0, briefHits.length ? `Brief uses don't-list word(s): ${briefHits.join(", ")}. Kept out of the copy.` : "Brief is clean against the don't-list", "soft", "none");
  await checkAndRender({ type, task, it, layer1, language: spec.language, briefCheck });
  [it.review] = await review({ task, brief, layer1, items: [{ copy: it.copy, image_url: it.image?.asset_url || null }], budget, complete: deps.complete });
  const ok = hardFails(it.checks).length === 0 && reviewerPasses(task, it.review);
  const copyText = JSON.stringify(it.copy);
  it.rule_applied = (layer1.rules || []).filter((r) => ruleIds.includes(r.id)).map((r) => ({ id: r.id, value: r.value, applied: r.kind === "banned_word" ? findBanned(copyText, [r.value]).length === 0 : true }));
  it.status = ok ? "ready" : "flagged"; it.stage = ok ? "Ready" : "Flagged"; it.needs_review = !ok; it.revisions += 1;
  const out = publicItem(it);
  onEvent({ type: "item", item: out });
  return { item: out, metrics: { total_ms: Date.now() - t0, cost: budget.summary(), ledger: budget.ledger } };
}

export function publicItem(it) {
  return {
    index: it.index, status: it.status, stage: it.stage, needs_review: !!it.needs_review, revisions: it.revisions,
    copy: it.copy || null, html: it.html || null, html_bytes: it.html_bytes || null,
    image: it.image ? { asset_url: it.image.asset_url || null, model: it.image.model || null, fallback_from: it.image.fallback_from || null, width: it.image.width, height: it.image.height, uses_reference: it.image.uses_reference, reference_count: it.image.reference_count, ocr: it.image.ocr || null, ms: it.image.ms, attempts: (it.image.attempts || []).map(({ route, model, ms, error, ocr }) => ({ route, model, ms, error, ocr_pass: ocr?.pass ?? null })), error: it.image.error || null } : null,
    checks: it.checks, review: it.review,
    rule_applied: it.rule_applied || null,
    before: it.before ? { copy: it.before.copy, image_url: it.before.image_url, failed: it.before.failed } : null,
  };
}
