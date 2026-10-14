# Quinn review repairs

No production/shared database changes, paid calls, dev/main writes or pushes. All schema verification runs in disposable PostgreSQL.

## Migration replay

Commit279800d updates20261013030000,20261013040000 and20261014000000: IF NOT EXISTS tables/indexes, CREATE OR REPLACE functions, DROP CONSTRAINT IF EXISTS, DROP TRIGGER IF EXISTS before recreation. Explicit revocation of inherited service-role write/delete grants keeps audit tables append-only. Five regression tests replay all three migrations twice and preserve existing rows/budget/leases/audits while testing grants/constraints/function behavior.

MIGRATIONS entry17 for reference_intake is present in all synchronized VDS integration branches; its deployment command keeps schema and tracking insertion in one transaction. Added entry18 for the new qa_passed output constraint/data correction and updated the explicit migration inventory test.

## QA vs human approval

Commit6873f7b changes both taskOutput and rerunOutput to persist qa_passed when automated checks pass, retaining the qa_passed boolean as evidence. qa_passed and machine-ready render Needs review. Approved requires explicit human internal/client approval with assertHumanActor, permissions and separation-of-duty checks. Recovery and Library inspect real workflow reviewer metadata, so old QA-approved rows cannot masquerade as human approval; a newer rerun clears the prior approval. The serialized task envelope survives a human changes request.

Migration20261014050000_output_qa_passed.sql adds the state and corrects old machine approvals without changing recorded human decisions. It is idempotent and has no inner transaction wrapper. Deploy it before code that writes qa_passed; it has not been applied to an existing local or production database in this repair task. One disposable PostgreSQL test applies it twice and proves data preservation/constraint behavior. HTTP and actual rendered React shelf regression tests prove QA is never Approved.

## Discovery rebase

fix/vds-discovery-extraction rebased onto fetched origin/dev6d04d01. package.json conflicts resolved as a union preserving all current dev tests plus discovery tests. Only import unions were needed in bios/discovery-session; existing human guards remain. Idempotent20261013030000 copied from the reviewed migration patch; no unrelated VDS migrations added. Rebased tip7344f9d passes687 tests and build; dev remains its ancestor. Push uses an explicit lease against prior remote d75190d, never overwriting an unseen remote update.

## Verification and pushed branches

Pre-push integration:793 units, build and diff checks PASS. Schema suites:5 migration-replay +1 output-status DB test PASS. A/B/C/D review branches are synchronized with repaired integration so Quinn reviews current QA/schema behavior on every tip. E remains separate. Push integration and all five feature branches only, then run full test:units and build from each exact pushed SHA and verify remote/local SHA equality. Post-push logs/verification JSON are local ignored work artifacts; final user report provides the exact SHA/count/build for every pushed branch.
