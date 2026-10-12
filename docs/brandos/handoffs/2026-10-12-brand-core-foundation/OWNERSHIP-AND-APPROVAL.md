# Follow-up: section 8 build order, ownership and Cake Me approval

Read-only comparison on 12 October 2026. Foundation branch remains based on `17c5e21`; no task-pipeline checkout files were modified.

The user has now supplied section 8 directly. `SECTION-8-SCOPE.md` is the authoritative current scope. Earlier numbering below is historical: F1/F2/F5 and copy-agent guard belong to task-pipeline; our current slices are F3, F0, F7, F6b, F6 and F4.

| Current slice | Result |
|---|---|
| F3 logo | SVG/PNG upload, variants, five HTML fixtures, deterministic auto-find, uploads win at confidence 100. |
| F0 strip | Current Brand Core screen, above strategy, logo light/dark, primary/ink/surface, real-font specimen, reference thumbnails, Missing + Upload. |
| F7 palette roles | Per-swatch role selection; new extraction and legacy editor default guesses; framework defaults are excluded from automatic proposals. Explicit designer choices remain editable. |
| F6b fonts | Google Font or licensed upload; display/body and px scale; labelled Instrument Sans fallback cannot satisfy missing display type. |
| F6 gate | Certification/shared production gate and read-only image gateway; cap 79, foundation_incomplete, zero model/credit/ledger work. |
| F4 compositor | Standalone Sharp/SVG PNG compositor and local CLI, real font outlines and real logo buffers, contrast variant and primary bar; no protected-path wiring. |
| F1/F2/F5 + copy guard | Task-pipeline-owned; skipped in this follow-up. Earlier Cake Me approval artifacts remain unexecuted preparation only and are handed to that owner. |

## Protected-file boundary

Both `server/src/routes/runs.js` and `server/src/lib/runs.js`, `server/src/lib/models/fal-image.js`, and `server/src/lib/format-preview/` have no net changes from the base on this branch. Image preflight lives in `server/src/routes/foundation-run-gateway.js`. Authentication reuses a server-verified request context when that gateway enters the existing router, so JWT validation and rate charging happen once, not twice.

The shared production loader enforces the foundation on latest and pinned certified payloads. This also covers task-pipeline's existing call to `loadBrandBio({requireCertified:true})` before it opens a task run or calls a writer. Read-only loading of legacy Brand Cores remains available.

## Runtime contract for the pipeline owner

A saved uploaded logo stores **source IDs**, not an expiring signed URL. `resolveFoundationForUse` resolves only the exact pinned uploads on the selected brand and provides the existing Layer 1 contract:

- `visual.logo.url`: dark mark on light backgrounds by default, otherwise the available variant.
- `visual.logo.dark_url`, `light_url`, and `variants.dark/light.url`: fresh runtime URLs. A light mark belongs on a dark background.
- `visual.type[].url`: fresh private font URL when a licensed source is selected.
- `visual.type[].provider === "google"`: the selected Google family; the existing CSS2 helper supplies its stylesheet URL.

These values are a runtime projection; the persisted payload, hash and durable IDs are unchanged. Missing/deleted/unresolvable pinned assets fail closed.

Task-pipeline's current `buildLayer1` reads `logo.url` / `dark_url`, so an uploaded source-ID logo can now reach it without a change to that file. The standalone `composeSocial` now provides contrast selection, actual font outlines and PNG export. The task-pipeline owner controls when to invoke it from the harness; that protected wiring is unchanged. Supply resolved image/logo/font buffers; the compositor does no URL fetch or model work.

Both branches modify `visual-assets.js`, `ingest-guards.js` and have a backfill script. During integration, preserve foundation's logo/font separation, explicit rights and ownership validation, and source-ID URL projection, alongside task-pipeline's multi-reference behavior. Keep the safer **local-only** backfill contract. Do not cherry-pick a conflicting backfill blindly.

## Earlier F5 approval packet · handed to task-pipeline owner, not executed

[CAKE-ME-APPROVAL.json](CAKE-ME-APPROVAL.json) was generated entirely from the saved local snapshot with `scripts/prepare-cake-me-foundation.mjs`. The tool has no Supabase client, network call or apply mode.

The packet identifies the exact brand, BIO version and payload hash. It proposes yellow `#ffd115` as primary for designer confirmation and lists `53.png`, `56.png`, and `58.png` for Oscar's rights review. It does not contain or approve a synthetic logo, placeholder font, or production-ready payload.

Before a concrete load can be approved, provide the official light/dark logo files, actual display/body fonts and licence evidence, confirmed colour roles and reference rights. Then prepare an exact append-only payload diff against the pinned version/hash for Oscar's review. Existing certification must not silently carry over to a new version.

No production action is authorized by this packet or this document. The local backfill script continues to refuse remote targets.

## Earlier rehearsal checklist · outside the clarified scope

For Cake Me (and Nomad when separately ready), capture two social posts and one branded email with:

- Exact approved Brand Core version/hash and resolved reference IDs.
- A failing preflight example before completion: missing foundation, zero writer/image calls and zero credit/ledger writes.
- After completion: real display/body font, approved primary/ink/surface, logo contrast variant and supplied reference style.
- Raw generated image free of AI lettering/logos; composited logo/type handled by the pipeline renderer.
- Email HTML with the approved logo, primary CTA and passing MJML/contrast/size checks.
- Before/after screenshots, check verdicts, run IDs and actual cost ledger retained together.

The existing local strip screenshots demonstrate only the foundation gate/UI transition. They must not be presented as production post/email results.
