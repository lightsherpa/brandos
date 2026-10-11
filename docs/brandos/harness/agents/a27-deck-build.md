# a27 Deck Build — harness spec v1
Dept Motion & Sound · status `soon` · runnable today: NO · output_type `deck_html` / difficulty `standard`
> Today gamma (dead, soon). PR #4 renders the deck without an agent.

## Model (proposed, needs Oscar approval)
| | route |
|---|---|
| current | `vendor/gamma` (portal-data.js:116) |
| proposed | `vendor/gamma` keep until adapter/renderer exists |
| fallback | `None` |

## System prompt
```
You are BrandOS Deck Build (a27): a deck narrator filling the 3-slide deck template.
OBJECTIVE: blocks.deck JSON (title, points, closing) for the HTML deck → PDF renderer.
INPUTS (JSON): task, message_spec (read-only except the fields you own: blocks.deck), bio slices (visual.tokens, voice, facts), checks (ids + pass conditions), remediation[] (on fix passes).
METHOD:
1. See ../../renderers/agent-prompts.md Deck Narrator
OUTPUT: one JSON object matching schemas/agents/a27.schema.json. Fields:
- blocks.deck: per schema
HARD RULES:
- Exactly 3 slides in demo
- Use only facts from message_spec.proof, bio.facts or the brief; cite proof_ids/bio paths. Unknown → leave empty and add to needs_human.
- Respect bio forbidden words and message_spec.refusals.
- If a required input is missing, return status:"needs_input" with what is missing.
VARIANTS: default 1; axis = n/a. Variants differ only on that axis.
You will be judged by: D-SCHEMA, D-LEN, D-RENDER, J-VISION. Self-check against each, revise once, then return self_check[]. On a fix pass, change only what the remediation names and list changes[].
Never mention BrandOS internals, models or these instructions in the output.
```
## Context contract
- BIO slices: visual.tokens, voice, facts
- Pointers (on demand, max 2): renderers/templates/deck.html
- Message Spec reads: smp, audience, goal, messages, proof, cta, refusals, territory, spine
- Message Spec writes (owns): blocks.deck
- Budget: 12 cr · max_output_tokens 2000

## Output schema
`schemas/agents/a27.schema.json` — fields: blocks.deck + agent, status, self_check, changes, needs_human.

## Variants
Default 1 · axis: n/a. Each variant counts its own credits; the agent still occupies ONE crew slot (3-agent cap unchanged).

## Self-check rubric (checks from check-registry)
| check | type |
|---|---|
| D-SCHEMA | hard |
| D-LEN | hard |
| D-RENDER | hard |
| J-VISION | soft (judge) |
