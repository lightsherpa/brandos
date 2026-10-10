# Production BIO route and test budget

The route is server-owned in `server/src/lib/discovery-models.js`. `DISCOVERY_TEST_ROUTE` no longer selects BIO models. The existing `DISCOVERY_V2=0` escape hatch affects retrieval/visual depth, not the model family.

| Step | Primary | One fallback | Output cap | Verified primary USD / 1M input / output |
|---|---|---|---|---|
| Evidence reader | Haiku 5.5 | Gemini 3.8 Flash | 6,000 | $0.10 / $0.50 below 100k input |
| Interpretation and synthesis | Sonnet 5.5 | Opus 5.5 | 12,000 | $2 / $10 |
| Visual observations | Gemini 3.8 Flash | Sonnet 5.5 | 2,000 | $0.75 / $3.75 |

Model IDs and rates were checked against the public [OpenRouter model catalog](https://openrouter.ai/api/v1/models) on October 10, 2026. Haiku has higher pricing at >=100k input tokens; compilation evidence is bounded below that threshold. A run’s authoritative model cost comes from provider-reported usage, retained internally in the API usage ledger. No dollar amounts are rendered in the product.

Each fallback buffers a fresh response and discards failed partial JSON. Empty, truncated or malformed output fails closed after the one fallback. Normal Inngest retry policy remains two retries; approved paid-test mode disables worker retries and maintains a durable $5 reservation ledger under ignored `.bio-local/`.

For the approved two-brand test, conservative reservations are made before provider calls: reader $0.08; primary synthesis $0.40 / fallback $0.75; primary vision $0.80 / fallback $2.10. Model reservations settle to reported cost when returned; unknown outcomes retain their reservation. Retrieval reserves $0.25 per bounded map and $0.10 per scrape/search. These are budget bounds, not reported charges. [Firecrawl pricing](https://www.firecrawl.dev/pricing) lists basic scrape/map page credits and bounded search credits; $0.005/credit is the conservative Hobby overage reference. No JSON/extract premium formats are used.

The paid test mode accepts only geoking.com and thecake-me.com. Additional references require a separate reviewed test specification; no automatic broad crawl is authorized. Credentials are loaded by normal runtime configuration and never displayed or saved in result artifacts.

## Visual extraction

Read <=6 linked/imported CSS files, <=1 MB each / <=3 MB combined, with 8-second request timeouts. Public-address DNS validation pins the actual connection, and redirect targets are rechecked. Google/Adobe CSS fonts are read as declarations. Palette roles are inferred from declarations and require review; contrast pairs are mathematically measured against extracted hexes. This is not computed-style extraction or designer approval.

Uploaded visual images with confirmed rights are interpreted with their canonical/inspiration/avoid roles. Current and desired directions remain separate. PDF text is read; embedded PDF imagery is not rendered. Optional Brandfetch and a full multi-query competitor agent remain post-VDS.
