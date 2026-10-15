import { test } from "node:test";
import assert from "node:assert/strict";
import { assertToolAllowed, assertSpecRouteAllowed } from "./tools.js";
import { createBudget, createSemaphore, BudgetExceededError } from "./budget.js";
import { validateContract } from "./contracts/index.js";
import { checkSocialCopy, checkSocialImage } from "./checks/social.js";
import { checkEmailCopy } from "./checks/email.js";
import { findBanned, stem, contrastCheck, linksCheck, altCheck, htmlSizeCheck } from "./checks/common.js";
import { evaluateOcrTokens, ocrNoText } from "./ocr.js";
import { assemble } from "./context.js";
import { buildLayer1, paletteRoles } from "./brand-core.js";
import { applyRules, normalizeRule } from "./rules.js";
import { buildWriterPrompt } from "./writer.js";
import { runTask, rerunItem } from "./pipeline.js";
import { renderEmail } from "./render.js";
import { composeTaskImagePrompt } from "./images.js";
import { TASKS } from "./registry.js";
import { parseBackfillArgs, legacyVisualChanges } from "../../../scripts/backfill-visual-roles.mjs";
import { classifyVisualSources, selectGenerationReferences } from "../lib/visual-assets.js";

const CAKE_ME_DONT = ["formal", "corporativo", "distante", "agresivo", "negativo", "aburrido", "exclusivo", "cliente"];
const bio = {
  identity: { positioning: "Cheesecakes artesanas en Madrid" },
  voice: { register: "Cercano y divertido", forbidden: CAKE_ME_DONT, signatures: ["¡Qué rico!"] },
  visual: { palette: [{ hex: "#161616", name: "black" }, { hex: "#ffffff", name: "white" }, { hex: "#ffd115", name: "yellow" }, { hex: "#f40041", name: "red", role: "primary" }], type: [{ kind: "Display", family: "Recoleta" }, { kind: "Body", family: "Inter" }], imagery: ["golden tones"], avoid: ["stock photos"], logo: { url: "https://cdn.test/logo.png" } },
};
const layer1 = () => buildLayer1({ brand: { id: "b1", name: "Cake Me", url: "https://cakeme.es" }, bio, refusals: ["No descuentos falsos"], references: [{ id: "r1", url: "https://cdn.test/53.png", role: "canonical" }, { id: "r2", url: "https://cdn.test/56.png", role: "inspiration" }] });

test("tool guard: only the image step may call image models", () => {
  assert.ok(assertToolAllowed("image", "vendor/fal/gpt-image-2.5"));
  for (const role of ["writer", "specialist", "reviewer", "ocr", "planner"]) assert.throws(() => assertToolAllowed(role, "vendor/fal/gpt-image-2.5"), /may not call image route/);
  assert.throws(() => assertToolAllowed("image", "anthropic/claude-sonnet-5-5"));
  assert.throws(() => assertSpecRouteAllowed({ payload: { department: "Copy", code: "a12" } }, "vendor/fal/flux-schnell"), /a12/);
  assert.ok(assertSpecRouteAllowed({ payload: { department: "Design" } }, "vendor/fal/flux-schnell"));
});

test("budget caps spend and call counts; semaphore caps image concurrency at 3", async () => {
  const b = createBudget("social_post", { maxUsd: 0.1, maxImageCalls: 1 });
  b.reserve("image", 0.05); b.record({ kind: "image", step: "imaging", cost_usd: 0.05 });
  assert.throws(() => b.reserve("image", 0.01), BudgetExceededError);
  assert.throws(() => b.reserve("text", 0.06), BudgetExceededError);
  const sem = createSemaphore(3); let peak = 0; let live = 0;
  await Promise.all(Array.from({ length: 7 }, () => sem(async () => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--; })));
  assert.equal(peak, 3);
});

test("contracts reject image briefs without the no-text negative", () => {
  const post = { angle: "a", caption: "c", hashtags: [], cta: "x", image_brief: { subject: "cake", composition: "c", light: "l", palette_roles: [], negative: "none", aspect: "4:5" } };
  assert.equal(validateContract("social_post", { task: "social_post", language: "es", smp: "s", posts: [post] }).ok, false);
  post.image_brief.negative = "no text, no letters, no logo";
  assert.equal(validateContract("social_post", { task: "social_post", language: "es", smp: "s", posts: [post] }).ok, true);
});

