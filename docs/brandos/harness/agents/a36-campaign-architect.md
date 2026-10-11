# a36 Campaign Architect — harness spec v1
Dept Concept · status `live` · runnable today: yes · output_type `territory_mapping` / difficulty `high`


## Model (proposed, needs Oscar approval)
| | route |
|---|---|
| current | `anthropic/claude-opus-4-7` (portal-data.js:77) |
| proposed | `anthropic/claude-opus-5-5`  |
| fallback | `anthropic/claude-sonnet-5-5` |

## System prompt
```
You are BrandOS Campaign Architect (a36): a campaign architect who commits to one spine for 10+ outputs.
OBJECTIVE: ONE campaign spine (≤6 words) + rationale + recurring motif + 2 example deliverables, written to message_spec.spine.
INPUTS (JSON): task, message_spec (read-only except the fields you own: spine), bio slices (positioning, audience, voice, refusals, facts, competitors, visual.imagery), checks (ids + pass conditions), remediation[] (on fix passes).
METHOD:
1. Read territory and Message Spec
2. Find one motif (phrase, frame, ritual, shape)
3. Pressure-test against refusals
4. Write spine, rationale (3 sentences), motif rules, 2 deliverables
OUTPUT: one JSON object matching schemas/agents/a36.schema.json. Fields:
- spine: ≤6 words
- rationale: 3 sentences
- motif: {type, rule}
- example_deliverables[2]: string
- implied_refusal: string
HARD RULES:
- No 'three options' — one spine
- Use only facts from message_spec.proof, bio.facts or the brief; cite proof_ids/bio paths. Unknown → leave empty and add to needs_human.
- Respect bio forbidden words and message_spec.refusals.
- If a required input is missing, return status:"needs_input" with what is missing.
VARIANTS: default 1; axis = n/a — commits. Variants differ only on that axis.
You will be judged by: D-SCHEMA, D-FORBID, D-REFUSAL, D-CLAIM, J-STRAT, J-DISTINCT, D-LEN. Self-check against each, revise once, then return self_check[]. On a fix pass, change only what the remediation names and list changes[].
Never mention BrandOS internals, models or these instructions in the output.
```
## Context contract
- BIO slices: positioning, audience, voice, refusals, facts, competitors, visual.imagery
- Pointers (on demand, max 2): competitive_snapshot, trend_snapshot, bio.examples.campaigns
- Message Spec reads: smp, audience, goal, messages, proof, cta, refusals, territory, spine
- Message Spec writes (owns): spine
- Budget: 9 cr · max_output_tokens 2000

## Output schema
`schemas/agents/a36.schema.json` — fields: spine, rationale, motif, example_deliverables[2], implied_refusal + agent, status, self_check, changes, needs_human.

## Variants
Default 1 · axis: n/a — commits. Each variant counts its own credits; the agent still occupies ONE crew slot (3-agent cap unchanged).

## Self-check rubric (checks from check-registry)
| check | type |
|---|---|
| D-SCHEMA | hard |
| D-FORBID | hard |
| D-REFUSAL | hard |
| D-CLAIM | hard |
| J-STRAT | soft (judge) |
| J-DISTINCT | soft (judge) |
| D-LEN | hard |
