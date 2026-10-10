# MVP client trial protocol

Status: prepared; no client measurements or paid provider run yet. Client, real brief and spending ceiling remain pending.

## Eligibility and approvals

Identify the client and approved brief, workspace owner, BIO certifier, deliverable reviewer, trial operator, API spend ceiling and stop criteria. Confirm which data may be sent to each processor, applicable hosting/residency requirements and retention controls. Do not move infrastructure or claim GDPR compliance from local tests. Minimize the trial inputs; avoid personal data and unapproved client secrets. Synthetic local fixtures are not client approval or human BIO certification.

Enable only reviewed provider routes with credentials, rate cards, exact settings, model-version evidence and conservative max-cost bounds. Workspace hard per-request/monthly ceilings include routing, generation and QA. JEV remains shadow; active requires >=100 measured accepted labels, >=95% agreement, zero hard-constraint failures, >=0.90 confidence and explicit human review. Mock cases do not satisfy that gate.

## Trial sequence

1. Record the existing/manual workflow baseline: brief to accepted deliverable, revisions, errors, accepted outputs, elapsed human time and known spend.
2. Certify the real BIO through the steward workflow and pin BIO/spec/model/settings versions.
3. Create the real brief and canvas. Generate approved text, review and select output, then create image work. Approve a stored image before using it as an edit/video reference.
4. Review QA and request changes/approve through actual roles. Preserve rejected versions. Video requires human review.
5. Test HTML email preview and export if in the brief; verify actual email clients and durable approved public asset URLs before external sharing. There is no campaign sending.
6. Verify restart/reconnect, storage retrieval and exactly-once credit settlement. Reconcile uncertain billable submissions; do not automatically resubmit.
7. Compare with JEV shadow recommendations on the same input class and constraints. Shadow is still paid classification and requires its own allowance.

## Measurements

Each reviewed record includes cohort (baseline/shadow), brief ID, run ID, modality, model/version/gateway, settings, cache mode, routing result/confidence, QA outcome, human acceptance, revisions, failed attempts, latency, time to accepted output, and total cost including routing/QA/retries. Report unknown cost as unknown and distinguish provider reported, rate-card estimate and reconciled charges. Never infer acceptance from provider success.

Use scripts/bench-creative.mjs --results=<reviewed JSON> for grouped summaries. It reports acceptance, revisions, failures, p95 latency, median/p95 time to accepted output and cost per accepted output. Model versions/settings/gateways/cache modes/cohorts stay separate. Do not claim causal savings from unmatched trials. Fixture-only runs produce no live quality or savings results.

## Acceptance report

Record completed deliverables and evidence, quality issues and revisions, actual cost versus ceiling, credit-ledger reconciliation, observed recovery failures, reviewer sign-off and decision to continue/stop. Include data-handling exceptions. Do not activate JEV from this small MVP trial alone.

Before the trial, qualify each staged text endpoint/provider with full-context input rates including cache/long-context premiums, hard output/reasoning limits and every fee. Local synthetic qualifications are test evidence only. Test the shared text/media ceiling and reconcile generation/QA/routing invoices through the protected operator flow. Stop on unresolved or over-bound charges; preserve the original invoice and amendment evidence. Other legacy text paths are not covered by the shared staged execution ledger.
