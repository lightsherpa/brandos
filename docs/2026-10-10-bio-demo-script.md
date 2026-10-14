# BIO demo and regression runbook

Freeze: Friday October 16, 2026, 18:00 Europe/Madrid. Target release branch: `feat/bio-selfcert-vds`, based on `rc/caa-44-rc1`. Merge/deployment and hosted migrations remain deploy-owner actions.

## Local review

Run the isolated stack with `node scripts/start-bio-local.mjs web` and `node scripts/start-bio-local.mjs api`. These read local Supabase status into memory; do not print its credential JSON. The API's local helper disables outbound email and uses local Inngest. Provider credentials are intentionally absent after the approved live test.

Open `http://127.0.0.1:5185/#/discovery/new` to review source-led intake. Website, reference links with current/aspiration/competitive purpose and files remain the inputs. Do not trigger paid generation in rehearsal without a new explicit approved test scope.

Use the disposable local Owner account already seeded in `.bio-local/owner.json`; do not publish fixture credentials as deployment credentials. Choose the synthetic demo bakery saved in `.bio-local/demo-brand.json` to view the actual local certified demo BIO. `#/brand-book/replay/demo` renders its stored record. The certification belongs to synthetic test actors; it does not represent a human certification of Cake-me or Geoking.

## Hero regression

`node scripts/test-bio-demo.mjs` blocks external requests and supplies deterministic Firecrawl/OpenRouter fixtures. It runs the real compiler function, local Auth, database and API review routes three times. It verifies:

1. Sources → bounded model stages → correlated saved BIO and completed progress.
2. Non-Owner self-certification is denied; stale version is denied.
3. Exact v2 Owner review writes a receipt and unlocks briefing; production remains blocked.
4. A separate local Creative Director fixture submits the full rubric and changes the BIO.
5. Production remains blocked until the Owner accepts the exact changed version.
6. Non-Owner/stale acceptance is denied; the accepted receipt exists and production unlocks.

Final measured runs: 2.33s, 2.08s, 2.14s. Paid cost: $0. These are **synthetic provider / real local API and database regressions**, not three live model runs or three human reviews. Inngest notification dispatch is a synthetic acknowledgment; email delivery and asynchronous worker restart recovery are not covered by this script.

`node scripts/test-bio-progress-local.mjs` verifies the terminal failure handler, preserved failing stage, sanitized error, authenticated status read, and backfills the two historical live-test progress outcomes explicitly. `node scripts/check-bio-local.mjs` verifies briefing/production gates and both attestation and acceptance transaction rollback.

## Saved-run fallback

`public/demo/bio/replay.html` embeds the actual read-only renderer output, all three stored outcomes and a local Plex font. It requires no login, API, provider or external assets. Open it directly as a file if the local stack is unavailable. Cake-me shows an unreviewed saved candidate; Geoking shows a retrieval failure. The page's selector changes embedded records without fetching anything.

Regenerate with `node scripts/build-bio-replay.mjs`. The live/CSS follow-up fixtures in `output/bio-discovery` stay ignored. `test-bio-demo.mjs` exports the original live Cake-me candidate; after a visual refinement use `refresh-bio-test-visuals.mjs` to append an unreviewed candidate and regenerate the portable replay. That refresh is a local write, not a provider run. Never overwrite an original provider result or certify a real brand automatically.

## Remaining freeze checks

- Brand Book 390px/1440px and EN/ES/AR layout checks are complete; audit broader mobile dock/overlay interactions and legacy account translations before a platform-wide release.
- Have Oscar/designer validate the complete visual system and photographic direction.
- Geoking needs a readable source, uploaded brand materials, or a separately approved retrieval retry.
- Recheck competitive evidence freshness before using comparisons in production.
- Identify/confirm the actual demo deployment branch, merge the reviewed PR, apply reviewed hosted migrations and seed the demo there through the deploy owner. No hosted deployment or migration was performed here.

Post-VDS: full competitive agent, optional cached Brandfetch, embedded PDF image analysis, library, approvals and templates.
