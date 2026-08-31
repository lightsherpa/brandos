# CAA-52 — RC1 security operator proof: live auth policy, MFA, and secret separation

**Issue:** CAA-52 (child of CAA-49) · **Owner:** Brandolph · **Operator:** CEO / founder
**Date:** 2026-09-01 · **Branch:** `rc/caa-44-rc1` @ `b32802f`
**Live project under proof:** Supabase `yemzrohzqfuxmekcgnnh`

---

## 1. Verdict

**CONDITIONAL NO-GO for RC1 as of 2026-09-01.**

Zero of the four acceptance items can be satisfied from the repository. Every one of them is a
statement about live production configuration or about credential state held outside version
control, so the repo can only tell us what the code *expects* — never what the project *is*.

The verdict flips to **GO** when §4's evidence table is complete and §5's mutations are approved
and applied. Nothing else in this issue is blocking; the code-side work is already correct.

One finding below (F-1) is not merely a security gap — it is a **functional RC blocker**. If TOTP
is disabled on the live project, no account can ever reach `aal2`, and every privileged route in
the product returns `403 MFA_REQUIRED` forever. RC1 would ship with its entire admin surface
inaccessible.

---

## 2. What the repository *does* prove (no operator needed)

These are settled. They do not need evidence from the dashboard and are not part of the go/no-go.

**Application-side MFA enforcement is real and correctly implemented.** This is not a stub:

| Enforcement point | Location |
|---|---|
| `aal2` gate returning `403 MFA_REQUIRED` + denial audit | `server/src/middleware/auth.js:61` |
| `requireMfa` standalone middleware | `server/src/middleware/auth.js:79` |
| `requireSuperAdmin` = `portal.super_admin.access` + `mfa: true` | `server/src/middleware/auth.js:76` |
| Personas that require MFA (all platform roles + `workspace_admin`) | `server/src/lib/permissions.js:31` |
| Role management, audit read, member/invite management | `server/src/routes/access.js:32,54,68,75,144,152,168` |
| OPEX budgets, override issue, cost export | `server/src/routes/opex.js:122,154,164` |
| Override consumption on run paths | `brandolph.js:49`, `discovery.js:59`, `briefs.js:37`, `runs.js:124` |
| Client TOTP enroll / challenge / verify (`MfaGate`) | `src/portal-auth.jsx:101`–`146` |
| Assurance level surfaced to the client | `server/src/routes/me.js:43` |

The application is fully wired for MFA. **The only open question is whether the identity provider
will issue an `aal2` token at all** — which is a live-project setting.

**The override-secret fallback is real, and it is the default deployed state.**
`server/src/lib/opex-override.js:12` resolves the HMAC key as
`OPEX_OVERRIDE_SECRET || SUPABASE_SERVICE_ROLE_KEY`. `OPEX_OVERRIDE_SECRET` appears in **no**
deployment manifest — neither `server/.env.example` nor the Render variable list in
`docs/mvp-deployment.md` mention it. So this is not a rare edge case an operator might trip: with
the documented deployment procedure followed exactly, production signs every override token with
the database service-role key. Rotating the database key silently invalidates all in-flight
override tokens, and the blast radius of either secret leaking now covers both.

The crypto itself is sound — HMAC-SHA-256, `timingSafeEqual` with a length pre-check, nonce,
issued-at skew tolerance, hard 60-minute TTL ceiling. Only the key *source* is wrong.

**The in-repo Supabase config is below the RC bar on five settings.** `supabase/config.toml` is
the local-development file and does **not** describe the live project — but it is the only
declared configuration intent we have, and it is wrong on every setting this issue asks about:

| Setting | `supabase/config.toml` | RC1 bar |
|---|---|---|
| `auth.minimum_password_length` | `6` | ≥ 12 |
| `auth.password_requirements` | `""` (none) | `lower_upper_letters_digits` or stronger |
| `auth.email.enable_confirmations` | `false` | `true` |
| `auth.email.secure_password_change` | `false` | `true` |
| `auth.mfa.totp.enroll_enabled` | `false` | `true` |
| `auth.mfa.totp.verify_enabled` | `false` | `true` |

**The PAT record.** `docs/IMPLEMENTATION_LOG.md:13` records that Supabase PAT `sbp_e88f…` was
pasted in chat to enable `supabase link` / `db push`, and was "flagged for user revocation … once
we're done with this push." The committed text holds a truncated prefix only — **not a usable
credential, and no repo scrub is required.** But the log records a *request* for revocation, never
a confirmation of it, so the token must be assumed live until the operator checks.

