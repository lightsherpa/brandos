# Production migrations on dev, not in main's applied set

Do not apply this list from the handoff. Nothing here has been run against a database. `main` was not modified.

Main's applied set is the migration files on `origin/main` at the time of this note. Dev has those files plus the ones below. Apply them in this order, after main's chain, one file at a time. Stop on the first error.

`SUPABASE_DB_URL` is the direct Postgres URL for the target database. Each apply command is one `psql` invocation. Each verify query is read-only.

## Flag: `20260815005000_platform_integrity` was renamed

Git records a 100% rename:

`supabase/migrations/20260815000000_platform_integrity.sql` on main
→ `supabase/migrations/20260815005000_platform_integrity.sql` on dev

The bytes are the same migration. Main also has `20260815000000_m1_gate_and_hardening.sql`, so the old platform-integrity filename shared a version with M1. Dev moved platform integrity to `20260815005000` so the version is unique.

Do not apply `20260815005000_platform_integrity.sql` on a database where `public.reserve_workspace_credits` already exists. That means the renamed SQL already ran. Applying it again repeats grants, policies, and functions. If the function is absent, the version was never applied and it needs separate review.

## 1. `20260815005000_platform_integrity.sql`

Safe before the merge.

Run the verify query first. Skip the file when a row comes back, and record the renamed version so a later runner does not apply it again:

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations (version,name) values ('20260815005000','platform_integrity') on conflict do nothing"
```

If it was never applied (the verify query returns no row), it needs separate review before anyone runs the apply command.



```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20260815005000_platform_integrity.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20260815005000', 'platform_integrity') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reserve_workspace_credits';
```

## 2. `20260901000000_delegation_token_hash.sql`

Apply together with or immediately after the main deploy. `origin/main`'s `server/src/routes/discovery-delegation.js` still inserts and looks up `discovery_delegations.token`. This migration drops that column. Applying it while that server is live breaks delegation links.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20260901000000_delegation_token_hash.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20260901000000', 'delegation_token_hash') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'discovery_delegations' and column_name = 'token_hash') as token_hash,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'discovery_delegations' and column_name = 'token') as plaintext_token;
```

`token_hash` is true and `plaintext_token` is false.

## 3. `20260910000000_brief_drafts.sql`

Safe before the merge. Run the verify query first and skip if a row comes back.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20260910000000_brief_drafts.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20260910000000', 'brief_drafts') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select to_regclass('public.brief_drafts') as brief_drafts
where to_regclass('public.brief_drafts') is not null;
```

## 4. `20261010010000_bio_review_attestation.sql`

Safe before the merge.


```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261010010000_bio_review_attestation.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261010010000', 'bio_review_attestation') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'bio_attestations' and column_name = 'review_capture';
```

## 5. `20261010020000_bio_client_acceptance.sql`

Safe before the merge.


```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261010020000_bio_client_acceptance.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261010020000', 'bio_client_acceptance') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'bios'
  and column_name in ('client_acceptance_required', 'client_accepted_at', 'client_accepted_by')
order by column_name;
```

## 6. `20261010030000_bio_client_acceptance_receipt.sql`

Safe before the merge.


```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261010030000_bio_client_acceptance_receipt.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261010030000', 'bio_client_acceptance_receipt') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'accept_bio_client_changes';
```

## 7. `20261010040000_discovery_run_progress.sql`

Safe before the merge. Run the verify query first and skip if a row comes back.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261010040000_discovery_run_progress.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261010040000', 'discovery_run_progress') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select to_regclass('public.discovery_runs') as discovery_runs
where to_regclass('public.discovery_runs') is not null;
```

## 8. `20261011000000_output_needs_review.sql`

Safe before the merge.


```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261011000000_output_needs_review.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261011000000', 'output_needs_review') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select pg_get_constraintdef(oid) as def
from pg_constraint
where conname = 'outputs_status_check';
```

`def` includes `needs_review`.

