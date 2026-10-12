# Brand Core foundation: verified plan and cut for Rehearsal 1 (Thu Oct 15)
Kai · Mon 12 Oct 2026 · checked against origin/main = origin/dev = 17c5e21, and origin/rc/caa-44-rc1 = c4bbc3b (22 Sep, older than main).
Sources: Maya's PLAN.md (older repo copy) and BUNDLES-AND-BACKLOG.md. Prod proof: /workspace/brandos/brand-core-foundation/cakeme-prod-brandcore.json (read-only pull).

## 1. Claim check (main 17c5e21; rc = c4bbc3b)
| # | Claim | Verdict | Evidence now |
|---|---|---|---|
| F1 | No logo field, no logo extraction | TRUE | schema `compile-bio.js:98-137` (identity…visual{palette,type,imagery,avoid}); "logo" only at `sharpener.js:132,165` and `fal-image.js:12`. rc: same, schema `:102-129` |
| F2 | Discovery text-only, `onlyMainContent:true` | TRUE, lines moved | `compile-bio.js:193,220-221,279,303`; `firecrawl.js:35-36,112,126`. rc `compile-bio.js:168,197-198,254`; `firecrawl.js:100` |
| F3 | Prompt says visual is placeholder; visual step fails silently | TRUE, moved | comment `compile-bio.js:12-13`; empty visual in schema `:132-137`; silent catch `:386-390` ("never let the visual pass invalidate the BIO"), comment `:347`. NEW on main: a `visualEvidence` path `:316,349-354` reads uploaded refs + licensed fonts first |
| F4 | Palette/fonts regex from raw HTML, top 5, no roles | TRUE | `extract-visual-deterministic.js:102-135` (palette, top-5 + near-white/black rule at :131-132), fonts `:197-250` (Google Fonts link :240). rc: same lines |
| F5 | `visual.*` scored:false | TRUE, moved | `bio-schema.js:53-57` (rc `:44-47`). Proven in prod: Cake Me scores **96** with `type: []` and no logo |
| F6 | Image calls get text only, payload `{prompt,size}` | PARTLY WRONG | Main already conditions on ONE uploaded reference: `runs.js:213-228` → `selectGenerationReference` (`visual-assets.js:69-72`, canonical role only) → `resolveImageRequest` (`fal-image.js:91-99`) → z-image controlnet (`fal-image.js:32-38`). BUT only the `flux-1.1-pro` route has a `referenceEndpoint`; flux-schnell (a41, a35, a46, a48 per `portal-data.js:79,101,106,114`), recraft and gpt-image-2 ignore it. Palette-as-text still `compose-image-prompt.js:38-41` |
| F7 | Copy gets voice as prose only; "say so plainly" preamble | MOSTLY TRUE, moved | voice prose `compose-specialist-prompt.js:54,71`; provenance line is now `:32` ("never invent brand attributes…"). "Say so plainly" not found on main. Deterministic voice check exists post-hoc: `qa-voice.js` (imported `runs.js:34`) and `format-preview/brand-check.js:23` |
| F8 | No MJML / branded renderer | WRONG on main (true on rc) | `server/src/lib/format-preview/{render.js,compose.js,brand-check.js,templates/email.mjml,landing.html,deck.html}`, route `routes/format-preview.js:16,135,147`. Not wired into normal runs (Maya's DIAG-4 holds). rc has no format-preview |
| F9 | `DISCOVERY_V2=0` disables visuals | TRUE, moved | `compile-bio.js:39` (rc `:32`) |
| B1 | taxonomy has parts→crew | TRUE | `taxonomy.js:9-15` (`social_post` caption a16 / image a41; `email` subject a14 / body a13) |
| B2 | `count` → `buildDeliverableContract` ~L141 | MOVED | `runs.js:145,197`; QA `Promise.all` at `:506` |
| B3 | Brand visual read only at QA ~L483 | PARTLY WRONG | QA vision `runs.js:480`, `bio_visual` at `:689-692`; but the reference IS read at generation `:213-228` (see F6) |
| B4 | a41 fluxSchnell `portal-data.js` L98 | MOVED | `portal-data.js:101` |
| B5 | Renderer lives in `/workspace/brandos/renderers-handoff/` | MOVED | It is in the repo: `server/src/lib/format-preview/` |
| B6 | No-text not enforced | PARTLY | Prompt-level "no text" exists only in artDirection/sourceText branches (`compose-image-prompt.js:25,31`) and contract `deliverables.js:110,113`. No OCR check anywhere |

## 2. Cake Me in production (brand 35f265f0-0546-4a9a-b793-a49887ad7125, bios v1 f46b7cd3, certified, score 96, self-certified 25 Aug)
- **Logo:** absent. No field, no source.
- **Palette:** 5 hexes, no roles, conf 60 "inferred from website imagery and emoji": #161616 black, #ffffff white, #ffd115 yellow, #ccddcc "cream", #f40041 red. Black and white are framework defaults; roles unknown.
- **Fonts:** `visual.type: []`. `missing[]` says the guideline PDF lists typography in its TOC but the content wasn't read.
- **Imagery/avoid:** 5 and 4 adjectives (cheesecake texture, golden tones, overhead light, kraft packaging). `visual.references`: absent.
- **Tone:** strong. Register, 8 forbidden words, rhythm and 3 signatures, conf 80-98, sourced from the uploaded brand deck. 6 refusals.
- **Strategy:** full (positioning, pillars, audience, JTBD, goals, watchouts, notList).
- **Sources (bio_sources):** `Cake-me Brand Guidelines - 2025.pdf` (5.3 MB, bucket foundations), 3 PNGs `53/56/58.png` (bucket visual, 2-3 MB), homepage scrape (9.6k chars).
- **Root cause, sharper than PLAN.md:** Cake Me *uploaded* a brand book and 3 images, and none of them reach generation. The PNG rows have no `signals.asset_role` and no `rights_confirmed` (they predate `ingest-guards.js:88-98`), so `classifyVisualSources` (`visual-assets.js:7-11`) drops all three. Even with roles set, a41 runs on flux-schnell, which has no reference endpoint. The brand book's logo, colours and fonts were never parsed out of the PDF. The score of 96 hides all of it because visual is unscored.
- **Implication:** for Cake Me the fastest fix is not URL extraction. It's using what the client already gave us (PDF pages + PNGs), plus an upload fallback for the logo.

## 3. Cut for Rehearsal 1 (Thu 15). Budget ≈ 2.5 dev-days of Codex + QA
| Rank | Slice | Hours | Depends on | Why |
|---|---|---|---|---|
| S1 | References actually reach every image call (all routes) + legacy backfill | 5 | – | Highest value; mostly plumbing that already exists |
| S2 | Hard no-text: prompt + negative + OCR check, 1 regenerate | 4 | – | Oscar's hard no; cheap |
| S3 | Logo: upload (role `logo`) + cheap auto-find (JSON-LD, header img/svg, apple-touch-icon, og:image) | 6 | – | Needed by S4 and S5 |
| S4 | Social compositor (Sharp + SVG): image + logo + headline in brand font + accent bar | 8 | S3, S1/S2 | Text and logo leave the model; biggest visible jump |
| S5 | Email: wire the existing format-preview MJML into email runs, tokens from palette + logo | 5 | S3 | Renderer already exists; DIAG-4 fix |
| S6 | Score the foundation: logo + primary colour + display font required to certify; preflight blocks image runs with 0 credits | 3 | S3 | Stops a "96" with nothing visual |
| S7 | Minimal palette roles: designer picks primary/ink/surface on the Brand Core screen (no headless render) | 3 | – | Roles for S4/S5 without a crawler rewrite |
| S8 | Cake Me + Nomad Coffee before/after re-run | 2 | S1-S7 | Rehearsal proof |
| Total | | **36 h** | | |

**Deferred to post-freeze / post-VDS:** P0-2 headless computed-style palette + type scale (L, risky crawler work; S7 covers the demo by hand). Full schema v2 L1/L2/L3 migration (P0-5: do only the scoring change in S6; renaming layers before the freeze breaks the loaders for no visible gain). P0-7 Brand Core screen v2 (only add a foundation strip: logo, 3 role swatches, font specimen, refs, inside S3/S7). P0-3 auto image harvest from site (users upload; picker = the existing role select). P0-4 voice from real copy (Cake Me's voice is already 95-98 conf from its deck; not the bottleneck). PDF brand-book parsing for logo/fonts (post-VDS; for Cake Me, upload the logo and font by hand).
**Pushback:** PLAN.md ranks P0-2 and P0-5 second and third. They are the most expensive and least visible items. Rehearsal value comes from S1/S2/S4: the image looks like the brand's photos, has no fake text, and carries the real logo and font.
**Prod writes needed (Oscar approval):** S1 backfill of `bio_sources.signals` for Cake Me's 3 PNGs; S3 logo upload for Cake Me/Nomad; re-certify both after S6.

## 4. Codex slices

### S1 · References on every image call
- Goal: when a brand has ≥1 certified reference, every image specialist uses it. When it has none, the run says so instead of failing quietly.
- Files: `server/src/lib/models/fal-image.js`, `server/src/lib/visual-assets.js`, `server/src/routes/runs.js:213-228`, new `scripts/backfill-visual-roles.mjs`.
- Values: add `referenceEndpoint` to `vendor/fal/flux-schnell` → `/fal-ai/flux/dev/redux`-style or reuse the z-image controlnet (`referenceModel: vendor/fal/z-image-turbo-controlnet`, $0.04). Map gpt-image-2 → its edit endpoint with `image_urls`. Pass up to 3 refs (canonical first, then inspiration), not just 1. `classifyVisualSources`: treat image `file_upload` rows with no `asset_role` as `inspiration` only when `bucket==='visual'`. Verify the signed-URL bucket: rows carry `bucket` (`visual`/`foundations`) while `signedEvidenceUrl` hardcodes storage bucket `bio-sources` (`visual-assets.js:18-23`). If `bucket` is a category rather than a storage bucket this is fine; otherwise use `row.bucket`. Backfill script: `--dry-run` default, `--only=<brandId>`, sets `signals.asset_role='canonical'` and `rights_confirmed=true`.
- Done: unit test that each image route with a ref resolves a reference endpoint. Cake Me dry-run lists 3 PNGs. A run log shows `usesReference:true` for a41.

### S2 · No text in images
- Goal: 0 legible text in final images.
- Files: `server/src/lib/compose-image-prompt.js`, `server/src/lib/models/fal-image.js`, new `server/src/lib/qa-no-text.js`, `server/src/routes/runs.js` (image branch).
- Values: always append "No text, letters, numbers, logos, signage or watermarks anywhere in the image." Add `negative_prompt: "text, letters, typography, logo, watermark, signage, caption"` where the route supports it. OCR via a Gemini Flash vision call returning `{hasText:boolean, snippet}`. On `hasText`, regenerate once with seed+1. If it still fails, mark the output `needs_review` (existing status), never ship silently.
- Done: test with a fixture image containing text → hasText true. 10 a41 runs on Nomad produce 0 shipped images with text.

### S3 · Logo
- Goal: every demo brand has a stored logo (light and, if possible, dark).
- Files: `server/src/lib/ingest-guards.js` (add role `logo`, exts svg/png), new `server/src/lib/extract-logo.js`, `compile-bio.js` visual step (~:356-390), upload UI where asset roles are chosen (`src/portal-team.jsx` ~:938).
- Values: candidates in order: JSON-LD `Organization.logo` → `header|nav` `img|svg` whose alt/class/id/src matches `/logo|<brand name>/i` → `link[rel~=apple-touch-icon]` → `og:image`. Use the `rawHtml` already fetched at `compile-bio.js:361`, no new crawler. Store at `bio.visual.logo = {url, source, conf}`. conf 90 for JSON-LD/header, 50 for og/touch-icon. Below 60 shows "Upload your logo". Uploads always win (conf 100). Never AI-generate.
- Done: fixtures for 5 saved HTML files (Nomad, Cake Me + 3) → the correct logo or null. An upload sets conf 100.

### S4 · Social compositor
- Goal: one finished post PNG, with text and logo set in code.
- Files: new `server/src/lib/compose-social.js` (Sharp + SVG overlay; Satori only if Sharp text can't do it), the runs.js `social_post` path, a font loader from `visual.type` / licensed font uploads (`visual-assets.js:56`).
- Values: 1080×1080 (IG) and 1080×1920 (story). Logo bottom-right, width 18% of canvas, clear space 4% of canvas. Pick the light/dark variant by the mean luminance of that corner (>0.5 → dark logo). Headline from the caption's first line, ≤ 8 words, display font, 64 px on square. 8 px accent bar in `primary`. Fallback font Instrument Sans if the brand font isn't loadable, and flag it. 1 image per post.
- Done: snapshot test on a fixture image. A Nomad run yields 1 PNG with the uploaded logo and no AI text.

### S5 · Branded email always renders
- Goal: every email/email_sequence task returns HTML.
- Files: `server/src/lib/format-preview/render.js`, `compose.js`, `templates/email.mjml`; the runs.js deliverable finish path for `email`.
- Values: tokens `logoUrl`, `primary` (CTA background), `ink`, `surface`, font stack `'<display>', Helvetica, Arial, sans-serif`. Copy fills slots only (subject ≤ 60, preheader ≤ 110). The task fails if MJML errors.
- Done: test that an email run produces `html` with the logo `<img>` and the primary hex. It renders in Gmail web (manual check by Quinn).

### S6 · Score and gate the foundation
- Goal: a brand can't certify, or run images, without logo + primary colour + display font.
- Files: `server/src/lib/bio-schema.js:53-57`, `scoreBio`, the certification route, runs.js preflight.
- Values: add scored paths `visual.logo`, `visual.palette[role=primary]`, `visual.type[display]`. Missing any → `certifiable:false` with `missing[]`. Image/social/email runs with an uncertified foundation return `{state:"foundation_incomplete"}` before any spend. Old Brand Cores still load (score recomputed, not migrated).
- Done: tests that Cake Me's payload → not certifiable (missing logo, type); a run returns foundation_incomplete with 0 ledger rows.

### S7 · Palette roles by hand
- Goal: primary/ink/surface known for demo brands.
- Files: the Brand Core screen palette tile (`src/`, the current Brand Core view), the bio update route.
- Values: each swatch gets a role select `primary|secondary|accent|ink|surface`. Default guess: most saturated → primary, darkest → ink, lightest → surface. Saved as `palette[i].role` with an audit-log entry.
- Done: set roles on Cake Me in staging; S4/S5 read them.

### S8 · Rehearsal proof
- Goal: before/after for Cake Me and Nomad Coffee (Nomad must be recreated in prod first, since it isn't in Oscar's brand switcher).
- Done: 2 social posts + 1 email per brand saved to `docs/brandos/handoffs/2026-10-12-brand-core-foundation/proof/`; Oscar signs off.
