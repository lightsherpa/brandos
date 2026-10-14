# S2 durable state — 2026-10-14

Branch `feat/certifier-s2-durable` starts at `origin/dev` / `6d04d01`.

One migration: `20261013040000_certifier_durable_state.sql`. PR #18 (`fix/discovery-quality`, open when checked) already uses `20261013030000_discovery_review_gate.sql`; that version is not reused. No migration was applied to a project/shared database, and no shared data was seeded.

## State and concurrency

- Postgres owns the $0.30 budget for `(brand_id, bio_version)`, individual provider reservations, completed/failed run records, briefs, question drafts and human claim confirmation audit events. Request-local claim Maps remain data structures; there are no process-global budget, busy, brief, draft or confirmation Maps.
- Each provider call commits its conservative estimate through a single conditional `UPDATE ... WHERE spent + p_est <= cap`. The provider is called only after that transaction succeeds. Known usage settles the reservation and returns unused allowance; uncertain/failed calls retain the full estimate. RPC retries for a reservation/settlement are idempotent.
- A committed, fenced row lease implements `409 CERTIFIER_BUSY` across instances. It lasts three minutes and is renewed during reservation/settlement, exceeding the existing maximum 90-second provider run. A dead worker's lease can expire without restoring its spending allowance. A replacement run fences the old worker from reserving, refunding measured costs, releasing the replacement's lease, or committing a stale brief.
- A successful brief is committed before releasing the lease. Single-claim re-drafts reload their parent brief under that lease, preserving other claim cards while avoiding stale concurrent parents. Completed briefs and redraft parents survive new application/store clients and module reloads.
- Human confirmations are append-only rows containing the actor, claim ID, BIO ID/version and database timestamp. Duplicate confirmation of the same brand/version/claim remains 409. No update/delete grants are given on the audit table.
- RLS is enabled on all five tables. Clients/anon/PUBLIC have no table grants or RPC execution. Only service_role can execute the state functions; budget tables and brief records are written through those functions. These functions never become model tools.

## Validation

- `npm run test:units`: **668 passed, 0 failed, 0 skipped**.
- `CERTIFIER_TEST_CONTAINER=certifier-durable-pg-test npm run test:certifier-db`: **8 passed, 0 failed, 0 skipped** against a separate disposable PostgreSQL 17 container, with mocked provider output and synthetic test rows.
- Actual SQL tests cover concurrent connections, atomic cap reservation, DB-backed busy, crash takeover, stale-worker fencing, idempotent settlement, full brief/redraft recovery through fresh runner modules, persisted confirmation audits, RLS and service-only grants. The disposable container was removed after validation.
- `git diff --check` passed. No live model requests were made.

The DB test deliberately requires an explicitly named disposable container; it never reads project database URLs or credentials. To reproduce, start an empty test PostgreSQL container before running the script (the script creates minimal scope tables/roles and applies this migration there):

```sh
docker run -d --rm --name certifier-durable-pg-test --user postgres --entrypoint sh public.ecr.aws/supabase/postgres:17.11.0.002 -c 'mkdir -p /tmp/certifier-pg; initdb -D /tmp/certifier-pg -A trust >/tmp/init.log && exec postgres -D /tmp/certifier-pg -k /tmp'
CERTIFIER_TEST_CONTAINER=certifier-durable-pg-test npm run test:certifier-db
docker stop certifier-durable-pg-test
```
