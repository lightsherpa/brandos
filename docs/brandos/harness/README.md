# BrandOS harness — spec pack (Ada, v0.1, 2026-10-11)
Source: /workspace/brandos/brandos-harness.md + OpenAI "Harness engineering" (Feb 11, 2026): map not manual, plans as artifacts, mechanical invariants with remediation text, loops until reviewers pass, human taste encoded once.
Buildable by Claude/Codex for the hero crew before the **Oct 16 freeze**. Proposal only — no repo changes; everything needing a route/roster/model change needs Oscar's approval.

## Index
| File | What |
|---|---|
| context-contracts-hero.md | Full contracts for Sharpener a02, Social Captions a16, Social Post Designer a41, Email Sequence a13, Subject Lines a14, Conversion Copy a12, Headlines a37, QA (a18+a24) |
| context-contracts-all55.md + contracts/aNN.json | All 55: BIO slices, pointers, spec writes, schema, checks, budget |
| schemas/*.schema.json | Output schemas (hero-specific + department envelopes + check_result) |
| check-registry.md / .json | 27 deterministic + 7 judge checks: id, applies-to, severity, pass condition, remediation |
| run-plan.schema.json | Run Plan (goal, message spec, crew, DAG, checks, budget, loop) |
| brandolph-planner.md | Planner system prompt + full example plan (G1) |
| routing-change-hero.md + .diff / .pr4.diff / .rc1.diff | Approved hero-crew model upgrade with fallbacks (apply-ready) |
| router/ | Self-updating model router design (post-hero) |
| self-correction-loop.md | State machine, fix-call inputs, stop rules, trace |
| correction-to-rule.md | correction + candidate_rule schemas, Rule Miner prompt, validation, promotion |
| ../renderers/message-spec.schema.json | Message Spec v0 (shared) |
| ../agents/social-captions.md | Full a16 prompt |

## Build order (for Claude/Codex; on top of PR #4 `cursor/demo-baseline-c1e1`)
1. **Sun–Mon:** load contracts/*.json + schemas into server (`server/src/harness/contracts/`); context assembler: BIO slice resolver by path → agent input. Unit test: a16 gets only its slices.
2. **Mon:** check runner — deterministic demo-critical set (D-SCHEMA, D-LEN(-PLATFORM), D-FORBID, D-URGENCY, D-SUPERLATIVE, D-CLAIM, D-ALT, D-RENDER, D-CONTRAST, D-PALETTE) with remediation templating; returns check_result.
3. **Tue:** Run Plan: Brandolph planner call + schema validation + DAG executor. **The 3-agent cap stays** (`.slice(0,3)` in portal-brandolph.jsx is NOT removed — Oscar, 2026-10-11): planner emits ≤3 agents per run (Sharpener pre-step not counted) and puts extra deliverables in `followup_runs` executed sequentially; plan visible in UI.
4. **Tue:** loop (self-correction-loop.md) + `run_trace` table.
5. **Wed:** judges J-VOICE (Haiku 5.5), J-VISION (Gemini 3.8 Flash) on rendered screenshots (needs headless Chrome server-side — PR #4 uses browser print only).
6. **Wed:** correction-to-rule: correction capture on canvas, Rule Miner, replay validation, approve → bio.rules → D-FORBID compile.
7. **Thu:** hero prompts locked; blind test; rehearsal; replay mode.
Cut line if late: 5 and the FP-scan part of 6.

## PR #4 status (read 2026-10-11 00:30 CEST)
Draft, open, mergeable, 12 commits, 114 files, head `cursor/demo-baseline-c1e1` → `main`. Token budget now `cr_estimate*100` clamped **2000–8000** (fixes fix-list F9), per-spec `max_output_tokens`. Format preview (email/landing/3-slide deck from one message spec, deterministic brand-check badges) behind `FORMAT_PREVIEW` + `VITE_FORMAT_PREVIEW`. Paid-route rate limits. CI on Node 22.
**Social Captions re-score: NOT run.** Needed: (1) a checkout of the PR branch on the box (box copy has no git; no push needed, just `git clone` + checkout — read-only), (2) `ANTHROPIC_API_KEY` (or OpenRouter key) and Supabase URL/service key for a certified demo BIO — none present in box env, (3) Node 22. Then run G1 + G10 via `/api/runs/stream` for a16 with arm A prompt vs new prompt, score with eval-harness rubric.
