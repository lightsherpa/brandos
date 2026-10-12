# Follow-up: section 8 build order, ownership and Cake Me approval

Read-only comparison on 12 October 2026. Foundation branch remains based on `17c5e21`; no task-pipeline checkout files were modified.

`CaastorOS/.work/PLAN.md` is absent on this host. The path was checked again after clarification, along with the accessible worktree/handoff directories. Only `PLAN-VERIFIED.md` is available. The supplied build order is recorded here without claiming that section 8 was read.

| Slice | Foundation branch / owner |
|---|---|
| F1 logo | Implemented: uploads, inert SVG/PNG, variants, fetched-HTML discovery. |
| F2 colour roles | Implemented: primary/ink/surface/accent, designer edits and audit, framework default filtering. |
| F3 references | Skip implementation: `feat/task-pipeline` `737c039` and `8897c18` pass up to three references to image routes. The foundation strip provides upload/visibility. |
| F0 strip | Implemented with Missing states and local Cake Me before/after screenshots. |
| F7 branded email | Skip implementation: task-pipeline's harness renderer and MJML template already consume logo and palette tokens. |
| F6b fonts | Implemented: Google Font selection, licensed upload, display/body, px scale and real-font specimen. |
| F6 cert gate | Implemented: certification and shared production-loader gate; image gateway response is `foundation_incomplete` before credit/model work; displayed score caps at 79. |
| F4 logo on posts | Skip image/render implementation: task-pipeline already has the HTML logo composite. Its own handoff notes that variant selection and PNG export remain renderer follow-ups owned there. |
| F5 Cake Me load | **Prepared only. Requires Oscar's approval and official asset inputs. No production load, seed, certification or backfill applied.** |
| F8 before/after | Local foundation screenshots are complete. Production post/email rehearsal is prepared in the checklist below and depends on approved F5 plus pipeline integration. No paid run was initiated. |

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

Task-pipeline's current `buildLayer1` reads `logo.url` / `dark_url`, so an uploaded source-ID logo can now reach it without a change to that file. Its renderer still owns choosing contrast variants, loading the real font in exported HTML, and PNG export. Those are documented integration follow-ups, not claimed complete here.

Both branches modify `visual-assets.js`, `ingest-guards.js` and have a backfill script. During integration, preserve foundation's logo/font separation, explicit rights and ownership validation, and source-ID URL projection, alongside task-pipeline's multi-reference behavior. Keep the safer **local-only** backfill contract. Do not cherry-pick a conflicting backfill blindly.

## F5 approval packet

[CAKE-ME-APPROVAL.json](CAKE-ME-APPROVAL.json) was generated entirely from the saved local snapshot with `scripts/prepare-cake-me-foundation.mjs`. The tool has no Supabase client, network call or apply mode.

The packet identifies the exact brand, BIO version and payload hash. It proposes yellow `#ffd115` as primary for designer confirmation and lists `53.png`, `56.png`, and `58.png` for Oscar's rights review. It does not contain or approve a synthetic logo, placeholder font, or production-ready payload.

Before a concrete load can be approved, provide the official light/dark logo files, actual display/body fonts and licence evidence, confirmed colour roles and reference rights. Then prepare an exact append-only payload diff against the pinned version/hash for Oscar's review. Existing certification must not silently carry over to a new version.

No production action is authorized by this packet or this document. The local backfill script continues to refuse remote targets.

## F8 rehearsal checklist after approval/integration

For Cake Me (and Nomad when separately ready), capture two social posts and one branded email with:

- Exact approved Brand Core version/hash and resolved reference IDs.
- A failing preflight example before completion: missing foundation, zero writer/image calls and zero credit/ledger writes.
- After completion: real display/body font, approved primary/ink/surface, logo contrast variant and supplied reference style.
- Raw generated image free of AI lettering/logos; composited logo/type handled by the pipeline renderer.
- Email HTML with the approved logo, primary CTA and passing MJML/contrast/size checks.
- Before/after screenshots, check verdicts, run IDs and actual cost ledger retained together.

The existing local strip screenshots demonstrate only the foundation gate/UI transition. They must not be presented as production post/email results.
