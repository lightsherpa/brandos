# BrandOS — Model Audit & Upgrade Plan
*v0.1 · 2026-10-10 · CTO · read-only review of `CaastorOS` @ main + web research (prices read Oct 6–10, 2026)*

## TL;DR
1. **The stack is 1–2 generations behind and paying more for it.** Every text route is on a model that now has a newer, *cheaper* successor: Sonnet 4.6 ($3/$15) → **Sonnet 5.5 ($2/$10)**, Opus 4.7 ($5/$25) → **Opus 5.5 ($4/$20)**, Haiku 4.5 ($1/$5) → **Haiku 5.5 ($0.10/$0.50)**, Gemini 2.5 Flash/Pro → **Gemini 3.x Flash**, GPT-5 → GPT-5.6/6. Upgrading *raises quality and lowers text cost ~30–40%*.
2. **Images are the biggest quality gap.** Volume visuals (social, mood board, lifestyle, email) run on **Flux Schnell** ($0.003) — the cheapest, weakest model in the market, and Flux-family models fail non-Latin/mixed text. Market leaders now: **GPT-Image-2.5** (#1 Arena), **Nano Banana 2.1** (best quality/$ at ~$0.034), **Ideogram 4** (typography), **Recraft V4.1** (native SVG for logos/icons).
3. **Weak specialists (Territory Mapper 40/100, Social Captions 10/100) are mostly a prompt/contract problem, not a model problem** — both already run on Sonnet. Fix prompt + add exemplars, then re-score with the eval harness below.
4. **Before the Oct 17 freeze:** only swap models *inside the hero demo flow*, pinned, A/B'd on 3 golden briefs. Everything else → November behind the eval harness.

> ⚠ Verify every model id on our actual gateways (OpenRouter slugs, fal endpoints) before switching — availability on a provider can lag the vendor launch. Prices are list prices; re-check vendor pages before budgeting.

---

## 1. Current model map (as found in code)

Source of truth chain: `src/portal-data.js` (`CI_AGENTS[].model` short keys) → `scripts/seed-specs.mjs` `MODEL_MAP` → `specs` table (`payload.modelRouting.primary`) → `server/src/lib/models/router.js` (dispatch by prefix `anthropic/` · `openrouter/` · `vendor/fal/`). Adapters: `models/anthropic.js` (direct SDK, prompt caching), `models/openrouter.js`, `models/fal-image.js`.
⚠ CLAUDE.md notes "~22 route downgrades" applied — the **DB `specs` rows may differ from `portal-data.js`**. Run `SELECT id, payload->'modelRouting'->>'primary' FROM specs` before switching (read-only check I could not do without credentials).

`MODEL_MAP` (`scripts/seed-specs.mjs`): opus→`anthropic/claude-opus-4-7` · sonnet→`anthropic/claude-sonnet-4-6` · haiku→`anthropic/claude-haiku-4-5-20251001` · gpt5→`openrouter/openai/gpt-5` · gemPro→`openrouter/google/gemini-2.5-pro` · gemFlash→`openrouter/google/gemini-2.5-flash` · gptimage→`vendor/fal/gpt-image-2` · flux→`vendor/fal/flux-1.1-pro` · fluxSchnell→`vendor/fal/flux-schnell` · recraft→`vendor/fal/recraft-v3` · exa/elevenlabs/v0/gamma/framer→`vendor/*` (not wired).

### 1.1 Pipeline steps
| Step | File | Model today |
|---|---|---|
| Discovery scrape | `lib/firecrawl.js` | Firecrawl (no LLM) |
| BIO synthesis | `inngest/functions/compile-bio.js:43` | `openrouter/google/gemini-2.5-pro` |
| Visual extraction (screenshot → palette/type/imagery) | `lib/extract-visual-vision.js:22` (+ deterministic `extract-visual-deterministic.js`) | `openrouter/google/gemini-2.5-flash` |
| Brief sharpener + crew | `lib/sharpener.js:24` | `anthropic/claude-sonnet-4-6` |
| Brandolph chat (L1) | `router.js` `BRANDOLPH_SYNTHETIC_SPEC` | Anthropic (Opus/Sonnet tier per CLAUDE.md) |
| Voice QA | `lib/qa-voice.js:25` | `gemini-2.5-flash` |
| Vision QA | `lib/qa-vision.js:22` | `gemini-2.5-flash` |

### 1.2 Specialists by family (`portal-data.js` short keys)
| Family | Specialists → model |
|---|---|
| Strategy | a01 Diagnostician sonnet · a02 Sharpener sonnet · a03 Strategist sonnet · a04 Tension-Finder sonnet · a05 Refuser haiku · a34 Audience Profiler gemPro · a06 **Territory Mapper sonnet** |
| Concept | a07 Namer opus · a08 Metaphor Smith opus · a09 Pull-Quote sonnet · a10 Reframer sonnet · a11 Anti-Brief sonnet · a36 Campaign Architect opus · a35 Mood Board fluxSchnell |
| Copy | a12 Conversion sonnet · a13 Email Seq sonnet · a14 Subject Lines gemFlash · a15 Long-form opus · a16 **Social Captions sonnet** · a17 Microcopy haiku · a18 Voice QA haiku · a37 Headlines gemPro · a38 Ad Copy gemPro · a39 Product Copy gemFlash · a40 Press & Bio sonnet · a51 VO Script sonnet |
| Visual | a19 Identity Drafts gptimage · a20 Hero KV gptimage · a21 Editorial gptimage · a22 Packaging gptimage · a43 OOH/Print gptimage · a44 Style Frames gptimage · a42 Ad Creative flux · a50 Storyboard flux · a41 Social Post fluxSchnell · a46 Lifestyle/Product fluxSchnell · a48 Email Designer fluxSchnell · a23 Iconography recraft(v3) · a45 Infographic sonnet · a24 Brand Consistency QA gemFlash |
| Web & UX | a25 Page Composer v0 · a26 Email Build v0 · a29 Framer framer · a47 Component Lib haiku · a49 Wireframe gemFlash |
| Motion & Sound (soon) | a28 Video Treatment opus · a27 Deck gamma · a52 Sonic Logo elevenlabs |
| Research & Ops | a30 BIO Compiler gemPro · a31 Site Scanner exa · a32 Competitor Map exa · a33 Audit haiku · a53 SEO gemFlash · a54 Trend gemFlash · a55 Insights gemPro |

### 1.3 Quality evidence on file
- `CLAUDE.md` "In-flight": **Territory Mapper 40/100**, **Social Captions 10/100 (FLAGGED)** — "not yet diagnosed".
- `docs/benchmarks/2026-06-02/results.md`: image A/B on 4 slots (hero-kv, editorial, ad-creative, moodboard-tile) × flux-schnell ($0.003) / flux-1.1-pro ($0.04) / gpt-image-2 ($0.07) — images only, **no scores recorded**, single brand (BIO v9). No text benchmarks exist.

---

## 2. Market scan (Oct 2026)

### 2.1 Text
| Model | $/1M in / out (cache read) | Notes | Source |
|---|---|---|---|
| **Claude Opus 5.5** (`claude-opus-5-5`) | $4 / $20 ($0.20) | #3 EQ-Bench Creative Writing (2050); cheaper than Opus 4.7 ($5/$25) | anthropic.com/claude/opus; Anthropic list prices 2026-10-07 (assets.claude.com PDF) |
| Claude Opus 5 | $5 / $25 | #1 EQ-Bench Creative Writing (2133) | evy.so/compare/best-llms-for-writing (Oct 2026) |
| **Claude Sonnet 5.5** | $2 / $10 ($0.10) | vs Sonnet 4.6 $3/$15 | platform.claude.com/docs/en/about-claude/pricing |
| **Claude Haiku 5.5** | $0.10 / $0.50 (≤100k prompt) | 10× cheaper than Haiku 4.5; classification/QA | anthropic.com/claude-haiku-5-5 |
| GPT-5.6 Sol | $4 / $20 (promo to ≥Nov 21) | EQ-Bench CW 1972; GPT-6 / 6.1 Sol listed at $2/$10 (Sep 2026) | developers.openai.com/api/docs/models/gpt-5.6-sol; llmlearner.com/models/gpt-5-6-sol |
| GPT-5.6 Luna | $0.20 / $1.20 | budget; CW ~1829 | developers.openai.com/api/docs/pricing |
| **Gemini 3.x Flash** (3.6–3.8) | $0.75 / $3.75 intro → $1.50/$7.50 from Jan 1 2027 | outperforms 2.5 Pro (Google); vision, structured output, 1M ctx | cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing; blog.google gemini-3-flash |
| Gemini 3 Flash (preview) | $0.50 / $3 | | blog.google/products-and-platforms/products/gemini/gemini-3-flash/ |

**Multilingual ES/EN:** no ES-specific leaderboard found this pass; Claude 5.x and Gemini 3.x are both strong in Spanish in our experience — **decide by our own ES golden briefs** (§4). Open item.

### 2.2 Image
| Model | $/image | Strength | Source |
|---|---|---|---|
| **GPT-Image-2.5** (Flare / Sunburst) | ~$0.04–0.20 by quality | #1/#2 Arena text-to-image & edit (Oct 6, 2026); perfect text 10/10 | stackspend.app/blog/model-selection/image-generation-models-october-2026; blog.sandbase.ai/ai-image-text-rendering-benchmark-ecommerce-2026/ |
| **Nano Banana 2.1** (Google) | ~$0.034 (1K) / $0.076 (4K), batch ½ | best quality-per-dollar; released ~Oct 6 (provisional ranking) | stackspend (above); theozard.com/models/image |
| Nano Banana 2 / Pro | $0.039 / ~$0.078–0.134 | 10/10 multilingual poster text | sandbase (above); Google Cloud pricing |
| **Ideogram 4** | $0.03–0.10 | typography/posters specialist | stackspend; versely.studio roundup |
| **Recraft V4.1** | $0.035 raster / **$0.08 SVG** | logos, icons, native vector | stackspend; versely |
| Seedream 5.0 Pro | ~$0.068–0.078 | strong decorative type, sometimes adds accents (bad for ES ñ/á) | jantaris.com/blog/ai-logo-generator |
| FLUX.2 Pro / Max | $0.03 / $0.07 | control/references; **failed all non-Latin posters** | sandbase |
| Flux Schnell (ours) | $0.003 | drafts only | fal / our bench |

---

## 3. Proposed model map

Typical brief assumption (for costing): sharpen (8k in / 1.5k out) + 4 text specialists (6k in cached-heavy / 1.2k out each) + 2 QA calls + 3 images. BIO compile is per-brand (amortised).

### 3.1 Pipeline steps
| Step | Recommended | Fallback | Why |
|---|---|---|---|
| BIO synthesis | **Claude Sonnet 5.5** (JSON, high faithfulness) | Gemini 3.x Flash | Sonnet better at "leave empty, don't invent" + citing sources; cost ~same as 2.5 Pro for one call/brand. A/B on 5 brands; keep Gemini if equal |
| Visual extraction | **Gemini 3.x Flash** + Brandfetch (deterministic palette/fonts) | GPT-5.6 Luna (vision) | Vision + structured output at Flash cost; Brandfetch removes guesswork on hex/fonts |
| Sharpener / crew | **Claude Sonnet 5.5** | Opus 5.5 | drop-in successor, cheaper |
| Brandolph (L1) | **Claude Opus 5.5** | Sonnet 5.5 | flagship voice of the product; Opus 5.5 is cheaper than 4.7 |
| Voice QA / Brand QA | **Claude Haiku 5.5** | Gemini 3.x Flash | QA must agree with Claude-written copy register; Haiku 5.5 is ~cheapest frontier option |
| Vision QA | **Gemini 3.x Flash** | GPT-5.6 Luna | best $/vision |
| LLM judge (eval) | **Opus 5.5** cross-checked by **GPT-5.6 Sol/GPT-6** | — | different family than generator to reduce self-preference |

### 3.2 Specialists by family
| Family | Recommended | Fallback | Why |
|---|---|---|---|
| Strategy (a01–a06, a34) | **Sonnet 5.5**; Territory Mapper & Strategist → **Opus 5.5** | GPT-6 Sol | reasoning-heavy, low volume |
| Concept / naming / manifesto (a07, a08, a36, a15) | **Opus 5.5** (or Opus 5 for pure creative) | Sonnet 5.5 | top creative-writing scores |
| Copy (a09–a14, a16, a37–a40, a51) | **Sonnet 5.5** | Gemini 3.x Flash | replace gemPro/gemFlash on headlines/ad copy — copy is the product, don't cheap out; Subject Lines/Product Copy can stay on Flash 3.x |
| Microcopy, Refuser, Audit, Component Lib (a05, a17, a33, a47) | **Haiku 5.5** | Gemini 3.x Flash | short structured outputs |
| Research (a53–a55, a30) | **Gemini 3.x Flash** (+ grounding) | Sonnet 5.5 | long context, cheap |
| Hero KV, Editorial, OOH, Style Frames, Packaging (a20–a22, a43, a44) | **GPT-Image-2.5 Flare** | Nano Banana Pro | best overall + edits; text-perfect |
| Social Post, Ad Creative, Email Designer, Storyboard (a41, a42, a48, a50) | **Nano Banana 2.1** | GPT-Image-2.5 Flare | text-on-image correct in ES/EN at ~$0.034 — replaces Flux Schnell/1.1 Pro |
| Lifestyle / Product photo, Mood Board (a46, a35) | **Nano Banana 2.1** (ref-image editing for product fidelity) | FLUX.2 Pro | photoreal + reference control |
| Identity drafts / logos (a19) | **GPT-Image-2.5** (wordmark ideation) → **Recraft V4.1 SVG** (final vector) | Ideogram 4 | correct lettering + real vector output |
| Iconography (a23) | **Recraft V4.1 vector** | Recraft V4 Styles | native SVG |
| Typography-led posters/ads | **Ideogram 4** | Nano Banana 2.1 | specialist |

### 3.3 Cost per typical brief (estimate, list prices, excl. BIO compile)
| | Today | Proposed |
|---|---|---|
| Sharpen (Sonnet 4.6 → 5.5) | ~$0.047 | ~$0.031 |
| 4 text specialists (mix Sonnet 4.6/gem → Sonnet 5.5, 1 on Opus 5.5) | ~$0.12 | ~$0.10 |
| 2 QA calls (Gem 2.5 Flash → Haiku 5.5 / Gem 3 Flash) | ~$0.002 | ~$0.003 |
| 3 images (2× Flux Schnell + 1× gpt-image-2 ≈ $0.076) | ~$0.08 | 2× Nano Banana 2.1 + 1× GPT-Image-2.5 Flare ≈ **$0.11–0.15** |
| **Total / brief** | **≈ $0.25** | **≈ $0.25–0.29** |
Net: **roughly flat cost for a full-generation quality jump** — text savings pay for the image upgrade. All in credits to the user (never show API cost — CLAUDE.md rule). Note Gemini 3.x Flash doubles Jan 1 2027.

### 3.4 Weakest specialists — diagnosis
| Specialist | Score | Model today | Likely cause | Fix |
|---|---|---|---|---|
| a16 Social Captions | 10/100 FLAGGED | Sonnet 4.6 | **Prompt/contract**, not model: Sonnet is a strong copy model; 10/100 suggests format failure (deliverable contract in `deliverables.js` / platform rules), BIO voice slice missing (`bioSlices` for Copy = voice/forbidden only), or QA judge (`qa-voice` on Gemini Flash) mis-scoring. | Inspect 5 failing runs in `runs`/`qa_results`; add platform specs (length, hashtags, CTA, emoji policy), 3 brand exemplars, Spanish variant; re-judge with new QA. Then model swap. |
| a06 Territory Mapper | 40/100 | Sonnet 4.6 | Mostly **prompt + inputs**: territories need competitor context, but a32 Competitor Map (exa) is not wired → mapper invents competitive space; the anti-invention guardrail then pushes it to generic output. Partially model (strategic reasoning). | Feed competitor scan (Firecrawl/exa) into slice; require 2×2 axes + evidence; upgrade to Opus 5.5. |
| Flux Schnell visual family | not scored | flux-schnell | **Model** — cheapest draft model, poor text rendering | swap to Nano Banana 2.1 |
| Headlines/Ad Copy on gemPro 2.5 | not scored | Gemini 2.5 Pro | model generation old | Sonnet 5.5 |

---

## 4. Eval harness — "prove above market"

**Goal:** a repeatable number per specialist family we can show on stage and in sales ("BrandOS 82 vs ChatGPT 61 vs Jasper 58 on our blind panel").

1. **Golden set** (`evals/golden/`): 3 brands (incl. one Spanish-first, one with a real certified BIO) × 10 briefs = 30 briefs, covering social, ad, naming, landing, hero KV, logo idea. Freeze BIO versions.
2. **Rubric** (reuse the style of `cert_rubric_versions`): per output 0–4 on *On-BIO voice*, *Factual fidelity (no invented attributes)*, *Strategic sharpness*, *Craft/originality*, *Format compliance*, *Language quality (ES/EN)*, *Visual: palette/type adherence, text correctness*. Gate: fidelity <2 = fail.
3. **LLM judge:** Opus 5.5 + GPT-6/5.6 Sol, pairwise blind (A vs B, randomised order), ask for rubric scores + preference; report agreement; disagreements → human.
4. **Baselines (the "market"):** same brief + same pasted brand doc into ChatGPT (GPT-5.6), Gemini, Jasper/Canva Magic where possible → shows the value of BIO + specialists, not just the model.
5. **Designer spot checks:** 20% sample scored by 2 certifying designers (the same people who certify) → calibrate judge; track judge–human correlation.
6. **Mechanics:** `scripts/eval-run.mjs` (reads golden, calls `/api/runs/stream` with model override, stores to `eval_runs`/`eval_scores` tables or JSONL), `scripts/eval-judge.mjs`, a markdown report like `docs/benchmarks/`. Images: auto-check text OCR (does the rendered string match?) + palette ΔE vs BIO palette.
7. **Cost:** ~30 briefs × 2 variants × ~$0.3 + judging ≈ **$30–50 per full run**. Run on every model or prompt change.

---

## 5. What's safe before the Oct 17 freeze vs November

### Before Oct 17 (demo-scoped only, pinned, reversible by re-seeding)
- [ ] Read the live `specs` routes in DB (confirm what actually runs).
- [ ] For the **hero brief's crew only**: Sharpener + its 2–3 text specialists → Sonnet 5.5 / Opus 5.5 (Anthropic direct adapter, same SDK — just model id + verify the SDK version `@anthropic-ai/sdk ^0.32` accepts it).
- [ ] Hero image specialist → GPT-Image-2.5 Flare or Nano Banana 2.1 **if available on fal**; else keep gpt-image-2 (already good).
- [ ] Run a mini-eval: 3 golden briefs × old vs new, Oscar + 1 designer pick blind. Switch only if new wins.
- [ ] Pre-generate + cache demo outputs (fallback mode) regardless.
- ✗ Do NOT touch BIO compiler, QA judges, or the whole roster before the fair (changes scores/certification behaviour).

### November
- W1: eval harness + golden set + baselines; diagnose Social Captions & Territory Mapper (prompt fixes first).
- W2: roster-wide text upgrade (Sonnet 5.5 / Opus 5.5 / Haiku 5.5 / Gemini 3.x Flash) behind eval; update `MODEL_MAP`, re-seed; add `fallback` route per spec (router already has `isRouteAvailable`).
- W3: image family swap (Nano Banana 2.1 volume, GPT-Image-2.5 hero, Recraft V4.1 SVG, Ideogram 4 typography); add OCR + ΔE image QA.
- W4: BIO synthesis A/B (Sonnet 5.5 vs Gemini 3.x Flash); Brandfetch in visual extraction; QA judges → Haiku 5.5/Gemini 3 Flash; budget alarms before Gemini Jan 2027 price doubling.
- Ongoing: publish "BrandOS Quality Index" monthly.
