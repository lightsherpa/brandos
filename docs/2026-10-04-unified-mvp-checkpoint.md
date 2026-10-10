# Unified MVP checkpoint

4 October 2026. Integration checkout: `.claude/worktrees/melius-competitor-analysis-e18b7d`, branch `claude/melius-competitor-analysis-e18b7d`, base `6fafe38`. The canvas and JEV streams share one checkout; source hashes and merge provenance are in `mvp-integration-provenance.json`. The JEV source checkout is preserved. No commit, PR, production deployment, production migration, paid generation or client contact was performed.

**The independent local integration is reviewable. The full goal is not complete.** A real client, approved brief, human-certified BIO, permission to use client materials, reviewers, provider credentials/qualifications and an explicit API budget are still required. Synthetic outputs and review transitions below are test evidence, not client validation, live model accuracy or savings.

## Runnable local surfaces

- App: http://localhost:5184 — real isolated local auth/API/database.
- Canvas interaction sandbox: http://localhost:5184/docs/mockups/canvas-v2/index.html?demo=1 — explicit simulation, no provider calls.
- Component reference: http://localhost:5184/docs/mockups/design-system/index.html — real shared controls, no workspace data/provider calls.
- Production build preview: http://127.0.0.1:5185.
- API: http://127.0.0.1:8791; isolated Supabase API: http://127.0.0.1:57321; Inngest developer UI: http://127.0.0.1:8291.

Local fixture credentials are in ignored `.mvp-local/fixture.json`; synthetic operator fixtures are separate files there. `.env.mvp-local` and `server/.env.mvp-local` contain local keys only and exclude paid provider keys. The setup uses project ID `caastoros-mvp-integrated`; other local stacks remain untouched. TOTP is enabled only in its generated local configuration so the real protected operator UI can be checked.

```sh
npm run setup:mvp-local
npm run dev:mvp-local:api
npm run dev:mvp-local:web
npm run dev:mvp-local:inngest
npm run test:mvp-local
```

Run the three dev services in separate terminals. For production preview, build with `npm run build -- --mode mvp-local`, then `npm exec vite -- preview --host 127.0.0.1 --port 5185 --strictPort`. Local API CORS permits these two UI ports. Never use this synthetic fixture or local calibration bypass as production certification.

## Concrete integration changes

- Canvas text and media use persisted quote UUIDs as run identities. Text quote claim/run/hold and media quote/job/run/hold are atomic database transactions; concurrent requests cannot start a second execution. Failed text credit reservation leaves the quote pending and creates no run.
- Canvas media goes through the durable creative worker, not the text SSE path. Exact input/settings/BIO/spec snapshots, approved stored image references, qualification constraints, per-request/monthly budget checks and conservative eligible-route ceilings precede paid submission.
- Private image/video assets use the new `creative-outputs` bucket. Signed access is regenerated from stored bucket/path identity; client storage access is denied. Video remains under human review.
- Existing renderer/router routes are preserved. JEV is a bounded choice classifier over eligible evaluated candidates. Shadow records recommendation/decision without changing execution; active requires measured labels, confidence and human-approved evidence. Unknown provider equivalence/pricing does not qualify a route.
- Shared Dialog, PanelHeader, IconButton and ActionButton plus paired tokens underpin the new canvas/media/email/reference surfaces. The incumbent visual identity remains. See `DESIGN.md` and `2026-10-04-impeccable-audit.md`.
- Heavy Briefs/Canvas and Discovery/BIO modules load on navigation. Main JS: **774.66 → 526.11 kB**; gzip **224.94 → 165.69 kB**. Including the unchanged React/Supabase chunks, initial JS falls **1126.98 → 878.43 kB**, gzip **324.93 → 265.68 kB**. Lazy chunks are 224.29/82.80 kB plus 18.19 kB brief CSS and 3.38 kB extracted control CSS. Both browsers pass production-build navigation. These are build sizes, not Core Web Vitals results.

## Measurement now comes from the actual platform

