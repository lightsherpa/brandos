# Codex handoff — BrandOS Discovery → BIO (paste-ready)

> Paste everything below the line into Codex. Written by the BrandOS CTO agent on 2026-10-10 (Europe/Madrid) from a read-only review of Oscar's Mac.

---

## 0. Context (read first)

You are working on **BrandOS** (repo folder and code name still `CaastorOS`; do not rename code in this task). BrandOS builds a **Brand Intelligence Object (BIO)** from a brand's own sources, a human Creative Director certifies it, then ~55 specialist agents produce work from it. We pitch with a live demo at **VDS Valencia on Oct 21, 2026**. **Code freeze: Fri Oct 17, 2026, 18:00 Europe/Madrid.**

**Product direction from Oscar (non-negotiable):**
- **Discovery keeps its free-form "freedom".** Users drop a website, links (current brand / aspiration / competitive context, each with a short intent note) and files. No questionnaires, no chapter-by-chapter manual BIO building, no forced structure at intake.
- **Structure comes after the BIO**, as *views and workflows* over it: brand book view, review/self-certification, Creative Director certification, approvals, library. (See `/workspace/brandos/brandos-frontify-for-smb-spec.md` §1 Brand Book and §4 approvals — "Frontify for SMBs": auto-generated from the BIO, then certified.)
- Never call it "brand brain". It is the **BIO**. The certifier is the **Creative Director** (formerly "Steward").
- Keep the Plex / mineral / graphite / cobalt design system; no Inter, no AI-slop styling. EN/ES/AR strings.
- Never show internal API cost to users — credits only.

## 1. Where the work actually is (current state)

| Location | Branch / HEAD | State |
|---|---|---|
| `~/Documents/Claudio/CaastorOS` (main checkout) | `main` @ `6fafe38` (Aug 23) | 43 uncommitted files, all **agency-office** UI (`src/agency-office.jsx`, `src/pixel-office/`, `public/agency-office/` …); `src/portal-briefs.jsx` now defaults to the office surface instead of the canvas. **Not BIO/Discovery.** |
| `.claude/worktrees/melius-competitor-analysis-e18b7d` | `claude/melius-competitor-analysis-e18b7d` @ `6fafe38` | **Your active Discovery/BIO work, 183 uncommitted changes, nothing committed since Aug 23.** Also contains canvas v2, JEV, creative production, text spend, office integration. Local stack: app :5184, API :8791, Supabase :57321, Inngest :8291 (`scripts/start-discovery-local.mjs`, `npm run setup:mvp-local`). |
| `.claude/worktrees/caastoros-mvp-review-d969b6` | `claude/caastoros-mvp-review-d969b6` @ `334029e` (Oct 2) | **25 commits not on main** (Claude Code): Brand Judge QA, Owner/Editor/Viewer roles, output versions, approved-run quotes, craft quotes, `bio_client_acceptance`, "user-supplied reference required", dedicated Territory Mapper / Social Captions prompts, specialists learn from approved work. 147 files, +13k lines. |
| `~/.codex/worktrees/1586/CaastorOS` | detached @ `6fafe38` | JEV / creative-production subset (uncommitted) — superseded by the melius worktree. |
| `rc/caa-44-rc1`, `codex/durable-brief-drafts` | Sep 1–22 | Security RC (delegation token hashing, brief drafts). Partially overlapping with mvp-review. |

