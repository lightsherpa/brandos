# CaastorOS / BrandOS UI: anti-slop review (Oct 10, 2026)
Read-only review. Code copy: /workspace/caastoros/CaastorOS. Reference images: /workspace/ui-refs/.

## 1. Diagnosis: the slop tells (verified in code)
| Tell | Evidence |
|---|---|
| Mono uppercase micro-labels everywhere ("STRATEGIC WATCHOUTS", "GAPS", breadcrumb, status pill) | `public/caastor/portal.css`: `var(--font-mono)` used 26x vs `--font-sans` 9x; `text-transform: uppercase` 17x; letter-spacing .07–.16em (lines 72, 130, 181, 193); 31 more `uppercase` in `src/*.jsx`. The "terminal-chic" eyebrow is the #1 AI-generated-UI signature. |
| Font roulette | `ds-tokens.css:73-77` defines Inter Tight + Geist Mono + Instrument Serif; `:341-344` ships a runtime switcher (`inter/geist/plex/serif-mix`); screenshots render IBM Plex Sans Condensed + Plex Mono (same stack as the pitch HTMLs). Four families plus a picker = no typographic identity. |
| Colored left-border callout cards (blue/green/amber/red) | Screenshot 3; `border-left` styling in `src/portal-brandolph.jsx`, `portal-shared.jsx`, `portal-briefs.jsx`, `portal-admin.jsx`, `portal-team.jsx`. Classic generated-dashboard pattern; colour carries no meaning (green = "watchouts"?). |
| Generic indigo/blue primary + random palettes | `ds-tokens.css:140` `--accent: #4F46E5 /* electric indigo */` (Tailwind indigo-600, the default AI accent); alternate palette `#7C3AED` violet + `#84CC16` lime. `caastor-tokens.css:68-72` maps all `--blue-*` to one status colour. |
| Equal-weight CTA stacks | Screenshot 2: 6 buttons, 2 filled primaries ("Review & self-certify", "Feed Brandolph"), 4 outlined with icons, varying widths, right-aligned vertical stack. No primary, no grouping, no overflow. |
| Icon set is hand-rolled, inconsistent | No icon library in deps. `portal-shared.jsx:385` custom `Icon` (20px grid, stroke 1.6) + inline SVGs at stroke 1.6 (`:322`) and 24px/stroke 2 (`portal-shell.jsx:530`). Mixed grids/strokes = wobbly optical weight; glyphs read like default Lucide. |
| Radius soup | border-radius: 10px x14, 12px x11, 999px x9, 8px x8, 4/14/16px. Should be 2–3 values. |
| Inline-style drift | e.g. `portal-brandolph.jsx:165-217` `style={{fontSize:11.5}}`, `fontSize:12`, ad-hoc flex; "→" / "←" glyph links everywhere. |
| Gimmick status | "BRANDOLPH IS READING" uppercase pill + pixel avatar (`src/pixel-office/`): reads as toy/chatbot, undermines "certified" trust. |
| Over-explaining copy | Screenshot 3 intro paragraph inside a tinted card; "self-certify", "Feed Brandolph" jargon. |

## 2. References (URLs exactly as returned)
Mobbin
1. Linear sidebar + list: https://mobbin.com/screens/fd1b4d88-f021-49a3-98af-4cd3a87e1d29 — sentence-case section headers ("Your teams", "Try") in muted 12px sans, no mono/caps; 13px rows, 16px icons, one subtle active fill. Image: ui-refs/mobbin-linear-sidebar.jpg
2. Linear customize sidebar: https://mobbin.com/screens/f81c0f0b-aaf3-45a0-9985-d79c9b0c0cca — grouped settings in plain bordered panels, no colour coding.
3. Linear issue detail: https://mobbin.com/screens/f00cc4fb-4083-43fc-a0fb-703a6c4ef771 — object page = title + body left, Properties rail right; actions are icon buttons top-right, zero filled buttons. Image: ui-refs/mobbin-linear-issue-detail.jpg
4. Linear project grouped list: https://mobbin.com/screens/ef923b0e-9a40-4fdd-80f2-f3aafb4f36ce — status via small coloured status glyph + count, not coloured borders.
5. Attio record page: https://mobbin.com/screens/feab3de9-e5a0-48cc-861b-4f0a87289fea — model for the BIO page: header with logo+name, tabs (Activity/Emails/Notes), right "Record details" key/value rail; 3 secondary header actions, overflow "⋮". Image: ui-refs/mobbin-attio-record.jpg
6. Attio table + shortcuts: https://mobbin.com/screens/fa567c5a-616d-4991-88fc-e2a047b5fcfd — dense tables, tags as neutral chips, keyboard-first.
7. Attio sidebar: https://mobbin.com/screens/f85654c3-a89c-444e-bdf4-7ba40c3118f4 — Favorites/Records/Lists, the single blue button is the only filled one ("Add billing").
8. Frame.io review: https://mobbin.com/screens/ee704edf-a186-4f30-98ed-e15525a6ac59 — review = asset centre + comment rail; for certifier flow. Image: ui-refs/mobbin-frameio-review.jpg
9. Frame.io empty comments: https://mobbin.com/screens/ed2618fe-e7af-48c3-90a3-0a66c30033f2 — quiet empty state: one glyph, one line.
Refero
10. Linear active issues: https://refero.design/pages/53f2db5e-8089-4e75-a767-9f6d21c8ba23 (ui-refs/refero-linear-active.jpg) — Briefs list model.
11. Linear issue: https://refero.design/pages/cb07661a-3372-4bf9-80ce-4b308e947548 (ui-refs/refero-linear-issue.jpg) — activity log as audit trail.
12. Intercom Fin AI agent setup: https://refero.design/pages/1ca4151b-aa42-41bc-8775-db41ca1c50a1 (ui-refs/refero-intercom-fin-agent.jpg) — agent shown as a configured product with step checklist + live preview, not a cartoon "is reading" pill.
13. Airtable empty state: https://refero.design/pages/551a5f79-b6bf-4be0-b57c-92e463a06b69 (ui-refs/refero-airtable-empty.jpg) — single primary action empty state.
Note: Mobbin/Refero results for Notion, Vercel, Pitch, Frontify, Brandfolder were not pulled in this pass; worth a second search for the Library/Brand Book view (Frontify).

