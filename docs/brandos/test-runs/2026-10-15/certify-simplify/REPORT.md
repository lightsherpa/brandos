# Certify simplify — completion report

Code SHA: `f00f2d3`. Branch: `feat/certify-simplify`. Base: `origin/dev` at `44ce1f8`, including PR #23. Research was recorded before UI changes in `01be99f`.

## Delivered

Review → Confirm → Done replaces the five-rating confirmation. The left Focus first queue puts visual identity before voice/production and keeps strategy collapsed. The center displays large source evidence and actual font specimens. Stewart · Review assistant stays in the right panel with assessment, source citations, a draft question and explicit Accept / Ask / Flag actions. Sending a draft opens client chat and advances.

Confirm is a short separate screen with coverage and grounding computed once and shown read-only, an optional note, and one black **Certify Brand Core** primary action. The API records explicit human approval and the two measured criteria. It does not synthesize five human scores or an artificial composite. Current claim/evidence, foundation rights, assignment, owner separation, human actor and calibration gates remain enforced.

Done persists across refresh. It shows Brand Core certified, version, reviewer, reviewed count and plain change descriptions. Open Brand Book opens the reviewed brand. Back to queue navigates to the queue, rather than restarting this review.

A shared display boundary keeps signed URLs, JWTs, storage paths, internal identifiers and serialized font metadata out of visible claim values, citations, specimens, edits, questions, errors and change summaries. Font labels read, for example, **Meaty Nineties · Display · commercial** and **Lato · Body**. Resource URLs remain only in the attributes needed to load assets or open evidence, behind human labels. Existing client model-name scrubbing remains intact.

PR #23 role protection remains in place. Owners/users receive Brand Book. Qualified reviewers can also open the exact Brand Book from Done; the portal guard previously bounced that exit to Review desk.

## Research

`docs/brandos/specs/CERTIFY-SIMPLIFY.md` records five patterns from Refero approval/verification flows and the public Mobbin Dropbox Dash sequence. Mobbin is explicitly identified as adjacent completion/context guidance, not proof of backend persistence. Its checked final-state screenshot is in `docs/brandos/specs/certify-simplify-references/`.

## Validation

| Check | Result |
| --- | --- |
| Full `npm test` | **983 passed**, 0 failed, 0 skipped; includes database regressions |
| Full local SQL suite | **101 assertions passed**, 5 files |
| Build with simplify flag off | Pass |
| Build with simplify flag on | Pass |
| Cake Me CD walkthrough | Pass, local v3, 31 persisted human decisions |
| Manual ratings / audit | **0** manual ratings; only C1/C2 recorded; composite null; explicit human approval true |
| UI disclosure/layout checks | All verified captures have zero visible token/path/URL leaks and zero horizontal page overflow |
| en/es/ar | Review, Confirm and Done captured at 1280 and 1440px; Brand Core remains English |
| Owner access | Reviewer job and progress APIs403; browser deep link → Brand Book, no reviewer wizard/action |
| Browser errors | None recorded |
| `git diff --check` | Pass |

Builds retain the existing bundle-size advisory. Regression tests cover a short confirmation with no selects in all three languages, safe font/source/editor output, metadata-valued Done changes, simplified approval with no rating placeholders, and preserved stale-evidence/rights/owner/agent/calibration gates. Durable progress coverage includes refresh, in-flight edits, idempotent retry, conflict recovery, evidence invalidation and closed records.

## Cake Me walkthrough evidence

The walkthrough uses a separate local copy of the saved Cake Me v3 and existing local test identities. The original Cake Me brand remains unchanged. Certification completed with 31 persisted decisions and an empty manual-score object. The append-only audit records `reviewMode: simplified`, `humanApproval: true`, C1/C2 only, and no composite.

Evidence files under `docs/brandos/test-runs/2026-10-15/certify-simplify/`:

- `walkthrough.json`: actual stages and screenshot manifest.
- `final-api-proof.json`: completed/certified v3, durable closed Done, 31 decisions, 0 manual scores and owner403 checks.
- `question-proof.json`: sent question, client answer and cited recommendation.
- `ui-proof.json`: per-screen/locale/width disclosure and overflow checks.
- `role-proof.json`: user redirect, CD access, Brand Book exit and queue behavior.

### Screenshot pairs

| Screen |1280px|1440px|
| --- | --- | --- |
| Review,en |[Review](03-review-en-1280.jpg)|[Review](03-review-en-1440.jpg)|
| Review,es |[Review](03-review-es-1280.jpg)|[Review](03-review-es-1440.jpg)|
| Review,ar |[Review](03-review-ar-1280.jpg)|[Review](03-review-ar-1440.jpg)|
| Confirm,en |[Confirm](06-confirm-en-1280.jpg)|[Confirm](06-confirm-en-1440.jpg)|
| Confirm,es |[Confirm](06-confirm-es-1280.jpg)|[Confirm](06-confirm-es-1440.jpg)|
| Confirm,ar |[Confirm](06-confirm-ar-1280.jpg)|[Confirm](06-confirm-ar-1440.jpg)|
| Done,en |[Done](07-done-en-1280.jpg)|[Done](07-done-en-1440.jpg)|
| Done,es |[Done](07-done-es-1280.jpg)|[Done](07-done-es-1440.jpg)|
| Done,ar |[Done](07-done-ar-1280.jpg)|[Done](07-done-ar-1440.jpg)|
| Stewart strategy |[Stewart](04-stewart-strategy-en-1280.jpg)|[Stewart](04-stewart-strategy-en-1440.jpg)|
| Stewart cited reply |[Reply](05-stewart-cited-reply-en-1280.jpg)|[Reply](05-stewart-cited-reply-en-1440.jpg)|

Additional captures show logo lockups, type labels, the Brand Book exit and owner-only Book routing. Full filenames are in the walkthrough manifest.

## Flags and workspace

`VITE_CERTIFY_SIMPLIFY=0` and `CERTIFY_SIMPLIFY=0` are the committed defaults. Enable both for rollout alongside the existing Certify claim/chat prerequisites. The local ignored environment enables them for review. `AGENCY_OFFICE=0`; frontend office flag is also 0.

All work used `/Users/oscarmottaquintana/Documents/Claudio/CaastorOS`. Web 5197 and API 8797 run from this checkout. The only Supabase stack used is CaastorOS on 54321. No stacks or production writes were created. The included durable-progress migration was already present in this local database; no remote migration was applied. No provider generation calls were needed.

Stewart recommendations are deterministic projections of the current recorded evidence. It drafts review support and questions; only the human approves or certifies.

Pre-existing local work was preserved before switching from main: tracked changes are in stash `76d6af8` (`certify-simplify-preserve-existing-tracked-edits`), and 419 overlapping untracked originals are in `.git/certify-simplify-backup/untracked/` with a manifest. Unrelated untracked files remain outside this change. This pass created and used no additional checkout.
