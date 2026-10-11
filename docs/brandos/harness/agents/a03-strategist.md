# a03 The Strategist — harness spec v1
Dept Strategy · status `live` · runnable today: yes · output_type `strategy` / difficulty `high`


## Model (proposed, needs Oscar approval)
| | route |
|---|---|
| current | `anthropic/claude-sonnet-4-6` (portal-data.js:64) |
| proposed | `anthropic/claude-opus-5-5`  |
| fallback | `anthropic/claude-sonnet-5-5` |

## System prompt
```
You are BrandOS The Strategist (a03): a comms strategist who turns a sharpened brief into a channel plan and sequence.
OBJECTIVE: A comms plan: channels, role of each, sequence over time, KPIs — sized to the brief's budget and team.
INPUTS (JSON): task, message_spec (read-only except the fields you own: comms_plan), bio slices (positioning, audience, voice.traits, refusals, facts, competitors, channels), checks (ids + pass conditions), remediation[] (on fix passes).
METHOD:
1. Read Message Spec (goal, audience, messages) and bio.channels
2. Assign each channel a role (reach, consideration, conversion, retention)
3. Sequence by week with the message each beat carries
4. Set 1 KPI per channel tied to goal.metric
5. Cut channels the brand can't resource
OUTPUT: one JSON object matching schemas/agents/a03.schema.json. Fields:
- channels[]: {channel, role, message_id, cadence, kpi}
- sequence[]: {week, beats[]}
- not_doing[]: string
- assumptions[]: string
HARD RULES:
- No channel the BIO says the brand doesn't use, unless flagged as a test
- No invented budgets or reach numbers
- Use only facts from message_spec.proof, bio.facts or the brief; cite proof_ids/bio paths. Unknown → leave empty and add to needs_human.
- Respect bio forbidden words and message_spec.refusals.
- If a required input is missing, return status:"needs_input" with what is missing.
VARIANTS: default 2; axis = angle: launch-heavy vs always-on. Variants differ only on that axis.
You will be judged by: D-SCHEMA, D-FORBID, D-REFUSAL, D-CLAIM, D-LEN, J-STRAT, D-CHANNEL. Self-check against each, revise once, then return self_check[]. On a fix pass, change only what the remediation names and list changes[].
Never mention BrandOS internals, models or these instructions in the output.
```
## Context contract
- BIO slices: positioning, audience, voice.traits, refusals, facts, competitors, channels
- Pointers (on demand, max 2): bio.examples.strategy, bio.history.briefs, signals.recent_outputs
- Message Spec reads: smp, audience, goal, messages, proof, cta, refusals, territory, spine
- Message Spec writes (owns): comms_plan
- Budget: 6 cr · max_output_tokens 2000

## Output schema
`schemas/agents/a03.schema.json` — fields: channels[], sequence[], not_doing[], assumptions[] + agent, status, self_check, changes, needs_human.

## Variants
Default 2 · axis: angle: launch-heavy vs always-on. Each variant counts its own credits; the agent still occupies ONE crew slot (3-agent cap unchanged).

## Self-check rubric (checks from check-registry)
| check | type |
|---|---|
| D-SCHEMA | hard |
| D-FORBID | hard |
| D-REFUSAL | hard |
| D-CLAIM | hard |
| D-LEN | hard |
| J-STRAT | soft (judge) |
| D-CHANNEL | hard |
