# API perimeter and HTTP response policy

**CAA-50 · Ada · 2026-09-01 · branch `rc/caa-44-rc1`**

Closes S1 (no rate limits / no request-size policy) and S3 (missing security
headers, excess health disclosure, CORS fallback origin) from the CAA-49 review.
S2 — delegation bearer-token hashing and log redaction — is CAA-51 and is not in
this change; the two land on the same branch and share `lib/rate-limit.js`.

No product flow, route, or response shape changed. The only behavioural deltas a
user could observe are: an abusive caller now gets `429`, an oversized body now
gets `413`, and `/healthz` returns less.

## What shipped

| File | Role |
|---|---|
| `server/src/lib/rate-limit.js` | Trusted-proxy-aware client-IP resolution + a bounded fixed-window counter. Pure, no I/O. |
| `server/src/lib/http-policy.js` | The single policy table: abuse class → per-IP/per-user ceilings, body ceiling, headers, CORS decision, health body. |
| `server/src/index.js` | Installs the perimeter before CORS and before every route; fail-closed CORS; minimal `/healthz`. |
| `server/src/middleware/auth.js` | Per-authenticated-user ceiling, applied the moment the JWT is verified. |
| `server/src/lib/*.test.mjs` | 34 tests — 9 on the IP/counter primitives, 25 driving a real Hono app end to end. |

## The five decisions worth knowing

**1 · Client IP is counted from the right of `X-Forwarded-For`, and only when
`TRUST_PROXY` is on.** XFF is attacker-controlled. A client that pre-seeds the
header only pollutes the left of the chain; the right-most `TRUSTED_PROXY_HOPS`
entries were written by infrastructure we trust, so the client sits at
`length - hops`. With trust off we ignore forwarding headers entirely and bucket
on the socket peer — the one value a caller cannot choose. Defaults: on in
production (Render terminates TLS and rewrites XFF), off everywhere else.
**If a CDN is ever put in front of Render, `TRUSTED_PROXY_HOPS` must go to 2**,
or every request buckets on the CDN's egress IP.

**2 · Per-user limits live in `requireAuth`, not at the edge.** The edge cannot
key on a user without trusting an unvalidated `sub` claim — which would let a
forged token drain a victim's budget. So the user ceiling is applied at the first
point the identity is *verified*, and before the profile/authorization queries,
so a throttled caller costs us no further database work.

**3 · Signed callbacks are exempt from throttling, not from body limits.**
Stripe and Inngest authenticate by signature, arrive from provider ranges we
cannot bucket usefully, and retry on failure — throttling them manufactures
outages. They get a 4 MB body ceiling instead. Hono's `bodyLimit` short-circuits
on `Content-Length` without touching the stream, so the webhook's raw-body
signature read is unaffected (verified live). `/healthz` is exempt too: Render's
probe must never be throttled, and the response is now a static 15 bytes.

**4 · Ceilings are abuse controls, not product quotas.** Credits and the opex
guardrails already govern spend. These numbers are set so a real session — SSE
runs, 3–10s BIO polling, a multi-specialist brief batch — never sees a 429:

| Class | Per IP | Per user | Body | Covers |
|---|---|---|---|---|
| `health` | — | — | 8 KB | `/healthz` |
| `webhook` | — | — | 4 MB | `/api/inngest`, `/api/billing/webhook` |
| `publicToken` | 20/min | — | 256 KB | `/api/discovery/delegation/:token` |
| `upload` | 60/min | 20/min | 16 MB | evidence + avatar multipart |
| `generation` | 120/min | 60/min | 1 MB | writes to brandolph, runs, craft, discovery, steward, bios |
| `api` | 600/min | 300/min | 1 MB | every other `/api` call, incl. polling |
| `asset` | 1200/min | — | 256 KB | SPA + static assets |

Reads are never classified `generation` — only `POST`/`PUT`/`PATCH` are — so
status polling spends from the roomy `api` budget. The 1 MB JSON ceiling has
5–20× headroom over the largest real payload (a full BIO `PATCH`); no route
sends base64 bodies. Every ceiling is env-overridable
(`RATE_LIMIT_<CLASS>_IP_MAX|_USER_MAX|_WINDOW_MS`, `BODY_LIMIT_<CLASS>_BYTES`)
so ops can tighten without a deploy, and `RATE_LIMIT_DISABLED=1` is the escape
hatch for load scripts.

**5 · CSP enforces in production only, and `script-src` is the directive doing
the work.** The SPA ships as module files with no inline script, so
`script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`) blocks an injected or
third-party script outright. `style-src` *does* carry `'unsafe-inline'` —
`index.html` ships inline `<style>` blocks and the portal renders with React
style props. That is an accepted, documented relaxation, not an oversight.
`img`/`media`/`font-src` stay broad (`https:`) because brand assets legitimately
come from Supabase signed URLs and fal.ai hosts that rotate. `CSP_MODE` accepts
`enforce | report-only | off` for a staged rollout. Outside production CSP and
HSTS are off — in dev the SPA document is served by Vite on :5173, not by this
app — while the cheap headers still ship.

Also now set: HSTS (1 year, production), `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(camera/microphone/geolocation off), `nosniff`, CORP `same-origin`, and
`X-Powered-By` removed. Headers are installed outermost, so `429` and `413`
responses carry them too.

**Bonus fix, same class of problem:** CORS previously answered a disallowed
Origin with `ORIGINS[0]` — telling every caller "you are allowed, just not as
yourself". It now returns no `Access-Control-Allow-Origin` header at all.

## Verification

- `npm run test:units` — **263 pass, 0 fail** (34 new).
- `npm run build` — pass, bundle sizes unchanged.
- Live probe of a production-mode server (`NODE_ENV=production`, real `dist/`):
  - `/healthz` → `{"status":"ok"}` and the full header set.
  - `/api/discovery/delegation/:token` → 20 × 200, then `429` with
    `Retry-After` and `RateLimit-*`; a second IP unaffected; a rotating spoofed
    XFF prefix stayed in one bucket.
  - 2 MB `POST` → `413 PAYLOAD_TOO_LARGE`, handler never reached.
  - `/api/inngest` × 30 → never throttled.
  - Disallowed `Origin` → no `Access-Control-Allow-Origin`; allowed origin echoed.
  - Built SPA still serves: `index.html`, hashed bundle, `/caastor/ds-tokens.css`,
    deep-link fallback, and the JSON `/api/*` 404 — all 200/404 as before.

## Deploy note

`render.yaml` now sets `TRUST_PROXY=1` and `TRUSTED_PROXY_HOPS=1`. **Without
`TRUST_PROXY=1` in production every request buckets on Render's internal proxy
IP** — one shared bucket for the whole internet, which would throttle real users.
No secret and no new dependency was added; the limiter is in-process.

## Known limitation (accepted for RC1)

The limiter is per process. RC1 runs a single Render web service, so this is
exact today. At >1 instance the buckets become per-instance and the effective
ceiling multiplies by the instance count — it degrades, it does not fail open in
a surprising way. Moving to a shared store touches only `createRateLimiter`.
Flagged now so nobody is surprised by it when we scale out.
