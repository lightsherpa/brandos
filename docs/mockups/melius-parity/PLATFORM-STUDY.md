# Plex Registry platform study

2026-10-04. Extends the Melius parity mockup to the remaining CaastorOS product areas, based on the existing ScreenRouter, client/team route lists and SettingsView sections. This is a reviewable local design study, not production integration or permission enforcement.

Open `index.html?view=bio` on the existing local server at port 5184. The “Rest of the platform…” selector is prototype navigation, not a proposed product dropdown. Direct preview links accept `?view=<id>`.

## Coverage

| Area | Views / controls | Production source |
| --- | --- | --- |
| Entry and creation | Existing Home, Canvas and review; sign-in validation preview | portal-auth.jsx, portal-brandolph.jsx, portal-briefs.jsx |
| Briefs | Searchable status/owner/credit list, canvas handoff | portal-briefs.jsx |
| BIO | Essence, voice, visual direction, refusals, certification history and source evidence | portal-discovery.jsx |
| Discovery | Sources, draft attestation preview, blocked certification explanation | portal-discovery.jsx |
| Library | Existing asset selection and actions, aligned client rail | portal-briefs.jsx |
| Specialists | Search, expandable definition, canvas handoff, authoring form | portal-briefs.jsx |
| Humans | Craft scope and review/craft handoff | portal-craft.jsx |
| Credits and plans | Estimate versus spent distinction, ledger, tier comparison without invented prices | portal-craft.jsx, portal-shell.jsx |
| Account | Profile, workspace, members, brands, billing, usage, rules, integrations, notifications, language, API & MCP, export/deletion | portal-craft.jsx |
| Team | Review desk, queue, assignment, craft polish, capacity, clients, earnings, account | portal-team.jsx |
| Administration | People/access, versioned specs, translations, sourced memory, restricted OPEX fixture state | portal-admin.jsx, portal-shell.jsx |

22 new selector views plus assignment detail, alongside the existing four views. Account and BIO contain additional subsections. These are representative layouts of the product's main surfaces; they do not reproduce every production state or capability.

## Design decisions

- Share `public/caastor/ds-tokens.css` and `plex-registry.css` from the current approved platform direction at localhost:5189.
- IBM Plex Sans for controls, Serif for page/section titles, Mono for metadata. No Inter.
- Mineral paper, white working surfaces, graphite rules, cobalt actions. Green signifies evidence verification and completion.
- Tables for work and credit records, explicit source evidence for BIO, quiet nested settings navigation. No decorative dashboard charts or invented performance metrics.
- Keep client brand typography/palette in deliverable content. Platform controls retain Plex Registry.
- Existing navigation destinations remain recognisable. Canvas is a workspace reached from briefs and creation, not a replacement chat product.
- Prototype access to team/admin areas is intentional for visual review; production role restrictions are not changed.

## Preview behaviour and limits

Search filters sample records and shows an empty result. BIO chapters, account sections and discovery previews switch locally. Account drafts survive subsection switching in memory and reset on reload. Form submissions show preview feedback; no server writes, extraction, credential transmission, paid generation, billing, invitation or access changes occur. Disabled controls identify unsupported consequential actions. Original canvas interactions remain simulated.

The inherited mockup images remain random placeholders. Claims, identities, records and credits are labelled sample data. No vendor costs, payout amounts, prices or newly granted entitlements are invented. Plan and OPEX panels explain missing verified data.

## Verification

- Browser: all 22 selector destinations render their heading at desktop and 390px; mobile main panes fit their available width after fixing Discovery's native file input and form button overflow. Wide tables scroll internally.
- Interaction: brief search narrows to one row; no-result state appears; BIO refusals tab updates; account saves show feedback and retain local profile values across section switching; Discovery reveals an attestation preview; direct `?view=bio` link renders the requested view.
- Browser console: no errors observed during the final interaction pass.
- JavaScript syntax and whitespace checks pass. No new dependencies or production source edits.
- Screenshots: `output/melius-parity/platform-{bio,briefs,review-desk,account,review-mobile}.png`.

## Integration boundary

If approved for implementation, reuse the production components and data hooks above. Replace sample rows with existing APIs, enforce permissions, preserve current account/Discovery flows, and use actual source/version/credit records. Visual review of this study is not evidence that those production integrations have shipped.