### Discovery/BIO pieces in the melius worktree
Done (locally, tests green per docs, **uncommitted**):
- Source-led intake: website + up to 6 reference links with purpose (current / aspiration / competitive) + intent note; uploads with purpose; public-URL guards. Manual-draft creation path and competitor questionnaire removed. (`src/portal-discovery.jsx`, `server/src/routes/discovery.js`, `docs/2026-10-09-discovery-bio-improvements.md`)
- Inngest pipeline split into read → interpret → research market → synthesize (`server/src/inngest/functions/compile-bio.js`, `server/src/lib/discovery-intelligence.js`, `competitive-landscape.js`, `validate-discovery-candidate.js`, `parse-compiled-bio.js`).
- Visuals: deterministic HTML colour/font extraction + Gemini 3.8 Flash screenshot interpretation; aspiration visuals kept separate from current (`server/src/lib/discovery-visuals.js`, `extract-visual-vision.js`).
- BIO schema: aspiration fields + competitive landscape (`server/src/lib/bio-schema.js`).
- Model benchmark on Geoking (Oct 10): **Sonnet 5.5 best cost/quality** ($0.12), Opus 5.5 $0.23, Haiku 5.5 $0.008 (misses competitors), Gemini 3.8 Flash $0.04; Gemini 3.1 Pro and 3.5 Flash-Lite failed the renderer (`docs/2026-10-10-geoking-latest-model-comparison.md`).
- Local test route `DISCOVERY_TEST_ROUTE=haiku-sonnet` (Haiku evidence ledger → Sonnet synthesis, 12k token cap) — local-only flag.
- Refero-researched intake redesign (`docs/2026-10-10-discovery-refero-design.md`) and a stricter self-certification modal: statement v2, exact BIO id/version, 7 reviewed sections, atomic attest + unlock via a service-only DB function (`docs/2026-10-10-bio-self-certification-flow.md`, migration `20261010010000_bio_review_attestation.sql`).

Half-done:
- **No real end-to-end provider run** of the new pipeline saved as a BIO (`output/discovery-bio/current-status.json` is synthetic; provider keys absent in that run). Geoking benchmark exercised interpret+synthesize only, not retrieval.
- Uploaded images/PDF visuals stored but **not analysed**; HTML declarations ≠ computed styles; external stylesheets/fonts not resolved; palette = top-5 declarations without roles.
- Competitive agent = bounded (≤4 excerpts, fixed query). Full agent (multi-query discovery → qualification → per-rival evidence) specified in `docs/2026-10-10-discovery-live-test-and-competitive-agent.md` but not built.
- Onboarding tour per section and per-option upload error messages (Oscar asked Oct 9) — verify if done.

Missing / risky:
- **Nothing is committed.** 183 files of work exist only in one worktree's working tree.
- **Migration collisions** between streams: `20261004000000_output_versions.sql` (mvp-review) vs `20261004000000_canvas_workspace.sql` (melius) share a timestamp; `platform_integrity.sql` renamed to `20260815005000_…` on mvp-review but `20260815001000_…` in melius. Production has M1–M3 applied (per `docs/IMPLEMENTATION_LOG.md`); M5/P3 status unknown.
- mvp-review's BIO changes (`bio_client_acceptance`, Owner-only confirm, reference-required checks, Brand Judge) are not in the melius tree — two divergent BIO review models.
- No post-BIO "view" layer yet (brand book) — the structure-after-BIO direction.

## 1a. Focus of this handoff: BIO self-certification + Discovery fixes (melius worktree, uncommitted)

Start by reading `docs/2026-10-10-bio-self-certification-flow.md` in the worktree. The slice to protect and finish:

| File | Status | What it does |
|---|---|---|
| `src/bio-self-certification.jsx` (73 lines) + `.css` | new | Modal: 7 section previews with review counter, 3 unchecked declarations (authority / reflects / aspirationalMarked), disabled confirm until complete, Esc dismiss, fresh state on reopen, receipt (who, BIO version, timestamp) |
| `server/src/lib/certification-review.js` + `.test.mjs` | new | Pure validator: exact `bioId`+`version` (else `STALE_BIO`), `statementVersion === '2'`, all 7 `CERTIFICATION_SECTIONS` reviewed, strict-boolean statements |
| `server/src/lib/self-certify.js`, `server/src/routes/bios.js` (`POST /:brandId/self-certify`) | modified | Calls validator, then the RPC; returns `attestationId`, `attestedAt` |
| `supabase/migrations/20261010010000_bio_review_attestation.sql` | new, **local test DB only** | `bio_attestations.review_capture jsonb` + `record_bio_self_certification(...)` security-definer fn: locks brand row, rejects stale version, inserts attestation, flips `self_certified` atomically; execute granted to `service_role` only |
| `scripts/check-bio-attestation-transaction.sql` | new | DB check: receipt metadata, unlock, stale rejection, rollback, authenticated-role denied |
| `src/locales/{en,es,ar}.json` | modified | New copy for the modal (EN/ES/AR) |
| `src/section-tour.jsx`, `src/discovery-intake.css`, `src/lib/discovery-progress.js` | new | Earlier Discovery fixes: first-time per-section onboarding tour, compact intake styling, `watchDiscoveryBio` (real progress polling instead of fake timer) |
| `src/portal-discovery.jsx` | modified | Wires intake, tour, progress and the modal |

