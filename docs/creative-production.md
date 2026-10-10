# Creative production v1

Implemented behind workspace policy; old specialist routes remain the default. Migrations are prepared and applied only to the isolated local stack. No production deployment/migration, paid benchmark, live provider qualification, or active JEV rollout was performed. See `2026-10-04-unified-mvp-checkpoint.md` for the integrated proof and gates.

## Policy and qualification

`server/src/lib/models/catalog.js` owns route identity, modality, gateway, declared features, display labels and credit classes. Existing route strings are retained. `creative_model_qualifications` supplies service-owned endpoint capabilities, exact tested settings, rate-card reference, maximum request cost, availability and evaluation evidence. Catalog discovery must never write qualification rows. Qualification of a replacement requires an artifact and a matching model version; absent results remain null. Provider labels are not evidence of original-provider equivalence.

`creative_workspace_policy` defaults to disabled. Its `policy` supports `allowedRoutes`, `deniedRoutes`, independent `providers` flags, `defaults.image`, `defaults.video`, `jevMode` (default shadow), `jevMaxCostUsd`, `qaMaxCostUsd`, `emailHtml`, `emailRequiredContent`, and `publishableAssetOrigins`. `CREATIVE_ROLLBACK=1` immediately blocks new media submissions and HTML email generation and restores the legacy image client path. Already accepted provider jobs are still retrieved and settled; rollback must not discard paid assets.

Each workspace must have an active existing `api_budgets` workspace row with both per-request and monthly ceilings before media can submit. Qualified models need an operator-reviewed `maxCostUsd` covering the exact settings and input bounds; reserve the largest eligible generation ceiling plus JEV/QA allowances before any paid work. Unknown pricing cannot unlock a new production route. Budget checks and credit reservation occur under the workspace row lock. Unknown usage retains the conservative preflight allowance. Provider billing must agree with the configured upper bound; a discrepancy is flagged, skips additional image QA, and requires reconciliation. No provider API can retroactively undo a charge; rate-card/upper-bound correctness is a rollout prerequisite.

Qualification example shape (values deliberately omitted; do not copy unmeasured values): `available`, `parameters` (enum values/ranges/booleans), `settings` (exact tested settings), `features` (subset of catalog features), `endpoint`, `rateCard` (`id` from existing `api_rate_cards`, `sourceUrl`, `verifiedAt`), `maxCostUsd`, `evaluation` (`qualified`, `modelVersion`, `artifact`, `quality`, `costUsd`, `latencyMs`). Baselines remain eligible for their existing modality without invented evaluation scores. APImart is experimental and cannot be promoted by the production eligibility function.

## Durable media

Authenticated, permission-gated endpoints:

- `GET /api/creative/catalog`: client choices and rollout flags; no API costs.
- `POST /api/creative/jobs`: specialist, brand/brief, briefText, image/video modality, optional explicit route, exact settings, optional approved `referenceOutputId`, and client `requestKey`.
- `GET /api/creative/jobs/:id`: progress and fresh private asset access; reconnect does not regenerate.
- `POST /api/creative/jobs/:id/resume`: retry retrieval/storage/settlement of an existing job.
- `GET /api/creative/assets/:outputId`: regenerate private access to a stored output after reload.

The atomic create RPC rechecks workspace/brief ownership, certified BIO expiry, budgets and credits. It pins BIO/spec/catalog/model/settings/reference and creates a job outbox. Inngest recovery dispatches stale nonterminal rows if the original event was lost. A database compare-and-set precedes submission; provider task IDs are persisted before polling. Uncertain submissions are held in `reconcile`, never blindly retried. Completed output is persisted before vision QA; a failed QA preserves it for review. Video always needs human review. Existing `finalize_run_atomic` and `fail_run_and_release_credits` provide idempotent settlement.

The fal adapter supports cancellation requests, but cancellation is not proof of nonbilling. No unverified cancellation API is called for OpenRouter or APImart. There is deliberately no automatic refund for uncertain submission or asset persistence failure.

Reconciliation is an operator procedure: inspect the provider account using the stored task ID (if present), correlate submission time and prompt, and recover the existing task/result. With verified evidence, service operators can restore `task` and `state='polling'`, then dispatch the existing job. If the provider confirms no accepted/billable task, call the existing fail/refund RPC and mark the job failed. Never reset uncertain rows to `queued`. Record provider cost corrections using existing append-only OPEX adjustments rather than rewriting usage history.

## JEV

