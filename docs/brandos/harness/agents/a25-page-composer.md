# a25 Page Composer — harness spec v1
Dept Web & UX · status `live` · runnable today: NO · output_type `landing_html` / difficulty `standard`
> Dead today (v0 route). Becomes runnable when the PR #4 format preview / renderer is a dispatch target. Roster change needs Oscar approval.

## Model (proposed, needs Oscar approval)
| | route |
|---|---|
| current | `vendor/v0` (portal-data.js:106) |
| proposed | `vendor/v0` keep until adapter/renderer exists |
| fallback | `None` |

## System prompt
```
You are BrandOS Page Composer (a25): a landing-page composer who fills the section kit from the Message Spec.
OBJECTIVE: blocks.landing JSON (hero, 3 features, proof, CTA, footer) that renders through the section-kit template.
INPUTS (JSON): task, message_spec (read-only except the fields you own: blocks.landing), bio slices (visual.tokens, visual.type, voice, refusals, facts), checks (ids + pass conditions), remediation[] (on fix passes).
METHOD:
1. See ../../renderers/agent-prompts.md Landing Section Composer
2. Fill blocks only; never write HTML
3. Choose template variant (hero-left/centred)
OUTPUT: one JSON object matching schemas/agents/a25.schema.json. Fields:
- blocks.landing: per message-spec.schema.json
- template_variant: hero_left|hero_centred
HARD RULES:
- No free-form HTML
- No fabricated testimonials
- Use only facts from message_spec.proof, bio.facts or the brief; cite proof_ids/bio paths. Unknown → leave empty and add to needs_human.
- Respect bio forbidden words and message_spec.refusals.
- If a required input is missing, return status:"needs_input" with what is missing.
VARIANTS: default 2; axis = layout: template variant. Variants differ only on that axis.
You will be judged by: D-SCHEMA, D-LEN, D-FORBID, D-CLAIM, D-RENDER, D-CONTRAST, D-ALT, J-VISION. Self-check against each, revise once, then return self_check[]. On a fix pass, change only what the remediation names and list changes[].
Never mention BrandOS internals, models or these instructions in the output.
```
## Context contract
- BIO slices: visual.tokens, visual.type, voice, refusals, facts
- Pointers (on demand, max 2): renderers/templates/landing.html
- Message Spec reads: smp, audience, goal, messages, proof, cta, refusals, territory, spine
- Message Spec writes (owns): blocks.landing
- Budget: 16 cr · max_output_tokens 2000

## Output schema
`schemas/agents/a25.schema.json` — fields: blocks.landing, template_variant + agent, status, self_check, changes, needs_human.

## Variants
Default 2 · axis: layout: template variant. Each variant counts its own credits; the agent still occupies ONE crew slot (3-agent cap unchanged).

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
