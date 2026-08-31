-- ─────────────────────────────────────────────────────────────────────
-- CAA-51 · Discovery delegation tokens at rest — plaintext → one-way digest
-- (remediates the release blocker in docs/2026-09-01-security-roadmap-review.md §S2)
--
-- 20260815020000_m3_discovery.sql stored the magic-link token verbatim in
-- discovery_delegations.token. A pending row is a live, chapter-scoped
-- read/write credential, so anyone with read access to the table — or to a
-- backup, or to a replica — could lift a usable link. The application also put
-- the raw token in the request path, so the same value landed in stdout logs.
--
-- After this migration the database holds only token_hash: a one-way digest
-- (HMAC-SHA-256 under DELEGATION_TOKEN_PEPPER, or a domain-separated SHA-256
-- when no pepper is set) of a 256-bit CSPRNG token. Lookups go through the
-- digest; the raw token exists only in the POST response and the invite email.
-- Server side, see server/src/lib/delegation-token.js.
--
-- ROLLOUT — read before applying to a live database:
--
--   1. This migration REVOKES every pending link. Existing tokens were stored
--      in plaintext and must be treated as compromised; there is also no way to
--      derive their digests once the column is gone. Pending rows are moved to
--      status='expired' rather than deleted, so the owner still sees the
--      delegation in its history and can re-send.
--   2. It is therefore ORDER-SENSITIVE against the application deploy. Apply
--      the migration and the server change together: the pre-CAA-51 server
--      inserts `token` (NOT NULL, dropped here) and the post-CAA-51 server
--      inserts `token_hash`. Neither runs against the other's schema.
--      Recommended sequence on Render: deploy with the service stopped, or
--      accept a short window where in-flight POST /api/discovery/delegation
--      calls 500. The route is low-traffic and non-core-loop.
--   3. Rolling back requires restoring 20260815020000's column definition AND
--      the old server; the plaintext tokens are not recoverable by design.
--   4. Set DELEGATION_TOKEN_PEPPER before or with this deploy. Changing the
--      pepper later invalidates every pending link — that is the intended
--      mass-revocation lever, not a bug.
--
-- Ordering note (CAA-46): the declared chain through 20260817000000 is
-- reconciled with staging and unchanged. This migration only appends.
-- ─────────────────────────────────────────────────────────────────────

-- 1. The digest column. Nullable first so the backfill can run.
alter table discovery_delegations
  add column if not exists token_hash text;

-- 2. Revoke every pre-hash pending link. Their plaintext tokens were readable
--    from the table and the logs, so none of them may survive the cutover.
update discovery_delegations
   set status = 'expired'
 where status = 'pending';

-- 3. Backfill historical rows with a digest that no token can ever produce.
--    This is a hash of the row id, not of a credential: it satisfies NOT NULL
--    and UNIQUE while being unreachable from any GET/PATCH lookup (an attacker
--    would need a SHA-256 preimage, and the rows are 'expired' regardless).
update discovery_delegations
   set token_hash = encode(sha256(convert_to('caastoros:delegation:revoked:' || id::text, 'UTF8')), 'hex')
 where token_hash is null;

-- 4. Lock the column down. Unique because it is the lookup key.
alter table discovery_delegations
  alter column token_hash set not null;

create unique index if not exists discovery_delegations_token_hash_key
  on discovery_delegations (token_hash);

-- 5. Destroy the plaintext column. This is the point of the migration: after
--    this statement, database access alone cannot recover a usable link.
alter table discovery_delegations
  drop column if exists token;

comment on column discovery_delegations.token_hash is
  'One-way digest of the delegation magic-link token (CAA-51). The raw token is returned to the creator exactly once and is never stored or logged. Rotate DELEGATION_TOKEN_PEPPER to revoke every pending link.';