Known gaps in this slice: the shared discovery `/attest` path still uses the older field-review flow (both write an attestation via the same RPC, but two UX paths exist); migration not applied to any hosted DB; no hosted E2E yet; production still needs M1–M3-compatible order (the fn relies on `bio_attestations.field_marks/statement_version/self_score` from `20260815010000_m2_certification.sql`).

## 1b. Relationship to `rc/caa-44-rc1`

- `rc/caa-44-rc1` (HEAD `c4bbc3b`, "Refine Plex registry styling and draft controls") is the security/release-candidate line (durable brief drafts, hashed delegation tokens CAA-51, CAA-46 migration reconciliation). It is now on GitHub; the repo moved to **`lightsherpa/brandos`** (local `origin` still says `lightsherpa/caastoros` — run `git remote set-url origin git@github.com:lightsherpa/brandos.git` and `git fetch`).
- Both branches fork from `6fafe38` and **touch the same files**: `src/portal-discovery.jsx`, `src/portal-discovery.test.mjs`, `server/src/routes/bios.js`, `discovery.js`, `discovery-delegation.js`, `compile-bio.js`.
- **Migration conflict:** rc renames `platform_integrity.sql` → `20260815005000_…`; melius renames it → `20260815001000_…`. Pick rc's name (it is pushed and reviewed) and drop melius's rename. rc adds `20260901000000_delegation_token_hash.sql` and `20260910000000_brief_drafts.sql`; melius's `20261010010000_bio_review_attestation.sql` sorts after them — fine.
- Target: the BIO branch should be **rebased onto / merged with `rc/caa-44-rc1`** so the demo ships RC security fixes plus the new self-cert flow. Resolve conflicts in favour of rc for security/delegation code and in favour of melius for intake/self-cert UX.

## 2. Constraints

- **Branch:** work in `.claude/worktrees/melius-competitor-analysis-e18b7d` on `claude/melius-competitor-analysis-e18b7d`. **First action: commit and push this branch as-is** (WIP snapshot, after confirming `.env*`, `.mvp-local/` and `output/` logs with secrets are git-ignored) so nothing is lost. Then cut `feat/bio-selfcert-vds` from it for the focused slice, rebased on `rc/caa-44-rc1`. Office/canvas/JEV/creative files stay on the snapshot branch — do **not** carry them into the VDS branch.
- **Commit and push often**: at least after every task below, small conventional commits, `git push -u origin` each time. No force-push to shared branches. No commits to `main` directly; open a PR.
- **Migrations:** no new migration without (a) a unique timestamp later than every existing one across *all* branches, (b) a note in `docs/IMPLEMENTATION_LOG.md` (apply order, depends-on, reversible?), (c) never apply to production yourself — list it for Oscar.
- **Tests green:** `npm run test:units`, discovery tests (`src/portal-discovery.test.mjs`, new `server/src/lib/*discovery*.test.mjs`), `npm run build`, `git diff --check` must pass before each push.
- **Paid calls:** ask Oscar before any run that calls Firecrawl / OpenRouter / Anthropic / fal with real keys; log cost per run in the doc.
- Never read or print `.env*` contents; never commit keys or `.mvp-local/` fixtures.
- Follow `CLAUDE.md` rules ("don't change flow or features without verifying with me first"; CanvasHeader stays; canvas is the moat).

## 3. Ordered tasks + acceptance criteria

**T1 — Save the work (today, before anything else).**
`git remote set-url` to `lightsherpa/brandos`; verify ignores (`git check-ignore .env .env.local server/.env .mvp-local/fixture.json`); `git add -A && git commit -m "wip: snapshot melius worktree (self-cert v2, discovery fixes, canvas/JEV)"`; `git push -u origin claude/melius-competitor-analysis-e18b7d`. Then create `feat/bio-selfcert-vds` from `rc/caa-44-rc1` and bring over only the §1a files (+ the Discovery files from §1) via `git checkout <snapshot> -- <paths>` or cherry-picked commits.
✅ Snapshot branch visible on GitHub; worktree `git status` clean; `feat/bio-selfcert-vds` pushed; `docs/2026-10-1x-branch-split.md` lists which files went where.

