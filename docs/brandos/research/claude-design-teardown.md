# Claude Design teardown, mapped onto BrandOS
Prepared 10 Oct 2026 (Madrid). Tags: **[C]** means confirmed by a public source. **[L]** means it comes from leaked system prompts (unofficial, may be out of date). **[I]** means my own inference.

## Sources
1. Anthropic launch post (17 Apr 2026): https://www.anthropic.com/news/claude-design-anthropic-labs
2. Product page: https://claude.com/product/design
3. Help: Get started: https://support.claude.com/en/articles/14604416-get-started-with-claude-design
4. Help: Set up a design system: https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design
5. Help: Admin guide: https://support.claude.com/en/articles/14604406-claude-design-admin-guide-for-team-and-enterprise-plans
6. Tutorial: decks: https://claude.com/resources/tutorials/using-claude-design-for-presentations-and-slide-decks
7. Leaked prompt (Apr 17): https://leaked-system-prompts.com/prompts/anthropic/anthropic-claude-design_20260417 ; https://github.com/elder-plinius/CL4R1T4S/blob/main/ANTHROPIC/Claude-Design-Sys-Prompt.txt
8. Leaked prompt (later version): https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/claude-design.md
9. Reviews: https://www.mejba.me/blog/claude-design-visual-workflow-claude-code ; https://salesdorado.com/en/ai/review-claude-design/ ; https://kay-zhang.com/blog/honest-review-on-claude-design/ ; https://claude-code-playbook.pages.dev/en/docs/level-4/claude-design-handoff

## 1. Where the product stands
- It launched on 17 Apr 2026 as an Anthropic Labs research preview at claude.ai/design [C1, C9].
- It is now built into every Claude chat, Claude Code and the Artifacts tab as an artifact "template", with on-canvas editing [C2, C3].
- Standalone claude.ai/design is being closed [C5].
- Presentations moved to a separate tool, **Claude Slides** [C5].

## 2. Inputs
- **Starting points [C1, C2, C3]:** a text prompt, DOCX, PPTX or XLSX files, screenshots, competitor examples and wireframes ("make it look like this"), a codebase (GitHub or local), Figma or design files, and a **web capture tool** that grabs elements from a live site.
- **Clarifying questions [L7, L8]:** when a request is new or ambiguous, the agent asks one structured round of questions (`questions_v2` tool) before it builds anything. It skips this for small tweaks. A reviewer also mentions answering "the interview" [C9 mejba].

## 3. How the design system is built and applied
- **Built once at onboarding, by reading what you upload [C1, C4]:**
  - codebase or component library (React works best, via `/design-sync` in Claude Code)
  - decks and PDFs
  - logos, palettes, type specimens
- **What it extracts [C4]:**
  - colour palette (primary, secondary, accent)
  - typography (families, sizes, weights)
  - components (buttons, cards, navigation)
  - layout patterns (spacing, grid, page structure)
- **Governance:**
  - An admin flips a "**Published**" toggle. Every new project in the org then uses that system by default [C4].
  - Teams can keep more than one system [C1].
  - Anthropic recommends that "an experienced designer" sets it up and checks the output [C5].
- **Storage:** each design system is an artifact made of a guide, tokens and components. "Let Claude clean it up" tidies migrated systems [C2].
- **How it is applied:** the system is injected as context plus approved imagery [C6]. Starter components fix the format for each output type [L7]. The agent "checks its own output" against the system [C3, partial snippet].

## 4. Generation pipeline by output type
Everything is one HTML/React document rendered in an iframe [L7, C6].

