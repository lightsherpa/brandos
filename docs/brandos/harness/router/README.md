# Self-updating model router — design (post-hero build; proposal only)
Files: triage.md + triage.schema.json (cheap classifier) · routes.md (type→model table, HTML patterns) · self-update.md (scout job, scoring, human approval) · data-model.sql + route-proposal.schema.json.
Principles: expensive models never make routing decisions; deterministic first (contract-declared type), cheap model only when ambiguous; humans approve every switch; **3-agent cap per run unchanged** — routing picks models for ≤3 tasks, never adds agents.

## Build spec (Claude/Codex, AFTER hero crew ships; ~5–7 dev-days)
| # | Build | Files (proposed) | Done when |
|---|---|---|---|
| 1 | Tables | migration from data-model.sql | migration applies; seed `route_versions` from current MODEL_MAP + approved hero rows (scope agents) |
| 2 | Catalog sync | `server/src/router/catalog-sync.js` | pulls OpenRouter /models + fal watchlist; upserts model_catalog; flags missing primaries |
| 3 | Triage | `server/src/router/triage.js` | contract type → else Haiku 5.5 JSON (schema-validated), 4s timeout, fallback flash-lite, conf<0.6 → standard |
| 4 | Resolver | `server/src/router/resolve.js` | `(agent, task) → {primary,fallback,judge}` from active route_versions (scope match first); feeds existing router.js fallback wrapper (routing-change-hero) |
| 5 | Scout job | `server/src/inngest/functions/router-scout.js` | weekly; budget cap; writes eval_runs/results; proposals only |
| 6 | Proposal UI/API | `GET/POST /api/admin/route-proposals` | approve → new route_versions row; reject with note; no other path writes routes |
| 7 | Tests | unit: triage schema, resolver precedence, scout never writes route_versions; e2e: approve → next run uses new route |
Until #4 ships, routes stay in specs (seed) as today.