## 9. `20261011010000_hero_model_rate_cards.sql`

Safe before the merge.


```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261011010000_hero_model_rate_cards.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261011010000', 'hero_model_rate_cards') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select model
from public.api_rate_cards
where operation = 'completion'
  and model in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5', 'google/gemini-3.8-flash')
order by model;
```

## 10. `20261012000000_brand_rules.sql` (feat/task-pipeline, not merged)

New table for "Save as rule" (Rehearsal beat 5). Additive. Safe before the merge. Do not apply to production without Oscar's approval.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261012000000_brand_rules.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261012000000', 'brand_rules') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select count(*) from public.brand_rules;                                   -- 0 on a fresh apply
select relrowsecurity from pg_class where relname = 'brand_rules';         -- t (RLS on, no client policies)
select indexname from pg_indexes where tablename = 'brand_rules';          -- brand_rules_pkey, brand_rules_brand_idx
select version from supabase_migrations.schema_migrations where version = '20261012000000';
```

Runtime notes:
- The server reads this table with the service role. If the lookup errors, task runs fail closed (503 `BRAND_RULES_UNAVAILABLE`) before any credits are reserved, so apply this migration **before** setting `TASKS_ENABLED=true`.
- Only Owner/Editor (`brand.manage`) can insert rows via `POST /api/tasks/:id/rules`.
- No backfill. Nothing else depends on it.

Rollback (only if no rules have been saved yet):

```sql
drop table if exists public.brand_rules;
delete from supabase_migrations.schema_migrations where version = '20261012000000';
```

## 11. `20261012010000_runs_release_failed.sql` (feat/task-pipeline, not merged)

Widens `runs_status_check` to allow `release_failed`. Task settlement uses it when a credit release fails, so the run is flagged for reconciliation instead of being left `running`. Additive. Safe before the merge. Do not apply to production without Oscar's approval.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261012010000_runs_release_failed.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261012010000', 'runs_release_failed') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'runs_status_check';  -- includes 'release_failed'
```

Reconciliation query (should normally return 0 rows):

```sql
select id, started_at, ended_at from public.runs where status = 'release_failed' order by ended_at desc;
```

## 12. `20261013000000_bio_sources_font_mime.sql` (chore/bio-sources-font-mime)

Adds `font/ttf`, `font/otf`, `font/woff`, `font/woff2` and `application/font-woff` to the `bio-sources` bucket's allowed MIME types, keeping the existing ones. SVG stays disallowed. Safe before the merge. **Already applied to production on 2026-10-13 at 11:40 (Europe/Madrid), with Oscar's approval, for the Cake Me foundation load.** Only record the version on prod; don't re-run the update.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261013000000_bio_sources_font_mime.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261013000000', 'bio_sources_font_mime') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select allowed_mime_types from storage.buckets where id = 'bio-sources';  -- includes font/ttf … application/font-woff, no image/svg+xml
```

## 13. `20261013010000_append_bio_version_expected.sql` (fix/upload-followups)

Adds an optional `p_expected_version integer default null` to `append_bio_version`. When it's set, the append is refused with `STALE_BIO_VERSION` (errcode 40001) unless the brand's latest version equals it. Existing callers pass 5 named args and behave exactly as before. The 5-arg function is dropped and the 6-arg one created in the same transaction, so PostgREST never sees two ambiguous overloads. Grants stay service_role only. Additive. Safe before the merge. Do not apply to production without Oscar's approval.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261013010000_append_bio_version_expected.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261013010000', 'append_bio_version_expected') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select pg_get_function_identity_arguments('public.append_bio_version'::regproc);  -- ends with p_expected_version integer
```

## 14. `20261013020000_cert_messages.sql` (feat/certifier-s3)

Certifier v2 S3: `cert_messages` stores versioned CD ↔ client questions. Every message has the job's `bio_version`, schema-validated `field_paths`, and stable SHA-256 `claim_ids` derived from `[brand_id, bio_version, field_path]`. Client replies inherit these references, so evidence never silently moves to another Brand Core version. Drafts have `sent_at` null.

