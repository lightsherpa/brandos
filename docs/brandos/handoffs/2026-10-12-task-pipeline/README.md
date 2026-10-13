# Task pipeline: social post and email sequence (feat/task-pipeline)

Built 2026-10-12 against CREWS.md, HARNESS.md steps 1–5, and PLAN-VERIFIED S1/S2/S5. Not merged. Production untouched.

## What runs
Planning (Brand Core Layer 1 + saved rules) → Writing (1 writer call, typed Message Spec) → Imaging (1 image per slot, parallel, cap 3) → Checking (code checks, then 1 read-only reviewer) → Fixing (≤1 targeted revision) → Ready / Needs review.

| | Social post | Email sequence |
|---|---|---|
| Writer | a16 Social Captions (+ a37 Headlines skill) | a13 Email Sequence (+ a14 Subject Lines, a12 Conversion Copy skills, text only) |
| Images | GPT Image 2.5 Sunburst edit → Nano Banana 2.1 edit, ≤3 Brand Core refs, 4:5 | Optional hero per email, same models, 16:9 |
| Code checks | OCR no-text, aspect ±1%, caption ≤2200, first line ≤125, ≤5 hashtags, CTA, banned words, brief don't-list | subject ≤50, preheader 40–100, headline ≤60, body ≤200 words, https CTA, MJML 0 errors, HTML <80 KB, alt, links, 1 primary CTA, contrast, banned words, OCR on heroes |
| Reviewer | Gemini 3.8 Flash (Sonnet 4.6 fallback): 6 binary checks, voice + claims mandatory, pass ≥5/6 | same, sequence-level checks |
| Render | HTML composite: image + overlay line in brand display font + logo + accent bar | MJML template `email-task.mjml` with palette roles + logo |

Model IDs (fal): `openai/gpt-image-2.5/sunburst/text-to-image` and `/sunburst/edit` (quality `high`, 120 s timeout); fallback `google/nano-banana-2.1` and `/edit` (2K, thinking high). Nano Banana 2.1 is a separate model from Nano Banana 2 (released Oct 6 2026, `google/nano-banana-2.1`), so the Oct 29 retirement of NB2 doesn't affect it. It was verified live (28.7 s, 1 ref). Text: `anthropic/claude-sonnet-5-5` writer (fallback `claude-sonnet-4-6`), `openrouter/google/gemini-3.8-flash` reviewer and OCR.

## E2E (local Supabase, Nomad Coffee v2, self-certified 86, 3 site photos as canonical refs, logo = og:image)
| Run | Status | Time | Cost | Stages (s from Run) |
|---|---|---|---|---|
| social-nomad | ready 3/3 | 97.6 s | $0.263 | writing 22.9 · images 42–59 s each in parallel · checks done 82.0 · reviewed 97.6 |
| social-nomad-beat4 (brief says "exclusivo") | ready 3/3, brief flagged | 93.2 s | $0.257 | — |
| email-nomad (no heroes) | ready 3/3 | 23.5 s | $0.030 | writing 16.3 · reviewed 23.5 |
| email-nomad-heroes | ready 3/3 | 84.5 s | $0.262 | images 35–44 s |
| Beat 5 rerun (rule "sin complicarte" on social item 2) | ready, rule applied, image reused | 21.3 s | $0.039 | — |

Cost per step is in each `result.json` → `metrics.cost.by_step` and `metrics.ledger` (model, ms, tokens, fallback). Image cost is fal's published rate (edit, high, about 1 MP + refs ≈ $0.07). fal doesn't return the billed amount per request, so check it against the fal dashboard. HTML emails are 11.7–15.1 KB.

Screenshots: `screenshots/` (posts are the code composite, emails are Chrome renders). The raw HTML is in each run folder.

## Known gaps / follow-ups
- Jobs are kept in memory on the server, so they survive the user leaving the page but not a Render restart. Persisting them to `runs`/`outputs` is a post-freeze task.
- The social export is HTML/CSS. There's no PNG yet because sharp isn't in the server deps; adding it before the freeze is a risk.
- The logo is placed bottom-right with no light/dark variant pick, so a black logo on a dark photo is weak (see social-nomad-3). This needs S3 (logo light/dark).
- The primary colour role is guessed for Nomad (`foundation_missing: primary_colour_role`) until S7/F-roles land.
- The OCR is a vision model, not tesseract. It fails closed.
- In the legacy runs path, `portal-briefs.jsx:1841-2014` still fans out image runs from copy parts. Server-side, copy-dept specs on image routes are now rejected with 403 (`runs.js`), and `taxonomy.js` ad_creative uses a38 instead of a12.
- Beat 4: when the brief uses a don't-list word, the run catches it and shows it on every card, but the writer then avoids the word, so no revision happens. For a visible before→after, the catch has to come from the copy or the reviewer (risk R1).

## Quinn unblock (credits, caps, flag, rules, roles)

- **Credits:** `server/src/harness/settlement.js` mirrors `runs.js`: preflight `assertCreditsAvailable` (402, $0 spent) → briefs + runs rows → `reserveCredits` (`task:<runId>:credits`) → work → `finalize_run_atomic` (outputs + qa_results + ledger `run`/`run_flagged`), or `failRunAndReleaseCredits` on error. Used for tasks and item re-runs. Text and image calls are tagged with the run id (`usage-context.js`); each image attempt writes an `api_usage_events` row (`service=image`, `rate_card_estimate`).
- **Placeholder prices (pending Oscar):** `TASK_CREDITS` in `settlement.js`: social 12, email 6, email+heroes 12, re-run 2.
- **Re-runs:** at most 2 per item, server-side (429 `RERUN_LIMIT`; 409 while one is in flight).
- **Flag:** `TASKS_ENABLED` (server env, default off). Off → every `/api/tasks` route 404s `TASKS_DISABLED`; `GET /api/tasks/enabled` drives the nav item and route in `portal-shell.jsx`.
- **Rules fail closed:** `loadRules` throws 503 `BRAND_RULES_UNAVAILABLE`; rules load before any reservation.
- **Save as rule:** needs `brand.manage` (workspace owner/admin, platform admin, creative director). Workspace user/designer → 403.

### Live Fixing path (forced reviewer fail, local Supabase)

`scripts/e2e-fixing.mjs` forces `voice_on_brand` to fail on item 1 in the first review. Nomad Coffee, social post, run `75216d53-a3ca-4269-8370-a6732b01425f`:

| | |
|---|---|
| Total | 121.7s, $0.3005 (writing 0.0326 · imaging 0.21 · ocr 0.0046 · review 0.0187 · fixing 0.0345) |
| Stages | Imaging 22.0s · Checking 78.8s · Fixing 96.0s · Ready 121.7s |
| Items | item 1 failed voice_on_brand → 1 revision → ready; items 2–3 ready, 0 revisions |
| DB | run completed · 1 output `task`/approved · ledger `run` 12 credits · 10 api_usage rows (3 image) |

A first run (`ca76598c-…`, 120.3s, $0.2972) went through Fixing the same way but logged 0 image usage rows: `cost_source` was `estimated`, which the DB check rejects. Fixed to `rate_card_estimate` and re-run (table above). Result: `fixing-forced/result.json`.
