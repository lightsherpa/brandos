# Melius: competitor teardown and CaastorOS parity plan

Date: 2026-10-02. Source: Refero (site 1166, about 1,100 Melius screens and 42 named flows). Five research passes looked at about 130 full screenshots and read about 300 screen descriptions.

Detailed reports (verbatim copy, menus, hex values and Refero links for every screen):

| # | Area | File |
|---|---|---|
| 1 | Entry, auth, onboarding, Home, nav, new project, Templates, Academy | [melius-1-entry-shell.md](melius-1-entry-shell.md) |
| 2 | **Canvas**: nodes, ports, wires, add/select/run, tour, share | [melius-2-canvas.md](melius-2-canvas.md) |
| 3 | Agent "Mel": composer, chat panel, approvals, skills, settings | [melius-3-agent-chat.md](melius-3-agent-chat.md) |
| 4 | Create tools: Playground, Cast studio, voices, model picker | [melius-4-create-tools.md](melius-4-create-tools.md) |
| 5 | Assets, projects, settings, billing, team, referral, feedback | [melius-5-library-settings-billing.md](melius-5-library-settings-billing.md) |

**15-day build plan / handoff:** [`docs/2026-10-04-melius-parity-handoff.md`](../../2026-10-04-melius-parity-handoff.md)

Mockups of the proposed CaastorOS UI: [`docs/mockups/melius-parity/index.html`](../../mockups/melius-parity/index.html).

---

## 1. What Melius is, in one paragraph

Melius is a dark, node-graph creative canvas with an agent ("Mel") that **builds the graph for you**. Every object is a typed node (Text, Image, Video, Audio, Upload) with colour-coded ports. Each node has its own prompt, model chip, variation count and **↑ Run** button. You can add nodes in five equivalent ways (dock +, `N`, right-click, dragging a wire onto empty space, or asking the agent), and they all open the same picker. The agent plans, creates and wires nodes, and asks before spending ("Start generation? This generation will spend 169 credits" with Approve, Always approve or Deny). Outputs stay attached to their node as variations. There is a review mode with a versions list, provenance and comments pinned to a spot on the image. The chrome takes about 6% of the screen; the canvas gets the rest.

## 2. The baseline: the 20 things a user now expects

The canvas is ranked first because it is our moat.

1. **Add nodes from anywhere**: dock **+**, the `N` key, right-click, dragging a wire into empty space (auto-connects), or the agent. All of these open one picker, with single-key shortcuts.
2. **Typed ports and wires**: colour-coded inputs and outputs with labelled slots. You connect by dragging. `@mention` in a prompt is a second way to connect.
3. **Run on the node**: a white ↑ that becomes ■ while running, a variation count, a dot-matrix loading state, a global "Generating N nodes" tray, and a "ready" toast with a `Space` shortcut.
4. **Variations stay on the node**: "‹ 2/5 ›" plus a thumbnail tray. The picked variation is what flows to the next node.
5. **A model bar on the selected node** (Model · Ratio · Res · Tools · ⬇ · Share · ⛶), plus a right-hand inspector.
6. **Model picker with time and credit cost per model**, plus an **Auto** toggle.
7. **Right-click menu**: Ask agent `/` · Copy · Copy prompt · Duplicate › · Paste › · Rename ⌘E · Download · Delete ⌫. Duplicate and Paste also have "no connections" variants.
8. **Ask the agent about the current selection** (`/`, shows "1 selected").
9. **The agent builds on the canvas**: a run log (Read canvas → Plan → Create nodes → Start generation), a presence outline ("Mel · Creating nodes") and a **"View N nodes"** jump.
10. **Approve before spending credits**, with the cost in credits and an Always approve option.
11. **Editing never overwrites**: Upscale, Inpaint, Remove BG, Outpaint and Crop each create a new connected node.
12. **Review mode**: versions list, prompt, model, size, created by, and comments pinned to the image with replies.
13. **Floating dock, minimap, zoom readout and keyboard-shortcuts dialog** (⌘/).
14. **Notes** (5 colours, 3 sizes) and **comments** placed from the dock (S / C).
15. **Share modal**: Restricted or Anyone with the link · Copy link (with a toast) · Team · Add people.
16. **First-run tour**: "First generation, on us" in 4 steps (Generate → Variations → Edit → Iterate), with coaching bubbles placed next to the real node.
17. **Composer with one button whose role changes** (mic → send → stop). Skills, files and node references sit as chips inside the text. A **+** menu holds Attach, Skills and Settings. Auto-run and Plan toggles.
18. **Skills**: a named brief plus up to 20 reference images, used as a slash command.
19. **Library**: filter chips with counts (All · Generations · Uploads · Favorites), an "On canvas" badge, a floating bar when multiple items are selected (Move, Tag, Download, Delete), and archive instead of delete.
20. **Credits shown only where a decision is made**: in the canvas header, the model picker, the approval card and the template "Cost per run". Never in dollars per generation.

## 3. Gap matrix: CaastorOS today vs the Melius baseline

✅ we already have it · 🟡 partly · ❌ missing · ★ we're ahead