The same log row and `IMPLEMENTATION_LOG.md:15` flag an Anthropic key and an OpenRouter key as
likewise "passed in chat … flagged for user rotation." Also unconfirmed. They are outside this
issue's stated scope, but they sit on the same dashboard visit and cost nothing extra to clear, so
they are included in §4 as E-5.

---

## 3. Findings, ranked

**F-1 · TOTP may be disabled on the live project — functional + security blocker.**
Local config disables both TOTP enroll and verify. If production matches, `aal2` is unreachable,
and every route in the table above is permanently `403`. Fix: enable TOTP enroll + verify, then
prove a real account reaches `aal2` (E-3).

**F-2 · Override signing reuses the database service-role key — high.**
`opex-override.js:12`, with `OPEX_OVERRIDE_SECRET` absent from every manifest. Fix: M-2 + M-3.

**F-3 · Password policy likely permits 6-character, no-complexity passwords — high.**
Applies to privileged personas, who hold `super_admin` / `platform_admin` / `workspace_admin`.
Fix: M-1.

**F-4 · Email confirmation and secure password change likely disabled — high.**
Without `secure_password_change`, a stolen session cookie can be escalated to full account
takeover with no re-authentication. Fix: M-1.

**F-5 · Historical Supabase PAT revocation unconfirmed — high until checked.**
A live Supabase PAT is a management-plane credential: it can read project secrets, run migrations,
and alter auth configuration — i.e. it can undo every fix in this document. Fix: E-4 + M-5.

---

## 4. Evidence table — operator fills this in

Redaction rule for every row: **never capture a secret value.** Crop or black out API keys,
service-role keys, TOTP secrets and QR codes, JWTs, and the PAT body. Capture only setting names,
their values, toggle states, timestamps, and key *prefixes* (first 8 chars) plus last-used dates.
Do not paste any secret into the Paperclip issue thread.

| ID | What to prove | Where | Capture | Status |
|---|---|---|---|---|
| **E-1** | Password policy | `supabase.com/dashboard/project/yemzrohzqfuxmekcgnnh/auth/providers` → Email | Screenshot showing **Minimum password length** and **Password requirements** | ☐ |
| **E-2** | Email confirmation + secure password change | same panel | Screenshot showing **Confirm email** and **Secure password change** toggle states | ☐ |
| **E-3** | TOTP enabled **and** a privileged account reaches `aal2` | dashboard MFA settings, then the running app | (a) screenshot of TOTP enroll/verify enabled; (b) app-level proof below | ☐ |
| **E-4** | Supabase PAT `sbp_e88f…` revoked | `supabase.com/dashboard/account/tokens` | Screenshot of the token list — either the token absent, or shown revoked. Token **name + creation date only**, never the body | ☐ |
| **E-5** | *(adjacent, cheap)* Anthropic + OpenRouter keys rotated | provider key dashboards | Key prefix + creation date of the current key, confirming it post-dates 2026-05-25 | ☐ |
| **E-6** | `OPEX_OVERRIDE_SECRET` set in Render and **≠** service-role key | Render → service → Environment | Screenshot of the variable list showing the key **present**, value masked | ☐ |

Dashboard labels move between Supabase versions; the URL patterns above are stable — navigate by
URL and read the panel.

### E-3, the app-level `aal2` proof (strongest evidence, no secrets involved)

This proves the whole chain end to end — provider issues `aal2`, middleware reads it, privileged
route opens — and it is cheaper and more convincing than a settings screenshot.

1. Sign in as the privileged test account in the running app.
2. Enrol TOTP through the in-product `MfaGate` (`src/portal-auth.jsx:101`) and verify a code.
3. `GET /api/me` → expect `"assuranceLevel": "aal2"` and `"mfaSatisfied": true`.
4. `GET /api/access/audit` → expect **200**. (Before step 2 it must return
   `403 {"code":"MFA_REQUIRED"}`. Capturing *both* results is the complete proof.)

Paste the two JSON responses with the `id`/`email` fields redacted. No screenshot needed.

---

## 5. Production mutations requested — **CEO approval required**

Per the issue: any production mutation needs explicit CEO approval and a rollback note. Nothing
below has been executed. A confirmation card is posted on CAA-52.

**M-1 · Tighten live Supabase auth policy.**
Minimum password length `6` → `12`; password requirements `none` → `lower_upper_letters_digits`;
enable **Confirm email**; enable **Secure password change**.
*Blast radius:* existing accounts are **not** retro-invalidated by Supabase — current passwords
keep working; the new bar applies to new passwords and resets. Enabling **Confirm email** means
new signups must click a confirmation link before first sign-in, so verify Resend/SMTP delivery is
live **before** flipping it, or new signups will silently strand.
*Rollback:* revert each toggle in the same panel. Instant, no data migration, no user impact.

