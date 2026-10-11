# Handoff: BrandOS UI anti-slop pass (CSS/tokens only)

Paste this into Codex or Claude Code, working in your current worktree
(`.claude/worktrees/melius-competitor-analysis-e18b7d`). If you haven't yet, commit and push that branch first.

## Goal
Make the app feel calm and premium, in the spirit of Linear, Attio and Frame.io. This is a visual pass only: no logic, data, API or migration changes. Run it locally with `npm run dev:all`.

## Rules
- **Fonts:** Instrument Sans for the whole interface. Instrument Serif only for brand profile and Brand Book titles. Geist Mono only for IDs, hex codes and numbers. Don't use Inter Tight or Geist Sans. Remove the runtime font switcher (tweaks panel / font toggles).
- **Labels:** replace mono UPPERCASE micro-labels with sentence-case sans labels (13px, medium, muted grey).
- **Colour:**
  - Warm grey neutrals (for example `#FAFAF9`, `#F5F5F4`, `#E7E5E4`, `#A8A29E`, `#57534E`, `#1C1917`).
  - A near-black primary (`#1C1917`) in place of indigo `#4F46E5` everywhere.
  - Caastor yellow only for the logo and the certified seal.
  - Status colours only as small 6–8px dots.
- **Cards:** a plain 1px border in a warm grey, no coloured left borders, no heavy shadows.
- **Radii:** exactly three tokens: `--r-sm: 4px`, `--r-md: 8px`, `--r-full: 9999px`. Replace every other radius.
- **Buttons:** all 32px tall. One filled primary per view, at most two secondary (outline or ghost), and the rest in a `⋯` overflow menu.
  - On the brand profile view: **Certify brand** is primary, **Open brand book** is secondary, and the other four actions go in `⋯`.
- **Sidebar:** sentence-case labels. Rename "BIO" to **Brand profile** in the UI text only (en/es/ar locale files), not in routes or data.
- **Status pill:** "Reading sources… 3 of 7" in place of "BRANDOLPH IS READING". Use the real progress from `src/lib/discovery-progress.js`.

## Steps
1. Centralise the tokens (fonts, colours, radii, button height) in the existing token CSS (`ds-tokens.css` / `caastor-tokens.css` / `portal.css`). Load Instrument Sans (Google Fonts or self-hosted).
2. Search and replace: `#4F46E5` and other indigo values, uppercase and letter-spacing label classes, `border-left` accent styles, and stray `border-radius` values.
3. Update the brand profile, Briefs and sidebar components (`src/portal-*.jsx`, `src/portal-discovery.jsx`) for the button hierarchy and the overflow menu.
4. Update the locale strings.
5. Run `npm run build` and the unit tests. Click through the brand profile, Briefs and the sidebar on localhost.
6. Take before and after screenshots of those three views and commit on a branch named `ui/anti-slop-test`. Push it.

## Done when
- No indigo, no uppercase mono labels and no coloured left borders remain anywhere.
- Every view has one primary button.
- The build and tests pass, and screenshots are attached.
