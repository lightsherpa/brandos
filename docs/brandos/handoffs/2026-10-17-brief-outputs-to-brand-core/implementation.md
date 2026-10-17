# Brief references → accepted outputs → Brand Core

Branch: feat/brief-outputs-to-brand-core, based on origin/dev after PR #30.

## Behavior

The brief composer accepts up to three PNG/JPEG/WebP photos (5 MB each). Uploaded photos live in the separate private `brief-references` bucket and service-only `brief_references` table. No `bio_sources`, Brand Core reference list, or certification state is written by upload. Recovery drafts preserve the selected reference IDs. Removing a photo deletes its unbound private object and metadata. Discard brief deletes that draft's unbound photos before deleting the recovery draft; photos already bound to production briefs remain intact. Identical photo bytes (SHA-256) are deduplicated within the same brand, owner and draft, including concurrent uploads; separate drafts retain independent lifetimes.

Generation resolves IDs on the server, checks the brand, owner and brief, and passes signed photo URLs as reference-image inputs through the existing generation adapters. The first run binds the reference to its production brief; subsequent runs resolve the pinned IDs. Another brief cannot borrow that binding. Both the assembly and task pipelines carry the IDs, including task recovery/reruns. The next brief without those IDs receives no photo. A late upload response triggers deletion of its unbound photo when the draft changes; Start/Proceed waits for an active upload. The original photo remains viewable in its brief drawer, never in the Brand Core example preview. Agents, their registry, their prompts, and their saved model routes are unchanged.

After the existing human client approval workflow marks the finished grouped deliverable Delivered, its detail offers one **Add to Brand Core** action. The API requires the existing `brand.manage` Brand Core/rule edit permission, rather than the broader `bio.propose`. Clients and workspace admins without that edit permission have no capability/button and receive HTTP 403. Users without it receive no capability/button and POST returns 403. Authentication, workspace access and human-actor checks remain mandatory. Approving an output alone does not add it to Brand Core.

Promotion is a service-only transaction: record the accepted contributor output IDs, original brief, original reference IDs, deliverable key/type/index and existing generated asset pointer; append an uncertified candidate BIO containing the approved example ID. The certified row and its reference list are untouched. Duplicate clicks return the same addition/candidate. The canonical output text/HTML remains in `outputs`; the existing asset remains in Storage. No file is copied, fetched and re-uploaded, or duplicated for promotion. A reference-bucket file cannot be promoted as a generated output asset.

Brand Core's **Approved work** section renders the OUTPUT from those canonical output rows and links back to its brief. The reference photo is lineage only and never displayed as a Brand Core example. The addition is explicitly Pending until the existing certification process certifies its candidate. This PR does not auto-certify or add model training. Certify routing stays unchanged; end users retain Brand Book V2. AGENCY_OFFICE stays off.

## Database / rollout

`supabase/migrations/20261017191634_brief_outputs_to_brand_core.sql` creates two service-only tables, a private 5 MB photo bucket and the atomic `propose_brand_output_example` RPC. Table RLS is enabled with no anon/authenticated grants or policies; the promotion RPC is executable only by service_role. Client access is through permission-scoped APIs. Brand Core edits cannot forge or remove the server-owned example ID list.

**HOLD: local/dev only until Oscar approves the prod apply.** Applied only to local Docker Supabase for development. No production migration was run. Deploy the feature with this schema after approval; endpoints fail closed without it. Existing review/approval and production model configuration remain required; the retired legacy Flux route observed in the earlier demo is not changed by this PR.

The current plan is deliberately conservative: every addition appends a reviewable candidate, including on an uncertified brand. A certified Brand Core never changes in place. Subsequent learning is the brand's explicitly reviewed collection of accepted examples; there is no silent promotion of inspiration into certified references.

## Verification and screenshots

- A real PNG upload is tested through the multipart route. It creates only a brief reference.
- The real task context loader and image generation step are exercised with an injected provider: the photo arrives in `referenceImageUrls`, the generated output has a different identity, and a following brief has no photo. This is deterministic adapter verification, not a live paid-provider generation demo.
- HTTP tests cover accepted-only addition, no edit permission, wrong workspace, unauthenticated and automated actors, provenance, original asset reuse, repeat clicks, and refusal to promote the reference file.
- Disposable local Postgres tests exercise the actual migration/RPC, accepted-only enforcement, idempotence, original certified row preservation, candidate certification reset, RLS and revoked direct browser access.
- UI rendering tests verify the action is absent before acceptance/without permission and check matching en/es/ar control keys.
- Browser capture was attempted but the browser tool rejected the local-app observation through its URL policy. No live UI screenshots are included or claimed. Screenshot/manual browser acceptance remains outstanding; do not treat deterministic tests as an end-to-end live demo.

Final checks: `npm test` passed 1,057 tests (zero failures/skips); the separate server test run passed 801 (overlapping the full suite); `npm run build` passed, with the existing chunk-size warning. `git diff --check` passed. Local Supabase advisors reported eight existing RLS-initplan warnings and three existing security-definer-view errors (`public_industries`, `public_template_versions`, `public_specs`), with no findings naming the new feature objects. These unrelated objects were not modified. The disposable database tests separately verify the new objects' RLS, privileges and service-only RPC.

## Quinn review corrections

The migration is replay-safe for tables, indexes, columns, policy and RPC, and is tested twice on an empty disposable schema and again with pending additions/certified data present. It defines no triggers, so there is no corresponding CREATE TRIGGER requiring a DROP. MIGRATIONS.md reserves #23 for PR #29 and numbers this entry #24. New draft linkage, SHA-256 and cleanup-claim columns remain in the same production-HOLD migration. A unique partial hash index arbitrates concurrent uploads; only the losing request's own object is removed. Cleanup claims prevent concurrent binding; failed Storage deletion leaves a blocked, retryable row. The draft FK prevents late inserts from becoming unbound orphans after discard, while already-bound references are explicitly detached from the recovery draft before deletion. Ordinary New brief navigation continues to preserve saved drafts; the explicit Discard brief action performs deletion.

Post-review validation: all 1,057 tests passed, the separate server run passed all 801, the build passed, and `git diff --check` passed. Migration replay is validated in disposable local Postgres, including data preservation, hash uniqueness and late-upload FK enforcement. No production migration was applied.