| Output | Mechanism | Confidence |
|---|---|---|
| Decks | `deck_stage.js` web component: scaling, keyboard navigation, speaker notes, print to PDF. Built as HTML first, then exported to PPTX, PDF or Google Slides. | L7, C6 |
| Landing pages and microsites | A single-page HTML/React file, deployable through Vercel, Netlify or Wix, or handed off to Claude Code. | C5, C3 |
| Prototypes | A hi-fi clickable React file that can use real components. | C1, L7 |
| Visual exploration | `design_canvas.jsx`: a grid of labelled variant cells when comparing 2+ static options. | L7 |
| One-pagers | HTML, exported to PDF. | C3 |
| Emails | No dedicated email pipeline documented. Export targets include Adobe Journey Optimizer and HubSpot, so emails are probably HTML pushed out to those ESPs. | **I** |
| Social | Not documented. Most likely canvas cells sized to each format, or a hand-off to Canva. | **I** |

## 5. Iteration and feedback loops
- **Three ways to give feedback [C3, C5]:**
  - chat
  - direct edits on the canvas (text, colours, sliders)
  - **inline comments** pinned to elements
- **Tweaks [L7, L8]:**
  - In-page controls, toggled from the toolbar, covering colours, fonts, spacing, layout variants and feature flags.
  - The agent adds 2–3 by default even when the user didn't ask.
  - In the later version, tweaks are props on a "Design Component", and the host renders the panel.
  - Tweaks are reserved for things direct editing can't do, such as alternative treatments or one flag that changes many elements.
- **Batch your changes [C9 mejba]:** a reviewer found that sending five annotations as one batch gives more coherent regenerations than five separate asks.

## 6. Export and handoff
- **Formats [C3]:** ZIP, PDF, PPTX, Google Slides, standalone HTML, and an internal share URL with view or edit rights.
- **Send-to partners [C3]:** Adobe (AEM, Creativity, Journey Optimizer), Base44, Canva (opens as an editable design), Gamma, HubSpot, Hyperframes, Lovable, Miro, Netlify, Replit, v0, Vercel and Wix.
- **Claude Code handoff [C1, C9]:** a bundle of design spec, tokens, component structure and implementation notes. One reviewer says the resulting code is about 80% right.
- **Known gaps [C9]:**
  - no Figma export
  - no real-time multi-user editing
  - one-way handoff: you can't go back to Design after Code (Kay Zhang)
  - HTML export isn't easy to edit

