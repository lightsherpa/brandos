# Brand Book guideline website, export and sharing

16 October 2026 · `feat/certify-simplify` · implementation head `093eb39`

Development stayed in `/Users/oscarmottaquintana/Documents/Claudio/CaastorOS`. The Cake-me guideline project was read-only reference material. Only the existing local Supabase CaastorOS stack (`54321`, container `supabase_db_CaastorOS`) was used. No new stack, production writes, deployment, push or merge. `AGENCY_OFFICE=0`; Certify role gates remain intact. Both new feature flags default off in code/examples and are enabled only in ignored local test settings.

## Result and before/after

Before: the Brand Book was a generic three-section BrandOS report without the approved guideline site's identity or a complete website export.

After: one full-canvas reader with a return/export/share toolbar, branded chapter navigation, actual logo, brand palette, large approved photography, live typography, chapter cards and readable strategy/voice guidance. Home, Strategy, Foundations, Logo, Colour, Typography, Imagery, Voice, Expressions, Applications, Learned rules, Resources, Tokens and For agents share one standalone renderer. Missing approved applications/learning are clearly identified; no examples were fabricated. en/es/ar controls, Arabic RTL and literal English Brand Core are supported. Original certified brand content is preserved in its recorded language.

Download offers a complete guideline website or a selected original-asset kit, category and per-file selection, versioned metadata and genuine asset bytes. Website text remains complete; selection controls packaged assets. Kits include only selected categories. Both contain README, manifest and applicable machine-readable rules/tokens.

Owner sharing is deliberate, expiring, revocable and bound to a certified version. Public HTML contains capability asset routes, never private storage signed URLs. Tokens are hashed in the database and redacted from logs, including percent-encoded paths. Snapshots and asset hashes protect against changes to later records or overwritten source bytes. Public failure states render human guidance, not JSON. CD can read/export; only a human workspace owner can create/revoke sharing links.

## Commits

- `9af7889` — reader integration, selection, owner sharing controls and locales.
- `5c7bb9d` — certified snapshot/export/share API, private asset access, share migration and tests.
- `2ccd3d8` — encoded capability log redaction.
- `bb726a9` — actual recorded Lato/Inter font files with OFL licences and selection tests.
- `58e7a44` — standalone branded renderer, reference layout, chapter interactions, full-canvas integration, rollout flags and migration handoff.
- `093eb39` — friendly expired/revoked public guide pages with en/es/ar regression coverage.

## Validation

- Full `AGENCY_OFFICE=0 npm test`: **1,021 passed, 0 failed, 0 skipped**, including the existing database regressions.
- All six `supabase/tests/*.sql` files: **116 pgTAP assertions passed** in the existing local container, transactional fixtures rolled back. The new shares suite contributes 15 assertions. See `sql-check.json`.
- `npm run build` with `AGENCY_OFFICE=0` and `VITE_BRAND_BOOK_GUIDELINES=0`: passed.
- Same build with `VITE_BRAND_BOOK_GUIDELINES=1`: passed. Existing large-chunk advisory remains; no build error.
- Data-driven second-brand fixture verifies a different palette/name without Cake-me copy or assets. Rendering tests cover XSS boundaries, private metadata removal, all three locales, fallback fonts, relative/capability URL allowlists, commercial-font download restrictions and embedded navigation.
- Route tests cover exact certified version/source selection, tenant/owner/human permissions, explicit empty selections, expiry/revoke, immutable shares, source byte hashes, font rights, trusted open-font embedding and human public errors.
- Browser checks cover chapter navigation, section search, live fonts, mobile RTL drawer, language switching, download completion, owner share creation, public read without app authentication, revoke and return to the app. The full-canvas portal restores normal shell interaction on return.
- Desktop screenshots were checked against actual viewport widths, not inferred filenames. See `screenshots.json`.

## Cake Me v3 walkthrough