`20261004030000_execution_measurements.sql` adds private append-only evidence captured in the same transactions as run status, job state/error and output workflow/body changes. No historical acceptance is invented. Content edits count as revisions; review change requests have a separate count. Automated QA and internal approval never count as client acceptance.

`GET /api/opex/measurements?workspaceId=<UUID>&from=<ISO>&to=<ISO>` requires existing operator `opex.read` permission. It reads actual runs/jobs/events/usage with tenant scope and returns per-run client acceptance, timestamps/time from run start to acceptance, revisions, change requests, error events, model/settings/cohort and persisted JEV mode/chosen route/recommendation/confidence/fallback. The FinOps **Execution outcomes** tab exposes this evidence. The API accepts `acceptanceStage=internally_approved` for an explicitly named internal-review report; client acceptance is the default.

Usage operations retain reported, estimated, reconciled and unknown values separately. Reconciliation takes precedence without adding the same charge twice. Missing generation/QA/JEV evidence keeps the total and cost-per-accepted output null; a known subtotal is still shown. JEV costs are included in media run settlement, and unpriced classification cannot silently become zero. FinOps overview labels known spend/forecast as a lower bound when charges are unknown; cost per approved deliverable remains unknown in that case.

The reporting cohort is runs **started** in the selected period, with their subsequent review/cost evidence. API pagination prevents silent 1,000-row truncation; excessive windows fail with a request to narrow the period. Time-to-accepted is per execution, not an inferred full project lifetime. Older runs without prospective events remain uncovered. Baseline/shadow/active groups stay separate by model version/settings/gateway/cache mode. Shadow observations do not establish causal savings.

The paid benchmark runner keeps a file lock and persists each conservative hold before submission. It now rejects undefined/NaN/infinite/negative/string committed spend and refuses a resumed ledger whose stored reservations exceed its committed balance. Uncertain/failed cases retain their holds. No benchmark was run with `--paid`.

## Verification at this checkpoint

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run test:units` | 201 pass | Existing offline contracts, permissions, credits, BIO and account tests. |
| `npm run test:canvas` | 16 pass | Graph/reference rules, snapshots, tier/quote validation, scoped access, CAS, replay and review rules. |
| `npm run test:creative` | 26 pass | Routing/JEV/provider contracts, replay/recovery behavior, email validation, cost/measurement provenance and invalid budget boundaries. |
| `scripts/test-jev-fixtures.mjs` | 120 mock cases pass | Classifier contract; **not** live accuracy or human label qualification. |
| `npm run test:mvp-local` | 45 real local checks pass | Auth, API, full migrated schema, BIO gate, tenant/RLS denial, CAS, missing-provider refund, synthetic settlement, private storage, atomic media/text holds and rollback, separate submitter/reviewer workflow, operator measurements and unknown-cost overview. Zero provider calls. |
| `scripts/check-mvp-browser.mjs` | Chromium + WebKit pass | Real authenticated save/reload, lazy navigation, light/dark/responsive reference, dialog focus and reduced motion; dev and production preview. |
| `scripts/check-measurement-browser.mjs` | Chromium pass, real local AAL2 | Operator table connects to actual persisted synthetic review/cost/routing evidence. |
| `scripts/canvas-browser-check.mjs` | Chromium + WebKit pass | Intercepted text/media approvals and graph interactions, keyboard/gestures/review/versions, screenshots. |
| `scripts/check-design-reference.mjs` | pass | Named light/dark contrast samples, 44 px coarse-pointer reference actions, no reference overflow. |
| `scripts/verify-email-preview.mjs` | 375/600 px pass | Browser layout/CTA validation. **Not** Gmail/Outlook/Apple Mail compatibility. |
| `scripts/check-text-reconciliation.mjs` | 26 real local checks pass | Real SIGKILL/quarantine, uncertain credits held, permissions/MFA, incomplete evidence denial, one refund, concurrent recovery/normal settlement, stale worker and altered-finalization rejection; zero provider calls. |
| `scripts/check-text-recovery-browser.mjs` | 12 checks; Chromium + WebKit, actual local AAL2 | Operator recover/refund UI, validation, Escape/focus, flagged draft/unknown cost and exactly one credit release. Synthetic evidence. |
| `scripts/check-canvas-locales.mjs` | 132 checks; Chromium + WebKit | Spanish/Arabic controls, stable status/action IDs, physical coarse targets ≥44 px, long Arabic names, 200% CSS zoom and picker usability at 390/768/1024/1440. Not a native zoom/device audit. |
| `npm run test:text-spend` | 6 pass | Full-context/all-fee bounds, partial unknown QA, invalid ceilings, one local HTTP SDK attempt, pinned OpenRouter settings and strict QA verdicts. |
| `npm run test:mvp-spend` | 30 real local checks pass | Shared text/media race and rollback, quote binding, old-month uncertainty, unknown extra charges, MFA invoice replay and late-evidence amendment history. |
| `scripts/check-spend-browser.mjs` | 12 checks; Chromium + WebKit, actual local AAL2 | Billing reconciliation, unknown commitments, late-charge discrepancy, preserved invoice amendments and measured totals. |
| Production build and `git diff --check` | pass | Build/load integration and whitespace checks. |

Browser scripts use `CAASTOR_BROWSER_MODULE_ROOT` to point at an installed Playwright package. `check-mvp-browser.mjs` accepts `CAASTOR_BROWSER_BASE_URL=http://127.0.0.1:5185`; email screenshots use `PLAYWRIGHT_MODULE=<absolute playwright/index.mjs>`. Evidence is in ignored `.mvp-local/browser`, `.mvp-local/integration-result.json`, and `output/creative-qa`.

