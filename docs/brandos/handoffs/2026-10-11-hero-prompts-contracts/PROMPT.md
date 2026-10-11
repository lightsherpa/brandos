# Handoff 2026-10-11 · hero-prompts-contracts (Codex/Claude — execute, test, commit today)
**Apply AFTER `2026-10-11-hero-routing`** (stacked). One diff fits both bases: PR #4 `cursor/demo-baseline-c1e1` @2951af5 and `rc/caa-44-rc1` @c4bbc3b, each with the hero-routing slice applied first. Verified 2026-10-11, Node 22.11: `git apply` clean; `npm run test:units` green (PR #4 326/326, rc1 303/303); `npm run build` OK.

## Scope
1. **Specialist prompt overrides** in `window.CI_SPECIALIST_SPECS` (`src/portal-data.js`), consumed at run time by `server/src/lib/compose-specialist-prompt.js` `renderSpecLayer` via the seeded spec payload:
   - NEW `a16` Social Captions — the 10/100 agent. Specific role, platform limits, 2 variants by hook, labelled output, hard rules tied to check ids.
   - NEW `a13` Email Sequence and NEW `a14` Subject Lines.
   - `a12` Conversion Copy and `a37` Headlines: existing overrides kept, `bioSlices` added.
2. **Context contracts → `bioSlices`** per hero agent. The seed now honours `override.bioSlices` before the department default (`scripts/seed-specs.mjs`). Valid slice keys are those in `server/src/lib/bio-schema.js`: audience, forbidden, goals, palette, positioning, strategic, type, voice.
3. **Docs**: copy `docs/brandos/harness/` from this export into the repo: contracts/*.json, check-registry.md/.json, schemas/, run-plan.schema.json, brandolph-planner.md, self-correction-loop.md, correction-to-rule.md, router/.
4. NEW `scripts/test-hero-specs.mjs` (offline check).

Not code-changed here: a02 prompt lives in `sharpener.js`, a18/a24 in `qa-voice.js`/`qa-vision.js`. Their contracts are docs-only in this slice. Runtime check runner, run plan and loop are separate build slices.

## Steps
```bash
git checkout feat/hero-routing            # branch from the routing slice
git apply --check docs/brandos/handoffs/2026-10-11-hero-prompts-contracts/hero-prompts-contracts.diff
git apply docs/brandos/handoffs/2026-10-11-hero-prompts-contracts/hero-prompts-contracts.diff
node scripts/test-hero-specs.mjs    # OK: hero overrides a12 a13 a14 a16 a37 complete; bioSlices valid; seed honours override
node scripts/test-hero-routing.mjs  # still OK
npm run test:units && npm run build
git add -A docs/brandos src scripts && git commit -m "Hero crew prompts + context contracts (a12 a13 a14 a16 a37), harness docs"
```
## Acceptance (test env with keys, after backing up `specs` and seeding only `--only=a12,a13,a14,a16,a37`, see `../SEED-SAFETY.md`; never a full seed)
1. `SELECT payload->'role', payload->'bioSlices' FROM specs WHERE specialist_id='a16'` shows the new role and `["voice","forbidden","audience","positioning"]`.
2. Run the G1 brief (eval-harness §1b) with a16. Output has labelled blocks per platform × 2 variants, IG hook ≤125 chars, no forbidden words or urgency. Voice QA passes.
3. Run the G10 adversarial brief: no "LIMITED TIME", "best", or "tag a friend" in the output.
4. Re-score a16 on the eval rubric (was 10/100). Target ≥70.

## Rollback
`git revert`, then restore the 5 rows from the backup (`../SEED-SAFETY.md` step 4).

## Out of scope
Check-runner code, run plan, loop, learning (later slices). Non-hero prompts (department slices). 3-agent cap unchanged. No model changes (routing slice).

## Finding for later
The seed's Visual and Motion department default asks for slice `"imagery"`, which does not exist in bio-schema.js, so it is silently ignored. Fix it in the Visual slice.
