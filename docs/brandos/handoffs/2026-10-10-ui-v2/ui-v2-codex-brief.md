# UI v2: Codex brief

## Goal
The UI must read as made by a design studio, not generated. No AI slop: no gradients, glows, glassmorphism, emoji, sparkle icons, purple, generic Lucide icon grids, rounded "card soup", or uppercase micro-labels.

## Already done (branch `cursor/ui-test-instrument-sans-d763`, PR #6)
- Instrument Sans for the UI, Instrument Serif for display, Geist Mono for data only. Font switcher removed.
- Indigo removed; warm grey neutrals; near-black primary.
- 1px borders, radii limited to 4 / 8 / full.
- One primary button per view; extra actions in the `⋯` menu.
- Sidebar in sentence case; "BIO" renamed to "Brand profile".
- Status line "Reading sources… 3 of 7".
- Dev fixture: `VITE_UI_FIXTURE=1 npm run dev`, routes `#/bio` and `#/briefs`.

## To do (behind `VITE_UI_V2`)
1. **Brand profile = cover.** Brand name in Instrument Serif at 120–200px with tight tracking, positioning line below, then a 7-section index row (number, name, status dot). Score in a yellow seal at the top right. Reference: mock A.
2. **Sections = spreads.** Voice: quote, say / never-say. Visual: large swatches with role + hex, type specimen. Reference: mock B.
3. **Certification seal.** An outline seal when the client confirms; filled `#F8C036` when the Creative Director certifies. One 400ms stamp animation; respect reduced motion.
4. **Discovery reading.** One sentence driven by real progress, numbered stages, findings appear as they land. Reference: mock C.
5. **Yellow rule.** `#F8C036` only for the seal, highlight and logo, at most 3 uses per view. Never as text on paper.
6. **Grid.** 12-column grid, hairline rules, asymmetric splits, big serif numbers for key stats.
7. **Motion.** 120–240ms for UI, 400–520ms for ceremony; ease `cubic-bezier(.2,.7,.2,1)`. No bouncing.

## Constraints
- CSS and markup only. No logic, API or migration changes. No new dependencies.
- Tokens scoped under `[data-ui="v2"]`. WCAG AA.

## Done when
- Brand profile, Discovery, Briefs, run output and certification all render in v2 on the fixture.
- Before/after screenshots of each are committed.
- Build and tests pass, pushed to `feat/ui-v2-press-proof`.

Mocks: `ui-elevate-mock-a-cover.png`, `-b-spread.png`, `-c-dark-studio.png`.
