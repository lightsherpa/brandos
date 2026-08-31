# CaastorOS security and roadmap review

**CAA-49 · Hopper (CTO) · 2026-09-01 · reviewed ref `rc/caa-44-rc1` @ `cb94939`**

## Decision

**Safe to continue development: yes. Safe to ship RC1 to internet users today: no.**

### ELI5 version

Think of CaastorOS as a house that already has good locks on the important rooms:

- users must show a valid key before entering;
- each customer is kept inside their own room;
- the most powerful actions need an extra lock (MFA);
- private files stay private; and
- Stripe and background-job messages are checked to make sure they are genuine.

So we can safely keep building the house. We should **not invite the public in yet**, because
the front gate still needs three improvements:

1. **Traffic limits:** stop one person or bot from hammering the doors thousands of times.
2. **Safer shared links:** store only a scrambled fingerprint of each discovery link, so a
   stolen database row or log line cannot be used as the key itself.
3. **Browser safety rules:** add the standard headers that tell browsers what CaastorOS may
   load and prevent other sites from framing or misusing it.

“Hash everything” is not the goal. A hash is like turning a secret into a fingerprint: it is
right for passwords, access links, and integrity checks, but wrong for ordinary project data
that CaastorOS must read again. Password hashing is handled by Supabase; the application does
not store plaintext passwords. BIO hashes are being used correctly. Discovery-link tokens are
the one important item that still needs safer hashing and log redaction.

**Plain-English release plan:** finish the database check, install those three front-gate
protections, run the complete BIO → brief → generate → verify → canvas journey once against
the live setup, and then make the go/no-go decision. Do not add new product features before
that proof.

The application has a credible security foundation: Supabase-validated JWTs, explicit
workspace authorization, permission and MFA gates for privileged operations, private
storage with signed URLs, RLS lockdown migrations, signature-verified/idempotent Stripe
webhooks, Inngest signing, upload allow-lists, SSRF guards, immutable audit/usage ledgers,
and cost guardrails. The core build and unit suite are healthy.

RC1 still needs two focused security remediations before the live core-loop smoke:

1. protect the internet perimeter (rate limits, security headers, request-size ceilings,
   less diagnostic disclosure); and
2. stop treating discovery delegation bearer tokens as ordinary database/log values.

Do not add product scope while these land.

## Verified snapshot

- Working tree: clean on `rc/caa-44-rc1`; RC is one commit ahead of `main`.
- `npm run test:units`: **207 pass, 0 fail**. A sandbox-only Vite WebSocket bind warning
  appeared; the affected UI test passed.
- `npm run build`: **pass**. Largest app chunk is 721 kB (208 kB gzip); performance debt,
  not a security/release blocker.
- Root production dependency audit: **0 known vulnerabilities** across 236 production deps.
- API production dependency audit: **0 known vulnerabilities** across 280 production deps.
- No committed `.env` or private-key file found. Secrets in `render.yaml` are `sync:false`.
- No CI workflow exists in the repository. RC proof is therefore manual until CI is added.
- Database integration tests were not rerun in this review. CAA-46 owns applied-vs-declared
  migration reconciliation and clean-database proof; local CLI state could not be used in
  this sandbox.

## Route-level security assessment

### Controls that are working

- Authenticated API routes validate the bearer JWT with Supabase Auth on every request.
- Authorization context resolves platform persona, workspace membership, assignment scope,
  and effective permissions; privileged routes add explicit permission and `aal2` checks.
- Tenant-owned resources are generally queried through the server service-role client only
  after an explicit workspace/brand check.
- The browser receives the Supabase anon key, not the service-role key.
- Public endpoints are intentional and bounded: health, Stripe webhook, Inngest callback,
  and chapter-scoped discovery delegation links.
- Stripe callbacks verify the raw-body signature and claim event IDs atomically before work.
- BIO certification and generation use server-only RPCs after the migration lockdown revoked
  authenticated client writes.

### Release blockers

#### S1 — No application rate limits or request-size policy (high)

There is no API-level throttling on authenticated generation routes, public delegation
endpoints, health, webhook, or other API traffic. Cost controls limit accepted model work but
do not protect CPU, auth lookups, database queries, upload parsing, or brute-force traffic.
Hono also has no global JSON/body ceiling or timeout policy visible at the edge.

**Required:** trusted-proxy-aware per-IP and per-user limits, stricter limits on public token
routes, bounded body sizes by content type/route, and 429 behavior covered by focused tests.

#### S2 — Delegation bearer tokens are stored and logged in plaintext (high)

Discovery delegation uses a high-entropy UUID, a seven-day TTL, and chapter scoping, which is
good. But the raw token is stored in `discovery_delegations.token`, placed in an API path, and
therefore included by the global request logger. Anyone with read access to application logs
or the delegation table can reuse a pending link.

