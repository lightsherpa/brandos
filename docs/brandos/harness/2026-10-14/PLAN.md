# BrandOS VDS harness plan — 14 October 2026

Base: `test/vds-integration` at `48ab4e2`. Freeze 16 October, demo 21 October. Integration evidence is read before dispatch. Work uses isolated feature worktrees; no production DB, seeds, dev/main pushes, or machine certification. Only human actors certify. All failure gates remain closed.

## Workstreams and exclusive file ownership

| Stream / specialist | Branch | Owned files | Acceptance | Dependencies |
|---|---|---|---|---|
| S-A / reference_intake | fix/vds-reference-intake | server/src/routes/bios.js; server/src/harness/task-context.js; server/src/lib/load-brand-bio.js; src/brand-foundation.jsx; new reference-intake helpers/tests; migration 20261014000000 and corresponding SQL tests | New rights-confirmed canonical sources append v3, retain/supersede old refs, exact-version job once; generation provenance scoped to version | base |
| S-B / image_export | fix/vds-image-export | server/src/harness/{brand-core,images,render,pipeline}.js; server/src/lib/models/fal-image.js; server/src/index.js (PNG route registration only); new server/src/routes/task-export.js/test; server/src/lib/visual-assets.js and visual-assets.test.mjs; new reference bridge/export helpers/tests; scripts/image-* | Reachable reference bytes, reference_count >0, no generated text, licensed font and stable logo embedded, saved PNG | A interface |
| S-C / reviewer_durability | fix/vds-reviewer-durability | server/src/harness/reviewer.js; server/src/harness/harness.test.mjs (strict reviewer fixtures); server/src/routes/tasks.js; new reviewer/recovery helpers/tests | items schema, one bounded repair then fail closed; completed tasks reconstructed with tenant authorization after restart | A context / B output |
| S-D / canvas_library | fix/vds-canvas-library | src/portal-briefs.jsx; src/task-pipeline.jsx; src/agency-office.jsx; src/portal-shell.jsx; src/portal-brandolph.jsx; src/lib/office-model.js; src/brief-workspace-surface.jsx; new src/lib/task-output/status helpers/tests | Truthful status, cards per task item, HTML/PNG exports, latest rerun, craft errors, continue assembly, mocks removed from nav; real screenshots | A → B → C |
| S-E / discovery_extraction | fix/vds-discovery-extraction (base fix/discovery-quality) | server/src/lib/{extract-logo,discovered-logo,discovery-visuals,discovery-styles,discovery-computed-styles,colour-roles,extract-visual-deterministic}.js; new extraction tests/real markup fixtures; scripts/discovery-* | Real-site fixture, non-ico >=64px logo, evidence-backed primary colour, honest score and gate | separate base |

All existing files outside these sets require ownership amendment before editing. No two specialists edit one file. Each specialist writes tests first, commits its owned files, and reports commit, tests, evidence, and open risks. Full test:units and build required per returned branch; root registers new tests at merge time.

## Shared files and migrations

Orchestrator exclusively owns package.json (test registration), i18n, MIGRATIONS.md, harness plan/gate/lessons and final rehearsal report. Orchestrator writes no feature code. S-A reserves migration `20261014000000`; S-B/C/D/E need no migration, with unused reservations `20261014010000` / `20261014020000` / `20261014030000` / `20261014040000` if justified before edits. Production migration handoff stays reviewable; only local applications authorized.

## Scheduling and gates

Three specialists can run beside the orchestrator (four total runtime slots). Start A/B/C; start D/E as slots release. Merge A → B → C → D only after each passes applicable gates; E separately into its own feature branch. Gate results distinguish automated engineering PASS from unverified live brand fidelity; missing rights/new inputs/human decisions are BLOCKED, never fabricated PASS. A failure returns to same specialist with exact failure, at most two repair rounds.

Per result record: (1) test:units + build; (2) certified Cake Me brand fidelity/new refs/no fabricated claims/no generated text; (3) truthful status; (4) fail closed/no secrets/no prod/human-only; (5) cost and elapsed seconds, flag >$0.30 or >120s. Offline tests are not paid runs and live evidence must be stated separately.

## Rehearsal

Save current-session evidence in docs/brandos/test-runs/2026-10-15 (requested folder; date remains honest: execution is 14 October). Verify local endpoints before any mutations. Check new sources and rights, append v3, S2 assistant and client question, await actual human rights/approval as required, generate social + three emails only from eligible v3, Library/Canvas screenshots and exports, restart recovery. Discovery live rerun on separate branch. Log all blocked steps and cost/time, never claim old references are new. Feature branch pushes only.

## User steering

Oscar confirmed the actual user must upload the new photos through the product UX, and the CD must certify. No scripted upload/rights/certification substitutes are authorized. Live v3 rehearsal stays pending those human actions; engineering tests and existing-v2 bridge/export checks proceed with honest labels. S-B exclusively owns pipeline.js (async rendering/provenance integration), coordinated with C task envelope.

## Crash recovery

Codex restarted mid-work. Uncommitted A/B/C files survived in their isolated worktrees; original specialists resumed without resets. C final pre-crash test log confirmed 717/717 pass. C committed 32b717e. D dispatched after C freed its slot. Local API/Vite stopped with crash and will be restarted after gate checks; no DB reset.

## Authorized additional S-D repair

Oscar explicitly authorized one extra focused repair round after the two-round escalation. Same specialist and branch retain ownership. Scope: Agency Office shelf mapping of needs_review/failed/approved, behavioral regression tests, browser verification on actual saved Cake Me outputs; merge only after PASS. No new paid calls, rights, uploads or certification required.