The service-only `answer_cert_question` RPC atomically creates text evidence and the reply. A unique constraint on `(brand_id, author_user_id, idempotency_key)` and a transaction key lock make retries/concurrent requests return the same answer. Reusing a key for different content returns 409. Closed/certified jobs reject new answers. File replies must reference this brand's file upload. Answers never write `bios`.

RLS restricts clients to their brands' sent messages. Column-limited SELECT excludes `author_user_id`, `idempotency_key`, and `request_hash`; clients have no writes or RPC execution. All changes are inside this migration, which has **not been applied to production**. The previous local-only shape must be dropped and this migration reapplied from scratch (do not rely on `create table if not exists` to upgrade it). Safe before the merge. Nothing reads it unless `CERTIFIER_V2_S3=true`. Do not apply to production without Oscar's approval.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261013020000_cert_messages.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261013020000', 'cert_messages') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select relrowsecurity from pg_class where oid = 'public.cert_messages'::regclass;  -- true
select has_column_privilege('authenticated', 'public.cert_messages', 'author_user_id', 'select'); -- false
select has_function_privilege('authenticated', 'public.answer_cert_question(uuid,uuid,uuid,text,text,uuid)', 'execute'); -- false
select pg_get_constraintdef(oid) from pg_constraint where conname = 'cert_messages_answer_key'; -- unique brand/user/key
```

RLS check (self-asserting, rolled back): `supabase/tests/cert_messages_rls.sql`.

Rollback (only if no questions have been sent yet):

```sql
drop function if exists public.answer_cert_question(uuid,uuid,uuid,text,text,uuid);
drop table if exists public.cert_messages;
delete from supabase_migrations.schema_migrations where version = '20261013020000';
```

Local rebuild of #14 (only the local S3 table; preserves other local data):

```sh
docker exec -i supabase_db_CaastorOS psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
begin;
drop function if exists public.answer_cert_question(uuid,uuid,uuid,text,text,uuid);
drop table if exists public.cert_messages;
delete from supabase_migrations.schema_migrations where version = '20261013020000';
commit;
SQL
docker exec -i supabase_db_CaastorOS psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261013020000_cert_messages.sql
docker exec -i supabase_db_CaastorOS psql -U postgres -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations(version,name) values ('20261013020000','cert_messages')"
docker exec -i supabase_db_CaastorOS psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/cert_messages_rls.sql
```

## 15. `20261013030000_discovery_review_gate.sql` (fix/discovery-quality)

Persists a confidence gate for each Brand Core version, including score and actionable waiting reasons. The service-only `reconcile_bio_review` RPC locks the BIO row, records a gated Discovery state, and queues the first review when checks pass. All prior jobs (including completed jobs) count, so concurrent rights confirmation, edits and self-certification cannot duplicate an automatic review for a version. Safe before the merge. Existing callers do not use this additive table/RPC until the application deploy. Run the verify query first and skip if a row comes back.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261013030000_discovery_review_gate.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261013030000', 'discovery_review_gate') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select to_regclass('public.bio_review_gates'), has_function_privilege('authenticated','public.reconcile_bio_review(uuid,jsonb,text)','execute'); -- table, false
select pg_get_constraintdef(oid) from pg_constraint where conname = 'discovery_runs_status_check'; -- includes gated
```

Regression checks: `supabase/tests/discovery_review_gate.sql` (transactional, rolled back).

## 16. `20261013040000_certifier_durable_state.sql` (feat/certifier-s2-durable)

Persists S2 version budgets, individual provider reservations, briefs, human confirmation audit events and question drafts. RLS is on with no client grants. Service-only RPCs acquire a fenced row lease, atomically reserve spend using `spent + estimate <= cap`, settle measured usage and commit a brief before releasing the lease. A crashed worker's unmeasured reservation stays spent; expiry releases only the busy lease. Safe before the merge with `CERTIFIER_V2_S2` off. **File only; not applied to shared databases.** Version `20261013030000` is reserved by PR #18's discovery gate and is not reused here.

