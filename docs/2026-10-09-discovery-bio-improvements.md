# Discovery → engine-generated BIO

## Correction to the previous implementation

The established product flow is source-led and engine-generated. The previous manual-draft creation path and competitor questionnaire were an implementation mistake. They have been removed. This correction supersedes the earlier manual-onboarding milestone and screenshots.

Users share evidence of their current brand and references for what they want to become. The engine reads, analyzes and interprets the material, researches the competitive landscape, and synthesizes the BIO. Users clarify and review that interpretation; they do not build the BIO by filling its chapters.

## Implemented in the local Melius worktree

- Sources/reference links labelled current brand, aspiration or competitive context, with a note explaining what should be learned. Up to six links; public HTTP(S) URL guards before reading.
- Uploaded source groups labelled current brand or aspiration; purpose persists in source metadata and compiler input. Existing image files still need visual extraction support beyond the primary website; the UI discloses this limit.
- Generation accepts a primary website, uploaded sources, or references. No readable evidence means no generated BIO. A social handle alone is not treated as read content.
- Separate Inngest steps read links, interpret the brand, search the derived market, and synthesize the researched BIO. Search is capped at four readable results and two synthesis calls; incomplete research leaves explicit gaps. Search snippets without page content are excluded.
- Competitive context is engine-generated rather than overwritten by client-authored competitor records. Records cover relevant alternatives, customer choice, category expectations, differences and proof. Aspirational direction has separate canonical fields and explicit factual limits in agent context.
- Review and candidate certification rules remain. A resume-review control is offered only when the brand has an engine-generated BIO with a discovery correlation ID. There is no blank/manual creation control.
- IBM Plex visual system, responsive layout and EN/ES/AR copy retained.

## Evidence and limits

42 focused tests pass, including mocked interpret → research → synthesize orchestration, reference guards, missing market, provider failure, aspiration boundaries in agent context, search response handling, BIO normalization/evidence/scoring and competitive UI round trips. Production build and diff checks pass.

Browser checks: manual creation control absent; a reference alone enables generation; source purpose can be set to aspiration; 390px intake has no document overflow. Screenshot: `output/discovery-bio/source-led-discovery.png`. Checks did not submit the generation button or call paid providers.

Provider-backed generation remains unverified: the isolated local environment has no model/scraper credentials configured. Mocked orchestration proves wiring and failure behavior, not research quality. This is not yet evidence of a best-in-class brand brain.

Next engine work: visual/document interpretation fidelity, research relevance and coverage, claim-level citations and freshness, contradiction resolution, and comparison against real brand reference cases. Evaluate completeness, factual support, aspiration separation, market relevance and usability in specialist briefs. Keep claims about quality grounded in those evaluations.

The previous office implementation is outside this correction. No main checkout, real client, hosted migration or paid provider execution was changed.
