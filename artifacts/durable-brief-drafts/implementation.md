Committed as `92633b8` on `rc/caa-44-rc1`.

# Durable brief drafts: integrated and locally verified

Date: 2026-09-10. The draft slice is now integrated into the main CaastorOS checkout on `rc/caa-44-rc1`, rather than existing only in a temporary worktree. Existing uncommitted design work is preserved and excluded from this slice's commit. The original handoff's later certification, execution-approval, sharing, output and human-service slices remain separate work.

## Delivered behavior

The Brandolph composer saves raw input, mode, question context, entered answers, and existing proposal/delivery-plan data into separate `brief_drafts` recovery records. The composer has no supported attachment control. Each record has a stable UUID, authenticated owner, server-derived workspace/brand association, optimistic revision, and idempotent mutation ID. Production `briefs` sharing is unchanged; this does not define the future production-brief privacy default.

Edits write a local recovery copy synchronously and debounce server writes at 600 ms. Blur, navigation/unmount and hidden-page transitions flush pending writes. Server saves are serialized; acknowledgements update metadata without replacing newer text. Recovery copies are separate per editor tab. Conflicts preserve both versions and offer saving the local version as a new draft. Known validation failures allow a corrected payload to replace the rejected request; uncertain failures retain the original mutation ID for safe retries.

New sessions list saved drafts. Selecting a draft restores it idle; only pending storage writes retry automatically. Start and canvas handoff wait for persistence. The canvas context includes `sourceDraftId`, which is a recovery-record ID rather than a production `briefId`. Start explicitly reanalyses the brief while exact BIO-version gating is not yet available. Drafts remain resumable after Start; archive/delete policy is not introduced.

Raw edits and failed analysis preserve previous questions and answers. Successful analysis retains answers matched by question text and records unmatched entered answers in visible history. Proceed is invalidated on editing and is enabled only after successful analysis. The former raw-brief error fallback has been removed so an analysis denial cannot unlock retained stale results. A blocked canvas storage write is surfaced instead of silently navigating with missing context.

Scope changes clear runtime analysis state but preserve each brand's records. Expected-owner checks prevent queued edits from being committed under a changed account. Malformed local recovery data is rejected before rendering; oversized but structurally valid text remains recoverable so the user can correct it. A delayed list response cannot replace a newer acknowledged revision. Save/retry/conflict/recovery feedback is provided in English, Spanish and Arabic.

## Independent review and verification

Three subagents independently reviewed lifecycle code, stress-tested the persistence controller, and audited/provisioned the database environment. Their findings were fixed and rechecked. No known blocker remains in the locally verified draft slice. This is bounded test evidence, not a claim of perfect software or production approval.

| Check | Result |
| --- | --- |
| Full regression suite, `npm run test:units` | **298/298 passed**: 263 existing plus 35 draft route/controller/review tests |
| Production build, `npm run build` | Passed; existing >500 kB bundle warning remains |
| `git diff --check` | Passed |
| Fresh real PostgreSQL migration chain | All **17 migrations applied successfully** in an isolated local Supabase stack |
| Real auth/API/PostgREST verifier | **19/19 passed** |
| Browser against actual product, actual backend and local Supabase | Passed scenarios below |

Independent stress tests specifically caught corrupt recovery crashes, hidden alternate tab copies, delayed-list races, and corrected text being stuck behind a rejected request. Review caught answer loss and stale-analysis progression. Browser testing caught a Start click being cancelled when blur-triggered autosave disabled its button. Each issue was corrected before the final suite.

Real integration checks use GoTrue password sessions and PostgreSQL, not database doubles: owner save/list/edit with a stable ID; authoring with no BIO; other-account/workspace denial; second-brand isolation; exactly one concurrent revision winner; idempotent lost-ack retry; stale-write rejection; unauthenticated API denial; direct anon/authenticated table denial; service-role persistence; unchanged runs, ledger and production briefs.

Browser scenarios executed through the real UI: typing/autosave; immediate Start after typing; navigation and reload/list/resume; restored question/answer content; failed analysis retaining answers with Proceed disabled; two-tab conflict and save-as-copy; stopping the API, editing, reloading while it was unavailable, restarting it and saving the recovery; brand switching; logout; another account seeing no first-account drafts; and reauthentication restoring the original account's draft list. Credits remained 300, with zero production briefs and zero runs in the local fixture database. The two signup credit-ledger entries remained unchanged.

The previously answered draft used for the failed-analysis browser case was a synthetic local fixture saved through the real API. No external model was invoked to create it. External model, email, billing and Inngest production credentials were omitted from the local runtime.

## Running local verification

The isolated stack is `/private/tmp/caastoros-drafts-integration`, project ID `caastoros-drafts-integration`. It does not reuse or modify existing Docker stacks. Supabase API is on loopback port 55321; PostgreSQL is on 55322. The actual product frontend is on `http://localhost:5187/`, with the actual backend on port 8887. These are local test services, not a hosted deployment.

Protected files `local.env` and `users.json` in that directory contain local-only runtime configuration and dedicated test-account credentials. Both have mode 0600 and are excluded from the commit. They are temporary fixtures, not production secrets. The browser test account can continue using the local product while these services run.

To rerun the real verifier against that running local backend:

```sh
node scripts/test-brief-drafts-local.mjs \
  --api http://localhost:8887 \
  --env /private/tmp/caastoros-drafts-integration/local.env \
  --fixtures /private/tmp/caastoros-drafts-integration/users.json
```

The verifier rejects non-loopback endpoints and does not print credentials. It retains its local draft for inspection. Do not substitute hosted credentials or endpoints. Unit tests need no configured services.

## Hosted staging and production remain unverified

The configured Supabase project is named `caastor-staging`, but an independent read-only audit of the publicly deployed `app.getcaastor.co` frontend confirmed it uses the same project as the local repository's configured/linked backend. It is therefore shared with the live product, not isolated staging. No remote migration or application-data write was performed.

A separate hosted staging target must be identified or provisioned before hosted validation. The user has been asked for that target. Do not run an unrestricted remote `supabase db push`: the preceding unapplied `20260901000000_delegation_token_hash.sql` drops a legacy token column and has a coordinated rollout requirement documented in `docs/2026-09-01-caa-46-migration-reconciliation.md`. The new `20260910000000_brief_drafts.sql` migration has been proven locally, but remains unapplied to the hosted/shared project. Existing environment files still point at their original target; the local verification processes received explicit loopback overrides.

## Next implementation slice

`loadBioForBriefing` still accepts self-certification, while production selects the highest currently certified BIO. The Creative Director route can append changed content and immediately certify it; it does not record user acceptance of that exact changed version.

Next implement an explicit reviewed/approved BIO version shared by analysis, assembly and production. Unchanged CD approval unlocks directly; changed content waits for acceptance of the same version without another review. Prevent an older certified BIO from silently unlocking a pending replacement. Test stale acceptance, changed/unchanged approval, decertification/expiry and a BIO change between resume and Start. Draft list/save must remain available and idle throughout.
