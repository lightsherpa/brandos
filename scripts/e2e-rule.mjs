#!/usr/bin/env node
// Local Beat 5 E2E: save a rule against a finished task item, then re-run only
// that item's copy (image reused) with the rule loaded from the DB.
//   node --env-file=server/.env scripts/e2e-rule.mjs --brand=<id> --from=<tag> --index=0 --value="..." --reason="..."
import fs from "node:fs";
import path from "node:path";
const arg = (k, d = null) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(process.env.SUPABASE_URL || "")) { console.error("Refusing: SUPABASE_URL must be local"); process.exit(2); }
const { loadTaskContext } = await import("../server/src/harness/task-context.js");
const { rerunItem } = await import("../server/src/harness/pipeline.js");
const { saveRule } = await import("../server/src/harness/rules.js");
const { supabaseAdmin } = await import("../server/src/lib/supabase.js");
const dir = path.resolve("docs/brandos/handoffs/2026-10-12-task-pipeline", arg("from"));
const prev = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
const index = Number(arg("index", "0"));
const brandId = arg("brand");
const { data: brand } = await supabaseAdmin.from("brands").select("workspace_id").eq("id", brandId).single();
const t0 = Date.now();
const rule = await saveRule({ brandId, rule: { kind: "banned_word", value: arg("value"), reason: arg("reason") }, source: { taskId: `e2e:${arg("from")}`, index, checkId: "designer" } });
const ctx = await loadTaskContext({ workspaceId: brand.workspace_id, brandId, type: prev.type });
const res = await rerunItem({ type: prev.type, brief: prev.brief, layer1: ctx.layer1, spec: prev.spec, item: prev.items[index], ruleIds: [rule.id], skillsPayloads: ctx.skillsPayloads });
const ms = Date.now() - t0;
const out = { rule, before: prev.items[index].copy.caption || prev.items[index].copy.body_blocks, after: res.item.copy.caption || res.item.copy.body_blocks, image_reused: res.item.image?.asset_url === prev.items[index].image?.asset_url, rule_applied: res.item.rule_applied, status: res.item.status, total_ms: ms, cost: res.metrics.cost };
fs.writeFileSync(path.join(dir, `rerun-item-${index + 1}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, before: String(out.before).slice(0, 160), after: String(out.after).slice(0, 160) }, null, 2));
process.exit(0);
