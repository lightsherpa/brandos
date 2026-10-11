# Routing change — HERO CREW ONLY (approved by Oscar 2026-10-11)
Scope: Sonnet 5.5, Haiku 5.5, Gemini 3.8 Flash for the hero crew. **Non-hero agents untouched. 3-agent cap (`.slice(0,3)`) untouched.** a41 Social Post Designer (image) unchanged — no image model change was approved.

## Per agent
| Agent | Where routed | Current | New primary | Fallback |
|---|---|---|---|---|
| a02 Sharpener | `server/src/lib/sharpener.js:24` (pipeline) + portal-data.js:63 | anthropic/claude-sonnet-4-6 | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` |
| a16 Social Captions | portal-data.js:84 → seed | anthropic/claude-sonnet-4-6 | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` |
| a13 Email Sequence | portal-data.js:81 | anthropic/claude-sonnet-4-6 | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` |
| a12 Conversion Copy | portal-data.js:80 | anthropic/claude-sonnet-4-6 | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` |
| a37 Headlines | portal-data.js:87 | openrouter/google/gemini-2.5-pro | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` |
| a14 Subject Lines | portal-data.js:82 | openrouter/google/gemini-2.5-flash | `openrouter/google/gemini-3.8-flash` | `openrouter/google/gemini-2.5-flash` |
| a18 Voice QA (directory spec) | portal-data.js:86 | anthropic/claude-haiku-4-5-20251001 | `anthropic/claude-haiku-5-5` | `anthropic/claude-haiku-4-5-20251001` |
| Voice QA (pipeline) | `server/src/lib/qa-voice.js:25` | openrouter/google/gemini-2.5-flash | `anthropic/claude-haiku-5-5` | `openrouter/google/gemini-2.5-flash` (previous primary, proven JSON) |
| a24 Vision QA (directory + pipeline) | portal-data.js:97, `qa-vision.js:22` | openrouter/google/gemini-2.5-flash | `openrouter/google/gemini-3.8-flash` | `openrouter/google/gemini-2.5-flash` |
| a41 Social Post Designer | portal-data.js:98 | vendor/fal/flux-schnell | **unchanged** | — |

Exact ids: direct Anthropic API uses dashes — `claude-sonnet-5-5`, `claude-haiku-5-5` (docs.claude.com models overview, 2026-10-10). OpenRouter equivalents use dots (`anthropic/claude-sonnet-5.5`, `anthropic/claude-haiku-5.5`) — not used here because our `anthropic/` prefix goes direct. Gemini: `google/gemini-3.8-flash` (live in OpenRouter /api/v1/models 2026-10-10) → route `openrouter/google/gemini-3.8-flash`.

## Code changes in the diff (7 files, +71/−15)
1. `src/portal-data.js` — 8 hero rows: new short keys `sonnet55`, `haiku55`, `gemFlash38`.
2. `scripts/seed-specs.mjs` — MODEL_MAP gains the 3 keys; new `FALLBACK_MAP`; `modelRouting.fallback = FALLBACK_MAP[agent.model] ?? null` (non-hero rows stay `null`).
3. `src/portal-brandolph.jsx` — add the 3 keys to `TEXT_MODELS` (otherwise RUNNABLE would filter the hero crew out). `.slice(0,3)` unchanged.
4. `server/src/lib/models/router.js` — allowlist +3 routes; credit multiplier treats gemini-3.8-flash like 2.5 flash (0.75×; haiku-5-5 already matches /haiku/); `streamCompletion` becomes a fallback wrapper around the original body (`streamRoute`).
5. `sharpener.js`, `qa-voice.js`, `qa-vision.js` — new primary + fallback.

## Fallback trigger logic (router.js)
- Only if `modelRouting.fallback` is set and differs from primary (so non-hero agents behave exactly as before).
- Switch only **before the first token**: first event is `error` matching `/\b(429|500|502|503|504|529|404)\b|overloaded|rate.?limit|timeout|network|ECONNRESET|ETIMEDOUT|not.?found|no such model/i`, OR no first event within `MODEL_FIRST_TOKEN_TIMEOUT_MS` (default 20000).
- Non-retryable errors (400 bad request, auth/missing key) are returned as-is — falling back would hide config bugs.
- Never mid-stream (would duplicate text). One fallback hop only.
- `done.usage.fallback_from = <primary>` so traces/cost show it; `console.warn` line logged.
Tested in isolation with stub adapters: 529→fallback ✔, first-token timeout→fallback ✔, 400→no fallback ✔, success→primary ✔, no fallback set→unchanged ✔.

## Which diff to apply
| File | Base | `git apply --check` |
|---|---|---|
| routing-change-hero.diff | /workspace/caastoros/CaastorOS (box copy, as requested) | ✔ clean |
| routing-change-hero.pr4.diff | PR #4 head `cursor/demo-baseline-c1e1` (router has telemetry/breaker, 2000–8000 budget) | ✔ clean |
| routing-change-hero.rc1.diff | `rc/caa-44-rc1` | ✔ clean |
The box-copy diff does NOT apply to PR #4 / rc1 (router.js differs) — use the matching file. Checked on temp clones in /tmp; the repo was not modified or pushed.

## Apply + verify (Claude/Codex)
1. `git checkout -b feat/hero-models <base>` → `git apply harness/routing-change-hero.<base>.diff`.
2. `node --check` on changed server files; `npm run build`; `npm run test:units` (PR #4 CI, Node 22).
3. Unit test to add: router fallback cases above (stub adapters) + seed test: hero rows have fallback, every non-hero row `fallback === null` and primary unchanged (diff `SELECT specialist_id, payload->'modelRouting' FROM specs` before/after re-seed — expect exactly 8 rows changed).
4. Re-seed specs (`node scripts/seed-specs.mjs` with Supabase env) — then confirm the ~22 DB "route downgrades" from CLAUDE.md weren't overwritten for non-hero agents (re-seed rewrites ALL rows from portal-data.js → if DB had manual downgrades, seed only the 8 hero ids or back up first). **Important.**
5. Smoke: one call each to `claude-sonnet-5-5`, `claude-haiku-5-5`, `google/gemini-3.8-flash` (needs keys). Force fallback by setting `MODEL_FIRST_TOKEN_TIMEOUT_MS=1` → expect `fallback_from` in usage.
6. UI: hero brief → assembly still shows ≤3 agents; hero agents not filtered out.
7. Eval: run G1/G10 blind A/B (arm A old vs arm B new) before the Oct 16 freeze; revert = `git revert` + re-seed 8 rows.
