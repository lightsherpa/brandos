# BIO status and JEV review — 9 October 2026

## Current selected BIO

The browser is showing Synthetic office brand, local test fixture `5bcfceec-a73e-4985-b37b-7463140cb5d7`. Read-only database checks confirm v2, score 0, certified false, self-certified false, no discovery correlation ID, zero saved sources, no competitive research result, and one queued Steward review. This version came from the previous UI edit test. It is not an engine-generated discovery quality example. Its competitive difference remains a hypothesis without proof.

Snapshot: `output/discovery-bio/current-status.json`. The report script refuses a non-synthetic fixture or a non-local Supabase target. No BIO data, certification or review status was changed by this audit.

## Tests run

- 44 tests covering discovery orchestration, source-reference guards, aspiration separation, competitive BIO normalization and UI round trips, evidence, scoring and text adapter boundaries: pass.
- 16 creative tests including JEV bounded candidate selection, low-confidence/invalid answer fallbacks, active qualification gates, shadow behavior and timeout contract: pass.
- 120 offline JEV routing fixture cases: pass. Their mock acceptance metadata is explicitly test-only and does not qualify live JEV.
- Production build: pass.

Logs: `output/discovery-bio/status-tests.log`, `jev-tests.log`, `status-build.log`. The isolated runtime lacks Firecrawl, OpenRouter and TypeSafe keys. No live provider request was made; no conclusion about research relevance or live JEV accuracy follows from these results.

## Is JEV included?

JEV is implemented in `server/src/lib/models/jev.js` for choosing between eligible, evaluated model routes. The creative route/store use it. Default mode is shadow; active route switching requires qualification evidence and sufficient confidence. Discovery compiles through the configured Gemini route in `compile-bio.js`; `streamCompletion` dispatches it directly. Neither source interpretation, competitive research nor BIO claim validation currently invokes JEV. The current BIO contains no JEV assessment.

## Proposed use in discovery/BIO

Use JEV for bounded judgments, while the generative engine remains responsible for analysis and synthesis. TypeSafe's documented citation-check pattern evaluates a claim against a source passage as supports, contradicts or says_nothing. Its model documentation explicitly advises against asking JEV to generate prose or perform broad reasoning with unrelated context.

1. Persist extracted passages with stable source IDs, hashes, purpose, URL/file identity and retrieval time. Current web source rows largely store metadata and `raw_ref: null`; retaining provenance is required for repeatable claim checks.
2. Have the generator attach source/passages to factual claims and identify aspirations separately. Validate schema, citation existence, types and access deterministically before invoking a model.
3. Judge one claim against the cited passage: supported, contradicted, unsupported, or aspiration-only. Separately judge candidate competitor relevance to the derived buying decision. Do not ask one question to perform both jobs.
4. Store the assessment, model/version, confidence and source hash beside the candidate. Unavailable or uncertain judgments remain unassessed and go to review; they never become verified by default. A publisher's claim being supported by its page does not independently prove that claim or superiority.
5. Use those assessments to request targeted regeneration or additional evidence. Do not let JEV create new facts, replace source retrieval, or change human certification.
6. Begin in shadow mode. Compare against human-labelled brand cases covering contradictory sources, misleading competitors, aspiration presented as fact, stale evidence, prompt injection, EN/ES/AR, unavailable providers and ambiguous claims. Measure false acceptance, false rejection, unsupported-claim rate, latency and cost. Set task-specific action thresholds after measurement; routing fixture results are not BIO validation evidence.

Recommended first integration: claim-to-passage checks for positioning and competitive differences, with aspiration leakage checks. This directly addresses the trustworthiness of the brand brain. Model routing can be evaluated separately later.

Primary documentation used: https://docs.typesafe.ai/cookbooks/citation_check and https://docs.typesafe.ai/model-jaggedness/jev-1.13, retrieved through Context7.
