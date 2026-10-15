# BrandOS product pass — acceptance report

15 October 2026. Implemented and integrated on **feat/product-pass**, based on **origin/dev** (`4a0374f6b4251cde763a848104be7932e018adfc`). Verified code SHA: **7b703475c5c140eb90793d4b4500f205cd838e0a**. The final evidence commit follows this code SHA; no merge to dev, deployment or production database write was performed.

## Acceptance results

| Check | Result |
| --- | --- |
| Full discovered suite, `npm test` | **930 passed**, 0 failed/skipped, 156 files; includes four database regression suites |
| `supabase test db supabase/tests` | **78 passed**, four SQL files |
| Production build, local feature flags on | Passed |
| Production build, feature flags off | Passed |
| Browser evidence | **62 viewport screenshots**, 1280/1440px; en/es/ar; no reported page errors or horizontal overflow |
| Sharpen p50, three identical Cake Me requests per variant | **9.563s → 7.604s**, 20.5% faster; all six requests successful |
| Live social crew | Ready; **100.874s** pipeline / **110.624s** including sharpening and polling |
| Live email crew, hero enabled | Ready; **71.100s** pipeline / **80.391s** including sharpening and polling |
| Owner and CD confirmation | Same local Cake Me brand; owner reviewed seven sections, CD reviewed **31 claims**, v4 certified |

[Validation record](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/validation.json) · [Artifact hashes and screenshot inventory](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/artifact-manifest.json) · [Before timing samples and outputs](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/sharpen-before.json) · [After timing samples and outputs](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/sharpen-after.json). The earlier 6.335s exploratory result used an intermediate prompt; the final comparison above uses the completed email-aware prompt.

## Delivered behavior and code evidence

**Images and composition.** [IMAGE_PRIMARY and no-text contract](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/images.js:13) select `vendor/fal/gpt-image-2.5`, with Nano Banana 2.1 as the internal fallback. [The mandatory QA/retry loop](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/images.js:89) permits two corrected retries, then removes rejected image URLs. OCR also rejects logos, grids, swatches and off-palette styling. The live social and email runs both resolved to **vendor/fal/gpt-image-2.5-edit**, used three actual brand references and passed raw-image QA; neither needed provider fallback.

[Legacy Canvas image runs](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/routes/runs.js:156) require the task pipeline when CREW_CANVAS is enabled. Model overrides are rejected and the flagged Canvas contains no model menu. [The vendor adapter](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/lib/models/fal-image.js:205) hard-blocks Flux/Recraft generation; submit, polling and result requests share a bounded deadline.

[Social composition](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/render.js:62) typesets the headline in the certified display font after photo generation and applies the certified logo and palette. [Brand composition guards](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/render.js:49) require usable fonts, logo and colour tokens. Genuine **Meaty Nineties Bold**, **Lato** and **Inter** are embedded with source rights evidence. Google font faces retain their weight, style and Unicode range. The commercial source's actual font name was checked using fontTools, and Chrome's rendered glyph API confirms genuine custom fonts across inputs, Brand Core visual previews, owner Certify and Brand Book.

**Crews and Canvas.** Social uses copy → image → compositor → QA; email uses copy → HTML → optional hero → QA. Only ready, real deliverables appear in the right rail. [Mandatory rendered artifact checks](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/pipeline.js:165) reject missing HTML, headline, brand fonts, palette and enabled email hero. [Email rendering](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/render.js:27) compiles MJML, includes subject/preheader/headline/body/CTA, and embeds the checked hero in the standalone HTML. Email transport is a separate 14.9KB draft; no email was sent. The primary Canvas email preview fits its entire content and CTA; scripts remain disabled in its sandbox.

[Component edits](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/harness/pipeline.js:227) preserve unrelated fields and images. Accepted assets remain private during export failures; HTTP responses, direct exports, Library and CD review quarantine failed work. A live caption replacement changed only the caption and made **zero image calls**. A rejected regeneration preserved the prior artifact. A live email render retry reused the copy and image with **zero model calls**. [Component proof](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/component-proof.json) · [Render retry proof](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/render-retry-proof.json) · [Full email preview measurements](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/email-preview-fit-proof.json).

**Sharpening.** [SHARPENER_FAST](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/lib/sharpener.js:30) defaults off. With the flag on, high-confidence positioning/audience/voice use Haiku 4.5; low confidence uses Sonnet. Fast output must pass brand-grounding and canonical crew checks; one quality fallback is allowed. The compact prompt uses 1600 output tokens, with bounded exact-context caching and context reuse across fallback. [Authorized parallel context loading and timing](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/server/src/routes/briefs.js:61) remove serial independent reads and expose Server-Timing. The existing 80ms scroll delay does not delay the request. Email hero requirements remain in the brief; the email crew handles production rather than spawning extra specialists.

**Brand Core and Certify.** Brand Book V2 presents strategy, visual identity and voice, source grids, light/dark logo lockups, role swatches and H1–H6/body font specimens. Owner section confirmation is large and primary; final confirmation stays visible. Certify retains section explanations, evidence, highlighted Focus first, claim drawers, inline questions/client chat, and the visible Stewart side panel. Every Brand Core review entry routes to Certify. Owner comments/change requests create an append-only version. Role names remain proposals in [ROLES.md](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/specs/ROLES.md) and have not been applied more widely.

The completed inputs foundation is included: unlimited tagged logos and extended palette, reference batches of ten with limits/tags, licensed whole-family font upload and live previews, recoverable reason/Retry toasts. Its [earlier full acceptance report](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/certify-ux/REPORT.md) retains 118 additional viewport/screens/artifact proofs and the complete Cake Me v3 CD/question/owner-version walkthrough.

