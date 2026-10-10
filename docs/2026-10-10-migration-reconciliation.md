# Migration reconciliation — 10 October 2026

The focused BIO release follows RC migration names. This is a cross-stream inventory, not permission to apply all feature migrations to production.

| Migration | Streams | Release decision |
|---|---|---|
| `20260524183348_init.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260524185323_grants_and_admin_rls.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260527000000_brandolph_memory.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260708120000_notifications.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260805000000_new_workspace_credit_grant.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260815000000_m1_gate_and_hardening.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260815000000_platform_integrity.sql` | main | Superseded by RC 20260815005000; same migration, never apply twice |
| `20260815001000_platform_integrity.sql` | snapshot | Superseded by RC 20260815005000; same migration, never apply twice |
| `20260815005000_platform_integrity.sql` | bio, rc, review | Included in focused release |
| `20260815010000_m2_certification.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260815020000_m3_discovery.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260815030000_m5_locale.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260815040000_p3_hardening.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260815050000_lang_management.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260816000000_scoped_access_and_opex.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260816010000_atomic_workspace_ownership.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260817000000_invitation_role_policy.sql` | bio, main, rc, review, snapshot | Included in focused release |
| `20260901000000_delegation_token_hash.sql` | bio, rc, review | Included in focused release |
| `20260910000000_brief_drafts.sql` | bio, rc, review | Included in focused release |
| `20260922000000_creative_production.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261003000000_bio_client_acceptance.sql` | review | Unapplied port uses unique 20261010020000; do not run both |
| `20261004000000_canvas_workspace.sql` | snapshot | Snapshot only. Before future union, rename unapplied canvas migration after latest stream timestamp; preserve applied output_versions history |
| `20261004000000_output_versions.sql` | review | Outside BIO release; do not apply from this branch |
| `20261004010000_canvas_creative_execution.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261004020000_creative_asset_storage.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261004030000_execution_measurements.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261004040000_canvas_text_claim.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261004050000_text_reconciliation.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261004060000_execution_spend.sql` | snapshot | Outside BIO release; do not apply from this branch |
| `20261005000000_approved_run_quotes.sql` | review | Outside BIO release; do not apply from this branch |
| `20261006000000_viewer_and_brief_privacy.sql` | review | Outside BIO release; do not apply from this branch |
| `20261007000000_craft_quotes.sql` | review | Outside BIO release; do not apply from this branch |
| `20261010010000_bio_review_attestation.sql` | bio, snapshot | Included in focused release |
| `20261010020000_bio_client_acceptance.sql` | bio | Included in focused release |

## Hosted state

The incoming handoff reports M1–M3 applied. M5/P3, RC integrity/scoped access/delegation/drafts, and all later migrations must be verified against hosted migration history by the deploy owner. Hosted state was not queried or modified. Do not infer “already applied” from local files.

## New BIO additions

`20261010010000_bio_review_attestation.sql` depends on M2 certification and existing bios/brands/users. It adds review_capture and the service-only atomic attestation RPC. Rollback requires disabling callers before dropping the RPC/column; retain attestation records.

`20261010020000_bio_client_acceptance.sql` is the review-stream acceptance schema port, renamed before any application in this isolated release. It depends on bios/users. Rollback would discard acceptance receipts; backup/export them first. No hosted application authorized.

`20261010030000_bio_client_acceptance_receipt.sql` adds a service-only exact-version Owner acceptance RPC. It locks the brand and current BIO and writes the decision receipt and acceptance timestamp atomically. Depends on the preceding acceptance columns, M2 decisions and scoped memberships. Disable callers before rollback.