## 3. Design direction
- **Type**: one sans for all UI. Recommend **Söhne** (licensed) or free **Geist Sans**; alt **Inter Display/Inter** at proper sizes. Mono (**Geist Mono**) ONLY for IDs, hex codes, tokens, numbers in tables. Optional editorial serif (**Instrument Serif** is fine, or **Tiempos Headline**) only for the Brand Book / BIO hero title, never in chrome. Delete the font switcher (`ds-tokens.css:341-344`).
- **Scale** (px/line-height): 12/16 meta, 13/20 UI body, 14/22 reading body, 16/24 section title (600), 20/28 page title (600), 28/34 hero (serif optional). Weights 400/500/600 only. No uppercase except 2-letter badges; letter-spacing 0 (−0.01em ≥20px).
- **Colour**: neutral warm-grey ramp (bg #FAFAF9, surface #FFF, border #E7E5E4, text #1C1917 / muted #78716C). One accent, not indigo: use the brand ink (near-black #1C1917 primary buttons, Linear/Vercel-style) and keep Caastor yellow #F5B400 as a tiny brand signal (logo, certified seal). Status colours (green/amber/red) only on small dots/badges, never on card borders or large fills.
- **Buttons**: max 1 filled primary per view, top-right of the page header. ≤2 secondary (ghost/outline) next to it; everything else in a "⋯" overflow menu. One height (32px), radius 6px, icons only on icon-only buttons or leading 16px when it adds meaning. Destructive in menus.
- **Icons**: adopt one library: **Phosphor (regular)** or **Lucide at stroke 1.5, 16px** consistently — delete the hand-rolled set. Rule: icons in nav and icon-only buttons; not in every text button; one size per context (16 nav/buttons, 14 inline).
- **Components**: cards = 1px border, radius 8, no shadow, no coloured borders; callouts become plain sections with headings or a key/value list; tags = neutral chips; status = dot + sentence-case label; radii only 4/8/full.
- **Density**: 4px grid; spacing 4/8/12/16/24/32/48; sidebar 240px, rows 28–32px; content max 960px for reading pages; "cozy" density default.
- **Voice**: sentence case, verbs on buttons ("Certify brand"), no explainer paragraphs in tinted boxes; move help to a "?" tooltip.

## 4. Screen-by-screen fixes
1. **Sidebar** — section labels → sentence-case 12px muted sans ("Workspace", "Brand"); rename "BIO" → "Brand profile"; single icon set, 16px; active = subtle grey fill, no accent bar; group "Specialists/Humans" under "Team".
2. **Button stack** → page header: primary **Certify brand** (one filled, ink); secondary **Open brand book**; overflow ⋯: Edit profile, Re-run discovery, Request human review, Add sources ("Feed Brandolph"). Horizontal, right-aligned in header.
3. **BIO strategic step** — remove 4 coloured left borders and the tinted intro box. Layout like Attio: left column sections with 16px/600 sentence-case headings ("Watchouts", "Brand is not"), right rail "Gaps (4)" as a checklist with amber dots and an "Add evidence" link each. Step indicator as "1 of 2" in header, not mono caption. Replace ✕ glyph list with plain bullets.
4. **Briefs header** — breadcrumb in 13px sans muted with "/" separators, title 20/600; filters as tabs (All / Active / Certified) like Linear; one "New brief" primary.
5. **"BRANDOLPH IS READING" pill + pixel avatar** — replace with inline status row: spinner/dot + "Reading sources… 3 of 7" sentence-case, plus a collapsible step log (Intercom Fin / Linear activity style). Drop pixel avatar in client-facing views (keep for internal/fun only).

## 5. Priorities
**Before VDS (Oct 21) — CSS/token-level, low risk, demo screens only**
1. Single font + kill font switcher default; replace mono eyebrows with sans (global CSS change on `.eyebrow`/mono label classes in portal.css).
2. Remove coloured left borders; neutral cards.
3. Button hierarchy on BIO/brand header + Briefs (1 primary + overflow).
4. Swap indigo accent for ink primary; status colour only on dots.
5. Agent status pill → sentence-case progress row.
6. Normalize radii to 4/8/full and button height 32.
(Needs Oscar's go-ahead to touch code; CTO owns demo stability — coordinate with the Oct 16/17 freeze.)

**November MVP**
- Adopt one icon library and remove hand-rolled icons; clean inline styles into tokens; Attio-style object page for brand profile; Frame.io-style certifier review view; empty states; keyboard shortcuts / command menu; full token rewrite with a documented type scale; second reference pass (Frontify/Brandfolder/Pitch).
