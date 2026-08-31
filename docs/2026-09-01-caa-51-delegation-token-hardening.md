# CAA-51 · Discovery delegation token hardening

**Ada · 2026-09-01 · branch `rc/caa-44-rc1`**
Remediates release blocker **S2** in `docs/2026-09-01-security-roadmap-review.md`.

## The problem

`discovery_delegations.token` held the magic-link token in plaintext, and the
token also travelled in the URL path — so Hono's request logger wrote a live,
reusable, chapter-scoped read/write credential to stdout on every call. Read
access to *either* the table (or a backup, or a replica) *or* the application
logs was enough to take over a pending delegation.

## What changed

| Axis | Before | After |
| --- | --- | --- |
| At rest | `token` (plaintext, `not null unique`) | `token_hash` only; the plaintext column is **dropped** |
| Digest | — | HMAC-SHA-256 under `DELEGATION_TOKEN_PEPPER`, else domain-separated SHA-256 |
| Token | `crypto.randomUUID()` (122 bits) | 32 CSPRNG bytes → base64url (256 bits) |
| Lookup | `.eq("token", raw)` | `.eq("token_hash", digest)` |
| Logs | full token in every request line | path segment masked to `[redacted]` |
| Rate limits | none | per-IP read / write / miss budgets + per-owner create budget |
| PATCH body | any object | bounded + schema-checked against the BIO field registry |
| Errors (open routes) | raw Postgres message | stable `INTERNAL` code, detail to the log |
| Caching | default | `Cache-Control: no-store`, `Referrer-Policy: no-referrer` |

**Unchanged on purpose:** the seven-day TTL, chapter isolation, single-use
semantics, the POST/GET/PATCH contract, and the SPA (`portal-discovery.jsx`
reads `j.link`, which still works). No product flow or feature was modified.

### Files

- `server/src/lib/delegation-token.js` — mint / digest / `validateChapterFields`
- `server/src/lib/log-redact.js` — `redactLogLine`, `redactingLogPrinter`
- `server/src/routes/discovery-delegation.js` — digest lookup, limits, bounds
- `server/src/index.js` — `logger(redactingLogPrinter)` (one line)
- `supabase/migrations/20260901000000_delegation_token_hash.sql`
- `scripts/probe-gate-isolation.mjs` — probes `token_hash`, not `token`

## Why the pepper is not fail-closed

`DELEGATION_TOKEN_PEPPER` is defence-in-depth, not the load-bearing control.
The digest input is 256 bits of CSPRNG output, so — unlike a password digest —
there is no low-entropy space to grind and no rainbow table to precompute. An
unpeppered SHA-256 of such a token is already unrecoverable from the database.

The pepper buys one thing that matters operationally: **rotating it invalidates
every pending link at once**, which is the mass-revocation lever. So a missing
pepper logs a startup warning rather than refusing to boot — refusing would turn
a forgotten env var into a hard deploy failure for a property we already have.

`DELEGATION_TOKEN_PEPPER` is in `server/.env.example` and `render.yaml`
(`sync: false`). **Hopper/infra: set it before or with this deploy.**

## Rollout note (live)

The migration is **order-sensitive against the application deploy** — the
pre-CAA-51 server inserts `token` (dropped here) and the post-CAA-51 server
inserts `token_hash`. Neither runs against the other's schema.

1. Set `DELEGATION_TOKEN_PEPPER` in the Render environment.
2. Apply `20260901000000_delegation_token_hash.sql` and deploy the server
   together. Single Render web service, so the honest options are a brief stop
   or accepting a short window where `POST /api/discovery/delegation` 500s. The
   route is low-traffic and outside the protected core loop.
3. **Every pending link is revoked by the migration.** Existing tokens were
   stored in plaintext and are treated as compromised; their digests are also
   underivable once the column is gone. Rows move to `status='expired'` (not
   deleted), so owners keep the history and can re-send.
4. Rollback needs the old column definition *and* the old server. Plaintext
   tokens are not recoverable — by design.

**Ordering vs CAA-46:** the declared chain through `20260817000000` is
reconciled with staging and untouched. This migration only appends, at
`20260901000000`. CAA-46's zero-to-head clean-apply proof is still blocked on
the local Docker daemon, so **this migration has not yet been run against a
disposable database** — it needs to be included in that run when Docker is
available. That is the one piece of verification I could not complete here.

## Verification

| Check | Result |
| --- | --- |
| `npm run test:units` | **263 pass, 0 fail** (includes 22 new lib tests) |
| `npm run test:delegation` | **13 pass, 0 fail** (route-level, in-memory Supabase) |
| Server boot with new imports | clean |
| Live log-redaction probe | token absent from server log; path shows `[redacted]` |
| Migration applied from scratch | **not run** — blocked on CAA-46's Docker daemon |

The route test asserts the acceptance criteria directly: the stored row contains
no plaintext token and replaying the stored digest 404s; a raw token completes
GET → PATCH exactly once and is spent; expired / returned / cancelled / tampered
tokens fail closed; a delegate cannot read or write another chapter; oversized
and off-schema bodies are rejected without spending the link; spraying and
replay hit 429 with `Retry-After`.

`test:delegation` is a separate script because module mocking needs
`--experimental-test-module-mocks`, and `test:units` should not carry an
experimental flag for the whole suite.

## Coordination notes

- **CAA-50** landed the app-wide perimeter (`lib/http-policy.js`,
  `lib/rate-limit.js`) concurrently. This route uses **their** `requestIp` and
  `createRateLimiter` rather than a second copy, so both layers bucket on the
  same trust-proxy policy (`TRUST_PROXY` / `TRUSTED_PROXY_HOPS` in
  `render.yaml`). The route-level budgets are deliberately tighter than the
  class-level ones because these two endpoints are unauthenticated.
- Rate limiting is **in-process**. On a single Render service that is the real
  ceiling; on >1 instance the effective limit multiplies by instance count. It
  degrades rather than failing open. A shared store is the CAA-50 follow-up.
- `POST /api/discovery/delegation` (authenticated) still returns database error
  messages, matching the rest of the codebase. That is the app-wide
  error-disclosure follow-up in CAA-49, not this issue — I tightened only the
  two unauthenticated routes.
