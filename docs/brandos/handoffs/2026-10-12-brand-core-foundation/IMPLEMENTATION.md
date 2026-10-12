# Brand Core foundation · local validation

Branch: `feat/brand-core-foundation`, based on `origin/dev` at `17c5e21`.

Implemented the explicit F1 → F2 → F6b → F6 → F0 scope. The verified plan is copied beside this report. `PLAN.md` section 8 was not present in the repository or available local handoffs; implementation follows the verified plan and the explicit request.

## Contract

- `signals.asset_role = "logo"`, SVG/PNG only, rights confirmation required. `logo_variant = "light"` means a light mark for dark backgrounds; `"dark"` means a dark mark for light backgrounds. The UI labels the intended background.
- `visual.logo` has durable `sourceId`, `source`, `conf`, and optional `variants.light` / `variants.dark`. Discovered logos have a public `url`, source and confidence. Uploaded logos win at confidence 100. JSON-LD and header logos have confidence 90; icon/OG fallbacks have 50 and do not satisfy certification.
- No additional crawl for logo extraction: uses fetched HTML in both discovery paths. SVG is rendered in an image element and active/external content is rejected. Logos stay separate from image-model conditioning references.
- Colour roles: `primary`, `ink`, `surface`, `accent`. Guesses are marked inferred; designer changes are confirmed. Pure `#000000`, `#ffffff`, and `#161616` never auto-pick. Designers can explicitly choose those colours. Role changes are included in the version and authorization audit.
- Fonts: curated Google Font selection or private licensed file upload, `Display` / `Body` / `Both`. `visual.typeScale` stores `h1` through `h6` and `body` in px. Specimens load actual Google or uploaded fonts and override the global interface font rule. Failed font loading remains visible.
- Foundation is a separate mandatory gate over the existing confidence formula: a logo at confidence ≥60, a six-digit primary colour, and a usable display font are required. `scoreBioBreakdown` exposes `certifiable` and `missing`; incomplete displayed scores cap at 79. Legacy payloads still normalize and load without migration.
- Both self-certification and CD/Lead approval enforce the gate. Image run preflight checks the latest foundation and the pinned certified foundation, validates source ownership, and returns `FOUNDATION_INCOMPLETE` / `foundation_incomplete` before credits, ledger, or model calls. Image generation and QA execution code is untouched.
- Assigned designers can read/upload/propose foundation edits. Foreign sources and unassigned designers are rejected. Edits create an uncertified append-only version.
- Foundation strip shows light/dark logo previews, primary/ink/surface swatches, a real font specimen, and references. Missing states expose upload/edit actions. The Spanish eyebrow now says `Brand Core`; Arabic already retained the proper name.

## Validation

- `npm run test:units`: **454 passed**.
- `npm run test:foundation`: **10 passed**, exercising the real Hono routes with mocked data/model/credit boundaries.
- Full offline scan of all 76 test files under `server/src` and `src`, plus the backfill, offline Cake Me preparation, seed-spec validation and migration-handoff unit tests: **477 passed**. No seed command was run.
- `npm run build`: passed. Existing large-chunk advisory remains.
- `git diff --check`: passed.
- Fresh local browser page: no console errors or warnings.
- Cake Me's local payload starts at **79** with missing logo, palette roles, typography and references. Uploading two test logo variants and choosing primary/ink/surface/accent plus Google display/body fonts creates local v2 at **96**, with **Review & self-certify** available. Computed specimen font: **DM Serif Display**.
- Screenshots: [Missing foundation](proof/cake-me-missing.jpg), [Foundation ready](proof/cake-me-foundation-ready.jpg). These are local UI fixtures with a synthetic test logo and test font selections, not changes to Cake Me's production identity. Reference images remain Missing to demonstrate that state; references, ink and surface are visible controls but are not mandatory certification gates.

The broader scan found obsolete assertions in the pre-existing Brandolph prompt tests. Those now check the shared core/detail reader, and a small readable route-context mapping restores the intended no-raw-slug behavior. This is isolated from generation and QA paths.

## Local preview

From this worktree:

```sh
VITE_UI_FIXTURE=1 VITE_UI_FIXTURE_BRAND=cakeme npm run dev -- --host 127.0.0.1 --port 5186
```

Open `http://127.0.0.1:5186/#/bio`. Fixture uploads and saves stay in browser memory; a reload restores the incomplete fixture. No Supabase credentials, seed, discovery rerun or model call is needed.

## Backfill

`scripts/backfill-visual-roles.mjs` defaults to dry-run and requires `--only=<brandId UUID>`. Existing role-tagged assets, other brands, fonts/documents and aspirations are excluded. It preserves existing metadata, adds canonical image intent and confirmed rights, and is idempotent.

Remote Supabase targets are blocked even for dry-runs. Applying requires `--apply` and local Supabase credentials. `--input` reads an offline source-row JSON array and is dry-run only.

Executed only against the previously saved local Cake Me source snapshot: **3 legacy images** (`53.png`, `56.png`, `58.png`), **0 network requests**, **0 writes**. Nothing was run against production.

## Ownership boundaries

No changes to `server/src/lib/runs.js`, `server/src/lib/models/fal-image.js`, or `server/src/lib/format-preview/`. `routes/runs.js` is also byte-for-byte unchanged from the base. The read-only preflight wraps that router in `foundation-run-gateway.js`, mounted by `index.js`. The shared `loadBrandBio(requireCertified:true)` gate protects task production before writer/model work; legacy certified foundations must be completed before production resumes. Internal `bio` identifiers are preserved. No files under `backups/` or `.work/` are committed. No production writes, migrations, seeds, certification or image runs were performed.
