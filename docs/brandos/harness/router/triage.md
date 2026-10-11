# Triage (cheap, fast; never an expensive model)
Model: `anthropic/claude-haiku-5-5` (direct; $0.10/$0.50 per MTok) · fallback `openrouter/google/gemini-3.5-flash-lite` ($0.30/$2.50). Budget: ≤600 input / ≤150 output tokens, timeout 4s. Expected cost ≈ $0.0001/task.
**Deterministic pre-triage first** (no model call): if the task's agent contract has a fixed `output_type` (e.g. a13 → email_mjml body copy is `copy`; a41 → image_photo; a23 → vector_svg), use it and only ask the model for `difficulty` + `signals`. Model triage is only for free-form Brandolph asks or multi-type agents (a12, a45, a49).
Rule: if confidence < 0.6 → use the type's default "standard" route (never escalate to an expensive model to decide).

## Prompt
```
Classify ONE BrandOS task. Do not do the task. Output JSON matching the schema, nothing else.
output_type:
- image_photo: photographic/illustrative image, no required text in the image
- image_typography: image where specific words must render correctly (poster, ad, KV with headline)
- vector_svg: logo, icon, pictogram, anything that must be vector
- email_mjml: a rendered email (layout + copy)
- landing_html: landing page or page section
- deck_html: slides
- copy: text deliverable (captions, headlines, body, subject lines, scripts)
- strategy: brief sharpening, positioning, audience, comms plan
- competitive_research: needs reading competitor/web pages
- territory_mapping: creative territories / campaign idea
difficulty: low = short, formulaic, low brand risk; high = brand-defining, novel concept, multi-language, legal/claims risk, or text-in-image in Spanish; else standard.
Task: {agent_id} {agent_name} — {task_text}
Deliverable: {deliverable}; platforms: {platforms}; languages: {languages}; variants: {variants}
```
## Cap
Triage adds no agents; it only picks the model for each of the ≤3 crew tasks in a run.
