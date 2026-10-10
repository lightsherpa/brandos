# Full discovery local test and competitive landscape agent

Local entry: http://127.0.0.1:5184/#/discovery/new. Isolated Supabase at 127.0.0.1:57321, API at 8791, Inngest at 8291. Provider keys are loaded into memory by scripts/start-discovery-local.mjs; hosted database configuration is never loaded. No paid generation has been triggered during setup. Submission starts real provider calls and saves an uncertified BIO locally, then queues the existing review workflow.

## Test route

The local-only DISCOVERY_TEST_ROUTE=haiku-sonnet flag selects Haiku 5.5 for an evidence ledger and market seed, then Sonnet 5.5 for final synthesis with a 12,000-token cap. The analyst receives original source text, reader observations, competitive research and screenshots. The ordinary compiler route is unchanged. Website and public current/aspiration reference visuals use deterministic HTML color/font declaration extraction plus Gemini 3.8 Flash screenshot interpretation. Evidence retains URL, purpose, read time, partial/unreadable status and explicit limitations. Aspiration visual values are never substituted into current visual values. Renderer-sensitive landscape shapes are rejected before persistence rather than silently repaired.

The next live test is user supplied: brand name, primary website, current sources, desired-direction reference links and short intent notes. Run one brand first; review source coverage, grounded claims, competitive relevance and photographic observations before adjusting prompts. No fabricated visual placeholders.

Known limits: HTML declarations are not computed styles; external stylesheets, downloaded font verification, complete palette roles and image-level photographic analysis still need work. Image/document uploads are stored, but their visuals are not analyzed by this test route. Screenshot observations are model interpretations. Palette extraction currently keeps five ranked declarations. Research still uses a bounded query and up to four truncated external excerpts. This test does not yet implement the complete competitive agent.

## Competitive landscape agent to build

1. Input: evidenced category, buyer jobs, geography, audience and price segment; client competitor references are leads, not confirmed rivals.
2. Candidate discovery: multiple targeted queries covering direct alternatives, adjacent solutions and status quo. Deduplicate entities and retain discovery sources.
3. Qualification: explain relevance to the same buying decision; label direct, indirect or status quo and distinguish researched rivals from unverified candidates.
4. Evidence retrieval: read each qualified rival's actual product/service, pricing, audience, positioning and case-study pages. Capture targeted passages rather than page-opening truncation. A roundup discovers candidates; it does not prove their detailed features.
5. Claim ledger: entity, claim, quoted supporting passage, URL, publication/read date, publisher versus independent source, evidence status, contradictions and missing evidence. Prices retain currency, billing interval and read date.
6. Sonnet synthesis: category expectations, why buyers choose each alternative, supported parity/differences and opportunities explicitly labeled as hypotheses. Aspirational reference brands are not automatically competitors.
7. Validation: required/nested types, source coverage, competitor relevance, dates and unsupported superiority. A source URL alone does not establish a verified claim.
8. Operations: bounded candidate/page budgets, caching, timeout/retry policy, per-stage timings/cost receipts and resumable execution. Record partial results instead of inventing completion.
9. Evaluation: manually verified cases across different sectors and geographies; measure relevant-rival precision/recall, claim support, contradictions, coverage, latency and cost. Escalate genuinely ambiguous evidence to Opus selectively; do not use model confidence as an accuracy score.

Suggested first bounded implementation: 3–5 qualified alternatives, up to three primary pages each, with evidence-backed comparisons and explicit gaps. No forced minimum when sources do not support it.

Verification during setup: 25 targeted offline tests passed, compiler syntax check and git diff --check passed. Live generation awaits user source entry; no end-to-end generation result is claimed.
