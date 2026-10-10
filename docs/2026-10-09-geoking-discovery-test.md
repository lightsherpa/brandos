# Geoking discovery test

Public source selected by the user: https://geoking.com. New isolated local brand: `f987a613-c9b2-4448-9929-83130e1a4534`, named Geoking · discovery test. No aspiration references supplied.

## Configured models and gathering workflow

- Firecrawl reads the homepage and up to five other high-signal pages, uploaded text documents and up to six supplied references. Reference intent is labelled current brand, aspiration or competitive context.
- Gemini 2.5 Pro through OpenRouter interprets the evidence into the first BIO candidate. The generator receives up to 48,000 characters; it should separate supported facts, inference, unknowns and aspirations.
- The derived category and audience become a competitive search query. Firecrawl searches and retrieves up to four readable results; snippets alone do not count as evidence.
- A second Gemini 2.5 Pro call synthesizes the researched BIO using brand evidence and dated external sources. Research failure leaves gaps rather than inventing comparisons.
- Homepage HTML provides deterministic palette and font extraction. Gemini 2.5 Flash through OpenRouter interprets the homepage screenshot for imagery direction and avoidances.
- The BIO is persisted as an uncertified candidate, draft review is seeded and a human Steward job is queued. JEV is not used. Brandolph chat is separately configured for Claude Sonnet 4.6; it is not the BIO compiler.

Current limitations: competitor search is one broad query, not exhaustive market coverage; uploaded images are not analyzed in the document-text lane; an Instagram handle is recorded, not treated as scraped content; web sources largely retain URLs/metadata rather than immutable extracted passages. Confidence is model-generated and not calibrated accuracy. Schema/evidence tests do not certify interpretation quality.

## Test method

The runner invokes the production `compileBio` handler and the real retrieval/model adapters against local Supabase. It executes steps directly without Inngest delivery, persistence or automatic retry testing. Only Firecrawl and OpenRouter credentials from the existing project configuration are loaded in memory; no credentials are saved in the report or test environment. Production client data is untouched.

The first attempt retrieved no readable pages, stopped before model calls and created no BIO. A diagnostic homepage request succeeded. The crawler had swallowed all individual errors; it now rejects an entirely unreadable crawl with the provider error and allows one bounded homepage fallback. Three offline regression tests cover fallback success, fallback failure and no extra request on initial success.

Artifacts are in `output/discovery-bio/geoking/`: `attempt-1.json`, `run.json`, `bio.json` when successfully persisted, `unit.log`, `build.log` and browser proof when available. Final results follow.


## Final live result — 9 October 2026

Attempt 2 reused the same isolated brand after the retrieval fix. Run `f51afc73-ae2f-40a0-8ba1-9ea6ce3fc630` ran from 11:05:58 UTC to 11:08:11 UTC. Primary retrieval, gathering sources, reading references, initial interpretation and competitive research completed. Both interpretation passes routed to `google/gemini-2.5-pro`. The final researched synthesis returned invalid JSON and failed before persistence. No BIO exists for Geoking. Vision extraction and Steward handoff were not reached; Gemini Flash was configured but not invoked.

The original error retained only the first 300 characters, not the completion finish reason or complete response, so it cannot distinguish truncation from malformed formatting. No further paid retries were run. The compiler now records response character count and finish reason, rejects known output-limit finishes with `BIO_TRUNCATED`, and distinguishes malformed JSON (`BIO_INVALID_JSON`) and invalid top-level shape (`BIO_INVALID_SHAPE`). This provides diagnosis for the next run; it does not resolve or retrospectively identify the cause of this failure.

The test also exposed stale BIO fields after selecting a brand with no BIO. The viewer now clears editable fields and sources across brand changes, resets editing, immediately refreshes on the brand switch event and ignores stale in-flight responses. Browser verification switched from Geoking to the existing synthetic fixture and back: Geoking showed no canon, no old name field and disabled Edit BIO. Proof: `output/discovery-bio/geoking/bio-empty-verified.png`.

Verification: 48 targeted offline tests passed, production build passed and `git diff --check` passed. These checks do not imply a successful live BIO or validate competitor coverage. Inngest delivery/retries were outside this direct-handler test.

Next work: make synthesis reliably conform to the BIO schema, check provider finish reason and budget before any bounded retry, then rerun Geoking and audit source attribution, competitor relevance, unsupported claims and current-vs-aspirational separation. The failed run cannot support a completed-BIO quality score. JEV remains deferred.