Approved deployment reference only:

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261013040000_certifier_durable_state.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261013040000', 'certifier_durable_state') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select relrowsecurity from pg_class where oid = 'public.certifier_budgets'::regclass;
select has_table_privilege('authenticated','public.certifier_briefs','select'); -- false
select has_function_privilege('authenticated','public.certifier_acquire_run(uuid,uuid,uuid,integer,uuid)','execute'); -- false
```


## 17. `20261014000000_reference_intake.sql` (fix/vds-reference-intake)

`20261014000000_reference_intake.sql` redefines `public.reconcile_bio_review`; do not re-run `20261013030000_discovery_review_gate.sql` (030000) on its own after this migration.

Adds service-only atomic owner rights confirmation and an immutable audit row for each request. References are appended in a new Brand Core version, prior references are superseded and retained. Row locks and request IDs prevent duplicate appends; new-reference review requires exact owner attestation and cannot duplicate terminal jobs. Safe before the merge for schema compatibility: existing callers do not invoke the new intake RPC; automatic review gains an additional gate only for new reference_intake payloads. **File only; production application has not been authorized or performed.** Run the verify query first and skip if a row comes back. Never use these deployment examples for this local rehearsal.

Approved deployment reference only:

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261014000000_reference_intake.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261014000000', 'reference_intake') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select relrowsecurity from pg_class where oid = 'public.bio_reference_intakes'::regclass; -- true
select has_function_privilege('authenticated','public.confirm_brand_references(uuid,uuid,integer,uuid,uuid[],jsonb)','execute'); -- false
select has_table_privilege('service_role','public.bio_reference_intakes','update'); -- false
```

Quinn replay repair: tables/indexes use IF NOT EXISTS, functions use CREATE OR REPLACE, and the reference trigger is dropped IF EXISTS before recreation. npm run test:migration-replay applies the three VDS migrations twice while retaining data and checking grants/constraints.

Regression checks: scripts/reference-intake-db.test.mjs uses only an isolated disposable PostgreSQL container. supabase/tests/reference_intake.sql is transactional and rolled back. No production seeds or database writes are part of this push.


## 18. `20261014050000_output_qa_passed.sql` (fix/vds-canvas-library)

Separates automated task QA from explicit human approval. Extends the output status constraint with qa_passed and corrects prior task/task_rerun machine approvals while preserving recorded internal/client human review decisions. Safe before the merge for schema compatibility: the constraint retains all old states and the backfill affects task QA approvals without independent human review metadata. Deploy this schema before code that writes qa_passed. **File only; no production application performed.** Run the verify query first and skip if a row comes back. The migration also supports safe replay, including its data repair; it contains no inner transaction boundaries, so the migration and tracking row commit together.

Approved deployment reference only:

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261014050000_output_qa_passed.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261014050000', 'output_qa_passed') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.outputs'::regclass and conname = 'outputs_status_check'; -- includes qa_passed
select count(*) from public.outputs where kind in ('task','task_rerun') and status = 'approved' and internal_reviewed_by is null and client_reviewed_by is null; -- zero
```

Regression: npm run test:output-status-db applies the migration twice in a disposable PostgreSQL container and proves machine approvals change while independently recorded human approvals remain. It never targets a shared database.

## 20. `20261016000000_brand_core_input_tags.sql` (feat/product-pass)

Landing order: **after** `20261015000000_email_assets.sql` on `feat/email-asset-hosting`, which is handoff entry 19. This migration was `20261015150000` and is renumbered to `20261016000000` so the two branches do not both claim entry 19. Apply email assets first, then this file. Preserves per-image product, brand/lifestyle and usage-example tags when confirming reference rights. New flagged uploads append to active references; legacy uploads retain the existing replacement behavior. Owner, tenant, rights, version and idempotency checks remain enforced. Safe before the merge with the new input flags off. This entry is a deployment reference only; no production application is authorized. Never replay the older reference function afterward.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261016000000_brand_core_input_tags.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261016000000', 'brand_core_input_tags') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select position('reference_append' in pg_get_functiondef('public.confirm_brand_references(uuid,uuid,integer,uuid,uuid[],jsonb)'::regprocedure)) > 0 as supports_append_and_tags;
```