**M-2 · Enable TOTP (enroll + verify) on the live project.**
*Blast radius:* additive — unlocks `aal2`, which is currently unreachable. Nothing that works today
stops working. Existing sessions stay valid at `aal1`; privileged users enrol on next use.
*Rollback:* disable both toggles. Reverts to today's state (privileged routes 403 again).

**M-3 · Create a dedicated `OPEX_OVERRIDE_SECRET`.**
Generate 32 random bytes — `openssl rand -base64 32` — and set it as a Render environment
variable on the API service. Do not reuse any existing key. Do not paste it into Paperclip, this
document, or any issue thread.
*Blast radius:* any override token issued **before** the switch stops verifying, because the HMAC
key changes. Override TTL is ≤ 60 minutes (`opex-override.js:31`), so the window is small — apply
during a quiet period and the practical impact is nil. No other subsystem reads this variable.
*Rollback:* unset the variable; `opex-override.js:12` falls back to the service-role key, i.e.
exactly today's behaviour. Fully reversible.

**M-4 · Remove the service-role fallback in code.** *(staged — do NOT apply before M-3 is live)*
```diff
-  const value = process.env.OPEX_OVERRIDE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
+  const value = process.env.OPEX_OVERRIDE_SECRET;
   if (value) return value;
   if (process.env.NODE_ENV === "production") throw new Error("OPEX override signing secret is not configured");
```
*Ordering is load-bearing:* deploy this **only after** M-3 is confirmed set in Render. Deployed
first, every override issue/verify throws in production.
*Rollback:* revert the one-line diff.
*Not applied in this heartbeat* — it changes production behaviour and is sequenced behind M-3,
per the standing "don't change flow without verifying first" rule.

**M-5 · Revoke the historical Supabase PAT** (and rotate the Anthropic + OpenRouter keys flagged
in `IMPLEMENTATION_LOG.md:15` while in the same dashboards).
*Blast radius:* the PAT is a management-plane credential used from a developer session for
`supabase link` / `db push`. Revoking it breaks any local workflow still relying on it; issue a
fresh scoped token if CLI access is still needed. Rotating the model keys requires updating Render
env vars in the same window or model calls start failing.
*Rollback:* none — revocation is one-way by design. Mitigation is issuing a replacement token.

---

## 6. Repo-side changes applied in this heartbeat

Documentation only. No runtime behaviour changed, no production mutated.

- `server/.env.example` — added `OPEX_OVERRIDE_SECRET` with generation instructions and an explicit
  warning about the service-role fallback.
- `docs/mvp-deployment.md` — added `OPEX_OVERRIDE_SECRET` to the required Render variable list.

These close the root cause of F-2: the variable was absent from every manifest, which is *why* the
fallback is the default deployed state. Setting the value (M-3) remains operator work.

---

## 7. Go/no-go statement for Hopper (CTO)

> **CAA-52: CONDITIONAL NO-GO for RC1, 2026-09-01.**
>
> Application-side MFA enforcement, override HMAC construction, and the persona→MFA mapping are
> correct in code and need no further engineering. Four acceptance items — live password policy,
> email-confirmation/secure-password-change state, `aal2` reachability for a privileged account,
> and PAT revocation status — are unprovable from the repository and remain open pending operator
> evidence (§4).
>
> One item is an RC blocker beyond its security weight: if TOTP is disabled on project
> `yemzrohzqfuxmekcgnnh`, `aal2` is unreachable and every privileged route — role management,
> audit read, member and invite management, OPEX budgets, override issue, cost export — returns
> `403 MFA_REQUIRED` permanently. RC1 must not ship until E-3 proves an account reaching `aal2`.
>
> Secret separation is documented and staged: `OPEX_OVERRIDE_SECRET` is now in both manifests, and
> the fallback-removal patch (M-4) is written and sequenced behind the operator setting the value
> (M-3). Applying M-4 before M-3 breaks production override signing.
>
> Recommendation: treat E-3 and E-4 as RC1 gates; E-1, E-2, E-6 as same-window operator work;
> E-5 as adjacent hygiene on the same dashboard visit. Flip to GO when §4 is complete.

---

## 8. Open, tracked elsewhere

Not in CAA-52's scope; listed so they are not lost. From
`docs/2026-09-01-security-roadmap-review.md`: S1 rate limiting and body ceilings, S2 delegation
bearer tokens stored and logged in plaintext, S3 missing HTTP security headers and `/healthz`
over-disclosure. These are CAA-49 remediation items and are RC1 blockers in their own right.
