# Self-correction loop (per task) — demo max 2 fix passes
## State machine
```
QUEUED → GENERATING(pass=0) → VALIDATING_SCHEMA
VALIDATING_SCHEMA --invalid & repairs<1--> REPAIRING_SCHEMA → VALIDATING_SCHEMA
VALIDATING_SCHEMA --invalid & repairs=1--> ESCALATED(reason:schema)
VALIDATING_SCHEMA --valid--> RENDERING (only if task.on_rendered) → DET_CHECKS
DET_CHECKS --hard fail--> decide
DET_CHECKS --no hard fail--> JUDGE_CHECKS
JUDGE_CHECKS --> decide
decide:
  all pass (soft fails allowed, shown as warnings)          → PASSED → HUMAN_GATE
  any check status=escalate (e.g. J-CLAIM-RISK)            → ESCALATED
  fails & pass < max_passes & budget ok & not stuck        → FIXING(pass+1) → VALIDATING_SCHEMA
  fails & (pass = max_passes | budget hit | stuck)         → FLAGGED → HUMAN_GATE (shown with failing checks)
```
## Inputs to a FIXING call
`{previous_output, failing_checks:[{check_id, evidence, location, remediation}], passing_check_ids, contract, message_spec, pass_no}` + prompt suffix: "Fix exactly the failing checks. Do not change content that passed. Return the full output plus changes[] mapping each check_id to what you changed."
Only failing checks + their remediation are sent (not the whole registry). Context slices unchanged.
## Stop rules
1. max_passes reached (demo 2, prod 3).
2. Stuck: same check_id fails with same evidence on two consecutive passes → FLAGGED.
3. Regression: a previously passing hard check fails after a fix → revert to best pass, FLAGGED.
4. Budget: run cost ≥ budget.max_usd or wall time ≥ max_wall_seconds → stop all FIXING, FLAGGED.
5. Escalate-class check → immediate ESCALATED, no auto-fix.
6. Upstream change: if a dependency's owned Message Spec field changes after this task ran, re-queue task at pass 0 (counts against budget, not passes).
## Best-output selection
Keep every pass. Score = (#hard fails ×100) + (#soft fails ×10) − judge mean. Lowest wins if loop ends without full pass.
## Trace (one row per event; table `run_trace`)
`{trace_id, run_plan_id, task_id, agent_id, pass_no, state, model_route, tokens_in, tokens_out, cost_usd, latency_ms, check_results_ref, changes[], ts}`
## Demo choreography (Oct 21)
Use a brief that rehearsal runs show reliably trips a real check (e.g. a word the designer banned in the learning step, or an off-palette colour) → UI shows red check + remediation → pass 1 green. Do not hard-code the failure; if it does not trip live, show the recorded trace in replay mode and say so.

## Cap
The loop runs within a run of ≤3 agents (cap unchanged). Fix passes re-call the same agent; they do not add agents. Follow-up runs start only after every task of the previous run is PASSED/FLAGGED/ESCALATED.