## Actual Cake Me walkthrough

No brand was seeded for this product pass. The run reuses the existing task-owned local Cake Me copy **0b9560e9-684d-4fc4-bed4-fbced3c4f808**; the original Cake Me brand was not modified by these scripts.

1. Sharpened against self-certified v3; the social and email planner results were specific, usable and canonical.
2. Ran social task **22283801-77c6-422b-bdbf-b47be0ba48ee** and hero email task **3661edba-0300-4540-b3df-030aa9f06b96**, both pinned to certified v3. Both passed mandatory code and model review.
3. Opened the actual ready artifacts in Canvas, edited the caption independently, and verified the image and other fields stayed unchanged. Render-only email retry made zero model calls.
4. Added an owner strategy comment through Certify, creating **v4** while preserving v3 and its provenance. Reviewed all seven sections and submitted the single **Certify Brand Core** owner confirmation.
5. Followed the Brand Core review link into Certify, reviewed **31 claims**, completed rubric scores, and submitted the single final CD confirmation. Job **99dc109f-8e2e-4ec1-bff4-6b4e6d2bbafd** completed; v4 is certified. This v4 step deliberately exercises the requested post-certification version flow; the production artifacts retain their v3 pin.

[Social run](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/social_post-run.json) · [Email run](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/email_sequence-run.json) · [Owner confirmation record](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/certify-live-proof.json) · [CD certification record](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/certify-cd-live-proof.json).

An initial social run correctly stayed hidden when font export failed: the uploaded font had a valid rights confirmation but no optional freeform licence note. The source assertion now supplies durable evidence, and the corrected actual runs pass. Its retained [rejection record](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/social_post-initial-rejected.json) documents the failure without a rejected image URL. No quality gate was relaxed to obtain the final results.

## View and download

| Surface | 1280px | 1440px |
| --- | --- | --- |
| Brand book | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/brand-book-en-1280.png) | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/brand-book-en-1440.png) |
| Canvas social | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/canvas-social_post-en-1280.png) | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/canvas-social_post-en-1440.png) |
| Canvas HTML email | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/canvas-email_sequence-en-1280.png) | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/canvas-email_sequence-en-1440.png) |
| Queue labels | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/queue-labels-en-1280.png) | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/queue-labels-en-1440.png) |
| Owner final confirmation | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/certify-live-final-en-1280.png) | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/certify-live-final-en-1440.png) |
| CD final confirmation | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/certify-cd-live-final-en-1280.png) | [View](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/certify-cd-live-final-en-1440.png) |

All main surfaces also have Spanish and Arabic captures in the manifest. The six font audit captures additionally document the existing preview surfaces at both widths.

**Standalone artifacts:** [Social PNG, 1080×1350](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/cake-me-social-post.png) · [Social composited HTML](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/cake-me-social_post-1.html) · [Email HTML with embedded hero/fonts](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/cake-me-email_sequence-1.html).

## Flags, commits and environment

| Slice | Commits | Gate |
| --- | --- | --- |
| Completed Brand Core/Certify foundation | `a7a2624` merge of completed `feat/certify-ux` (`40cfc65`) | Existing input/Certify/review flags |
| Image QA and typography | `48786d1`, `cb852c1`, `4695c66`, `72f1d67`, `530bc79` | Existing TASKS_ENABLED; strict composition uses CREW_CANVAS; retired-provider guard applies globally |
| Crews, components, quarantine, preview | `3656d77`, `fbbdcaf`, `25d9714`, `a5be414`, `6e4aced`, `fccb68b`, `7b70347` | CREW_CANVAS + VITE_CREW_CANVAS |
| Fast sharpener | `610df72`, `e6e1eaa` | SHARPENER_FAST |
| Brand book/Certify/font previews | `6b37192`, `7971c42` | VITE_BRAND_BOOK_V2 and existing UX flags |
| Actual queue evidence | `703f0da` | Existing REVIEW_DESK_UX/VITE_REVIEW_DESK_UX |

New flags default off in code and remain enabled only in ignored local configuration for this walkthrough. Local server: `TASKS_ENABLED=1`, `CREW_CANVAS=1`, `SHARPENER_FAST=1`, `REVIEW_DESK_UX=1`, existing certifier stages on. Local client: `VITE_CREW_CANVAS=1`, `VITE_BRAND_BOOK_V2=1`, `VITE_CERTIFY_UX=1`, `VITE_BRAND_CORE_INPUTS=1`, `VITE_REVIEW_DESK_UX=1`. **AGENCY_OFFICE=0 throughout.** Both flag-on and flag-off builds pass.

Only **CaastorOS Supabase 54321**, app **5196**, API **8796** were used. Docker's configured RAM cap is **4GB**. Database regression scratch databases reused the existing PostgreSQL container and were removed. No new Supabase project, Docker stack or brand seed was started. Test scripts that mutate existing data require explicit `--only=<brand UUID>`. Model calls were real; no email delivery or production database migration/data rewrite was performed. One existing local test CD display name was cleaned up; [scoped change record](/Users/oscarmottaquintana/.codex/worktrees/certify-ux/CaastorOS/docs/brandos/test-runs/2026-10-15/product-pass/local-test-profile-cleanup.json) documents it.

Nothing remains half-built or untested in these slices. Deployment and production flag activation remain outside this local task. The only outstanding product decision is Oscar's approval of the proposed wider role names/descriptions in ROLES.md; Stewart is already implemented as requested.
