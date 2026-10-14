# S2 implementation — 2026-10-13

Branch: `feat/certifier-agent`, based on `origin/dev` at `8f938b4`, as authorized after confirming that `feat/certifier-s1` was unavailable. The user's primary checkout and unrelated edits were preserved in a separate managed worktree.

`CERTIFIER_V2_S2=true` enables the internal steward brief, latest-brief, single-claim re-draft and per-claim confirmation endpoints. It is off by default. The three existing certification mutation paths reject agent, service and delegation actors independently of the flag. The model has exactly five tools, with no certification, editing, sending or web capability.

Validation: `npm run test:units` — **627 passed, 0 failed, 0 skipped** (44 S2 tests). Recorded-model mocks cover Cake Me's allow-listed production snapshot, synthetic Nomad Roasters and Lumen Dental Studio, source injection, circular citations, normalization back to original character/page offsets, question scope, six-read limit, forced submission, one repair, cost reservations, fallback/cancellation, draft fidelity, stale versions and human actor guards. `git diff --check` passed. A clean `npm ci --prefix server --ignore-scripts` verified the dependency lock. No live model calls, database seeds or migrations were run.

## Paths and integration details

- The handoff files were untracked in the original checkout; their exact text is now included with the implementation. Runtime copies of the schema/tools/system prompt live under `server/src/lib/certifier/`; a test compares the system string verbatim against the handoff.
- `load-brand-bio.js` has no pinned `bioId` API, so context construction uses scoped SELECTs to retrieve the exact reviewed BIO rather than silently selecting its latest version. Sources without stored extracts remain unavailable as textual evidence; filenames, URLs and unparsed PDF uploads are never treated as their document contents.
- Pure `groupClaims` and `HIGH_IMPACT` were exported from `steward-copilot.js`. Its `certificationRecommendation` never enters the context. The server removes the legacy approve/return recommendation from every case-file response.
- Foundation presence comes from `brand-foundation.js`, with the PNG/rights filtering used by `foundation-assets.js`; `visual-assets.js` remains the downstream asset loader. The real compiler is `server/src/inngest/functions/compile-bio.js`, rather than the handoff's `lib/compile-bio.js` reference.
- S3's versioned evidence lives in `cert_messages` and `bio_sources` (`routes/cert-chat.js`). Text and upload answers are attached only to the reviewed version. The latest-brief GET labels new evidence without running the model. Single-claim runs preserve all other claim cards, including rank, byte-for-byte.
- Routes are implemented in `routes/certifier.js`, mounted at `/certifier` by `routes/steward.js`; the public API paths match the handoff. Server-only run/credit/confirmation persistence lives in `lib/certifier-store.js`, outside the agent's SELECT-only module boundary. Only `certifier/drafts.js` exposes a mutation to the agent, inserting a draft without notification.
- The existing Anthropic text adapter needed a separate structured tool stream; it preserves tool blocks, cache controls and usage. The existing fallback helper now forwards caller cancellation to the primary provider as well. Cost reservations use a conservative UTF-8 token upper bound and include possible failed-primary input charges before fallback; uncertain fallback input is logged as an upper-bound cost. Output budgets may shrink to remain within the $0.30 cap.
- Workspace credit reservations use the handoff's estimated 14 credits/full and 3/single-claim, at the existing Sonnet 1× multiplier, as internal `steward_certifier` costs. These remain the handoff's provisional credit estimates; failed runs use the existing idempotent refund mechanism.


## Snapshot differences

The real Cake Me snapshot has framework black `#161616` (not `#000000`), white `#ffffff`, five colours without roles, no logo and empty typography. It has no explicit conflict annotation; the missing primary-role claim records the competing saturated yellow/red candidates. Missing optional registry fields also rank as To confirm, following the validator's specified confidence-first ordering; the two missing mandatory assets lead the queue and the primary-colour conflict blocks certification. Synthetic logo evidence includes an SVG source plus a rights-confirmed PNG variant to comply with the current foundation gate.

Agent-module commit: `cf3b104`. The following integration commit adds the flag-gated routes, actor guards, migration file, full-suite registration and this report.

Briefs, question drafts, confirmations and the cumulative $0.30 budget are held in trusted server memory, scoped to workspace, brand, BIO and version. Concurrent generation for a scope is rejected. No S2 migration or database role is required.