test("social limits: caption 2200, first line 125, ≤5 hashtags", () => {
  const ok = checkSocialCopy({ caption: "Hola\nmás", hashtags: ["#a", "#b"], cta: "Pide ya" });
  assert.ok(ok.every((c) => c.pass));
  const bad = checkSocialCopy({ caption: "x".repeat(126) + "\n" + "y".repeat(2100), hashtags: ["#1", "#2", "#3", "#4", "#5", "#6"], cta: "" });
  const failed = bad.filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(failed.sort(), ["CTA", "HASHTAGS", "LEN_CAPTION", "LEN_FIRST_LINE"].sort());
});

test("email limits: subject ≤50, preheader 40–100, body ≤200 words, https CTA", () => {
  const good = { subject: "Tu cheesecake del mes", preheader: "Tres sabores nuevos y cómo elegir el tuyo esta semana.", headline: "Nuevos sabores", body_blocks: ["Hola."], cta: { label: "Ver sabores", url: "https://cakeme.es" } };
  assert.ok(checkEmailCopy(good).every((c) => c.pass));
  const bad = checkEmailCopy({ ...good, subject: "s".repeat(51), preheader: "short", cta: { label: "x", url: "http://x" } });
  assert.deepEqual(bad.filter((c) => !c.pass).map((c) => c.id).sort(), ["CTA", "LEN_PREHEADER", "LEN_SUBJECT"]);
});

test("Beat 4: Cake Me don't-list words are caught (accent-folded, plural, word boundary)", () => {
  assert.deepEqual(findBanned("Para nuestros clientes más fieles", CAKE_ME_DONT), ["cliente"]);
  assert.deepEqual(findBanned("Un sabor EXCLUSIVO", CAKE_ME_DONT), ["exclusivo"]);
  assert.deepEqual(findBanned("clientela y formalidad", CAKE_ME_DONT).sort(), ["cliente", "formal"]);
  assert.deepEqual(findBanned("el mejor café del mundo", ["el mejor cafe del mundo"]), ["el mejor cafe del mundo"]);
});

test("html gates: links https, alt, 80KB, contrast", () => {
  assert.equal(linksCheck('<a href="https://a.es">x</a><a href="/rel">y</a>').pass, false);
  assert.equal(altCheck('<img src="a.png" alt="">').pass, false);
  assert.equal(htmlSizeCheck("x".repeat(81 * 1024)).pass, false);
  assert.equal(contrastCheck([["#ffffff", "#ffd115", "cta"]]).pass, false);
  assert.equal(contrastCheck([["#111111", "#ffffff", "body"]]).pass, true);
});

test("OCR gate: tokens ≥1 char at confidence ≥60 fail; errors fail closed", async () => {
  assert.equal(evaluateOcrTokens([{ text: "a", confidence: 99 }]).pass, false);
  assert.equal(evaluateOcrTokens([{ text: "OK", confidence: 40 }]).pass, true);
  assert.equal(evaluateOcrTokens([{ text: "CAKE", confidence: 90 }]).pass, false);
  const r = await ocrNoText({ imageUrl: "https://x/y.png", complete: async function* () { yield { type: "error", message: "boom" }; } });
  assert.equal(r.pass, false);
});

test("context allow-lists block teammate drafts and trim Layer 1", () => {
  assert.throws(() => assemble("writer", { brief: "b", prior_outputs: ["leak"] }), /allow-list/);
  const ctx = assemble("writer", { brief: "b", layer1: layer1() });
  assert.equal(ctx.layer1.references, undefined);
  assert.ok(ctx.layer1.voice);
});

test("Layer 1: explicit primary role wins; foundation gaps are reported", () => {
  const l1 = layer1();
  assert.equal(l1.palette.primary, "#f40041");
  assert.equal(l1.fonts.display, "Recoleta");
  assert.deepEqual(buildLayer1({ bio: { visual: {} } }).foundation_missing, ["logo", "primary_colour_role", "display_font", "reference_images"]);
  assert.equal(paletteRoles([{ hex: "#000000" }, { hex: "#ffffff" }, { hex: "#ff0000" }]).primary, "#ff0000");
});

