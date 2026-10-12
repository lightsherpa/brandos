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
select count(*) from public.brand_rules;
```