**T2 — Reconcile migrations (rc wins on names).**
Produce one ordered migration list across main, mvp-review and the BIO branch; rename colliding timestamps on the *unapplied* side only; keep `platform_integrity` under one name.
✅ `supabase db reset` on a local stack applies all migrations cleanly in order; `docs/IMPLEMENTATION_LOG.md` gains a row with the final apply order and which ones prod still needs.

**T3 — Single review flow (self-cert v2 + CD cert), merging mvp-review where relevant.**
Make the discovery `/attest` path use the same v2 modal + `validateCertificationReview` + RPC (one UX path). Then:
Bring over from `claude/caastoros-mvp-review-d969b6` only what touches BIO/Discovery: client acceptance (`20261003000000_bio_client_acceptance.sql`), Owner-only confirm, "Creative Director" naming, Brand Judge if it gates BIO, and reconcile with the new self-cert modal (statement v2). One review flow, not two.
✅ Single documented flow: engine BIO → Owner self-certifies (modal) → Creative Director certifies → production unlocked. `npm run test:cert-flow` and `test:discovery-flow` pass (update them if contracts changed).

**T4 — Freedom-first intake, final polish.**
Keep free-form sources; make per-option upload errors inline; add the first-time onboarding tour (dismissible, remembered); intake works with: website only / references only / files only.
✅ Browser check at 1440px and 390px with no overflow; three intake variants each enable "Build BIO"; no questionnaire anywhere; EN/ES/AR strings present.

**T5 — Production route for the pipeline.**
Promote the tested route to production config: interpret/evidence = Haiku 5.5, synthesis = Sonnet 5.5, vision = Gemini 3.8 Flash; Gemini 2.5 removed from the BIO path; fallback per step; token caps documented. Remove or env-gate `DISCOVERY_TEST_ROUTE`.
✅ `router.js` / `catalog.js` route table reviewed; unit tests for route selection; a cost line per step in the docs; no 2.5 ids left in discovery/BIO code.

**T6 — One real end-to-end run (with Oscar's OK).**
Run full Discovery on 2 real brands Oscar provides (one Spanish). Save BIOs locally, review coverage, grounded claims, aspiration separation, competitive relevance, visuals.
✅ `docs/2026-10-1x-discovery-e2e.md` with per-brand cost, time, screenshots, a pass/fail checklist; renderer passes; no invented visual values; gaps listed explicitly.

**T7 — Visual extraction v1.5.**
Resolve linked stylesheets + Google/Adobe font links; palette with roles (primary / accent / neutral / background) and contrast pairs; analyse uploaded images (vision) for photographic style. Optional: Brandfetch enrichment behind a flag, cached in `bio_sources`.
✅ On the 2 test brands, palette hexes match the live site (manual spot check by Oscar or a designer), fonts named correctly, imagery description present; tests for the extractor.

**T8 — First post-BIO view: read-only Brand Book (demo).**
Render the certified BIO as a Brand Book page (Essence, Positioning, Audience, Voice, Visual, Do & Don't, Competitive), each block a *view over BIO fields* with provenance chips and "Certified by {CD} · BIO v{n}". No editor. Route `#/brand-book`. (Spec §1.)
✅ Renders for both test brands; uncertified fields labelled "Inferred — pending review"; mobile OK; no new tables required (pure view).

**T9 — Demo hardening.**
Seed one fully certified demo brand on the target environment; Discovery progress UI shows real stages (no fake 90s advance); failure states readable; a "replay" mode loads a stored run.
✅ Full hero flow (sources → BIO → self-cert → CD cert → brand book) completes 3 times in a row locally in < 3 min each, plus replay works offline.

## 4. Definition of done for the Oct 17 freeze

- [ ] T1–T5 and T8–T9 merged via PR into the branch the demo deploys from; T6 done on at least one real brand; T7 at least palette roles + font names.
- [ ] Every migration listed with apply order; none applied to prod without Oscar.
- [ ] `test:units`, discovery/cert tests, build and `git diff --check` are green on the final commit.
- [ ] No uncommitted Discovery/BIO work anywhere; branches pushed.
- [ ] Demo script doc: exact brand, inputs, expected screens, fallback recording location.
- [ ] Anything not done is listed as "post-VDS" in `docs/IMPLEMENTATION_LOG.md` (full competitive agent, Brandfetch, library, approvals, templates).
