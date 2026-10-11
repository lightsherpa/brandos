# Type → model routes (proposal; live ids checked 2026-10-11 ~00:40 CEST)
Prices: OpenRouter /api/v1/models (per MTok in/out) and fal model pages / fal.ai/pricing. Direct Anthropic ids use dashes. **Only the hero-crew rows already approved are active; everything else is a proposal for the self-update process to validate.**

| output_type | difficulty | Primary | Fallback | Judge/check model | Notes |
|---|---|---|---|---|---|
| copy | low | `openrouter/google/gemini-3.8-flash` ($0.75/$3.75) | `openrouter/google/gemini-2.5-flash` | Haiku 5.5 (J-VOICE) | subject lines, microcopy |
| copy | standard/high | `anthropic/claude-sonnet-5-5` ($2/$10) | `anthropic/claude-sonnet-4-6` | Haiku 5.5 | **approved for hero crew** |
| strategy | standard | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` | Haiku 5.5 | Sharpener |
| strategy / territory_mapping | high | `anthropic/claude-opus-5-5` ($4/$20) | `anthropic/claude-sonnet-5-5` | Sonnet 5.5 (J-STRAT) | not approved yet |
| territory_mapping | standard | `anthropic/claude-sonnet-5-5` | `anthropic/claude-sonnet-4-6` | Haiku 5.5 | |
| competitive_research | any | Firecrawl scrape → `openrouter/google/gemini-3.8-flash` (1M ctx) | `anthropic/claude-sonnet-5-5` | Haiku 5.5 (J-GROUNDED) | tool step first |
| image_photo | low/standard | `vendor/fal/nano-banana-2` ($0.08/img) | `vendor/fal/flux-schnell` ($0.003) | Gemini 3.8 Flash vision (J-VISION) + D-PALETTE | |
| image_photo | high | `vendor/fal/gpt-image-2` (current) → candidate `openai/gpt-image-2.5` (fal page live) | `vendor/fal/nano-banana-pro` ($0.15) | same | |
| image_typography | any | `openai/gpt-image-2.5` (fal) — candidate; today `vendor/fal/gpt-image-2` | `fal-ai/ideogram/v4` | D-OCR (exact string, accents) + J-VISION | ES text: never Flux |
| vector_svg | any | `fal-ai/recraft/v4/text-to-vector` | `vendor/fal/recraft-v3` (current) | D-SVG-VALID (parse, ≤N paths, palette) + J-VISION on raster | |
| email_mjml | any | **template-first**: Sonnet 5.5 fills `blocks.email` JSON → MJML starter template | Sonnet 4.6 | D-RENDER, D-CONTRAST, screenshot J-VISION | no free-form HTML |
| landing_html | any | template-first: Sonnet 5.5 fills `blocks.landing` → section kit | Sonnet 4.6 | D-RENDER @1280 & 375, J-VISION | |
| deck_html | any | template-first: Sonnet 5.5 fills `blocks.deck` (3 slides) → HTML deck → PDF | Sonnet 4.6 | D-RENDER, J-VISION per slide | |

## HTML outputs — Claude Design patterns (from /workspace/claude-design-teardown.md)
1. **Fixed starter shells** (email MJML base, LP section kit, 16:9 deck shell) — models fill structured blocks; they never emit layout HTML. (renderers/ drafts.)
2. **2–3 variants on declared axes** (tone · layout · hero visual) — layout variants = choosing between template variants (hero-left / hero-centred), not new HTML.
3. **Silent verifier before the human**: render → headless screenshot (desktop 1280, mobile 375; email 600) → deterministic checks (D-RENDER, D-CONTRAST, overflow) → vision judge on the screenshot → fix loop (≤2 passes).
4. **One clarifying round** happens upstream in the Sharpener, not in the renderer.
5. **Edit once, sync everywhere**: all three formats read the same Message Spec.
## Routing rule
`route = routes[output_type][difficulty]`; if variant count >1 and type is image, variants 2–3 use the same route (comparability). The planner's crew still ≤3 agents per run.
