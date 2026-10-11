# Codex handoff — BrandOS UI v2: "Press Proof"

> Paste everything below the line into Codex. Written 2026-10-10 (Europe/Madrid) by the BrandOS CTO agent. Mockups to react to first: `/workspace/brandos/ui-elevate-mock-a-cover.png`, `-b-spread.png`, `-c-dark-studio.png` (+ `.html`).

---

## 0. Context and setup

BrandOS (repo `lightsherpa/brandos`, code name CaastorOS) sells certified brand work. Oscar reviewed the cleanup build (branch `cursor/ui-test-instrument-sans-d763`, PR #6) and said it is **"very plain and bland — nothing interesting, exciting, engaging or vanguard."** A product that sells design must signal taste in its own UI.

**Keep everything PR #6 achieved:** Instrument Sans for UI, Instrument Serif for display, Geist Mono only for data, one primary action per view, no indigo, no mono-caps eyebrows, no coloured left-border callouts (see `/workspace/ui-anti-slop-review.md`). This task **adds a point of view on top**; it does not undo the cleanup.

```sh
git fetch origin && git checkout -b feat/ui-v2-press-proof origin/cursor/ui-test-instrument-sans-d763
VITE_UI_FIXTURE=1 VITE_UI_V2=1 npm run dev     # fixture data, v2 on
VITE_UI_FIXTURE=1 npm run dev                  # compare: v1 (PR #6) must still render
```

## 1. Direction: **Press Proof**

BrandOS should feel like a design studio's proof sheet: an editorial publication about *your* brand, printed on warm paper, that becomes official when a Creative Director stamps it. Big serif moments carry the brand's own words; a strict hairline grid and quiet sans keep the product usable; Geist Mono appears only where data is (versions, counts, sources, timestamps). Colour comes from the client's brand (their palette, their imagery). BrandOS owns exactly one colour, **Caastor yellow `#F8C036`**, used like a highlighter and a wax seal: the certification seal, the active dot, the live-progress line, refused words. This is the move today's best studio and award sites make (twks, Awwwards SOTD 7 Oct 2026: one neutral system, colour belongs to the work; Odyssée/Tengile SOTDs: one light display serif with strict functional type roles), crossed with tool-grade calm (Linear's 2026 refresh: softer warm neutrals, fewer icons, less chrome) and hardware honesty (Teenage Engineering: hairlines, no shadows, data as design). The result is not "a dashboard with a serif"; it is a brand book that is alive.

### Research moves pulled (sources)
| Source | Move we take |
|---|---|
| twks — Awwwards SOTD 7 Oct 2026 (https://dokle.design/awards/twks-black-and-white-site-so-the-work-can-shout) | UI owns no colour; client colour is the only colour. Visible grid, first-line indents, superscript counts (`7⁷`). Grey = "second in line". |
| Maria Vasilyeva — SOTD 9 Oct 2026 (https://dokle.design/awards/maria-vasilyeva-portfolio-laid-out-like-a-score) | One serif for voice, one mono for controls; numbered sections `(01)`; annotation layer that can be toggled → our provenance layer. |
| Tengile MalaMala — SOTD 3 Oct 2026 (https://dokle.design/awards/tengile-malamala-staircase-page-titles) | Staircase title: one signature title shape reused on every page; copy anchors under the step. |
| Odyssée — SOTD 8 Oct 2026 (https://dokle.design/awards/odyssee-split-page-titles-over-full-bleed-footage) | Light, tightly spaced serif for headlines only; functional text never mixes with it on one line. |
| Linear refresh 2026 (https://linear.app/now/behind-the-latest-design-refresh) + UI redesign (https://linear.app/now/how-we-redesigned-the-linear-ui) | Fewer, smaller icons; soften borders; theme from 3 inputs (base, accent, contrast). |
| Vercel Geist (https://vercel.com/geist) | Geist Mono for numbers/data; grid as aesthetic; materials limited to a few radii/strokes. |
| Teenage Engineering (https://www.shadcn.io/design/teenage-engineering) | Hairlines not shadows; near-zero radius on surfaces; data and object carry the page. |
| Pentagram / Collins / Koto (pentagram.com, wearecollins.com, koto.studio — general observation, not fetched this pass) | Case-study cover pages: giant name, one line of positioning, index of chapters → our Brand Profile cover. |
| Existing refs `/workspace/ui-refs/` (Linear sidebar/issue, Attio record, Frame.io review, Intercom Fin agent) | Shell density and record layout from Linear/Attio; Frame.io's review → approve ceremony; Fin's agent-activity transparency → crew panel. |
| Repo brand material (`docs/agency-generation-kit/Brand-OS-Asset-Generation-Guide.md`, `Character-Direction-v2.md`, `website/2026-06-08-caastor-guia-tono-de-voz-*.docx`, yellow `#F8C036`) | Studio warmth (oak, plants, orange chairs) informs the warm palette; pixel crew used *small and tasteful*; voice = "the peer who's been there, craftsman with criteria, anti-agency, anti-smoke". |

## 2. Typography

Families (already loaded in PR #6): `Instrument Serif` (display, 400 + italic), `Instrument Sans` (UI 400/500/600), `Geist Mono` (data 400/500). Nothing else.

| Token | Family | Size / line-height | Tracking | Use |
|---|---|---|---|---|
| `--t-mast` | Serif | `clamp(120px, 13vw, 200px)` / 0.86 | -0.045em | Brand name on Profile cover only (one per app) |
| `--t-display` | Serif | 76 / 0.95 | -0.035em | Discovery narrative, certification moment |
| `--t-h1` | Serif | 56–64 / 1.0 | -0.03em | Page titles, spread titles ("04 — Voice") |
| `--t-quote` | Serif | 34–52 / 1.05 | -0.025em | Positioning line, brand voice pull-quote (hanging punctuation) |
| `--t-h2` | Serif | 26 / 1.1 | -0.015em | Section index titles, card titles |
| `--t-body` | Sans | 15 / 1.5 | 0 | Body |
| `--t-ui` | Sans 500 | 14 / 1.3 | 0 | Nav, buttons |
| `--t-label` | Sans 500 | 12 / 1.3 | 0.01em | Field labels, sentence case, `--ink-3` |
| `--t-data` | Mono | 11.5–13 / 1.4 | 0 | Versions, counts, timestamps, sources, hex |
| `--t-num` | Serif | 96–120 / 0.9 | -0.04em | Big numbers (score, sources read, outputs) |

Rules: serif never below 22px; never uppercase anything (except inside the seal ring); italics only for the client's own words or one emphasised word per headline; one `--t-mast` per screen; hanging quotes (`text-indent:-.4em`).

## 3. Colour

```
Light (default)            Dark (optional, [data-theme=dark])
--paper     #F4F1EA        #12110E
--paper-2   #ECE7DC        #1C1A16   (raised surface / panels)
--ink       #16140F        #F1ECE0
--ink-2     #5E584C        #B3AB99   (secondary text, AA on paper)
--ink-3     #9A9384        #77705F   (tertiary, labels ≥ 12px only, decorative/large)
--rule      #D8D1C2        #2C2923   (hairlines)
--y         #F8C036        #F8C036   (Caastor yellow)
--y-ink     #3A2A00        #3A2A00   (text ON yellow — 9.9:1)
--ok        #2F6B47        #6FB08A
--warn      = --y (dot only, never as text colour on paper)
--danger    #A63A2B        #E07A66
```
Yellow budget per view: **≤ 3 instances** (seal, active nav dot, one live/progress element, refused tag). Never as button fill, never for text on paper (fails contrast). Primary button = ink pill. Client palette shown at full size as *content*, never as UI chrome. Dark mode is for the "studio is working" moments (Discovery, runs) and as a user toggle; light is default.

## 4. Layout

- 12-col editorial grid, max content 1180px, gutter 24px, page padding 56px (desktop) / 20px (mobile); sidebar 232px.
- Asymmetry: 7/5 and 8/4 splits; titles left, meta right-aligned; the right column carries numbers and seal.
- Generous vertical rhythm: 8px base; section gaps 56–96px. A single 1px `--ink` rule closes each major section (masthead rule); `--rule` hairlines inside.
- Numbered sections `01–07` in mono, index rows across full width.
- Big numbers with superscript denominators (`7⁄7`, `72` with `/100` small mono).
- Radius: 0 for surfaces/tiles, 4px for panels, 999px for buttons/chips. No shadows except focus and the modal scrim.

## 5. Signature moments

1. **Brand Profile = living cover + brand book** (mock A + B). Cover: masthead name in `--t-mast`, positioning line in `--t-quote`, right column = seal (score) + big "sources read" number + review meta, then a 7-cell chapter index with status dots. Scrolling turns into *spreads* (01 Identity … 07 Not us), each a magazine spread: pull-quote of the brand's own words with provenance in mono, palette as giant swatches with role + hex, type specimen `Aa`, "say / never say" list with refused words struck through and tagged yellow. Toggle "Show sources" = annotation layer (Maria Vasilyeva move) that reveals provenance chips inline.
2. **Certification = ceremonial seal.** The seal is a yellow disc with mono text on a circular path (`AWAITING SEAL · BIO V3 · BRANDOS`). On certification: ring text rotates in (600ms), disc scales 0.6→1.04→1 with a slight 6° rotation (stamp press, 520ms), a paper "deboss" shadow fades, the ring text swaps to `CERTIFIED · {CD FIRST NAME} · {DATE} · BIO V3`, and the masthead gains a small "Certified" mark. Self-certification uses an *outline* seal (ink stroke, no fill); only the Creative Director fills it yellow.
3. **Agents working = the crew** (mock C). A compact studio panel: one tile per active specialist with a 28px pixel portrait (reuse `src/pixel-office/` sprites, scaled with `image-rendering: pixelated`, max 32px), name, and a live mono status line in yellow. Idle crew dimmed 40%. The full pixel office stays a separate optional view (`#/studio`), never the default (canvas remains the default per CLAUDE.md).
4. **Discovery reading = progress narrative** (mock C). A sentence in `--t-display` that updates as stages finish ("Reading *seven* sources to understand how Northshore sounds, looks and competes."), a 2px yellow progress rule under it (real progress from `src/lib/discovery-progress.js`, never a fake timer), a numbered stage list in hairline rows with mono status, and **first findings** surfaced as italic serif quotes with a timestamp as they arrive.

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entrances |
| `--ease-press` | `cubic-bezier(.3,1.4,.4,1)` | seal stamp only |
| `--d-1` 120ms | hover, press | |
| `--d-2` 220ms | menus, chips, tab underline | |
| `--d-3` 420ms | page/section reveal (opacity 0→1 + translateY 8px), stagger 40ms, max 6 items | |
| `--d-seal` 520ms + ring 600ms | certification | |
| progress rule | width transition 600ms linear on each real update | |
Principles: motion confirms state, never decorates; nothing loops except live status dots (1.6s opacity pulse) while work runs. `@media (prefers-reduced-motion: reduce)` → all durations 0.01ms, seal swaps instantly, no pulse, no stagger.

## 7. Micro-interactions, texture, icons, empty states, copy

- **Micro:** buttons darken 6% on hover and depress 1px; links get a 1px underline that draws left→right (`--d-2`); swatches copy hex on click with a mono "Copied" toast; chapter index row hover shows a hairline under the title; Cmd/Ctrl-K stays.
- **Texture:** SVG fractal-noise grain overlay at 6–7% on `--paper` (one fixed pseudo-element, `pointer-events:none`, inline data URI, < 1KB). Off in dark mode or at 4%. Client imagery shown full-bleed inside spreads with a 1px hairline frame, no rounded corners, no drop shadows.
- **Icons:** cut to the minimum (Linear refresh move). One set, 16px on a 16px grid, 1.5px stroke, round caps; nav items are text-only except Create (+). If a library is needed, `lucide-react` is *not* allowed (reads as default slop); hand-draw ≤ 12 icons in `src/ui/icons.jsx`.
- **Empty states:** editorial, not illustrations. A serif sentence + one action. e.g. Library: "*Nothing printed yet.* Approved work lands here, versioned and certified." Briefs: "*No briefs on the table.* Tell Brandolph what you need."
- **Copy tone:** Caastor voice (tone guide `website/2026-06-08-caastor-guia-tono-de-voz-vB-diseno.docx`): peer who has been in the founder's chair, craftsman with criteria, anti-agency, anti-smoke. Short, concrete, sentence case. Kill jargon: "Feed Brandolph" → "Add a source"; "Self-certify" → "Confirm it's right"; "Brand Steward" → "Creative Director". Never "brand brain".

## 8. Per-view specs

**Shell / sidebar.** 232px, `--paper`, right hairline. Wordmark: yellow 14px dot + "BrandOS" in serif 26px. Workspace block: brand name (sans 500) + one-line descriptor. Nav: text-only, sentence-case group labels (`--t-label`), counts in mono right-aligned, active = ink text + yellow 6px dot in the gutter (no fill pill). Footer: mono `v3 · date`. Top bar removed on v2; each page owns its header row: left mono breadcrumb-ish context, right max 1 primary + 1 secondary.

**Brand profile** (mocks A, B). Cover as §5.1. Primary action depends on state: Draft → "Confirm it's right" (outline seal flow); Self-certified → "Send for certification"; Certified → "Open brand book" (primary) + "Create a brief". Spreads: 01 Identity, 02 Audience, 03 Position, 04 Voice, 05 Visual, 06 Market, 07 Not us. Gaps render as italic serif "*Not stated by your sources.*" never empty boxes. Old tab bar replaced by the sticky chapter index (scroll-spy).

**Discovery.** Intake (free-form, keep Codex's source-led logic): page title staircase "Show us the brand / *as it is and as it wants to be.*"; three stacked hairline sections — Website, References (purpose chips: Current / Aspiration / Competitor), Files; single primary "Read my brand". Reading state = §5.4 in dark mode. Done state = cross-fade to the Profile cover with the seal in outline.

**Briefs / canvas.** Brief list as an editorial index (number, title in serif 22, status mono, date). Canvas keeps `CanvasHeader` + `InteractiveCanvas` (CLAUDE.md rule) restyled: nodes = paper cards, 0 radius, hairline, serif titles; edges 1px `--ink-3`; running node shows the crew portrait + yellow pulse; done node shows a small ink check. Crew panel (§5.3) docks right.

**Run output.** Output card = a "proof": asset full-bleed in a hairline frame, below it a mono receipt line `Composed by Social Captions · BIO v3 · Brand Judge 86 · 10 Oct`, then actions: one primary (Approve), secondary (Request changes), overflow. Approved outputs get a small ink check; certified ones a mini yellow seal (16px).

**Certification (modal + CD view).** Modal from PR (Codex self-cert v2) restyled: left column = 7 section previews as numbered rows that tick as reviewed (counter in big serif `5/7`); right = three declarations as large tappable rows; confirm button disabled until complete; on success the outline seal animates in with the receipt. CD view: rubric rows with 0–4 segmented controls in mono; decision → seal animation §5.2.

## 9. CSS tokens to add (`public/caastor/ds-tokens.css`, scoped `[data-ui="v2"]`)

```css
[data-ui="v2"]{
  --paper:#F4F1EA;--paper-2:#ECE7DC;--ink:#16140F;--ink-2:#5E584C;--ink-3:#9A9384;--rule:#D8D1C2;
  --y:#F8C036;--y-ink:#3A2A00;--ok:#2F6B47;--danger:#A63A2B;
  --font-display:"Instrument Serif",Georgia,serif;--font-ui:"Instrument Sans",system-ui,sans-serif;--font-data:"Geist Mono",ui-monospace,monospace;
  --t-mast:clamp(120px,13vw,200px);--t-display:76px;--t-h1:60px;--t-quote:44px;--t-h2:26px;--t-num:112px;--t-body:15px;--t-ui:14px;--t-label:12px;--t-data:12px;
  --track-mast:-.045em;--track-display:-.035em;--track-h:-.03em;
  --grid-max:1180px;--gutter:24px;--pad-page:56px;--side-w:232px;--space-section:72px;
  --r-0:0;--r-panel:4px;--r-pill:999px;--hair:1px solid var(--rule);--rule-strong:1px solid var(--ink);
  --ease-out:cubic-bezier(.2,.8,.2,1);--ease-press:cubic-bezier(.3,1.4,.4,1);--d-1:120ms;--d-2:220ms;--d-3:420ms;--d-seal:520ms;
  --grain-opacity:.065;
}
[data-ui="v2"][data-theme="dark"]{--paper:#12110E;--paper-2:#1C1A16;--ink:#F1ECE0;--ink-2:#B3AB99;--ink-3:#77705F;--rule:#2C2923;--ok:#6FB08A;--danger:#E07A66;--grain-opacity:.04}
@media (prefers-reduced-motion:reduce){[data-ui="v2"]{--d-1:.01ms;--d-2:.01ms;--d-3:.01ms;--d-seal:.01ms}}
```

## 10. Implementation steps (in order; commit + push after each)

1. **Flag plumbing.** `src/main.jsx`: if `import.meta.env.VITE_UI_V2 === "1"` set `document.documentElement.dataset.ui = "v2"`. Add `src/lib/ui-flag.js` exporting `isUiV2()`. No logic changes.
2. **Tokens + base.** Add §9 to `public/caastor/ds-tokens.css`; new `src/ui/v2.css` (grain, type classes `.t-mast/.t-display/...`, grid utilities `.ed-grid`, `.col-7`, hairline helpers). Import once in `main.jsx`.
3. **Primitives** in `src/ui/`: `Seal.jsx` (states: outline / pending / certified; SVG textPath ring; animation via CSS classes), `BigNumber.jsx`, `ChapterIndex.jsx` (scroll-spy), `Spread.jsx`, `Provenance.jsx` (toggle layer), `CrewPanel.jsx` (reads existing run/agent state; sprites from `src/pixel-office/`), `NarrativeProgress.jsx` (consumes `src/lib/discovery-progress.js`), `icons.jsx` (≤12 hand-drawn icons).
4. **Shell.** `src/portal-shell.jsx`: v2 branch for sidebar + page header per §8. Keep routes/handlers identical.
5. **Brand profile.** `src/portal-discovery.jsx` BioViewer (or the profile component on the PR #6 branch): v2 render path → cover + spreads using the primitives; data from the same hooks (`useLiveBio`, existing mappers). Fixture: `VITE_UI_FIXTURE=1` Northshore.
6. **Certification.** Restyle the self-cert modal (`src/bio-self-certification.jsx` if present on the branch, else the existing SelfCertPanel) and `src/portal-team.jsx` RubricPanel; wire Seal animation to the *existing* success callbacks.
7. **Discovery.** Intake + reading state in `src/portal-discovery.jsx` (+ `src/discovery-intake.css` if present) per §8; dark theme on reading state via `data-theme` on the page container.
8. **Briefs / canvas / run output.** `src/portal-briefs.jsx` list + `CanvasHeader` + node renderer + `OutputCard` in `src/portal-shared.jsx`; CrewPanel docked.
9. **Empty states + copy** pass (EN/ES/AR locale keys only; no logic).
10. **QA:** contrast check, reduced-motion check, screenshots (§12), Lighthouse.

## 11. Guardrails

- **Logic untouched:** no changes to API calls, routes, state machines, permissions, data shapes. Only render paths behind `isUiV2()`. v1 must still work with the flag off.
- **Flag:** everything behind `VITE_UI_V2=1`; default off until Oscar approves.
- **Accessibility:** WCAG 2.2 AA. Body text ≥ 4.5:1 (`--ink-2` on `--paper` passes; `--ink-3` only for ≥ 18px or non-essential labels — verify, darken if needed). Never text in yellow on paper. Focus ring: 2px `--ink` outline + 2px offset, visible on every control. Seal and progress have text equivalents (`aria-live="polite"` for Discovery stage changes). Respect reduced motion.
- **Performance:** no new heavy deps. Allowed only if noted in the PR: none expected (CSS animations + SVG). No Lottie/GSAP/Framer Motion. Grain = inline SVG. Fonts already loaded; subset if adding weights. LCP on Profile ≤ 2.0s on fixture; CLS < 0.05.
- **Brand rules:** no indigo/violet/lime; no mono uppercase eyebrows; no coloured left-border cards; one primary per view; yellow ≤ 3 instances per view; canvas stays the default work surface (pixel office only as small crew portraits or the optional `#/studio`).
- **Git:** branch `feat/ui-v2-press-proof` from `cursor/ui-test-instrument-sans-d763`; small commits; push after each step; PR into the PR #6 branch with screenshots.

## 12. Acceptance criteria + screenshot checklist

Acceptance:
- [ ] With `VITE_UI_V2=1 VITE_UI_FIXTURE=1`, Profile matches mock A/B intent: masthead name ≥ 120px serif, chapter index, spreads, big numbers, seal.
- [ ] Seal animates on self-cert (outline) and CD certification (filled yellow), instant under reduced motion.
- [ ] Discovery reading state shows narrative sentence, real progress rule, stage list, first findings, crew panel; works in dark.
- [ ] Shell: text nav, yellow active dot, no icons except Create, one primary per page.
- [ ] Yellow count ≤ 3 per view; no indigo anywhere (`rg -i "4F46E5|indigo" src public` returns nothing used in v2).
- [ ] With flag off, PR #6 UI is unchanged (screenshot diff).
- [ ] `npm run build`, `npm run test:units`, existing UI tests green; axe: 0 serious/critical; Lighthouse a11y ≥ 95.
- [ ] No new dependency (or explicitly listed and justified in the PR).

Screenshots (1440×900 and 390×844, light; dark where noted) to attach to the PR:
1. Profile cover — draft (outline seal)
2. Profile cover — certified (yellow seal) + mid-animation frame
3. Profile spread 04 Voice / 05 Visual (with "Show sources" on)
4. Discovery intake
5. Discovery reading state (dark) with crew panel and a first finding
6. Self-cert modal: 3/7 reviewed and complete states
7. CD rubric view + decision
8. Briefs list + empty state
9. Canvas with a running node and crew docked
10. Run output card (approved + certified)
11. Sidebar close-up
12. Reduced-motion run of certification (before/after only)