test("image prompt carries refs, palette roles and the no-text rule", () => {
  const l1 = layer1();
  const p = composeTaskImagePrompt({ image_brief: { subject: "cheesecake slice", composition: "overhead", light: "soft", palette_roles: ["primary"], negative: "no text, no letters, no logo", aspect: "4:5" }, palette: l1.palette, imagery: l1.imagery, avoid: l1.avoid, references: l1.references });
  assert.match(p, /2 attached reference/);
  assert.match(p, /primary #f40041/);
  assert.match(p, /No text, letters/);
});

test("Beat 5: saved rules reach the writer prompt and the banned check", () => {
  const rule = { id: "rule1", ...normalizeRule({ kind: "banned_word", value: " oferta ", reason: "No fake urgency" }) };
  const l1 = applyRules(layer1(), [rule]);
  assert.ok(l1.voice.forbidden.includes("oferta"));
  const { system } = buildWriterPrompt({ task: { ...TASKS.social_post, type: "social_post", label: "Social post", aspect: "4:5" }, brief: "b", count: 1, layer1: l1, skills: [] });
  assert.match(system, /oferta/);
  assert.equal(checkSocialCopy({ caption: "Gran oferta hoy", hashtags: [], cta: "x" }, { banned: l1.voice.forbidden }).find((c) => c.id === "BANNED").pass, false);
});

test("email renders MJML → HTML with logo, primary hex and <80KB", async () => {
  const r = await renderEmail({ email: { subject: "s", preheader: "p", headline: "h", body_blocks: ["b"], cta: { label: "Go", url: "https://cakeme.es" } }, layer1: layer1() });
  assert.equal(r.mjmlErrors.length, 0);
  assert.match(r.html, /logo\.png/);
  assert.match(r.html, /#f40041/i);
  assert.ok(Buffer.byteLength(r.html) < 80 * 1024);
});

/* ── Pipeline with stub models ── */
const img = (subject) => ({ subject, composition: "overhead", light: "daylight", palette_roles: ["primary"], ref_ids: ["r1"], negative: "no text, no letters, no logo", aspect: "4:5" });
function stubComplete({ captions, verdict }) {
  const calls = [];
  const fn = async function* ({ spec, messages }) {
    const step = spec.payload.name; calls.push(step);
    let body;
    if (step === "task.writing" || step === "task.fixing") body = { task: "social_post", language: "es", smp: "s", posts: captions(step).map((c, i) => ({ angle: `a${i}`, caption: c, hashtags: ["#cakeme"], cta: "Pide la tuya", image_brief: img(`slice ${i}`) })) };
    else if (step === "task.review") body = verdict(messages);
    else body = { tokens: [] };
    yield { type: "token", text: JSON.stringify(body) };
    yield { type: "done", usage: { cost_usd: 0.01, model: spec.payload.modelRouting.primary } };
  };
  fn.calls = calls; return fn;
}
const passAll = (task) => (messages) => ({ items: JSON.parse(messages[0].content[0].text.split("ITEMS:\n")[1]).map((_, index) => ({ index, checks: TASKS[task].reviewerChecks.map((id) => ({ id, pass: true, reason: "ok", target: "copy" })) })) });
const gen = async function* ({ route, aspect, referenceImageUrls }) { yield { type: "done", asset_url: `https://img.test/${route.split("/").pop()}-${Math.random()}.png`, width: 1088, height: 1360, model: route, cost_usd: 0.07, uses_reference: referenceImageUrls?.length > 0, reference_count: referenceImageUrls?.length || 0 }; };

test("social task: 3 posts, 1 image each with refs, streamed, ready", async () => {
  const events = [];
  const complete = stubComplete({ captions: () => ["Uno", "Dos", "Tres"], verdict: passAll("social_post") });
  const out = await runTask({ type: "social_post", brief: "Lanza el sabor de pistacho", layer1: layer1(), deps: { complete, gen, ocr: async () => ({ pass: true, reason: "0 tokens" }) }, onEvent: (e) => events.push(e) });
  assert.equal(out.status, "ready");
  assert.equal(out.items.length, 3);
  assert.ok(out.items.every((it) => it.image.uses_reference && it.html.includes("logo.png")));
  assert.deepEqual(events.filter((e) => e.type === "stage").map((e) => e.stage), ["Planning", "Writing", "Imaging", "Checking", "Ready"]);
  assert.equal(out.metrics.cost.calls, 5); // 1 writer + 3 images + 1 reviewer (OCR stubbed)
  assert.ok(events.some((e) => e.type === "item" && e.item.status === "checking" && e.item.image));
});

test("social task: banned word in the brief is flagged, copy fail gets 1 targeted revision with before→after", async () => {
  const complete = stubComplete({ captions: (step) => step === "task.writing" ? ["Para clientes", "Dos", "Tres"] : ["Para ti", "Dos", "Tres"], verdict: passAll("social_post") });
  const out = await runTask({ type: "social_post", brief: "Post para nuestros clientes", layer1: layer1(), deps: { complete, gen, ocr: async () => ({ pass: true }) } });
  const first = out.items[0];
  assert.equal(first.revisions, 1);
  assert.equal(first.before.copy.caption, "Para clientes");
  assert.equal(first.copy.caption, "Para ti");
  assert.equal(first.checks.find((c) => c.id === "BRIEF_BANNED").pass, false);
  assert.equal(first.status, "ready");
  assert.equal(complete.calls.filter((s) => s === "task.fixing").length, 1);
});

test("OCR fail retries twice with primary and never exposes a rejected asset", async () => {
  const complete = stubComplete({ captions: () => ["Uno"], verdict: passAll("social_post") });
  const routes = [];
  const g = async function* (a) { routes.push(a.route); yield* gen(a); };
  const out = await runTask({ type: "social_post", brief: "Lanza el sabor", layer1: layer1(), count: 1, deps: { complete, gen: g, ocr: async () => ({ pass: false, reason: "Text found: CAKE" }) } });
  assert.equal(out.items[0].status, "flagged");
  assert.ok(out.items[0].needs_review);
  assert.ok(routes.every(r => r === "vendor/fal/gpt-image-2.5"));
  assert.equal(routes.length, 3);
  assert.equal(out.items[0].image.asset_url, null);
  assert.equal(out.items[0].html, null);
});

test("Beat 5 re-run regenerates only that item's copy and reuses the image", async () => {
  const complete = stubComplete({ captions: () => ["Sin la palabra", "Dos", "Tres"], verdict: passAll("social_post") });
  const l1 = applyRules(layer1(), [{ id: "rule1", kind: "banned_word", value: "oferta", reason: "urgencia" }]);
  const item = { index: 0, copy: { angle: "a", caption: "Gran oferta", hashtags: [], cta: "x", image_brief: img("s") }, image: { asset_url: "https://img.test/keep.png", width: 1088, height: 1360, ocr: { pass: true } }, checks: [{ id: "BANNED", pass: false, reason: "oferta" }], review: [] };
  const spec = { task: "social_post", language: "es", smp: "s", posts: [item.copy] };
  let imageCalls = 0;
  const res = await rerunItem({ type: "social_post", brief: "b", layer1: l1, spec, item, ruleIds: ["rule1"], deps: { complete, gen: async function* () { imageCalls++; } } });
  assert.equal(imageCalls, 0);
  assert.equal(res.item.image.asset_url, "https://img.test/keep.png");
  assert.equal(res.item.copy.caption, "Sin la palabra");
  assert.deepEqual(res.item.rule_applied, [{ id: "rule1", value: "oferta", applied: true }]);
  assert.equal(res.item.status, "ready");
});

test("email task: 3 HTML emails rendered, every one <80KB", async () => {
  const complete = async function* ({ spec, messages }) {
    const step = spec.payload.name;
    const body = step === "task.review" ? passAll("email_sequence")(messages) : { task: "email_sequence", language: "es", smp: "s", emails: [0, 3, 7].map((d, i) => ({ day_offset: d, purpose: `p${i}`, subject: `Asunto ${i}`, preheader: "Un adelanto de lo que encontrarás dentro de este email.", headline: `Titular ${i}`, body_blocks: ["Hola, esto es un email."], cta: { label: "Ver", url: "https://cakeme.es" } })) };
    yield { type: "token", text: JSON.stringify(body) }; yield { type: "done", usage: { cost_usd: 0.01 } };
  };
  const out = await runTask({ type: "email_sequence", brief: "Secuencia de bienvenida", layer1: layer1(), deps: { complete, gen } });
  assert.equal(out.items.length, 3);
  assert.ok(out.items.every((it) => it.html && it.html_bytes < 80 * 1024 && it.status === "ready"));
});

test("S1: legacy role-less visual uploads count as inspiration; refs capped at 3, canonical first", () => {
  const rows = [{ id: "1", raw_ref: "a.png", bucket: "visual", signals: { rights_confirmed: true, ext: "png" } }, { id: "2", raw_ref: "b.png", bucket: "visual", signals: { rights_confirmed: true, ext: "png", asset_role: "canonical" } }];
  const { references } = classifyVisualSources(rows);
  assert.deepEqual(references.map((r) => r.id), ["2", "1"]);
  const picked = selectGenerationReferences([{ role: "inspiration", url: "i" }, { role: "avoid", url: "a" }, { role: "canonical", url: "c" }, { role: "inspiration", url: "j" }, { role: "inspiration", url: "k" }]);
  assert.deepEqual(picked.map((r) => r.url), ["c", "i", "j"]);
});

test("backfill script requires --only and defaults to dry-run", () => {
  assert.throws(() => parseBackfillArgs([]), /--only/);
  assert.equal(parseBackfillArgs(["--only=35f265f0-0546-4a9a-b793-a49887ad7125"]).dryRun, true);
  assert.equal(legacyVisualChanges([{ brand_id: "35f265f0-0546-4a9a-b793-a49887ad7125", bucket: "visual", kind: "file_upload", src: "53.png", raw_ref: "local/53.png", signals: {} }, { bucket: "foundations", kind: "file_upload", src: "x.pdf" }], "35f265f0-0546-4a9a-b793-a49887ad7125").length, 1);
});

test("don't-list variants: gender, number and light derivations (es/en)", () => {
  for (const v of ["exclusivo", "exclusiva", "exclusivos", "exclusivas", "Exclusividad"]) assert.deepEqual(findBanned(`Un producto ${v}`, ["exclusivo"]), ["exclusivo"], v);
  for (const v of ["cliente", "clientes", "clientela", "Clientes"]) assert.deepEqual(findBanned(`Para ${v}`, ["cliente"]), ["cliente"], v);
  assert.deepEqual(findBanned("A boring, aggressive tone", ["bore", "aggressive"]), ["aggressive"]);
  assert.deepEqual(findBanned("Luxury feel", ["luxurious"]), []);
  assert.equal(stem("exclusivas"), "exclusiv");
  assert.equal(stem("clientela"), "client");
});

test("Iris's tagline is flagged", () => {
  assert.deepEqual(findBanned("Una caja pensada para nuestros clientes exclusivos.", CAKE_ME_DONT).sort(), ["cliente", "exclusivo"]);
  assert.equal(checkSocialCopy({ caption: "Una caja pensada para nuestros clientes exclusivos.", hashtags: [], cta: "Pide" }, { banned: CAKE_ME_DONT }).find((c) => c.id === "BANNED").pass, false);
});

test("short stems never over-match (stem ≥5 chars, whole words only)", () => {
  assert.deepEqual(findBanned("lujos y lujoso", ["lujo"]), ["lujo"]);           // exact/plural only
  assert.deepEqual(findBanned("lujoso ambiente", ["lujo"]), []);                // no derivation for <5
  assert.deepEqual(findBanned("formalmente informal", ["formal"]), ["formal"]); // whole word 'formalmente'
  assert.deepEqual(findBanned("informales", ["formal"]), []);                   // no substring match
  assert.deepEqual(findBanned("negativa actitud", ["negativo"]), ["negativo"]);
  assert.deepEqual(findBanned("cafe", ["cafeteria"]), []);
  assert.deepEqual(findBanned("el mejor café del mundo", ["el mejor cafe del mundo"]), ["el mejor cafe del mundo"]);
});
