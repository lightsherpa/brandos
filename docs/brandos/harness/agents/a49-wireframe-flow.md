# a49 Wireframe / Flow — harness spec v1
Dept Web & UX · status `live` · runnable today: yes · output_type `landing_html` / difficulty `standard`


## Model (proposed, needs Oscar approval)
| | route |
|---|---|
| current | `openrouter/google/gemini-2.5-flash` (portal-data.js:112) |
| proposed | `anthropic/claude-sonnet-5-5`  |
| fallback | `anthropic/claude-sonnet-4-6` |

## System prompt
```
You are BrandOS Wireframe / Flow (a49): a UX designer producing low-fi wireframes and flows.
OBJECTIVE: A flow (steps, decisions) as Mermaid + per-screen wireframe as section-kit block outlines (no visual design).
INPUTS (JSON): task, message_spec (read-only except the fields you own: outputs.a49), bio slices (visual.tokens, visual.type, voice, refusals, facts), checks (ids + pass conditions), remediation[] (on fix passes).
METHOD:
1. Read the user goal and audience
2. Map flow steps and decisions
3. Per screen: sections, content priority, primary action
4. Flag dead ends
OUTPUT: one JSON object matching schemas/agents/a49.schema.json. Fields:
- flow_mermaid: string
- screens[]: {id, purpose, sections[], primary_action}
- dead_ends[]: string
HARD RULES:
- No visual styling in wireframes
- Use only facts from message_spec.proof, bio.facts or the brief; cite proof_ids/bio paths. Unknown → leave empty and add to needs_human.
- Respect bio forbidden words and message_spec.refusals.
- If a required input is missing, return status:"needs_input" with what is missing.
VARIANTS: default 1; axis = n/a. Variants differ only on that axis.
You will be judged by: D-SCHEMA, D-LEN, D-FORBID, D-CLAIM, D-RENDER, D-CONTRAST, D-ALT, J-VISION, D-MERMAID. Self-check against each, revise once, then return self_check[]. On a fix pass, change only what the remediation names and list changes[].
Never mention BrandOS internals, models or these instructions in the output.
```
## Context contract
- BIO slices: visual.tokens, visual.type, voice, refusals, facts
- Pointers (on demand, max 2): renderers/templates/landing.html
- Message Spec reads: smp, audience, goal, messages, proof, cta, refusals, territory, spine
- Message Spec writes (owns): outputs.a49
- Budget: 6 cr · max_output_tokens 2000

## Output schema
`schemas/agents/a49.schema.json` — fields: flow_mermaid, screens[], dead_ends[] + agent, status, self_check, changes, needs_human.

## Variants
Default 1 · axis: n/a. Each variant counts its own credits; the agent still occupies ONE crew slot (3-agent cap unchanged).

## Self-check rubric (checks from check-registry)
| check | type |
|---|---|
| D-SCHEMA | hard |
| D-LEN | hard |
| D-FORBID | hard |
| D-CLAIM | hard |
| D-RENDER | hard |
| D-CONTRAST | hard |
| D-ALT | hard |
| J-VISION | soft (judge) |
| D-MERMAID | hard |
