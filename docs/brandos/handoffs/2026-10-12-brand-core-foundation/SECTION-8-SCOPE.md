# Authoritative section 8 scope

Supplied directly by the user on 12 October 2026 after `.work/PLAN.md` was unavailable locally. This supersedes the earlier slice numbering in the implementation handoff.

F1/F2/F5 and copy-agent guard are owned by `feat/task-pipeline` — skip them.

- **F3 Logo (6h):** `asset_role="logo"` SVG/PNG upload and deterministic auto-find from existing rawHtml: JSON-LD → header img/svg → apple-touch-icon → og:image. Uploads win; never AI-generated. Five fixtures yield the correct logo or null, uploads have confidence 100.
- **F0 Foundation strip (3h):** on the current Brand Core screen above strategy: light/dark logo tiles, three primary/ink/surface role swatches, Aa + headline specimen in real brand font, reference thumbnails. Every missing item shows Missing + Upload.
- **F7 Palette roles (3h):** per-swatch role select and default guess; never auto-assign framework #000/#fff/#161616 as primary.
- **F6b Fonts (3h):** Google Font or licensed upload into visual.type, display/body; Instrument Sans is a flagged fallback.
- **F6 Gate (3h):** certification requires logo + primary role + display font. Missing foundation caps score at 79; preflight returns foundation_incomplete with zero credits and ledger writes.
- **F4 Compositor (8h):** Sharp+SVG, image + real logo + headline in brand font + primary accent bar, one PNG per post; no AI-drawn text or logo.

Order: F3 → F0 → F7 → F6b → F6 → F4.

Protected: `runs.js`, `fal-image.js`, `format-preview/`, `server/src/harness/`.

No production writes. Tests green; push `feat/brand-core-foundation` and report commits.