| Area | Melius | CaastorOS today (`src/`) | Status |
|---|---|---|---|
| Canvas pan / zoom / fit | Yes, plus minimap and zoom % in the dock | Pan, wheel zoom, ± and Fit in the top-right (`InteractiveCanvas`) | 🟡 no minimap, no dock |
| Node drag | Yes | Yes | ✅ |
| **Add node on canvas** | +, N, right-click, wire-drop, agent | None. Nodes only come from brief assembly | ❌ |
| **Connect nodes** | Drag between typed ports, plus `@mention` | Edges are computed by the system and read-only | ❌ |
| **Selection model** | Click to select, outline, port tags, inspector, model bar | Clicking opens a drawer or notepad; nothing is "selected" | ❌ |
| **Context menu** | Full right-click menu with shortcuts | None | ❌ |
| **Run per node** | ↑ / ■, variation count, model, ratio, res | Re-run only from inside the drawer or notepad | 🟡 |
| Variations on the node | Prev/Next plus tray | None | ❌ |
| Progress state | Dot-matrix in the node, tray, toast | Progress bar per specialist | 🟡 |
| **Agent builds the graph** | Run log → creates and wires nodes → View N nodes | Brandolph plans the crew → canvas assembles it | ★ ahead on depth (BIO, sharpener, 55 specialists); 🟡 on how visible the agent is on the canvas |
| Agent next to the canvas | Docked left panel with tabs and history | Brandolph lives on a separate page, plus the floater | 🟡 |
| Approval before spending credits | "Start generation? … 169 credits" | "Proceed to assembly" (no cost shown up front) | 🟡 |
| Ask about the selection | `/` plus "1 selected" | None | ❌ |
| Brand context | Agent Context (4k characters) plus Skills (50k + 20 images) | **BIO** (certified by a senior human) plus memory (`brand_signals`) | ★ far ahead. Expose BIO facets as `/skills` |
| Quality gate | None | QA vision and voice scores, steward approval | ★ |
| Overview above the canvas | None | `CanvasHeader` (tension, departments, refusals) | ★ keep it, make it slimmer |
| Review mode / versions / pinned comments | Yes | `DeliverableDrawer` / `SpecialistNotepad` (text-first, no pins) | 🟡 |
| Non-destructive tools | 7 tools, each creates a node | None on the canvas | ❌ |
| Notes / comments | Yes | None | ❌ |
| Share canvas | Modal with link access | None | ❌ |
| First-run tour | 4 steps, free first run | None | ❌ |
| Keyboard shortcuts | About 12 plus a dialog | `lib/editing-shortcuts.js` (only partly on the canvas) | 🟡 |
| Home composer | Serif question, suggestion chips with thumbnails, attach, model chip | `HomeCreate` composer | 🟡 add thumbnail chips and Recently viewed mosaics |
| Library | Chips with counts, multi-select bar, folders, tags, archive | `Library` folders, kind and status filters, viewer | 🟡 add the multi-select bar, tags and the On canvas badge |
| Credits in the UI | Header, model picker, approval, cost per run | `totalCr` in `CanvasHeader` | 🟡 add to the model picker and the approval card |
| Templates with INPUTS → OUTPUTS | Yes, with cost per run | Modes and templates plan (docs) | ❌ |

**Net:** our *intelligence* layer (BIO, Brandolph, the 55 specialists, QA, steward) is ahead. Our **canvas interaction model** is behind. Today it's a well-presented view-only graph; Melius's is an editable workspace. The canvas is our moat, so closing this gap is priority #1.

## 4. What we keep (non-negotiable), and how we stay ahead

- **`CanvasHeader` stays** above the canvas. It becomes a 44px bar that expands on demand, following the Figma `canvas-header`.
- **The canvas is the outcome; chat steers it.** Brandolph docks on the left like Mel, but its run log speaks in brand terms: *Reading BIO → Sharpening brief → Assembling crew (8) → QA gate*.
- **Credits only.** Never show model names with prices or any $ cost. In the model picker, Melius's "time · credits" chips become "speed tier · credits", and the picker is labelled by **quality tier** (Premium / Balanced / Fast), not by vendor.
- **Our differentiators get on-canvas real estate Melius doesn't have**:
  - a BIO node as the root of every graph (typed **BIO** port, yellow);
  - a QA score chip and a steward approval stamp on every deliverable node;
  - refusals shown as red "guardrail" pins on the wires they block;
  - brand-memory hints in the picker ("You approve 92% of Hero KV runs on Premium").

## 5. Proposed build order (needs your sign-off; touches flow and features)

| Phase | Scope | Files |
|---|---|---|
| P1: Canvas interaction core | Selection model · right-click menu · dock (+, select/hand, note, assets, minimap, zoom) · `N` add-picker (Specialists / Utilities) · drag-to-connect between typed ports · keyboard-shortcuts dialog | `portal-briefs.jsx` (`InteractiveCanvas`, `CanvasNode`) and `lib/editing-shortcuts.js` |
| P2: Run on the node | ↑/■ per specialist node · variation strip · contextual model bar (tier · ratio · res) · inspector · toast plus running tray | `BriefRunCanvas`, `server/routes/runs.js` (re-run already exists) |
| P3: Brandolph docked | Left chat panel on the canvas · run log · **credit approval card** · "View N nodes" · `/` ask-about-selection · BIO `/skills` | `portal-brandolph.jsx`, `portal-floater.jsx` |
| P4: Review mode | Versions list · provenance (BIO, specialist, QA) · pinned comments · steward approve | `DeliverableDrawer`, `SpecialistNotepad` |
| P5: Shell polish | Home thumbnail chips plus Recently viewed mosaics · Library multi-select bar, tags, On canvas badge · Share modal · first-run tour | `portal-brandolph.jsx`, `Library`, `portal-shell.jsx` |