Existing `test:router`, `test:run` and `test:discovery` scripts can invoke paid models/cloud workflows; they were not run without an approved budget. Passing their offline unit coverage is not a claim that those live smoke tests passed.

## Interrupted text recovery and canvas hardening

Migration `20261004050000_text_reconciliation.sql` creates private durable execution evidence in the same transaction as a canvas text run. The SSE executor records provider submission possibility, receipt, completed raw output, usage/finalization and heartbeat. The local Inngest reconciliation cron marks a heartbeat older than five minutes `reconcile`; it never guesses a charge or resubmits. The client run API exposes only the safe text state, and the canvas blocks another submission while the run is unresolved.

FinOps **Execution outcomes → Interrupted text executions** lists operator evidence. The mutation requires `opex.override` and AAL2. **Recover stored output** requires complete persisted generation and preserves interrupted QA as a flagged draft; no new generation/QA call occurs. **Confirm no provider charge** requires an operator reason, provider evidence reference and explicit confirmation before one idempotent refund. Unknown charges remain held. Normal settlement checks the exact persisted finalization under database locks, fencing stale workers and operator decisions. Lost streams cannot be resumed; live provider billing/task evidence is still required.

Canvas copy now uses EN/ES/AR catalogs (225 keys with matching interpolation parameters) and localized number/date formatting. Internal status/action IDs and physical keyboard keys never translate. Arabic chrome/list follows document direction; graph coordinates stay fixed. Coarse tablets up to 1024 px use the existing unscaled node list with the inspector/picker/review workflow, and native connection selects/actions have ≥44 px targets. Long content wraps; transient notices clamp to three lines and do not capture taps.

The **current** production main chunk is **526.11 kB / 165.69 kB gzip**, versus the original 774.66 / 224.94. Recovery UI and eager locale catalogs increase it from the earlier split-only checkpoint. Lazy Briefs is 224.29 / 60.10 with 18.19 / 4.25 CSS; shared controls CSS is 3.38 / 1.02. Discovery 82.80 / 20.38; React 141.83 / 45.44 and Supabase 210.49 / 54.55 are unchanged. Vite still warns about the >500 kB main chunk. Production navigation passes in both browsers; real-device LCP/INP/CLS remain unmeasured.

## Migration and deployment gates

