# Self-updating router — scheduled discovery + eval + proposal (NEVER auto-switch)
## Job: `router-scout` (weekly, Mon 03:00 Madrid; manual trigger allowed)
1. **Discover**
   - OpenRouter: `GET https://openrouter.ai/api/v1/models` (public) → id, pricing.prompt/completion, context_length, architecture.input/output_modalities, created.
   - fal: model catalog (fal model search/API or the public model pages for a watchlist of endpoint ids; verify the catalog endpoint before building) → endpoint id, category (text-to-image, text-to-vector, image-to-video…), unit price from page/pricing.
   - Anthropic direct: models list from docs/Models API (when key present) to map OpenRouter slug ↔ direct id.
2. **Diff** against `model_catalog` → new ids, price changes, deprecations/missing ids (missing primary or fallback = **P0 alert**, not a switch).
3. **Candidate filter** (deterministic): modality fits output_type; price ≤ 2× current primary for that type (or cheaper); context ≥ needed; not `:free`/preview unless flagged; provider allowed list. Max 3 candidates per type per week.
4. **Eval** each candidate vs current primary on that type's golden briefs (eval-harness.md; 5–10 briefs/type, 2 runs each, same BIO): run through the **same contract + check registry + loop (max 2 passes)**; record deterministic pass rate, passes needed, judge scores (pairwise blind judge from a different family than the candidate), latency p50/p95, cost.
5. **Score**: `quality = 0.5·judge_win_rate + 0.3·first_pass_check_rate + 0.2·(1 − passes_used/2)`; `value = quality / cost_per_output`. Propose if candidate quality ≥ current − 0.02 AND value ≥ 1.2× current, OR quality ≥ current + 0.05 at ≤ 1.5× cost; zero hard-check regressions; p95 latency ≤ 1.5×.
6. **Proposal** → `route_proposals` row + card for Kai/Ada: type, current vs candidate, metrics table, 3 side-by-side samples, cost delta/month at current volume, rollback plan. **Status `open` until a human approves.**
7. **On approval**: write new `route_versions` row (effective_at), old primary becomes fallback; optional canary (10% of runs for 3 days) with automatic rollback to previous version if hard-check failure rate rises >5 pts. Still human-initiated.
8. **Never**: switch routes, edit specs or prompts automatically; spend more than `scout_budget_usd` (default $25/week).
## Cap
Scout runs single-agent evals outside user runs; it never changes the 3-agent cap.
