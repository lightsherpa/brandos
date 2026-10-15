# VDS local integration — 14 October 2026

**The local integration builds and runs. It is not yet a fully working demo.** The task email path works; social review, local reference delivery, task recovery and the legacy Canvas/Library integration have blocking gaps. No Git pushes, hosted DB mutations or production seeds were performed.

## Branch and integration

- Branch: `test/vds-integration`, in `/Users/oscarmottaquintana/Documents/Claudio/brandos-vds-integration`. The dirty main checkout was preserved.
- Base: latest fetched `origin/dev`, `6d04d01`.
- Ordered merges: PR #18 `9dfd30761398667c96e27a3c30b54abfcd662da7` → durable S2 `b7a06d3` → agency office `2c9aba0`.
- Merge commits: `4626329`, `4e0b7ba`, `aa0def2` respectively.
- PR #18's gate re-queue fix **is pushed** at `9dfd307`. Local and fetched Discovery heads matched.
- Conflict resolutions: preserved dev's human-actor imports/checks, added Discovery reconciliation imports, combined feature-specific test registrations and kept both migration handoffs. There were no Agency Office runtime conflicts.
- Local integration repairs: support `1` as well as `true` for S1/S2/S3 and Tasks (including steward's S3 evidence loader); exercise `1` in existing tests. Add font MIME types to local Supabase bucket config so reset does not undo the font migration.
- Branch has no origin/dev tracking target; all commits remain local.

Stale PRs were not merged:

| PR | What it is | Obsolete? |
| --- | --- | --- |
| [#2](https://github.com/lightsherpa/brandos/pull/2) | CAA-27 Canvas write-path repair, stacked on `caa-26-harden-brandolph-briefing-prompts`; head `221ea9b` | Stale branch/base, but **not functionally obsolete**. Its craft error handling, latest rerun selection and assembly continuation fixes are still missing in this integration. Port the small fixes onto current code. |
| [#3](https://github.com/lightsherpa/brandos/pull/3) | CAA-33 public BIO teardown, lead/email gate and funnel hooks; head `697c147` | Stale and outside this demo. The separate public teardown routes are absent here; it is not demonstrably superseded end to end. Reassess separately rather than merge. |
| [#5](https://github.com/lightsherpa/brandos/pull/5) | Source-led Discovery, versioned approval and Brand Book; head `20d7d0d`, based on `rc/caa-44-rc1` | **Obsolete as an integration merge**: the head is already an ancestor of dev (`3f45762` integrated it). |

## Verification

| Check | Result |
| --- | --- |
| Root `npm ci` and server `npm ci` | Passed; logs saved |
| `npm run test:units` after final code edits | **717 passed, 0 failed, 0 skipped** |
| `npm run build`, Agency Office enabled | Passed; Vite warns about a >500 kB bundle |
| `npm run test:office` | **31 passed, 0 failed** |
| `npm run test:certifier-db` | **8 passed, 0 failed** on a disposable Postgres container, removed afterward |
| `supabase/tests/discovery_review_gate.sql` | **14 pgTAP assertions passed**, rolled back |
| `supabase/tests/cert_messages_rls.sql` | Passed, rolled back; author identity, client reads and service-only answer RPC checked |
| `git diff --check` | Passed |
| Test accounts | All password sign-ins and `/api/me` return 200; client denied admin and team routes with 403 |

The disposable certifier test container needed its initialization corrected before the passing final run; its earlier setup failures were not application test failures. No production database was involved.

## Local environment

- Client: [http://127.0.0.1:5196](http://127.0.0.1:5196/)
- API: [http://127.0.0.1:8796/healthz](http://127.0.0.1:8796/healthz)
- Supabase: [http://127.0.0.1:54321](http://127.0.0.1:54321)
- Studio: [http://127.0.0.1:54323](http://127.0.0.1:54323)
- Inngest: [http://127.0.0.1:8296](http://127.0.0.1:8296/); auto-discovery disabled, only the integration API registered.

| Login | Role |
| --- | --- |
| `owner@vds.local` | Workspace Owner / workspace_admin, client portal |
| `client@vds.local` | Workspace user, client portal |
| `cd@vds.local` | Creative Director, assigned to test workspace, steward + lead_steward |

Password for all three: **`Vds-local-2026!`**. Select **Cake-me** or **La Más Bonita** in the brand switcher. Auth provisioning also created empty personal “My brand” records; those are not the smoke-test brands.

Root `.env.local` and server `.env` have `CERTIFIER_V2_S1=1`, `CERTIFIER_V2_S2=1`, `CERTIFIER_V2_S3=1`, `TASKS_ENABLED=1`, `AGENCY_OFFICE=1`. Both Supabase targets are explicitly `http://127.0.0.1:54321`. Environment files and `.work` are excluded from Git. Provider keys were copied privately to enable the authorized live model/crawl tests. Outbound email is disabled.

The brandos-dev checkout uses the existing local **CaastorOS** Supabase stack, not a Docker project named brandos-dev. I backed up that local database into `.work/pre-reset-local.dump`, then ran `supabase db reset --local --no-seed` from the integration checkout. All **30** migrations applied; see [migrations.txt](migrations.txt) for the complete ordered list. The final five are font MIME, expected BIO version, `cert_messages`, Discovery review gate and certifier durable state (`20261013000000` through `20261013040000`). No hosted target was reset or seeded.

Cake Me was restored from the already-saved local brand/BIO snapshot and local imagery files, not recrawled or downloaded from production. Its three real product references were uploaded to local Storage. The foundation loader uploaded three logos and licensed Fraunces and appended version 2. Local specialist specs were initialized selectively from the code because the scoped production-update seed correctly refuses an empty fresh specs table. No seed ran against production.

## Smoke results

### Discovery: fresh La Más Bonita

Fresh brand `33f68208-4c2a-45de-8d9e-f6833afc7380`, website `https://www.lamasbonita.es`, live Discovery run `4a05b961-4662-4d11-8b84-f182663ae861`.

- **Score 70/100. Gate: gated, no reviewer job created.** Reasons: approved logo, primary colour and licensed display font required; score below 80. The queued response from `/discovery/start` was the background workflow queue, not a queued certification job.
- Logo: **incorrect favicon**, `https://www.lamasbonita.es/assets/images/favicon.ico`, source `og:image`, confidence 50.
- Colours: only `#262628`, “charcoal”, inferred surface. No primary colour. This is not a successful brand-palette extraction.
- Fonts: `DinR`, `DinM` (Body, computed) and `DinC` (Display, declared-not-computed). No unresolved CSS `var()` font names appeared. Display licensing is still missing.
- Competitors: Dulce de Leche, Bluebell Coffee, Blackbird Coffee, Bastard Coffee and Kitchen, Boa Beach and Federal Cafe. Their supplied evidence describes **Valencia/Patacona, Spain**. Country is inferred from that location evidence; the persisted competitor objects have no explicit country field. Most competitor website URLs are missing.
- This run proves local competitive research and the gate work; it **does not** prove the logo/palette issues in #18 are fixed for this site. Certification of this fresh brand remains blocked by its genuine foundation gaps. No values were fabricated to force a pass.

Evidence: [discovery-result.json](discovery-result.json), screenshots `02-*` and `03-*`.

### Cake Me foundation and certification

Brand `35f265f0-0546-4a9a-b793-a49887ad7125`, BIO v2 `b8c98aff-35ee-4d0e-a777-42d2d6cabfd7`.

- Loader: **foundation PASS, score 96**, no missing foundation fields. Primary `#FFD115`, accent `#FF4375`, surface `#FFFFFF`, ink `#3F3F3F`; Fraunces Display, Lato Body, Inter Label. Real logo variants and `53.png`, `56.png`, `58.png` reference images load in the browser.
- Owner self-confirmation: 200; exact-version attestation persisted; one review job queued.
- CD account read the 31-claim ledger, sent a positioning/reference-rights question. Client account answered; answer became a `client_answer` source and version-scoped evidence.
- CD submitted all 31 claim decisions with current evidence tokens and rubric scores. Response: **approved, completed, composite 100, certifiedVersion 2**. The account is a Lead, so no calibration wait.
- This was an **automated local role/authorization smoke**, not an independent human quality approval. The local decision narrative explicitly records that distinction. It does not certify production.
- S2's durable budget, leases, briefs and human-confirmation audits were verified by the eight real Postgres tests; no additional paid S2 assistant brief was generated.

Evidence: `foundation-loader.log`, `cake-self-certification.json`, `cd-review-before.json`, `cd-question.json`, `client-answer.json`, `cd-certification.json`, screenshots `01-*`, `04-*` through `09-*`.

### Cake Me deliverables — real provider calls

| Path | Time | Recorded cost | Result / real assets |
| --- | --- | --- | --- |
| Task social post, one item | **95.9 s** wall time; 93.5 s pipeline metric | **$0.0748**, 12 credits | Real generated image + branded HTML composite. Real local logo loads, certified colours used. **0 product references, `uses_reference=false`**. Flagged because the reviewer verdict lacked the required `items` field; all six model review checks failed closed. |
| Task email sequence, three items | **29.1 s** wall time; 28.0 s pipeline metric | **$0.0296**, 6 credits | **3 ready HTML emails**, valid MJML, all deterministic/reviewer checks pass. Actual Cake Me logo loads in each; real colour/voice tokens. No hero photos requested. |
| Legacy Briefs social image (`a41`) | **2.8 s** | No settled cost recorded; provider billing unknown; 6 credits fully refunded | Provider HTTP 422; no output. Real local reference URLs are supplied, but cannot be fetched by a remote provider. Exact provider validation body is discarded by this adapter, so reachability is a likely cause, not a proven response detail. |
| Legacy Briefs email (`a13`) | **61.8 s** | **$0.0722**, 12 credits | Incomplete text: only 631 characters of the first email, ending mid-sentence. 6000 completion tokens recorded. QA `qa_unparseable_response`, status `needs_review`. Uses brand context, not a finished branded HTML email. |

Costs are recorded application/provider-adapter figures, including image estimates, not a reconciled provider invoice. The old-path failures were retained; the task runs were additional smoke tests of the explicitly enabled pipeline.

Task reference root cause: `server/src/harness/brand-core.js` accepts only `https://` reference URLs, silently dropping the valid **local HTTP** signed Storage URLs. The legacy image path forwards these local URLs to fal. The approved product images exist and render; neither pipeline successfully conditioned this smoke's image on them.

Browser render verification: the generated social image and all four logo appearances loaded (`rendered-assets-check.json`). Social's HTML names Fraunces but does not embed/load its licensed font file. Email renders with its template font stack. Stored HTML contains one-hour signed logo URLs, so exports need renewal or embedded assets for later rehearsal.

Generated originals: [social_post-1.html](social_post-1.html), [email_sequence-1.html](email_sequence-1.html), [email_sequence-2.html](email_sequence-2.html), [email_sequence-3.html](email_sequence-3.html). Screenshots `18-generated-*` show those actual saved HTML outputs, **not a mocked task UI**.

## Briefs, Canvas and Library status

| Surface | Code and routes | What worked end to end | Stubbed, missing or broken | Flags |
| --- | --- | --- | --- | --- |
| **Briefs** | `src/portal-brandolph.jsx` HomeCreate; `src/portal-briefs.jsx` BriefsLibrary/TryPanel; `src/lib/use-brief-drafts.js`, `brief-draft-store.js`, `brief-draft-review.js`; `shared/brief-draft-payload.js`; server `routes/briefs.js`, `brief-drafts.js`, `runs.js`, `foundation-run-gateway.js`; task `src/task-pipeline.jsx`, server `routes/tasks.js`, `harness/{pipeline,registry,task-context,brand-core,render,settlement}.js`. SPA `#/home`, `#/briefs`, `#/tasks`; API `/api/briefs/sharpen`, `/api/briefs/drafts/*`, `/api/runs/stream`, `/api/tasks/*`. | Authenticated run → real provider → persisted brief/run/output/credits; task three-email generation and HTML rendering; brand-scoped list; failure credit release. Owner/client/CD role boundaries verified. | Legacy email incomplete and QA unparseable; social references fail/drop; task social reviewer schema failure. **Task jobs are an in-process Map**. API restart made both completed task IDs return 404; snapshots are in DB output JSON, but the task board cannot recover them. Durable draft autosave exists in code/unit tests but was not separately exercised through the browser in this run. Legacy `BriefDetail`/`BriefBoard` still use `CI_BRIEFS` mocks. | Main legacy paths ungated; `TASKS_ENABLED=1`; preview additionally needs server `FORMAT_PREVIEW` and client `VITE_FORMAT_PREVIEW=1`; `VITE_UI_FIXTURE=1` activates dev-only mocks and was off for these tests. |
| **Canvas** | `src/portal-briefs.jsx`: CanvasView, BriefRunCanvas, BriefViewCanvas, InteractiveCanvas, NotepadDrawer, DeliverableDrawer; `src/brief-workspace-surface.jsx`, `agency-workspace-surface.jsx`, `agency-office.jsx`, `generated-agency-scene.jsx`, `pixel-office/*`, office state helpers. SPA `#/canvas`, `#/canvas/prototype`, legacy `#/board/:id`; handoff via `sessionStorage.ci_run_context`; API `/api/runs/stream`, `/api/outputs/:id`, `/api/craft`. | Real saved brief opened from Briefs; graph of BIO/brief/specialist; Agency Office renders the real run and switches to Canvas; output drawer reads persisted copy. | **False “Approved”** label for the `needs_review` email, and “Project delivered” office framing. Saved view takes first/oldest output; reruns do not reliably replace/reload it. Craft handlers swallow failed responses and debit mock credits; assembly still breaks on a failed agent. Contextless canvas is a prototype/mock. Legacy BriefBoard is a mock. Pan/zoom is real; durable collaborative canvas editing/layout is not implemented. | `AGENCY_OFFICE=1` switches the live surface; otherwise legacy Canvas. Office customization/layout are browser-local. `/canvas/prototype` is explicitly a mock route. |
| **Library** | `src/portal-briefs.jsx`: Library, LibraryFolderDetail, LibraryAssetCard, LibraryViewer and shared useLiveBriefs; server `routes/outputs.js`, plus Supabase RLS joins of brands/briefs/runs/outputs. SPA `#/library`; API `PATCH/DELETE /api/outputs/:id`, `POST /api/outputs/:id/workflow`. | Persisted outputs → brand-scoped folders → folder/viewer; retained `needs_review` label for legacy email; original text preserved while edited text persisted via PATCH, 200. Canvas handoff works. | **Task JSON is displayed as raw serialized data**, not three rendered email cards; only one asset per task output. Existing downloads export text/URL rather than task HTML/PNG bundles. Image downloads rely on remote URLs; no stable embedded branded export. Not a full reusable brand-asset/DAM library. Version-specific proof can be misleading because list certification chips use the current latest certified BIO. | No Library feature flag; dev fixtures controlled by `VITE_UI_FIXTURE`. Task-aware rendering/export is absent. |

The live legacy list, graph and basic output Library are **not merely mocks**. The contextless/prototype Canvas, legacy BriefDetail/BriefBoard and specialist author's `mockDraft` dry-run **are mocks**. The task pipeline genuinely invokes providers and persists results, but its preview recovery and integration into those legacy surfaces are incomplete.

## Smallest demo-ready scope by Friday 16 October

Use the **task pipeline** for generation, keep the legacy mock routes off the demo path, and show the saved branded email/social artifacts. Do not claim the whole platform is complete. Priority order (engineering estimates, not completed work):

| Priority | Work | Surface | Effort |
| --- | --- | --- | --- |
| P0.1 | Preserve local references in Layer 1 and give remote image providers reachable reference bytes/URLs through a safe upload bridge. Verify `reference_count>0` and actual conditioning; embed/load the real display font and stable logo in exports. | Briefs/tasks | **4–6 h** |
| P0.2 | Enforce reviewer JSON schema/`items` wrapping with one bounded repair and a fail-closed status. Verify the social post can pass with no invented claims. | Briefs/tasks | **2–4 h** |
| P0.3 | Unify `needs_review`/failed/approved status mapping across graph, drawers and office; remove false delivered/approved framing. | Canvas | **2–3 h** |
| P0.4 | Reconstruct completed task snapshots from persisted outputs after restart; expose saved tasks in the board. At minimum guarantee completed-demo replay, rather than attempting a full durable worker rewrite before freeze. | Briefs/tasks | **3–5 h** |
| P0.5 | Parse `kind:task` output JSON into one card per item; display existing HTML and checks; export email HTML and a social artifact with stable logo/font assets. | Library + Canvas | **4–6 h** |
| P1.1 | Port #2's current-code fixes: latest rerun selection + refetch, craft error handling/live credits, continue assembly after individual failure. Keep mock board/detail out of navigation. | Canvas | **4–6 h** |
| P1.2 | Add a narrow full-three-email completeness check for legacy runs or remove that legacy route from the rehearsal path. | Briefs | **1–3 h** |
| P1.3 | Rehearse owner/client/CD flows, regenerate once using real references, verify reload and export, save the final proof pack. | All three | **2–3 h** |

Minimum credible curated demo: **roughly 2–3 engineering days** including validation; it is tight for one person by Oct 16. Email alone is much closer. A full persistent task worker, collaborative canvas or comprehensive brand asset Library is larger work and not a two-day promise.

Fresh-brand Discovery logo/palette extraction is a separate **3–5 h** targeted investigation and rerun. The current La Más Bonita result cannot honestly be presented as certified. For rehearsal use Cake Me's real prepared foundation, or explicitly show that Discovery asks for the missing evidence.

## Evidence and remaining blockers

- All screenshots are in this folder; `01`–`15` cover foundation, Discovery, question/answer/certification, legacy Briefs, office, graph and Library. `16`/`17` capture the task board/recovery failure; `18-generated-*` capture real rendered outputs; `19` captures the Library task representation problem.
- The existing local API process restarts when code changes under `node --watch`. That verified the task Map-loss issue; both prior task IDs now 404, while the output rows and original HTML remain saved. Generating a new task from `#/tasks` is testable, but the old tasks cannot be resumed without P0.4.
- No externally delivered email or production human approval was performed. The local CD decision is an explicit scripted smoke record.
- Signed asset URLs in raw evidence and generated HTML expire. PNG screenshots remain the stable proof. Live API/Vite/Inngest logs stay locally in this folder, ignored by Git; completed verification logs are committed.
- Remaining blockers are the P0 items above and fresh-brand foundation gaps. The green unit/build results must not be mistaken for green product end-to-end tests.