Prepared/applied to the isolated local stack only: creative production; canvas workspace; atomic media execution; private asset storage; execution measurements; atomic text claim; durable text evidence/reconciliation. Their files are in `supabase/migrations`.

The repository had two migrations with version `20260815000000`. The platform-integrity file is renamed to `20260815001000_platform_integrity.sql`, after the M1 gate file it depends on; fixture references are updated and the full local history applies. Before remote deployment, inspect the remote history and plan the correct repair for any already-applied old version. Do not blindly push or infer remote state from local success.

Enable canvas via `workspaces.canvas_v2_enabled`; flag-off preserves the v1 entry. Enable media via a reviewed workspace policy and qualified bounded routes; `CREATIVE_ROLLBACK=1` blocks new submissions while retrieving/settling already accepted provider work. Reconciliation retains uncertain holds and never blindly resubmits a billable task.

## Remaining release gates

1. **Real client trial:** identity, brief, data permission, human-certified BIO, reviewers and explicit API budget. Use `2026-10-04-client-trial-protocol.md`; no client activity has happened.
2. **Live provider evidence:** exact endpoints/model versions/settings, verified upper bounds including QA/JEV/fees, image edit/video capabilities, billing reconciliation, one approved end-to-end run per modality, restart/disconnect tests using real provider task IDs. Local contracts cannot prove these.
3. **Text provider/staging proof and dollar bounds:** canvas text now has durable evidence, heartbeat quarantine and operator recovery with a local crash/UI drill. It continues using SSE and does not resume a lost provider stream or automatically regenerate. Test genuine provider receipts/charges and hosted stale recovery before rollout. Staged canvas text now shares atomic dollar reservations with media. Other legacy text paths remain outside this ledger. Live full-context rate/capability qualification and provider billing evidence remain required.
4. **JEV activation:** ≥100 genuinely measured labeled cases, ≥95% agreement, zero hard constraint violations, required confidence and human acceptance artifact. The 120 mock fixtures do not meet this gate. Text specialists retain existing routing; this integration does not activate JEV for all legacy text routes.
5. **Browser/product coverage:** manual screen-reader/native browser zoom/physical touch and linguistic review, deployed migration repair and rollback drill, and real email-client compatibility. Spanish/Arabic controls, long content and 200% CSS zoom now have automated proof. Audit score is scoped 16/20, with three remaining P2 findings.

The complete capability-by-capability status is in `2026-10-04-unified-mvp-completion-matrix.md`.

## Shared execution dollar commitments

`20261004060000_execution_spend.sql` is applied and registered only in the isolated local stack. Staged canvas text and media reserve against one workspace ceiling in the same database transaction as quote/run/credit creation. Dollar or credit failure rolls everything back and leaves the quote pending. Legacy text outside staged canvas keeps its existing behavior.

Text requires service-owned, unexpired qualification for the exact route/version/endpoint: full provider context, highest input rate including cache/long-context premiums, capped output including reasoning, and all fees. Credit multipliers are not pricing qualifications. Generation and every permitted QA call are quoted; text routing is off with zero routing charge. Anthropic uses one attempt; OpenRouter pins a provider with fallback disabled and qualified price limits. Extra/malformed generated items receive human-review flags without extra QA calls. Invalid QA verdicts flag outputs and preserve any returned usage.

Unknown charges retain the full commitment across month boundaries, including terminal runs and extra unpriced events. Known actual charges release excess without double-counting managed usage. Historical text without a qualified bound stays unpriced and blocks new staged execution until reviewed. No zero bill is inferred from failure or missing evidence.

FinOps Execution outcomes exposes **Execution dollar commitments**. Billing reconciliation requires operator permission, AAL2, amount, invoice reference, reason and attestation. Amendments append evidence history. New or changed usage after reconciliation reopens a discrepancy and blocks new work until reviewed; actual charges above the quote stay recorded as a breached bound. This detects overbilling rather than retroactively preventing a provider charge.

