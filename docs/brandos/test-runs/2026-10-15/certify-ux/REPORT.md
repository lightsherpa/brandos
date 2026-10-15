# BrandOS · Brand Core and Certify UX

Completed locally on 15 October 2026. Branch **feat/certify-ux**, based on **origin/dev 4a0374f6b4251cde763a848104be7932e018adfc**. Integration code SHA **fa0ca1b**. No push, merge into dev, production database write, new Supabase project, stack start or database reset was performed.

Four dedicated slice agents implemented the work; root integrated routing and cross-slice schemas, repaired regressions and ran acceptance checks. Existing dirty main checkout was preserved. All new experiences default off without the flags below.

## Commits

| Slice | Main commit | Follow-ups |
| --- | --- | --- |
| 1 · Brand Core inputs | e62df0c | Integration reference-tag database regression in fa0ca1b |
| 2 · Certify | 0c3aea9 | 100e41e, 3735670, 3267c11, 23f27a0 |
| 3 · Stewart and proposed roles | c60d74c | Shared naming consumed by Certify |
| 4 · Review Desk and queue | d13c4d5 | 254442c, 8f73fff |
| Integration and acceptance runner | fa0ca1b | Owner/deep-link routing, flag fallback, SQL regression repairs, local walkthrough scripts |

## Delivered behavior

- **Inputs:** unlimited tagged PNG logos, up to ten reference images per selection with per-image tags and visible format/15 MB limits, unlimited grouped colours, whole commercial font families with rights confirmation and weight/style previews. Per-upload failures have localized retry toasts; a failed item does not stop another upload. Saving versions and reference-rights confirmation remain durable and idempotent.
- **Certify:** owner confirmations, queued Brand Core reviews and old job deep links open in Certify when enabled. Claims have plain explanations, expandable details, adjacent evidence, sourced competitor rendering, live H1–H6/body specimens, a detail drawer, inline questions, client chat and next-item navigation. Focus first heads the highlighted right column. Stewart stays visible with the existing deterministic case-file risks, source links and review actions. Final review has one Certify Brand Core confirmation. Owner strategy/visual/voice feedback creates a new version.
- **Roles:** Stewart is applied. Proposed role labels/descriptions in [ROLES.md](../../../specs/ROLES.md) remain documentation-only pending Oscar’s approval.
- **Review Desk:** images, copy and sandboxed emails render as components. Each editable component has a replacement action; authenticated writes retain an edit audit and workflow/permission locks. Queue entries have localized human labels, icons and one-line explanations. Operational JSON is excluded.
- **Languages:** new copy is supplied in en/es/ar; Brand Core and Stewart keep their English spelling. Legacy experiences remain when flags are off.

## Validation

| Check | Result |
| --- | --- |
| `npm test` · every project test file, including mocked routes and four database suites | **872 passed; 0 failed; 0 skipped** |
| `npm run test:units` · CI-compatible discovered unit/route tests | **851 passed; 0 failed; 0 skipped** |
| `supabase test db supabase/tests` | **78 SQL assertions passed**, all fixtures rolled back |
| Production build with new flags enabled | Passed |
| Production build with all three new flags disabled | Passed |
| Inputs browser interaction proof | Passed: limits, tags, 8 logos, 7 colours, 3 font styles/weights, failed upload recovery, rights and save |
| Real local Cake Me v3 certification walkthrough | Passed: 31 claims, question/answer, certification and owner new-version request |
| Real local Review Desk component editing | Passed: copy, image and email replacements persisted with audit history |
| Populated schema browser proof | Passed: sourced competitor links and arbitrary-key logo use captions in en/es/ar |
| Screenshot dimensions / browser errors / horizontal overflow | **118 PNGs**, 1280/1440 px; no page errors or overflow in passing runs |
| `git diff --check` | Passed |

See [test log](tests.log), [SQL log](sql-tests.log), [flags-on build](build-flags-on.log), [flags-off build](build-flags-off.log), [screenshots](SCREENSHOTS.md) and [inputs proof](SLICE1-INPUTS.md). The existing large-bundle advisory remains nonblocking.