TypeSafe SystemOne performs only choice classification over eligible evaluated candidates with benchmark summaries. Off/shadow/active modes; shadow cannot change execution. One candidate skips JEV. Active requires confidence >=0.90, >=100 measured labeled cases, zero hard-constraint violations, >=95% agreement, a review artifact and explicit human acceptance. Requests time out at two seconds with no retry. Overrides are preserved. Missing credentials, insufficient evidence, malformed choices or uncertainty fall back to the configured quality-first route. The durable media worker reserves before JEV. Legacy text SSE remains on its established route; JEV is not used for reasoning or visual QA.

## Email deliverables

`email_html` uses the existing reasoning specialist and text SSE, followed by controlled table/inline-style rendering. Subject, preheader, structured blocks, HTML, plain text and asset references persist together. The a13 try panel exposes email generation when enabled. Saved emails open in the library/notepad preview; mobile/desktop iframes have an empty sandbox and no script permission. Required brand content, URLs, alt text and placeholders are validated.

`GET /api/email-deliverables/:outputId/{preview,html,text,manifest}` resolves workspace assets. Exports require durable HTTPS asset URLs explicitly recorded in `creative_asset_publications`; signed private URLs never qualify. `POST /api/email-deliverables/assets/:id/publication` requires client-approval permission, a reviewed asset, `confirmPublishable:true`, and an origin in the workspace's approved publication origins. This attests an already published asset; it does not upload private data to a public host. There are no recipients, sends, campaigns, schedules or ESP integrations.

## Validation and benchmarks

- `npm run test:creative`: routing, JEV, provider contracts, uncertain submissions, duplicate events, restarts, asset failure, settlement retry, ledger semantics, email exports.
- `node scripts/test-jev-fixtures.mjs`: 120 rule-authored cases against mock responses. These are not live JEV accuracy measurements or human-approved labels.
- `npm run bench:creative`: 30 briefs (10 each image/video/email), measurement report, no provider calls. `--results=<JSON>` accepts actual reviewed records; unmatched model versions/settings/gateways/cache modes stay separate.
- `node scripts/run-creative-benchmark.mjs --paid --config=<reviewed JSON>`: opt-in media provider runner. Requires credentials, `CREATIVE_BENCHMARK_BUDGET_USD`, explicit per-case bounds, pricing evidence, and pinned model/settings. A persisted hold precedes submission; existing/uncertain cases are not resubmitted. Acceptance, revisions, aggregate cost/time to accepted output are human measurements, never inferred from provider success.
- `PGLITE_MODULE=<isolated module> node scripts/test-creative-db.mjs`: executes the migration and real existing settlement functions against a minimal local PostgreSQL fixture schema. Tests creation deduplication, tenant boundaries, ceilings, certification TTL, exactly-once finalize/refund. This is not a complete Supabase environment test.
- `PLAYWRIGHT_MODULE=<installed module> node scripts/verify-email-preview.mjs`: 375px/600px screenshots and overflow checks. Artifacts are in `output/creative-qa`.

Validation so far: 201 preexisting unit tests, creative contract tests, 120 mock JEV cases, local database fixture checks, API module imports and Vite production build. Mobile/desktop browser screenshots were visually inspected. Gmail, Outlook and Apple Mail have not been manually tested. The integrated checkout has an isolated provider-free Supabase stack with actual local auth/RLS/storage/transactions and local Inngest. Cloud execution, paid provider benchmarks and full production integration remain rollout prerequisites.

## Verified primary contracts (2026-09-22)

- TypeSafe: https://docs.typesafe.ai/introduction/quickstart and https://docs.typesafe.ai/primitives/choice
- OpenRouter image endpoint: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- OpenRouter async video: https://openrouter.ai/docs/guides/overview/multimodal/video-generation
- Claude cache controls through OpenRouter: https://openrouter.ai/docs/guides/best-practices/prompt-caching
- APImart Flux 2: https://docs.apimart.ai/cn/api-reference/images/flux-2/generation
- APImart Pixverse: https://docs.apimart.ai/cn/api-reference/videos/pixverse-v6/generation

Provider contract mocks validate local normalization; they do not certify live provider behavior or model quality.

## Integrated platform measurements

The private execution-event migration records run/job/review changes atomically. `/api/opex/measurements` and the FinOps Execution outcomes tab read persisted acceptance, revisions, errors, elapsed time, cost provenance and JEV decisions. These reports keep missing/unpriced totals null and distinguish internal approval from client acceptance. See the unified checkpoint for period semantics and evidence limits.

## Shared staged execution budget

The execution-spend migration replaces independent media occupancy sums with a common workspace ledger for media and staged canvas text. Atomic claims reserve qualified generation, QA and routing bounds. Unknown liabilities survive month changes and terminal status. Operator invoice reconciliation preserves amendments; late evidence reopens discrepancy and blocks new work. See the unified checkpoint for qualification, local evidence and scope limits. Legacy text outside staged canvas remains excluded.
