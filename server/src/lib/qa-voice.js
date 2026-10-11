// ─────────────────────────────────────────────────────────────────────
// a18 Voice QA — runs after every text specialist output.
//
// Two passes:
//   1. Local regex scan for forbidden-word violations (free, instant,
//      deterministic). No LLM tokens spent on what \bword\b matches.
//   2. Gemini 2.5 Flash (~$0.0008/check) for voice drift / register
//      assessment — the "soft" check the regex can't do.
//
// Returns { passed, voice_match, violations, usage }. `passed` is false
// if any local violation fires OR if the LLM says voice_match < 70.
//
// Hero QA uses Haiku 5.5; the previous Gemini Flash route is its fallback.
// ─────────────────────────────────────────────────────────────────────

import { streamCompletion } from "./models/router.js";

const QA_SPEC = {
  payload: {
    name: "a18 Voice QA",
    modelRouting: {
      primary: "anthropic/claude-haiku-5-5",
      fallback: "openrouter/google/gemini-2.5-flash",   /* previous primary, proven JSON verdicts */
      reason: "high-volume reliability check; local regex handles hard violations",
    },
    cr_estimate: 1,
  },
};

const QA_SYSTEM = `You are a18 Voice QA — you evaluate a piece of finished copy against a brand's voice rules and refusals.

Return STRICT JSON ONLY, no preamble, no fences. Shape:
{"passed":boolean,"voice_match":number,"violations":string[]}

- voice_match: integer 0–100. How well does the copy match the brand register + rhythm + signatures?
- violations: short strings, max 12 words each. Examples: "tone reads breathless; brand register is low-urgency", "uses fake urgency ('don't miss out')", "second-person addressed inconsistently".
- passed: true only if NO refusal violations AND voice_match >= 70.

Be strict on refusals (any contradiction = fail). Be calibrated on voice — a 70 is "passes muster, ships"; 85+ is "this reads exactly like the brand"; below 60 is "needs a rewrite, not a tweak".`;

const QA_SYSTEM_RETRY = `${QA_SYSTEM}

The previous reply was not valid JSON. Return exactly one JSON object and nothing else. No markdown fences, no commentary, no text before or after the object.`;

export function parseVoiceQaJson(text) {
  const stripped = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(stripped.slice(start, end + 1));
    throw new Error("unparseable");
  }
}

/* An unreadable verdict is not a pass. Callers persist this as needs_review. */
export function outputStatusForQa(qa) {
  if (qa?.status === "needs_review") return "needs_review";
  return qa?.passed ? "approved" : "flagged";
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectVerdict(complete, { system, messages, telemetry }) {
  let text = "";
  let usage = null;
  for await (const ev of complete({
    spec: QA_SPEC,
    system,
    messages,
    maxTokens: 400,
    telemetry: { operationKey: "specialist.text", feature: "qa.voice", ...telemetry },
  })) {
    if (ev.type === "token") text += ev.text;
    else if (ev.type === "done") usage = ev.usage;
    else if (ev.type === "error") {
      const error = new Error(ev.message || "qa unavailable");
      error.code = "qa_unavailable";
      throw error;
    }
  }
  return { text, usage };
}

function unavailableVerdict(localViolations, error, usage) {
  const detail = String(error?.message || error || "").trim();
  return {
    passed: false,
    status: "needs_review",
    voice_match: null,
    violations: [...localViolations, detail ? `qa_unavailable: ${detail}` : "qa_unavailable"],
    usage,
  };
}

function mergeUsage(first, second) {
  if (!first) return second;
  if (!second) return first;
  const costs = [first.cost_usd, second.cost_usd].filter((n) => typeof n === "number");
  return { ...first, ...second, cost_usd: costs.length ? costs.reduce((sum, n) => sum + n, 0) : null };
}

export async function voiceQa({ body, bio, refusals, telemetry = {}, complete = streamCompletion }) {
  /* 1. Local forbidden-words scan. */
  const forbidden = bio?.voice?.forbidden || [];
  const localViolations = [];
  for (const word of forbidden) {
    if (!word) continue;
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    if (re.test(body)) localViolations.push(`uses forbidden word "${word}"`);
  }

  /* 2. LLM voice-drift check. */
  const userMsg = [
    `BRAND VOICE`,
    `Register: ${bio?.voice?.register || "(none)"}`,
    `Rhythm: ${bio?.voice?.rhythm || "(none)"}`,
    `Signatures: ${(bio?.voice?.signatures || []).join(" · ") || "(none)"}`,
    `Forbidden: ${forbidden.join(", ") || "(none)"}`,
    ``,
    `GLOBAL REFUSALS`,
    ...(Array.isArray(refusals) ? refusals.map((r, i) => `${i + 1}. ${r}`) : []),
    ``,
    `COPY TO EVALUATE`,
    `"""`,
    String(body || "").trim(),
    `"""`,
  ].join("\n");

  let text = "";
  let usage = null;
  try {
    const first = await collectVerdict(complete, {
      system: QA_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      telemetry,
    });
    text = first.text;
    usage = first.usage;
  } catch (e) {
    return unavailableVerdict(localViolations, e, null);
  }

  let llmVerdict = null;
  try {
    llmVerdict = parseVoiceQaJson(text);
  } catch {
    try {
      const second = await collectVerdict(complete, {
        system: QA_SYSTEM_RETRY,
        messages: [{
          role: "user",
          content: `${userMsg}\n\nYour previous reply was not valid JSON. Return exactly one JSON object and nothing else.`,
        }],
        telemetry,
      });
      text = second.text;
      usage = mergeUsage(usage, second.usage);
      llmVerdict = parseVoiceQaJson(text);
    } catch (e) {
      if (e?.code === "qa_unavailable") return unavailableVerdict(localViolations, e, usage);
      return {
        passed: false,
        status: "needs_review",
        voice_match: null,
        violations: [...localViolations, "qa_unparseable_response"],
        usage,
      };
    }
  }

  const violations = [...localViolations, ...(Array.isArray(llmVerdict.violations) ? llmVerdict.violations : [])];
  const voiceMatch = typeof llmVerdict.voice_match === "number" ? llmVerdict.voice_match : 70;
  const llmPassed = llmVerdict.passed !== false;

  return {
    passed: localViolations.length === 0 && llmPassed && voiceMatch >= 70,
    voice_match: voiceMatch,
    violations,
    usage,
  };
}