## 7. Quality controls
- **Verification loop [L7, L8]:**
  - `done` / `ready_for_verification` returns console errors. The agent must fix them so the user never lands on a crashed view.
  - Then a **forked verifier subagent** checks the result in its own iframe (screenshots, layout, probing the page's code).
  - It stays silent if everything passes and only wakes the main agent when something fails.
  - It is skipped for trivial edits.
- **Brand consistency:** comes from the design system being applied by default [C4, C6].
- **Humans in the loop:** only optional (an admin validates the design system [C5]). There is **no certification of each output**. **[I]** Brand compliance is "best effort by the model", with no audit trail.

## 8. The core process, summarised
1. Ingest the brand into a design system.
2. Ask one round of clarifying questions.
3. Generate one HTML artifact from a format-specific starter (deck shell, canvas, page).
4. Expose variants as tweaks.
5. Check automatically with an error check plus a screenshot verifier.
6. Let the user iterate through chat, direct edits and comments.
7. Render the same HTML to many exports.

The key design choice is **a single intermediate representation (HTML/React plus tokens)**, with export adapters on top. **[I]**

---

# Mapping onto BrandOS

## Shared intermediate representation: the "Brand Document Graph" (BDG)
Two layers. Unlike Claude Design, BrandOS keeps **content separate from layout**. Claude Design mixes the two in one HTML file. **[I]** Separating them is what makes a single campaign reusable across formats.

1. **Brand Intelligence Object (BIO)**, already in the product. Add these to it:
   - tokens (colour, type, spacing, radii, motion)
   - voice rules and a banned-word list
   - logo and imagery rules
   - a component library for each medium
   - do/don't examples
   - legal claims
   - a version number
2. **Message Spec**, one per campaign and independent of format:
   - audience, goal, key messages, proof points and CTA
   - a hierarchy of content blocks (headline, subhead, body, proof, visual, CTA)
3. **Format Render Tree**, one per output: blocks mapped to medium-specific components. Each node points back to its Message Spec block and to the BIO version used.
4. **Renderers:**
   - email: MJML, then HTML (works across email clients)
   - landing page: HTML/React
   - deck: HTML deck shell, then PPTX, PDF or Google Slides
   - social: sized frames, then PNG
   - print one-pager: PDF

## Proposed pipeline (agents grouped into stages)
| Stage | Agents (examples from the 55) | Output |
|---|---|---|
| 0. Ingest | brand extractor (sites, PDFs, decks, code), web capture, token normaliser, voice analyser | BIO vN |
| 1. Brief intake | brief interviewer (one round of questions, like `questions_v2`), audience/goal classifier | Brief |
| 2. Strategy | message architect, claim and proof checker, CTA strategist | Message Spec |
| 3. Format planning | format router (which outputs, what sizes), layout planner for each medium | Render-tree skeletons |
| 4. Generation | copywriters per medium (email subject/preheader, LP hero, slide titles, social hooks), image/visual agent, component composer | Format Render Trees |
| 5. Variants | variant generator: 2–3 tweak axes by default (tone, layout, hero visual) | Variant set |
| 6. Automated QA | render verifier (screenshots, broken layouts), email-client checker, accessibility (contrast, alt text), brand linter (tokens, logo clear space, voice), claims and legal checker | QA report |
| 7. Human certification | a certified designer reviews the diff against the BIO, approves or annotates; their annotations go back to stage 4 | **Signed certificate** |
| 8. Export | renderers plus connectors (ESP/HubSpot, CMS/Webflow, PPTX/Slides, Canva, social schedulers) | Deliverables + audit log |
| 9. Learn | feedback agent: certifier edits update the BIO rules and examples | BIO vN+1 |

**Orchestrator rule:** any edit to a Message Spec block flows out to every format generated from it. Example: change the headline once, and the email, LP, deck and social posts all update.

## Where BrandOS can win
1. **Human certification as the product.** Claude Design has no per-output sign-off. BrandOS can offer a signed certificate plus an audit trail, which is what brand governance buyers need. **[I]**
2. **True multi-format campaigns.** Claude Design works on one artifact at a time. BrandOS takes one brief and produces a coordinated set (email, LP, deck, social) that stays in sync.
3. **Emails and social as first-class outputs.** Claude Design doesn't document either.
4. **A brand that learns.** Certifier corrections feed the BIO. Claude Design's system is mostly static once published.
5. **A governance linter that can explain itself.** Rule-level violations (for example "logo clear space < 1x") instead of best-effort model judgment.
6. **Price, and buyers who aren't developers.** Claude Design leans developer-led (code handoff). BrandOS can focus on marketing teams and agencies.

## Top 5 recommendations
1. **Make the Message Spec and Render Tree the backbone.** Every one of the 55 agents reads and writes this IR, not free-form HTML.
2. **Copy Claude Design's proven mechanics:**
   - one clarifying round before generating
   - format-specific starter shells (deck shell, email MJML base, LP sections, social frames)
   - 2–3 default tweak axes
   - a silent automated verifier before anything reaches a human
3. **Bake the BIO into a linter.** Run brand, accessibility and email-client checks before the certifier sees the output, so human time goes only on taste and judgment. This keeps the price low.
4. **Ship a certification UI built on inline comments.** Comments pin to Render Tree nodes, get batched, and are fed back to the generators. Every approval produces a certificate and lands in a versioned audit log.
5. **Sequence the formats:**
   - VDS demo (21 Oct): one brief to three synced outputs (email + LP + 3-slide deck), certified on stage.
   - MVP (Nov): add exports to PPTX, HTML/ESP and Canva.
   - Later: social and print.
