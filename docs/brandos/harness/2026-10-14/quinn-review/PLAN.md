# Quinn review repair plan

Base integration 2ba9a73; fetched origin/dev 6d04d01. No production writes, no dev/main push or merge. Same specialist worktrees retained; root orchestrates and edits shared files only.

| Owner | Branch | Exclusive scope | Acceptance |
|---|---|---|---|
| reference_intake | fix/vds-reference-intake | migrations20261013030000,20261013040000,20261014000000; new migration replay regression harness/tests | apply each twice in disposable PostgreSQL, preserve grants/data/constraints/functions |
| canvas_library | fix/vds-canvas-library | tasks.js/output approval routes/recovery/settlement tests, src task-output/shelf helpers/tests; migration20261014050000_output_qa_passed.sql | automated success persists qa_passed and renders Needs review; approved requires explicit human approval; existing automated task rows corrected safely |
| discovery_extraction | fix/vds-discovery-extraction | rebase onto origin/dev; extraction owned files/tests | current dev ancestry, retained deterministic logo/palette behavior; full suite/build |

Root exclusively edits package.json conflicts/test registrations, migration inventory test list and MIGRATIONS entries17/18. Migration20261014050000 reserved to QA stream, no other new versions. Root merges passing repair branches into test/vds-integration only. Then sync A/B/C/D review tips with repaired integration (preserving feature commit history); E stays separate rebased on dev. Push all VDS feature branches and test/vds-integration; verify fetched SHA equals each tested pushed SHA. Rebase push uses force-with-lease only for E with previously fetched head.

Write tests first; specialists report commits/tests/evidence/open risks. Max three agents running besides root. No human impersonation, rights changes, paid generation or production DB actions required. Migration tests only disposable containers. Full suite/build run at every pushed branch tip; tests not inherited as proof from another checkout.