The complete runner discovers tests rather than keeping a manual list. Its database regressions create and remove temporary databases **inside supabase_db_CaastorOS**; they never create another Supabase project or container. No temporary brandos_ux_* database remains. Two old SQL test assumptions were corrected: append_bio_version now has a sixth optional argument, and the self-asserting cert-message SQL now emits TAP output.

## Cake Me v3 walkthrough

The existing local Cake Me already had a newer v4. The walkthrough copied its saved v1–v3 payloads and 12 source rows, including 8 stored files, into a separate validation brand. It used real local sessions, API calls, signed source URLs, owner attestation, claim validation and certification writes. It did not certify the original Cake Me record or fabricate missing brand findings.

Validation brand: **c566c64a-1423-4525-9103-6a50f21f6484**. Review job: **9b8e3dde-3b37-470c-b238-03dd7bd6fb16**.

1. Owner opened Certify, reviewed all seven sections and confirmed the exact v3 with the required declarations.
2. The CD opened the old job URL and was redirected into Certify; the claim drawer showed its evidence and changes.
3. The CD asked about positioning inline. Sending opened client chat and advanced to the next claim. The owner answered through the local chat API; refreshed evidence appeared in the review.
4. The CD reviewed all 31 claims, entered the rubric scores and used the single final Certify Brand Core confirmation. The job completed and v3 persisted as certified.
5. The owner opened the certified view, selected Visual identity and requested a small-logo usage example. A new **uncertified v4** was appended with that feedback, while v3 remained certified in history.

[Machine-readable walkthrough](walkthrough.json) · [browser log](certify-walkthrough.log) · [review-desk proof](review-desk-walkthrough.json).

Review Desk synthetic output: **7c6fb202-3a91-4c66-920a-b1ebcfd5cd14**. Its three component replacements use the real authenticated API. Synthetic component fixtures are clearly labelled and are not Cake Me evidence. Earlier local validation attempts retain their audit records under distinct “earlier local UX check” names; their unfinished review queues are closed.

## Local configuration and reproduction

| Slice | Frontend flag | Server requirement |
| --- | --- | --- |
| Inputs | `VITE_BRAND_CORE_INPUTS=1` | Migration below |
| Certify and Stewart | `VITE_CERTIFY_UX=1` | Existing `CERTIFIER_V2_S1=1`; `CERTIFIER_V2_S3=1` for chat |
| Review Desk | `VITE_REVIEW_DESK_UX=1` | `REVIEW_DESK_UX=1` for component writes |

`20261015150000_brand_core_input_tags.sql` was applied and tracked **only in the existing local CaastorOS database**. It preserves tags and appends new flagged reference batches while retaining legacy replacement semantics. Local configuration and session files are ignored, contain no copied production/provider keys and are not committed. External email is disabled for the local walkthrough identities.

- Web: http://127.0.0.1:5198
- API: http://127.0.0.1:8798
- Supabase: http://127.0.0.1:54321; Postgres: 54322
- Owner flow: `/#/certify/owner/c566c64a-1423-4525-9103-6a50f21f6484`
- CD history: `/#/certify/9b8e3dde-3b37-470c-b238-03dd7bd6fb16`

Use the existing documented local test identities. To create a fresh validation copy, set TEST_LOCAL_PASSWORD privately and run `node scripts/prepare-certify-ux-local.mjs`, then `node scripts/test-certify-ux-local.mjs`. Browser scripts accept PLAYWRIGHT_MODULE_PATH and PLAYWRIGHT_EXECUTABLE_PATH for an installed Playwright runtime. Run `scripts/test-review-desk-ux-local.mjs`, `scripts/test-brand-core-inputs-ui.mjs` and `scripts/test-certify-ux-components.mjs` for their respective proofs. Nothing in these scripts starts Supabase or targets a hosted project.

## Open questions for Oscar

1. Approve or amend the proposed en/es/ar role names and descriptions in **docs/brandos/specs/ROLES.md**, especially “Brand contact” and “Brand reviewer.” These proposals have not changed UI role labels.
2. The saved Cake Me v3 has no populated competitors/frame-of-reference findings. Certify keeps those gaps explicit; the labelled populated fixture verifies rendering of found competitors and their source links. Which sourced findings should the owner approve for a later brand-data version? No new research run was performed as part of this UX change.
