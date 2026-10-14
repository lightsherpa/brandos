# S-E Discovery extraction report — 14 October 2026

Branch: `fix/vds-discovery-extraction`, isolated `/tmp/vds-discovery-extraction`, based on `fix/discovery-quality` at `9dfd307`. No integration merge or production writes.

## Result

A read-only live request to https://www.lamasbonita.es verified `/assets/images/logo.webp` as an actual 75×95 image. Extraction now prioritizes Organization JSON-LD, header/nav marks, explicitly named logo images (the site's header uses `div.topbar`), then OG/icon fallbacks. ICO URLs/MIME and raster bytes under 64 pixels in either dimension are rejected. HEAD and image-byte requests pin validated public DNS addresses, enforce redirect/size/time limits, and inspect image metadata. Failed candidates fall back in a bounded loop.

The real site's `/assets/css/main.css` contains `--color-blue: #6fd4e4`, used in topbar navigation/icon rules and button styles. Neutral-only computed observations previously discarded linked CSS evidence, leaving only gray text `#262628`. The hybrid palette now retains the CSS proposal with selector evidence and `usageStatus: declared-not-computed`. Computed samples take precedence when they establish a primary; unrelated body text frequency and mere saturation do not establish primary roles. Dark text remains inferred ink, and primary/ink/surface roles stay unique.

The production V2 compiler already replaces model visual fields with deterministic current-source observations. A mocked production compiler regression verifies that stale model logo/palette/font fields do not survive, and the review gate remains closed. No compiler implementation change was necessary.

## Validation

Tests were written against the saved real markup/CSS first: the baseline reproduced favicon.ico selection and missing colour-selector evidence. Additional regressions cover neutral-only computed fallback, unique colour roles, image dimensions/MIME, failed-candidate fallback and production persistence.

- `npm run test:units`: **605/605 pass** (2.17 s).
- `node --experimental-test-module-mocks --test server/src/lib/discovery-extraction.test.mjs server/src/lib/discovery-production.test.mjs`: **7/7 pass** (0.10 s). The orchestrator must register these new files in shared package.json if they are to run in the default suite.
- `npm run build`: **PASS**; existing large-chunk warning.
- `git diff --check`: **PASS**.
- Public deterministic rerun: **$0 paid provider spend**, under 1 s; exact duration/time in `server/src/lib/fixtures/discovery/lamasbonita-rerun.json`.

Reproduce the read-only live extraction with `node scripts/discovery-extraction.mjs [path/to/existing-discovery-result.json]`. The optional recorded BIO supplies existing claim confidence for the score; there is no synthesis or DB write. Markup/CSS origins and hashes are in `server/src/lib/fixtures/discovery/manifest.json`.

## Honest gate and limitations

Recomputing the existing La Más Bonita BIO using the corrected visual extraction and unchanged recorded textual confidence leaves its score at **70/100**. Primary is present. The gate stays closed for a rights-approved stored logo and a licensed display font: remote logo discovery does not confirm rights; site-declared DinC does not demonstrate its license. DinR/DinM/DinC are declaration observations, not licensed assets.

This rerun uses public HTML/CSS and verified logo bytes. It is **not** a new paid full Discovery synthesis, a browser screenshot review, a persisted BIO update or a certification. Palette roles remain inferred proposals; the CSS evidence includes interaction states and does not prove a final brand manual. The script reports unavailable screenshot/imagery inspection. Logo fetches can still fail closed for servers that omit Content-Length or for unavailable public assets. Safe inline SVG remains a scalable vector candidate; raster dimensions are checked before accepting remote image candidates. Existing source rights, user upload, human certification and score gates are unchanged.

## Quinn review rebase verification — 14 October 2026

Rebased this isolated feature branch onto fetched `origin/dev` at `6d04d01b5f42bcbe49273a005c14c399f43284b9`. `git merge-base --is-ancestor origin/dev HEAD` passes. The two route conflicts were import unions only: existing `requireHumanActor` imports and route checks remain, with discovery reconciliation imports added. The orchestrator resolved all package.json conflicts, preserving current dev test registrations and registering both real-site regression files. Historical migration/i18n changes replayed unchanged; no manual shared-file edits by S-E and no integration branch merged into this branch.

Full registered `npm run test:units` passes **687/687** after rebase, including current dev certifier/human-actor coverage and both extraction regressions. `npm run build` passes (existing large-chunk warning). Working tree and diff checks are clean. No public rerun or paid provider/database action was needed for this rebase. The prior score70, rights/license blockers and declaration-vs-computed limitations above remain unchanged. Push/force-with-lease is reserved to the orchestrator.
