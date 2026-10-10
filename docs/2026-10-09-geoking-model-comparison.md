# Geoking — parallel BIO model comparison

Test completed 9 October 2026. Models were verified in the live OpenRouter catalog before execution. All six generation receipts were subsequently checked against `/api/v1/generation`; totals match the streaming usage costs.

| Model | Billed text-model cost | Branch time | Competitors | JSON | Current competitive renderer |
|---|---:|---:|---:|---|---|
| google/gemini-2.5-pro | $0.1185300 | 92.7s | 3 | Valid | Fails |
| anthropic/claude-haiku-5.5 | $0.0087313 | 66.3s | 8 | Valid | Passes |
| anthropic/claude-opus-5.5 | $0.2442120 | 91.4s | 8 | Valid | Passes |

Total inference cost: $0.3714733. Haiku used 13.6 times less money than Gemini and 28.0 times less than Opus in this sample. These are inference-only totals; shared Firecrawl costs are excluded, not zero.

## Method and limits

One public Geoking homepage and three external research pages were frozen once. All branches ran concurrently with the production compiler prompt, model router, JSON parser and `generateDiscoveryBrain` two-pass orchestration. Exact prompts, raw output, usage, generation IDs, sources and hashes are saved. No client BIO was persisted and no Steward jobs were queued.

All models received the same 12,000-token cap per text call rather than production’s 5,000. Production routing and limits are unchanged. No response-format constraint or automatic retry was added. Identical text input does not mean identical token counts across tokenizers; billed completion tokens include reasoning. Haiku’s final synthesis used 9,741 completion tokens; Gemini’s first pass used 5,663. A smaller budget is therefore a material reliability risk, but this does not retrospectively prove the cause of the previous failed run.

The external search used one controlled query for local marketing / local SEO / reputation management. Each model derived its own query, recorded in the receipt file, but those queries were not separately fetched. This isolates synthesis quality and does not benchmark independent search strategies. Research was supplied as the production pipeline’s first 4,000 characters per external page, so heading-only evidence and omitted content constrain the landscape.

The shared HTML/screenshot Firecrawl request returned HTTP 500 after about 61 seconds. No Flash vision call ran, and visual fields are empty in all branches. Branch timings exclude shared retrieval. Firecrawl search reported five credits; other retrieval endpoints did not report credits and dollar spend is unavailable. No quality conclusion about imagery or typography is supported.

## Evidence review

This is a reviewer assessment from one brand, not a statistically significant ranking. No client aspiration references were provided, so aspiration behavior was not tested against a supplied desired direction. Unknown founding date and quarterly goals remain blank across all outputs. Competitor counts are breadth, not accuracy. The historical coverage metric rewards filling fields and model-generated confidence: Gemini scored 82, Haiku 73 and Opus 78, despite Gemini’s renderer failure; it is unsuitable as an independent accuracy score.

### google/gemini-2.5-pro

Weakest in this sample: valid JSON, but not usable in the current competitive renderer.

Strengths:
- Recognizes local marketing and both location-count segments.
- Leaves founding date and quarterly goals unknown; avoids proof-free points of difference.

Risks:
- Competitor difference fields are objects; the actual Competitive BIO renderer fails with Objects are not valid as a React child.
- Omits the required aspirations object.
- Assigns 85+ confidence to fields it describes as inferred, contrary to the prompt.
- Invents exclusions such as not designed for solopreneurs; the small-business offer does not establish that exclusion.
- BrightLocal feature details and Birdeye customer messaging go beyond the excerpts actually supplied.

### anthropic/claude-haiku-5.5

Best cost/performance candidate for a draft, with evidence and schema checks required.

Strengths:
- Renders successfully and describes both customer segments.
- Separates publisher claims from independent proof and preserves quarterly unknowns.
- Provides useful direct, indirect and status-quo candidates; lower confidence on inference.

Risks:
- Omits the required aspirations object.
- Claims Birdeye ranks itself first although that ranking is absent from the 4,000-character excerpt supplied.
- Describes AI-assisted review responses as parity with Chatmeter; the excerpt establishes sentiment/issue analysis, not that response feature.
- Neither small businesses nor enterprises is established as the primary audience; its hierarchy remains an interpretation.

### anthropic/claude-opus-5.5

Strongest evidence discipline and strategic reading in this sample, at the highest cost.

Strengths:
- Renders successfully and includes all registered BIO fields.
- Marks Yext, SOCi and Rio SEO as heading-only evidence and leaves buying reasons/differences blank.
- Explicitly distinguishes an observed offer from proof of unique differentiation.
- Marks audience primacy as inferred and identifies weak impact statistics and unnamed client proof.

Risks:
- Populates aspiration direction from current homepage benefit language despite no desired-direction references; it is not a client-confirmed future direction.
- Calls rivals well-reviewed without supplied review evidence.
- Several sourceDate values mix publication/read dates as text, which the current date input cannot preserve reliably.
- Some parity statements (for example social posting for SOCi) go beyond the supplied heading-only evidence.

## Decision

For further evaluation, Haiku 5.5 is the strongest candidate for economical first drafts; Opus 5.5 is the stronger candidate for difficult interpretation or review of weak evidence. A Haiku → Opus selective-review workflow was not run here, so its cost and quality are unmeasured. No production-model switch was made.

Before any model is promoted: enforce required fields and nested competitor types; distinguish inferred audience priority and unsupported exclusions; keep customer aspirations separate from publisher benefit language; retrieve targeted competitor passages instead of cutting pages at the first 4,000 characters; repeat across several brands and desired-direction references.

Verification: 40 targeted offline tests passed, production build passed, and `git diff --check` passed. The actual `BioCompetitive` component was server-rendered with every generated landscape: Gemini failed on nested object differences, Haiku and Opus passed. This diagnosis is recorded rather than silently repairing outputs during comparison.

Artifacts: `output/discovery-bio/geoking-comparison/index.html`, `comparison.json`, `receipt-audit.json`, `sources.json`, `output-checks.json`, `review.json`, per-model `bio.json`, raw responses and input snapshots. The browser report uses IBM Plex and the current mineral/graphite styling.
