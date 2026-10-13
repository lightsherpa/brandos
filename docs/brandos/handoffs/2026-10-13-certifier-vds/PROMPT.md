# Codex — build the Certifier support agent (VDS slice S2)
Repo: CaastorOS. Branch `feat/certifier-agent` off latest `origin/dev` (includes task-pipeline, foundation, PR 11, PR 13). **No DB seeds, no migrations applied to shared DBs.** Small commits; run `npm run test:units`; push the branch when green.

Read first: SYSTEM-PROMPT.md, MODEL.md, CONTEXT-ALLOWLIST.md, TOOLS.json, TOOL-CONTRACT.md, OUTPUT.schema.json, VALIDATOR.md, TESTS.md (this folder).

## UX (Maya, answered — no pending items)
Slices: **S1** evidence beside the claim · **S2** this agent · **S3** CD↔client chat.
- Separate **Certify view**, "Brand in 60s" at top, agent in a side panel. Brand Core screen gets only a Certify entry point and status chips Certified / Needs review / Missing (no confidence there).
- Confidence only in the review queue and claim cards.
- Citations side by side: claim left, source right (quote highlighted via char_start/char_end, PDF page or image), secondary link out (`GET /api/bios/:brandId/sources/:sourceId/url`, routes/bios.js:217). No hover-only.
- "To confirm" = neutral style, sorted top, actions Ask client / Add.
- Questions editable, sent as one batch per section under the CD's name (S3, in-app + email notifications via existing `/api/notifications`).
- Client answers/uploads become evidence on the claim → status "New evidence" → CD triggers single-claim re-draft → CD confirms. No automatic re-run.
- CD certifies claim by claim; "Confirm all" per section only when every claim in it has evidence; Layer 1 seal requires foundation gate (logo, primary colour, display font).
- Agent is internal; clients never see it (only the CD's questions + badge).

## Real code locations
| Need | Path |
|---|---|
| Load Brand Core | `server/src/lib/load-brand-bio.js` (`loadBrandBio`, read-only tier: no cert flags) |
| Fields/layers | `server/src/lib/bio-schema.js` (`BIO_FIELDS`, `normalizeBio`, `getBioForAgent`) |
| Provenance/evidence | `server/src/lib/bio-evidence.js`; claim grouping + HIGH_IMPACT in `server/src/lib/steward-copilot.js` |
| Sources | table `bio_sources` (init migration `supabase/migrations/20260524183348_init.sql:124`); routes `server/src/routes/bios.js` |
| Visual assets / gate | `server/src/lib/visual-assets.js` |
| Certification paths to guard | `routes/bios.js:398` self-certify; `routes/steward.js:169` PATCH jobs; `routes/steward.js:393` decertify; schema `supabase/migrations/20260815010000_m2_certification.sql` |
| Steward API mount | `server/src/index.js:69` `/api/steward` |
| Models / fallback / budget / credits | `server/src/lib/models/router.js`, `fallback.js`, `token-budget.js`, `anthropic.js`; `server/src/lib/credits.js` |

## Steps (S2, VDS-minimal)
1. `server/src/lib/certifier/context.js` — `buildCertifierContext({workspaceId, brandId, bioId})` per CONTEXT-ALLOWLIST (escape source text; mark first_party/derived_from_model).
2. `certifier/prompt.js` — exports the verbatim SYSTEM-PROMPT text + fill.
3. `certifier/tools.js` — 5 tools from TOOLS.json, bound to run scope, select-only.
4. `certifier/validate.js` + `certifier/enrich.js` — VALIDATOR.md exactly (ajv already in deps? if not, add `ajv` + `ajv-formats`).
5. `certifier/run.js` — tool loop (≤6 reads), forced `submit_brief`, Sonnet 5.5 → 4.6 fallback, $0.30 cap, run log.
6. Routes in `server/src/routes/steward.js` (requireAuth + requireSteward):
   - `POST /api/steward/certifier/:bioId/brief` {mode:"full"} → brief JSON
   - `POST /api/steward/certifier/:bioId/claims/:claimId/redraft` (single_claim)
   - `GET  /api/steward/certifier/:bioId/brief` (latest, pinned to version; stale if version changed)
7. `assertHumanActor()` in a new `server/src/lib/human-actor.js`; call it in all 3 certify paths + new per-claim confirm → 403 `AGENT_CANNOT_CERTIFY`.
8. Migration file only (do not apply): `certifier_briefs` (bio_id, version, brief jsonb, cost_usd, model) and `certifier_question_drafts` (status 'draft'|'sent', section, claim_ids, text). RLS: agent role SELECT only on bios/bio_sources.
9. Tests per TESTS.md with mocked model (`*.test.mjs` next to files) + lint test: no `.update(`/`.insert(`/`.delete(` in `lib/certifier/` except drafts helper.
10. Note: existing `buildStewardCopilot().certificationRecommendation` emits approve/return verdicts — keep it OUT of the agent context; flag to Kai whether to hide it in the Certify view.

## Later (not VDS)
S3 chat + email bridge + send endpoint; per-claim confirm UI "Confirm all"; eval on live keys; caching tuning; multi-language QA; re-score of rubric.

Report back: commits, test count, any path that differed from this table.