**Required:** store only `SHA-256(token + server pepper)` (or HMAC-SHA-256) and look up by the
digest; return the raw token only once; redact token-bearing paths from logs; rotate/revoke
existing pending links during migration; rate-limit GET/PATCH; cap and schema-check chapter
payloads. Content hashes do not need salting; credentials do.

#### S3 — Missing HTTP security headers and excess health disclosure (medium/high)

The Hono app does not set CSP, HSTS, frame protection, MIME sniffing protection, referrer
policy, or a permissions policy. `/healthz` discloses the selected model, configured origin
list, and whether a provider key exists. None is catastrophic alone; together they are an
unnecessary internet-exposure gap.

**Required:** production-safe security headers (CSP tailored to Supabase/model image origins),
minimal `{status:"ok"}` health output, and CORS rejection with no fallback origin header.

### Important follow-ups (not all RC blockers)

- **Auth policy proof:** password hashing is owned by Supabase Auth, not application code.
  The repository cannot prove the live Supabase password/MFA policy. Local config permits
  six-character passwords without complexity, disables email confirmation and secure password
  changes, and disables TOTP enrollment/verification. Verify production settings explicitly;
  require a stronger password baseline and enable TOTP before privileged personas are onboarded.
- **Secret separation:** OPEX override HMAC correctly uses SHA-256 and timing-safe comparison,
  but production silently falls back to `SUPABASE_SERVICE_ROLE_KEY` because
  `OPEX_OVERRIDE_SECRET` is absent from the deployment manifest/example. Add and rotate a
  dedicated signing secret so database-key rotation and override-token signing are independent.
- **Historical credential hygiene:** `docs/IMPLEMENTATION_LOG.md` records that a Supabase PAT
  was shared in chat and requested for revocation. The committed text contains only a shortened
  prefix, not a usable token, but CEO/infra must confirm the original PAT was revoked.
- **Error disclosure:** many routes pass database/provider error messages to authenticated
  clients. Replace with stable public error codes and log the detailed cause with a request ID.
- **Upload content verification:** extension and declared MIME checks are good, but magic-byte
  validation and malware/content scanning are absent. Private storage reduces exposure; add
  deeper scanning before broad external intake.
- **Latent destructive route:** `server/src/routes/workspace.js` contains workspace deletion
  protected only by authentication, but it is not mounted. Delete it or require owner + MFA +
  recent re-auth before anyone mounts it.
- **Authorization regression coverage:** existing tests validate permission functions, RLS
  source invariants, and DB RPCs, but there is no focused HTTP route matrix proving cross-tenant
  401/403/404 behavior. Add a small API integration suite around the highest-risk routes.

## Hashing and cryptography verdict

- **BIO payload binding:** deterministic SHA-256 is appropriate. It is an integrity identifier,
  not a password; salting is neither required nor desirable.
- **OPEX override tokens:** HMAC-SHA-256 plus timing-safe comparison is appropriate; use a
  dedicated secret.
- **Passwords and sessions:** delegated to Supabase Auth. The application never stores plaintext
  passwords. Production policy and MFA configuration still require an operator-side check.
- **Third-party callbacks:** Stripe and Inngest use provider signature verification.
- **Delegation bearer links:** entropy is adequate, but at-rest/log handling is not. Hash them
  before RC1.
- **User data generally:** do not “hash everything.” Reversible product data must remain usable;
  secrets need encryption/secret management, credentials need one-way verification, and audit
  integrity needs hashes/signatures. Applying one mechanism indiscriminately would break the
  product without improving security.

## Current roadmap and cut line

The live board supersedes the older August roadmap:

1. **CAA-44 / RC1 feature freeze** — protected loop only: BIO → brief → generate → verify →
   persisted canvas, plus access/security and deploy reliability.
2. **CAA-45 complete** — composite work preserved and cut as `rc/caa-44-rc1` @ `cb94939`.
3. **CAA-46 active** — reconcile declared migrations with live Supabase and prove clean apply.
4. **CAA-49 security remediation** — S1/S2/S3 above must land on the RC without product changes.
5. **CAA-47 release proof** — one live pass of the protected loop and explicit CTO go/no-go.
6. **Post-RC1:** CAA-48 BIO v1.0 content-model expansion, then other deferred product work.

The release order is therefore:

`RC preservation → migration proof → perimeter/token hardening → live core-loop proof → go/no-go`

Billing expansion, bundle work, redesign, new canvas features, and BIO model expansion remain out.

## Ownership

- **Ada:** implement the bounded perimeter and delegation-token remediations on a short branch;
  preserve route behavior and add focused tests.
- **Hopper:** review the changes, enforce the cut line, and issue the final go/no-go after CAA-47.
- **Brandolph / infra:** confirm live Supabase auth/MFA settings, confirm PAT revocation, and approve
  any production-affecting configuration or secret rotation.