## 21. `20261016010000_certify_review_progress.sql` (feat/certify-simplify)

Apply after entry 20. Adds reviewer/job/version-scoped draft review progress and idempotent save receipts. Service-only RPC rechecks active certifier role, assignment, exact version and closed-job state under a job lock. It does not certify Brand Core or change existing decision gates. `CERTIFY_SIMPLIFY` defaults off. This handoff does not authorize production application; only the existing CaastorOS local stack is used for acceptance. Re-running the file is safe: tables use `if not exists` and the save function uses `or replace`.

Verify `certify_review_progress` and `certify_review_progress_requests` have RLS enabled, authenticated/anon have no table access, and only service_role can execute `save_certify_review_progress`. Regression: `supabase/tests/certify_review_progress.sql` (transactional rollback fixtures in the existing local database).

Safe before the merge with CERTIFY_SIMPLIFY off. Apply only after deployment approval; this command is documentation, not authorization:

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261016010000_certify_review_progress.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261016010000', 'certify_review_progress') on conflict do nothing" -c 'commit'
```

```sql
select relname, relrowsecurity from pg_class where oid in ('public.certify_review_progress'::regclass, 'public.certify_review_progress_requests'::regclass);
```

## 22. `20261016020000_client_safe_runs_outputs.sql` (fix/client-db-redaction)

Client-portal users only ever see credits. Replaces the table-wide browser `select` on `runs` with a column grant that leaves out `model_used`, the token columns, `cost_usd` and `latency_ms`. Team/admin keep that detail through the service-role API. Also strips model/vendor keys (`image.model`, `attempts`, `fallback_from`, `provider_endpoint`, `*_usd`) from `outputs.body` rows already written. The scrub can't be undone, but nothing reads those keys back. Timestamp `20261015000000` is entry 19 (`email_assets`); this file is `20261016020000`, after entry 21.

**Deploy order: SPA/API deploy first, then apply this migration, only with Oscar/Kai approval.** Applying it early breaks the live brief list, because the SPA still in production selects `runs.model_used` and the column grant answers with permission denied. Do not apply this migration against the current production SPA.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261016020000_client_safe_runs_outputs.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261016020000', 'client_safe_runs_outputs') on conflict do nothing" -c 'commit'
```

Verify:

```sql
select has_column_privilege('authenticated', 'public.runs', 'model_used', 'select') as model_used_readable,  -- false
       has_column_privilege('authenticated', 'public.runs', 'status', 'select') as status_readable;          -- true
select count(*) from public.outputs
 where body::text ~ '\\?"(model|provider_endpoint|fallback_from|attempts|[a-z_]*_usd)\\?":';         -- 0
```

## 22. `20261016020000_brand_book_shares.sql` (feat/certify-simplify)

Safe before the merge with BRAND_BOOK_GUIDELINES off. Adds service-only, owner-created, expiring and revocable capability links bound to one certified Brand Core snapshot. Snapshot and edition are immutable; only revocation changes. No anon/authenticated table grants. No production application is authorized by this handoff. Applied and verified only on the existing CaastorOS local stack.

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/20261016020000_brand_book_shares.sql -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261016020000', 'brand_book_shares') on conflict do nothing" -c 'commit'
```

```sql
select relname, relrowsecurity from pg_class where oid = 'public.brand_book_shares'::regclass;
```

Regression: `supabase/tests/brand_book_shares.sql` verifies RLS/grants, certified owner-only creation, immutable snapshots and revocation with rollback fixtures.
