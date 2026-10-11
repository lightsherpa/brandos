// Real-key smoke; uses a synthetic BIO and writes no briefs, outputs or spec rows.
// The router records normal API usage telemetry. Run with the server env file.
import fs from "node:fs";
import assert from "node:assert/strict";
import { rows } from "./seed-specs.mjs";
import { streamCompletion } from "../server/src/lib/models/router.js";
import { composeSpecialistPrompt } from "../server/src/lib/compose-specialist-prompt.js";
import { sharpenBrief } from "../server/src/lib/sharpener.js";
import { voiceQa } from "../server/src/lib/qa-voice.js";
import { visionQa } from "../server/src/lib/qa-vision.js";
const ids = ["a02","a12","a13","a14","a16","a18","a24","a37"];
const forced = process.argv.includes("--force-fallback");
const pipelineOnly = process.argv.includes("--pipeline-only");
const samplesOnly = process.argv.includes("--samples-only");
const reportPath = new URL(`../docs/brandos/handoffs/2026-10-11-hero-models/${forced ? "forced-fallback" : "smoke-results"}.json`, import.meta.url);
const bio = {
  identity: { name: "Fieldnotes Studio", positioning: "A quiet design studio for independent founders", pillars: ["Say less", "Show the work", "Stay specific"] },
  audience: { primary: "Independent founders who write their own website" },
  voice: { register: "calm, plain and specific", forbidden: ["synergy", "limited time"] },
  strategic: { notList: ["fake urgency"] }, goals: { northStar: "Book a studio consultation" },
  visual: { palette: [{hex:"#102030",name:"Ink"},{hex:"#E7E1D6",name:"Paper"}], imagery: ["Editorial layouts"], avoid: ["neon gradients"] },
};
const brief = "Launch Fieldnotes Studio's new website service. Produce one landing hero, three Instagram captions, and a two-email welcome sequence. CTA: book a consultation. No invented prices, results or urgency. Keep outputs compact.";
const tasks = {
  a02: "Sharpen the launch brief into one proposition and the central tension, under 120 words.",
  a12: "Write one landing hero: headline, short paragraph and CTA.",
  a13: "Write two short welcome emails, each with subject and body, under 100 words each.",
  a14: "Write six subject lines with previews for the welcome sequence.",
  a16: "Write three Instagram captions, under 45 words each.",
  a18: 'Evaluate this copy: "A website that sounds like you. Book a consultation." Return JSON with passed, voice_match and violations.',
  a24: "Evaluate the attached interface screenshot against the brand palette and voice. Return compact JSON with passed, brand_match and violations.",
  a37: "Write ten short landing-page headlines.",
};
const assetUrl = `data:image/png;base64,${fs.readFileSync(new URL('../docs/brandos/specs/wireframes/01-plan-view.png',import.meta.url)).toString('base64')}`;
const catalogResponse = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
assert.equal(catalogResponse.ok,true);
const catalog = (await catalogResponse.json()).data;
const headers = { apikey:process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const dbResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/specs?select=specialist_id,version,payload`, { headers, signal: AbortSignal.timeout(15000) });
assert.equal(dbResponse.ok,true);
const dbRows = await dbResponse.json();
function estimate(usage) {
  if (!usage) return null;
  if (usage.cost_usd != null) return { usd: usage.cost_usd, source: usage.cost_source };
  let id = usage.provider === "anthropic" ? `anthropic/${usage.model.replace(/-(\d+)-(\d+)(?:-\d{8})?$/,'-$1.$2')}` : usage.model;
  const pricing = catalog.find(model=>model.id===id)?.pricing;
  if (!pricing) return null;
  return { usd: (Math.max(0,(usage.prompt_tokens||0)-(usage.cached_tokens||0)-(usage.cache_creation_tokens||0)))*Number(pricing.prompt) + (usage.completion_tokens||0)*Number(pricing.completion) + (usage.cached_tokens||0)*Number(pricing.input_cache_read||pricing.prompt) + (usage.cache_creation_tokens||0)*Number(pricing.input_cache_write||pricing.prompt), source: usage.provider === "anthropic" ? "published_anthropic_rate_estimate" : "catalog_rate_estimate" };
}
async function complete(spec, task, priorOutputs = []) {
  task = `${brief}\n\nYour specific deliverable: ${task}`;
  const system = composeSpecialistPrompt({ spec, bio, brief: task, priorOutputs });
  const content = spec.specialist_id === "a24" ? [{type:"text",text:task},{type:"image_url",image_url:{url:assetUrl}}] : task;
  let output = "", usage, error, stopReason;
  for await (const event of streamCompletion({ spec, system, messages:[{role:"user",content}], telemetry:{feature:"hero-models.smoke",environment:"development",specialistId:spec.specialist_id} })) {
    if(event.type==="token") output+=event.text;
    if(event.type==="done") { usage=event.usage; stopReason=event.stopReason; }
    if(event.type==="error") error={message:event.message,status:event.status};
  }
  return {output,usage,error,stopReason,cost:estimate(usage)};
}
const report = pipelineOnly || samplesOnly ? JSON.parse(fs.readFileSync(reportPath)) : { timestamp:new Date().toISOString(), syntheticBrand:true, forcedFallback:forced, samples:[] };
if (samplesOnly) report.samples = [];
function save(){fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');}
if(forced){
  const spec=rows.find(row=>row.specialist_id==='a16');
  const result=await complete(spec,tasks.a16);
  report.samples.push({id:'a16',after:result}); save();
  assert.equal(result.error,undefined);
  assert.equal(result.usage?.fallback_from,spec.payload.modelRouting.primary);
  console.log(`forced fallback: ${result.usage.model}; fallback_from=${result.usage.fallback_from}`);
} else {
  for(const id of pipelineOnly ? [] : ids){
    const spec=rows.find(row=>row.specialist_id===id);
    const existing=dbRows.find(row=>row.specialist_id===id && row.version===1);
    const before=await complete(existing,tasks[id]);
    const after=await complete(spec,tasks[id]);
    report.samples.push({id,beforeRoute:existing.payload.modelRouting.primary,afterRoute:spec.payload.modelRouting.primary,before,after}); save();
    console.log(`${id}: old=${before.usage?.model||before.error?.status||'failed'} new=${after.usage?.model||after.error?.status||'failed'} fallback=${after.usage?.fallback_from||'none'}`);
  }
  if (!samplesOnly) {
  const sharpened=await sharpenBrief({briefText:brief,brand:{name:bio.identity.name},bio});
  // Same runnable rule and slice as HomeCreate, with the Sharpener's live plan.
  const proposed=sharpened.proposedSpecialists.map(id=>rows.find(row=>row.specialist_id===id)).filter(Boolean);
  const assembly=proposed.filter(row=>row.active && /^(anthropic|openrouter)\//.test(row.payload.modelRouting.primary)).slice(0,3);
  assert.ok(assembly.length>0 && assembly.length<=3);
  const outputs=[];
  for(const spec of assembly) outputs.push({id:spec.specialist_id,...await complete(spec,sharpened.sharpenedBrief,outputs.map(o=>({kind:o.id,body:o.output})))});
  const voice=await voiceQa({body:outputs.map(o=>o.output).join('\n'),bio,refusals:[]});
  const vision=await visionQa({assetUrl,bio});
  report.pipeline={sharpened,assembly:assembly.map(row=>row.specialist_id),outputs,voice,vision}; save();
  assert.ok(outputs.every(o=>!o.error && o.output));
  assert.ok(voice.usage && vision.usage,'pipeline QA must complete');
  assert.ok(![...voice.violations,...vision.violations].some(v=>/non-JSON|unavailable|failed/i.test(v)), 'QA must return a parsed verdict');
  console.log(`pipeline: ${assembly.map(row=>row.specialist_id).join(',')}; voice=${voice.voice_match}; vision=${vision.brand_match}`);
  }
  assert.ok(report.samples.every(s=>!s.after.error && s.after.output && !s.after.usage?.fallback_from),'all upgraded primaries must succeed');
}
console.log(`Report: ${reportPath.pathname}`);