Local qualifications, invoices and outputs are explicitly synthetic, scoped to isolated localhost and rejected on hosted Supabase. `npm run seed:mvp-local:text-spend` creates a fresh synthetic workspace; the previous fixture is preserved in ignored `.mvp-local/pre-spend-fixture.json`. No paid requests, live route qualification or client trial occurred. Browser suites sharing the MFA operator must run sequentially: a concurrent run encountered a local auth-session deadlock, then passed sequentially.

## Visual baseline correction

The user rejected the older design reference and identified `http://localhost:5189/#/bio` as current. Its listener serves `caastoros-mvp-review-d969b6` (`334029e`) with Plex Registry. The source skin/font definitions and shell defaults now load in this integration, with a marked canvas/theme bridge. Desktop reference colors/fonts/corners, inspector, dialog dismissal and theme rendering were inspected; production build passes. Previous Chromium/WebKit/mobile/locale reports refer to the earlier skin and do not establish new visual parity. The 390px inspector and approval dialog have no horizontal overflow and 44px action/input/select targets; Deny restores focus to the run trigger. Direct authenticated BIO comparison and broad both-engine/locale regression remain pending. See `DESIGN.md` and `2026-10-04-design-alignment-source.json`.

## 9 October 2026 — generated office integration

Agency office is now the default production brief workspace in this MVP worktree. Canvas remains available through the same provider, selected output, inspector, Review, quote and approval path; no second execution state was added. Imported 201 explicitly hashed files from the uncommitted source office implementation, preserving generated assets and vendor licenses. Manual merges retain existing JEV/spend/recovery/feature gates. Source hashes matched at verification; main and real clients were untouched.

New local evidence: office 35/35, canvas 16/16, text spend 6/6, creative 26/26; production build and diff check pass. Focused IAB checks cover brand-local customization/reload, image/video selected-output review, stale/flagged/steward/client distinctions, Deny, forced-expired approval rejection, inert surface controls during approval, pending quote guard and surface round trip. The synthetic workspace retained four runs/three outputs and unchanged ledger. No live provider execution or actual video playback was tested.

Impeccable remediation fixes 390px page overflow and small office controls; recheck gives page width 390, >=44px office actions and a 366px approval dialog. At 1024px width, page fits and office actions remain >=44px. Coarse physical touch remains unverified. Plex operational panels/review labels are aligned; original art is unchanged. Remaining scoped P2s and external gates are explicit in `2026-10-09-office-mvp-integration.md` and the office audit. User's Account prototype preview tab is preserved; this remains distinct from the production office integration.


### 9 October office remediation follow-up — concrete P2s closed

Media-specific original links are translated; expired/required preflight quotes clear optimistic state and restore persisted review status, while accepted/unknown submission remains reconciliation. Before/after synthetic database snapshots are identical: four runs, three outputs, unchanged ledger, zero execution-spend holds and the same flagged/stale selected output with steward approval. Stock and added prop catalog/control/selection copy uses EN/ES/AR with stable IDs and category values; focused Spanish/Arabic rendering and RTL are checked.

Operational controls use both Plex themes reliably across entry-point CSS order. Enabled-control contrast samples are >=15.85:1 light / >=12.50:1 dark; 200% CSS zoom at 390px has no page/control overflow and keyboard focus works. Source art remains unchanged. Office tests now **38/38**; canvas **16/16**, prior unchanged text-spend **6/6** and creative **26/26**; final production build and diff check pass. See the updated office report/audit and output/office-integration/rejection-regression.json.

These updates supersede the previous four open office P2 implementation findings. Physical touch, native/text-only zoom, screen-reader, all artwork contrast/readability and full linguistic qualification remain unverified; CSS zoom/synthetic fixtures do not close live generation/client/deployment gates.

Separate final exit statuses: office unit 0, canvas unit 0, production build 0, diff check 0; Impeccable detector 2 for its one known inactive imported width-transition declaration. See output/office-integration/validation-status.json. CSS zoom/IAB evidence remains distinct from native zoom, physical devices and multi-engine acceptance.
