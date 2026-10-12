// One JSON-returning model call through the existing text router, with the
// tool guard and the task budget applied. `complete` is injectable for tests.
import { streamCompletion } from "../lib/models/router.js";
import { assertToolAllowed } from "./tools.js";
import { usageContext } from "./usage-context.js";

export function parseJsonLoose(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

export async function callJson({ role, step, route, fallback = null, system, content, maxTokens = 2000, budget, estimateUsd = 0.03, telemetry = {}, complete = streamCompletion }) {
  assertToolAllowed(role, route);
  if (fallback) assertToolAllowed(role, fallback);
  budget?.reserve("text", estimateUsd);
  const spec = { payload: { name: `task.${step}`, modelRouting: { primary: route, fallback, reason: `task pipeline ${step}` }, cr_estimate: 1 } };
  const started = Date.now();
  let text = ""; let usage = null; let error = null;
  try {
    for await (const ev of complete({ spec, system, messages: [{ role: "user", content }], maxTokens, telemetry: { operationKey: "specialist.text", feature: `task.${step}`, ...usageTelemetry(), ...telemetry } })) {
      if (ev.type === "token") text += ev.text;
      else if (ev.type === "done") usage = ev.usage || null;
      else if (ev.type === "error") { error = ev.message || "provider error"; break; }
    }
  } catch (e) { error = e?.message || String(e); }
  const ms = Date.now() - started;
  budget?.record({ kind: "text", step, model: usage?.model || route, cost_usd: Number(usage?.cost_usd) || 0, ms, tokens_in: usage?.input_tokens ?? usage?.prompt_tokens ?? null, tokens_out: usage?.output_tokens ?? usage?.completion_tokens ?? null, fallback_from: usage?.fallback_from || null, error });
  if (error) { const e = new Error(`${step} failed: ${error}`); e.code = "PROVIDER_ERROR"; throw e; }
  return { json: parseJsonLoose(text), text, usage, ms };
}

function usageTelemetry() {
  const u = usageContext();
  return u.runId ? { parentRunId: u.runId, workspaceId: u.workspaceId, brandId: u.brandId, actorUserId: u.userId, specialistId: u.specialistId } : {};
}
