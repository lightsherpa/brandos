# Prompt: hero crew model upgrade. Apply, commit, test.

Branch: create `feat/hero-models` from `cursor/demo-baseline-c1e1` (PR #4). If PR #4 is already merged into rc, branch from `rc/caa-44-rc1` and use the `.rc1.diff` instead.

1. `git fetch origin && git checkout -b feat/hero-models origin/cursor/demo-baseline-c1e1`
2. `git apply /Users/oscarmottaquintana/Documents/Claudio/CaastorOS/docs/brandos/handoffs/2026-10-11-hero-models/routing-change-hero.pr4.diff`, then copy the `docs/brandos/` folder into this branch and commit it too, so the docs live in the repo.
3. Check that exactly these routes changed:
   | Agent | From | To | Fallback |
   |---|---|---|---|
   | Sharpener (sharpener.js + a02) | claude-sonnet-4-6 | anthropic/claude-sonnet-5-5 | claude-sonnet-4-6 |
   | a16 Social Captions | claude-sonnet-4-6 | anthropic/claude-sonnet-5-5 | claude-sonnet-4-6 |
   | a13 Email Sequence | claude-sonnet-4-6 | anthropic/claude-sonnet-5-5 | claude-sonnet-4-6 |
   | a12 Conversion Copy | claude-sonnet-4-6 | anthropic/claude-sonnet-5-5 | claude-sonnet-4-6 |
   | a37 Headlines | gemini-2.5-pro | anthropic/claude-sonnet-5-5 | claude-sonnet-4-6 |
   | a14 Subject Lines | gemini-2.5-flash | openrouter/google/gemini-3.8-flash | gemini-2.5-flash |
   | a18 Voice QA + qa-voice.js | haiku-4-5 / gemini-2.5-flash | anthropic/claude-haiku-5-5 | previous model |
   | a24 Vision QA + qa-vision.js | gemini-2.5-flash | openrouter/google/gemini-3.8-flash | gemini-2.5-flash |
   No other agents change. Keep `.slice(0,3)`. Image models are unchanged.
4. Router fallback (in the diff): switch to the fallback only before the first token, on 429/5xx/404/timeout or no first token within 20s. Never on 400 or auth errors. One hop only. Record `usage.fallback_from`.
5. Add unit tests:
   - router: 529 falls back; first-token timeout falls back; 400 doesn't; success stays on the primary; with no fallback set, nothing changes.
   - seed: the 8 hero rows have a fallback, and every other row has `fallback === null` and an unchanged primary.
6. Run `node --check` on the changed server files, then `npm run build` and `npm run test:units`. All must pass.
7. Commit (`feat(models): hero crew on Sonnet 5.5 / Haiku 5.5 / Gemini 3.8 Flash with fallback`) and push.
8. **Database. Don't run the full seed.** It overwrites the ~22 cost-saving model settings in the live DB. Update only the 8 hero ids (`--only a02,a12,a13,a14,a16,a18,a24,a37`; add that flag if missing), after `SELECT specialist_id, payload->'modelRouting' FROM specs` as a backup.
9. Smoke test locally with real keys:
   - one hero brief end to end; ≤3 agents run; the hero agents aren't filtered out.
   - `MODEL_FIRST_TOKEN_TIMEOUT_MS=1` shows `fallback_from` in usage.
10. Report: test output, a sample output per agent, and the cost per run before and after.
