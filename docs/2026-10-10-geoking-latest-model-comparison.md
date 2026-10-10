# Geoking — current-model BIO comparison

Completed 10 October 2026 (Europe/Madrid). Gemini 2.5 was removed from the active benchmark. Model IDs and prices were verified against the live OpenRouter catalog before running six parallel branches. All 12 generation receipts were checked afterward; each returned HTTP 200 and matched its streaming cost.

| Model | Billed inference cost | Branch time | Competitive BIO renderer |
|---|---:|---:|---|
| anthropic/claude-haiku-5.5 | $0.0078768 | 60.6s | passed |
| google/gemini-3.5-flash-lite | $0.0115504 | 14.2s | failed |
| google/gemini-3.8-flash | $0.0406897 | 64.9s | passed |
| anthropic/claude-sonnet-5.5 | $0.1209860 | 65.5s | passed |
| google/gemini-3.1-pro-preview | $0.1635160 | 107.0s | failed |
| anthropic/claude-opus-5.5 | $0.2347720 | 85.8s | passed |

Total inference cost: $0.5793909. The previous comparison is preserved in `output/discovery-bio/geoking-comparison-2026-10-09/`.

## Method and limits

Each model ran the same production interpretation and synthesis prompts, real router, JSON parser and generateDiscoveryBrain orchestration. Each text call had a 12,000-token cap, with provider-default reasoning, no response-format constraint and no retries. Production still has a 5,000-token cap and its existing routing; this benchmark changes neither. No BIO was saved to the database, no queue jobs were run, and no publication occurred.

The identical evidence was the frozen 9 October Geoking homepage and three external research excerpts. Each external excerpt was limited to the production pipeline's first 4,000 characters. Research used a shared fixed query; model-derived queries were recorded but not fetched separately. This compares interpretation and synthesis, not independent retrieval or the full discovery workflow. The prior screenshot request failed; no vision call ran. Historical retrieval telemetry remains in comparison.json, but there was no new Firecrawl request or charge in this rerun. Costs above are inference only.

All six outputs parsed as JSON. The actual BioCompetitive component passed server rendering for Haiku, Flash, Sonnet and Opus. Pro failed on object-valued competitor differences; Flash-Lite failed on object-valued research gaps and omitted all aspiration fields. Outputs were not repaired to make the benchmark pass.

## Quality assessment

Sonnet 5.5 offers the strongest cost–quality balance in this sample: nine landscape candidates, qualification of heading-only and publisher evidence, lower confidence on inference, empty aspirations when no desired direction was supplied, and usable UI output. Some parity and buyer-fit interpretations still need stronger evidence. It costs approximately half as much as Opus.

Opus 5.5 provides careful strategic tensions and seven landscape candidates, but some parity assertions exceed heading-only evidence and mixed-text source dates do not fit the date input reliably. This sample does not establish enough additional quality to justify making it the default.

Haiku 5.5 is the cheapest and renders successfully, preserves unknown aspirations, and flags weak proof. However, it returns only one status-quo competitor despite named rivals in the supplied material. It needs further evaluation for extraction or drafts, not promotion as a standalone competitive BIO compiler from this result.

Gemini 3.8 Flash produces four landscape candidates and usable UI output at a low cost. Its inferred competitor advantages and invented aspirational direction require review. Gemini 3.1 Pro Preview provides three candidates but fails the renderer and invents a future direction. Gemini 3.5 Flash-Lite is fastest but returns no landscape, omits aspirations and fails the renderer.

This is one sample for one brand, reviewed against supplied evidence. Counts measure breadth, not accuracy; internal coverage/confidence scores are not independent quality measures. No aspiration references were supplied, so the test checks preservation of unknown direction rather than interpretation of an actual desired direction. No customer validation, visual analysis, Steward certification or end-to-end reliability conclusion is supported.

## Next implementation decision

Evaluate Sonnet 5.5 as the BIO compiler candidate, with strict nested schema validation and evidence checks before promotion. Retrieve targeted competitor passages rather than relying on truncated page openings; distinguish source claims from inferred advantages; preserve unknown aspirations. Repeat across several brands, including supplied aspiration references, at the intended production token budget. A cheaper extraction → stronger synthesis combination remains untested.

Latest-model documentation: [Google Gemini models](https://ai.google.dev/gemini-api/docs/models), [Claude models](https://platform.claude.com/docs/en/models/overview). Gemini 3.1 Pro is a preview model.

Artifacts: comparison.json, catalog.json, receipt-audit.json, output-checks.json, review.json, source snapshots, exact prompts, raw responses and per-model BIO JSON are under output/discovery-bio/geoking-comparison. The report uses IBM Plex with mineral paper, graphite and cobalt styling.