Used the separate existing local **Cake Me · Certify UX v3** validation copy, already certified at version 3. The original Cake Me record was untouched. This pass starts from the certified result; it does not re-certify, invent scores or restart Certify.

1. Opened the explicit Brand Book route as CD. Certified edition 3 loaded, with approved yellow/pink identity, logo variants, photography, Lato, Inter and private Meaty Nineties preview. No Share control was exposed to CD.
2. Navigated all fourteen chapters, including logo light/dark comparisons, all seven palette colours, editable font specimens and H1–H6/body samples, reference grids and voice rules. Search selected Typography. Mobile Arabic navigation opened, selected a chapter and closed correctly.
3. Chose the guideline website and downloaded a real ZIP from the UI; completion notice appeared. API checks also downloaded both formats. Final website: **22 files, 10,477,753 bytes**. Kit: **21 files, 10,422,188 bytes**. Both contain six approved image files and four open-font files; manifest hashes matched all ten binary assets. All website asset references resolve to packaged relative files. No private signed asset URL or commercial font binary is packaged. See `archive-check.json`.
4. Opened the same version as owner, chose Share, created a local expiring link and opened it without app authentication. The configured API origin was used correctly in the split local web/API setup. The shared page loaded all six approved images and four Lato/Inter font faces.
5. Revoked the latest link in the owner UI. Refresh showed the human unavailable page. API checks verified public HTML and the corresponding private asset both return 404 afterward. All local test links were revoked during cleanup; no active test capability remains.
6. Returned from the reader to Brand Core and verified the shell was interactive. Left the local CD Brand Book available for review.

## Rights and deliberate limits

Meaty Nineties is recorded as commercial and preview-only. It renders in the authenticated reader. Public shares and website/kit exports exclude its bytes unless explicit redistribution permission is recorded; they identify the missing file and use a fallback. Lato/Inter Regular/Bold are actual bundled open fonts, only introduced when those exact families are recorded with the Google provider and no uploaded source. Original OFL notices accompany the packages and rendered public resources. The public/offline display font therefore differs from the private preview when commercial redistribution is unapproved.

Direct `file://` browser opening of the extracted website was blocked by the browser URL policy, which permits HTTP(S). It was not bypassed. Archive inspection verified actual bytes, relative links, hashes, licences and script presence; browser interactions were exercised on the public guide using the same renderer. An offline browser opening is not claimed.

The reference CMS/editor, cloud publishing credentials and Portuguese locale were not imported. This implements the certified reader/export/share surface; future editing remains in Brand Core and Certify. No unresolved product-taste questions block this implementation.

## Evidence paths

All paths below are relative to `docs/brandos/`:

- `specs/BRAND-BOOK-EXPORT.md` — reference, design and integration contract.
- `specs/brand-book-export-reference/` — designated reference screenshots.
- `test-runs/2026-10-16/brand-book-guidelines/screenshots.json` — screenshot index and verified dimensions.
- `test-runs/2026-10-16/brand-book-guidelines/reader-*-1280.jpg` and `reader-*-1440.jpg` — every chapter plus Spanish/Arabic views.
- `test-runs/2026-10-16/brand-book-guidelines/export-selector-*.jpg` — website/kit selection.
- `test-runs/2026-10-16/brand-book-guidelines/share-settings-*.jpg` — owner expiry/revocation controls.
- `test-runs/2026-10-16/brand-book-guidelines/shared-home-*.jpg`, `shared-typography-1440.jpg`, `shared-revoked-*.jpg` — public read and revocation.
- `test-runs/2026-10-16/brand-book-guidelines/reader-arabic-mobile.jpg` — 390×844 RTL layout.
- `test-runs/2026-10-16/brand-book-guidelines/live-check.json`, `archive-check.json`, `sql-check.json` — non-secret machine verification summaries.

Full console logs and generated ZIPs are ignored local acceptance artifacts under `.mvp-local/`, inside this checkout. No session tokens, signed private URLs or public capability links are stored in this report.
