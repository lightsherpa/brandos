#!/usr/bin/env node
// Local E2E for the task pipeline. Runs one task on a certified brand and
// writes the result (spec, HTML, metrics) to docs/brandos/handoffs/2026-10-12-task-pipeline/.
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local> \
//   node --env-file=server/.env scripts/e2e-task.mjs --brand=<id> --task=social_post|email_sequence [--heroes] [--brief="..."] [--tag=name]
// Refuses to run against a non-local Supabase.
import fs from "node:fs";
import path from "node:path";

const arg = (k, d = null) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : (process.argv.includes(`--${k}`) ? true : d); };
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(process.env.SUPABASE_URL || "")) { console.error("Refusing: SUPABASE_URL must be local"); process.exit(2); }
const { loadTaskContext } = await import("../server/src/harness/task-context.js");
const { runTask } = await import("../server/src/harness/pipeline.js");
const { supabaseAdmin } = await import("../server/src/lib/supabase.js");

const brandId = arg("brand"); const type = arg("task", "social_post"); const heroes = !!arg("heroes");
const brief = arg("brief", type === "social_post"
  ? "Lanzamiento de NOMAD atHome Classics: la suscripción mensual de café de especialidad tostado en Barcelona. Tres posts de Instagram para home brewers que quieren buen café sin complicarse. CTA: suscríbete en nomadcoffee.es."
  : "Secuencia de bienvenida de 3 emails para nuevos suscriptores de NOMAD atHome: bienvenida, cómo preparar mejor tu café en casa, y cómo ajustar o pausar la suscripción. CTA a https://nomadcoffee.es/pages/suscripciones-nomad-coffee-athome");
const { data: brand } = await supabaseAdmin.from("brands").select("id, workspace_id, name").eq("id", brandId).single();
const ctx = await loadTaskContext({ workspaceId: brand.workspace_id, brandId, type });
console.log(`[e2e] ${brand.name} · Brand Core v${ctx.bio?.version ?? "?"} · refs ${ctx.layer1.references.length} · rules ${ctx.layer1.rules.length} · missing ${ctx.layer1.foundation_missing.join(",") || "none"}`);
const t0 = Date.now();
const events = [];
const out = await runTask({ type, brief, layer1: ctx.layer1, heroes, skillsPayloads: ctx.skillsPayloads, onEvent: (e) => {
  const at = ((Date.now() - t0) / 1000).toFixed(1);
  if (e.type === "stage") console.log(`  ${at}s stage ${e.stage}`);
  else if (e.type === "item") { console.log(`  ${at}s item ${e.item.index} ${e.item.status}`); events.push({ at, index: e.item.index, status: e.item.status }); }
  else if (e.type === "notice") console.log(`  ${at}s notice ${e.message}`);
  else if (e.type === "image_attempt" || e.type === "image_retry") console.log(`  ${at}s ${e.type} slot ${e.slot} ${e.route || e.reason}`);
} });
const tag = arg("tag", type);
const dir = path.resolve("docs/brandos/handoffs/2026-10-12-task-pipeline", tag);
fs.mkdirSync(dir, { recursive: true });
out.items.forEach((it) => { if (it.html) fs.writeFileSync(path.join(dir, `item-${it.index + 1}.html`), it.html); });
fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ brand: brand.name, brief, type, status: out.status, items: out.items.map(({ html, ...rest }) => rest), spec: out.spec, metrics: out.metrics, progress: events }, null, 2));
console.log(`[e2e] ${out.status} · ${(out.metrics.total_ms / 1000).toFixed(1)}s · $${out.metrics.cost.total_usd} · by step ${JSON.stringify(out.metrics.cost.by_step)}`);
for (const it of out.items) console.log(`  item ${it.index + 1}: ${it.status} · fails: ${[...it.checks, ...(it.review || [])].filter((c) => !c.pass).map((c) => `${c.id}(${c.reason})`).join("; ") || "none"} · image ${it.image?.model || "-"} ${it.image?.ms ?? ""}ms refs=${it.image?.reference_count ?? 0}`);
process.exit(0);
