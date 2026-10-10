# Handoff: Melius competitive teardown → CaastorOS MVP parity plan (15 days)

**Date:** Sun 2026-10-04 · **Ready-by:** Mon 2026-10-19 (15 calendar days, 11 working days)
**Branch:** `claude/melius-competitor-analysis-e18b7d` (worktree). Nothing is committed and no `src/` code has been changed yet.
**Status:** research ✅ · gap analysis ✅ · clickable mockups ✅ · **build not started. It needs owner sign-off (see §9).**

---

## 0. TL;DR

- **Melius** (melius.com, "The AI-native operating system for creatives") is the competitor that sets the UX baseline. It is a dark node-graph canvas.
  - An agent ("Mel") **builds and wires the graph for you** and asks before spending credits.
  - Every node runs on its own, has its own model, and keeps its variations.
  - There are 5 equivalent ways to add a node, and all of them open one picker.
- **CaastorOS is ahead on intelligence and behind on interaction.** We have BIO, Brandolph, 55 specialists, the QA gate, steward approval and memory; Melius has nothing like the certified BIO. But our canvas is a well-presented view-only graph: you can pan, zoom, drag and click a node to open a drawer. You **cannot add, connect, select, right-click, run a single node, see variations, use a minimap, leave notes or share.**
- **The canvas is our moat (standing rule), so the 15-day plan is canvas-first.** It builds an interaction core, then running nodes on the canvas, then Brandolph docked beside the canvas with a credit-approval card, then a lightweight review mode. Everything else is cut or stubbed.
- **Good news:** most of the backend already exists.
  - `POST /api/runs/stream` runs or re-runs **one** specialist, with `modelOverride` and `revisionFeedback`.
  - `estimateRunCredits()` exists.
  - QA, steward workflow and output PATCH/DELETE exist.
  - The work is about 80% front-end.

---

## 1. Artifacts produced (read these)

| What | Path | Notes |
|---|---|---|
| Summary + gap matrix + top-20 baseline | `docs/competitors/melius/README.md` | Start here |
| Teardown 1: entry, auth, onboarding, Home, nav, new project, Templates, Academy | `docs/competitors/melius/melius-1-entry-shell.md` | ~6k words, verbatim copy, hex values, Refero links |
| Teardown 2: **Canvas** (most important) | `docs/competitors/melius/melius-2-canvas.md` | ~7.6k words; includes an **interaction-model spec** at the end |
| Teardown 3: agent chat, approvals, skills, settings | `docs/competitors/melius/melius-3-agent-chat.md` | Chat ↔ canvas relationship |
| Teardown 4: Playground, Cast studio, voices, model picker | `docs/competitors/melius/melius-4-create-tools.md` | Out of MVP scope; reference |
| Teardown 5: assets, projects, settings, billing, team, referral | `docs/competitors/melius/melius-5-library-settings-billing.md` | Pricing/credits model |
| **Clickable mockups** (Home · Canvas · Review · Library) | `docs/mockups/melius-parity/index.html` | Vanilla HTML/JS on CaastorOS tokens |

**How to open the mockups:** run the command below from the worktree root, then go to http://localhost:8090/docs/mockups/melius-parity/index.html.

```bash
python3 -m http.server 8090
```

The desktop app's preview server gets stopped between sessions, so use a terminal.

On the Canvas screen, try:
- **N**, the yellow **+**, or right-click empty space to add a node;
- right-click a node for its menu;
- **/** to ask Brandolph about the selection;
- dragging a node's right-edge port onto another node, or onto empty space (opens the picker and wires the new node);
- **↑** on a node to run it;
- **Approve** in the chat;
- **Space** after a run finishes to open Review;
- **?** for shortcuts;
- **▶ First-run tour**.

The photos are random placeholders.

**Method / provenance:**
- **Source:** Refero MCP, site id 1166. It has about 1,100 Melius screens and 42 named flows. `refero_get_flow` returns `INVALID_FLOW_ID` for every Melius flow, so all flows were rebuilt from individual screens.
- **Coverage:** 5 parallel research passes looked at about 130 full screenshots and read about 300 screen descriptions.
- **Gaps (not captured anywhere):** the "Upscaling image" flow; per-reply feedback (thumbs) on agent answers; marquee and multi-select visuals; group/frame nodes; the contents of the "Utilities" tab; error and failed-generation states; the team-switcher dropdown.

---

## 2. Standing rules that constrain this work (from `CLAUDE.md`)

1. Don't change flow or features without the owner's sign-off. **This whole plan needs sign-off before code.**
2. Focus only on the ask; don't modify anything outside it.
3. **Credits only.** Never show internal API cost. ⚠️ Today the re-run picker shows **vendor model names** (`TEXT_RERUN_OPTIONS` / `IMAGE_RERUN_OPTIONS` at `src/portal-briefs.jsx:2176–2187`: "Opus 4.7", "Flux Schnell"…). The plan replaces them with **quality tiers** (Premium / Balanced / Fast) and credit ranges.
4. API integrations must be cost-optimised at scale (hybrid routing). Tiers map onto the existing routes; no new vendors.
5. **The canvas is the moat. Never simplify it into a chat thread.**
6. **Never remove `CanvasHeader`** (overview, tension, dept chips, brief/refusals). The plan *slims* it to 44px and makes it expandable; nothing is lost.
7. Wire node clicks through the `onNodeClick` prop. The canvas wrapper uses `setPointerCapture` and swallows inner `onClick`s. Any new node-level controls (Run, variation arrows, ports) need the same treatment: `stopPropagation` in `pointerdown`, or hit-testing in `endDrag`.
8. Keep `fluxSchnell` in `IMAGE_MODELS` (`portal-brandolph.jsx`).
9. No workspace-dropdown or palette-tint experiments.
10. The project is called **CaastorOS**. Never anything else.

---

## 3. What Melius does: the baseline in detail

The full detail is in the teardown files. This is the condensed spec a builder needs.

### 3.1 Canvas chrome (about 6% of the screen)
- **Top-left capsule:** ☰ · project name / **Canvas 1 ▾** (several canvases per project) · credits `20k` (tooltip "15,430 credits"). ☰ opens Back to home · Rename project · Rename canvas · Project settings · Settings · Help › (Docs, Keyboard shortcuts ⌘/, Share feedback) · Manage plan.
- **Top-right:** split **Share | 🔗** button.
- **Bottom-centre dock:** orange **+** · pointer ▾ · note/comment ▾ · Assets · (grid) · Minimap toggle · zoom readout ("64%").
- **Minimap:** bottom-right, closeable.
- **Left-edge orange tab:** collapses or expands the agent chat panel. This is the "layout switch".
- **Toasts:** a top-centre pill, "✓ Your generation is ready `Space`" and "Link copied to clipboard".
- **Background tray:** "Generating 1 node ⌃", with an orange progress line.

### 3.2 Adding nodes: 5 doors, 1 picker
- The doors are: the dock **+**; the **N** key (at the cursor); **right-click** on empty canvas; **dragging a wire from an output port and dropping it on empty canvas** (opens the picker at the drop point and **auto-wires** the new node); and the agent.
- **Picker:** tabs **Nodes | Utilities**. The first row is **Ask Mel `/`**, then Text `T` · Image `I` · Video `V` · Audio `A` · Upload `U`. Each row has a single-key shortcut, and the hovered row gets an accent outline.
- **Note** (`S`; 5 colours; Small/Medium/Large sizes) and **Comment** (`C`) are placed from the dock.

### 3.3 Node anatomy
- **Caption above the card:** type icon + title (left), model name (right).
- **Card:** media preview → divider → prompt. Prompts support **@mentions of other nodes**, shown as coloured tokens or thumbnail chips. Placeholder: "Describe your image, or @ to mention nodes".
- **Footer:** variation stepper "− 5 +" and a white circular **↑ Run** that becomes **■ stop** while running.
- **Typed, colour-coded ports:** text = teal, image = orange, video = magenta, audio = violet, last frame = amber. When selected, a node shows labelled tags ("Inputs: Text, Image…", "Outputs: Image, Last frame"). Notes have no ports.
- **Variations live on the node:** "‹ Prev · 5/5 · Next ›" plus a thumbnail tray on hover. The picked variation is what flows to the next node.
- **States:**
  - empty → writing (skeleton bars) → generating (dot-matrix shimmer, outline in the accent colour) → ready;
  - while the agent is building a node, it gets a **teal outline plus a "Mel · Creating nodes" pill**, like a second user's cursor.

### 3.4 Selection
- Click a node to select it. It gets an accent outline, port tags and a resize grip.
- A **contextual model bar** floats above it: `Model: Auto ▾ | 4:5 ▾ | 2K ▾ | ✂ Tools ▾ | ⬇ | share | ⛶`.
- A **right inspector** opens:
  - for generation nodes: Name · Generation settings (Model, Aspect ratio, Resolution, plus Duration and Audio for video);
  - for finished assets: Format · Size · Resolution · Created · Model · Ratio · Tool used, then Tools, then Generation settings.
- **Model picker:** search, "Featured models", each row with a **time chip and a credit chip** plus a one-line description, provider submenus, and an **Auto** toggle.
- **Right-click menu:** Ask Mel `/` · Copy ⌘C · Copy prompt ⌘⇧C · Duplicate › · Paste › · Rename ⌘E · Download · Delete ⌫. Copy, paste and duplicate have "(no connections)" variants.
- **Selection-scoped ask:** `/` opens a one-line prompt at the cursor with a "1 selected" chip. Sending it opens a new chat tab with the selection attached.
- **Editing tools never overwrite:** Edit · Inpaint · Remove object · Remove BG · Upscale (Topaz popover) · Outpaint · Crop. Each creates a **new connected node**.

### 3.5 Agent ("Mel")
- **Composer** with one button that changes role: mic when empty → ↑ send when there's content → ■ stop while running.
  - **Inline chips** inside the text: skills `/slug ✕`, files (thumbnail + name), node references.
  - **+ menu:** Attach files · Skills › · Go to agent settings.
  - Toggles: **Auto-run** and **Plan**.
- **Docked left chat panel** (~255–320px) with multiple tabs that name themselves, plus + new chat and 🕘 history.
- **Run log:** live phases with timers ("Thinking… 1.4s", "Daydreaming…", "Ideating…", "Waiting for input…") and expandable steps (Read canvas · Load guide · Updated plan · Create nodes · Start generation). When done it collapses to "› 6 tool calls".
- **Credit approval card:** "**Start generation?** This generation will spend **169 credits**" with **Approve** / **Always approve** / **Deny**. Planning and building nodes cost nothing; spending credits needs consent.
- The answer ends with **"⛶ View 1 node"**, which jumps the canvas to what was built.
- **Skills:** Name (becomes the slash command) · Description (200 characters) · Instructions (50k) · up to 20 reference images.
- **Agent "Context":** global rules, 4,000 characters, "runs on every agent call".

### 3.6 Review mode (⛶)
- **Versions** list (left) · large image (centre) with a bottom bar · right panel with Prompt (including source chips), metadata (created by…) and **Comments**.
- Comment mode: "Click anywhere on the image to comment" → a pin → a thread with Reply.

### 3.7 Shell, onboarding, library, billing (lower priority for us)
- **Auth and onboarding:**
  - Logged-out users can browse the app shell; auth opens as a modal over it, half of which is a reel of generated clips.
  - Passwordless: Google or a 6-digit email code.
  - Three one-click onboarding questions, then a seeded "Welcome to Melius" project with a **4-step canvas tour** ("First generation, on us": Generate → Variations → Edit → Iterate, with a 1/4 progress ring and coach bubbles placed next to the real node).
- **Home:** serif "What will you create today?" · composer with suggestion chips that have thumbnails · Recently viewed (cards show a 2×3 mosaic of project outputs) · Discover bento.
- **Library:** filter chips with counts (All · Generations · Uploads · Favorites) · "On canvas" badge · a floating bar when several items are selected (Move · Tag · Download · Delete) · **archive instead of delete**.
- **Pricing (credits model):**
  - Creator $18/mo for 20k credits, shown as "≈ 300 images or 14 videos".
  - Growth $45/mo for 50k.
  - Professional $99/mo for 110k or 300k.
  - Top-ups at $1 per 1k credits that never expire.
  - Per-member credit limits.
  - Credits appear in the canvas header, the model picker, the approval card and the template "Cost per run". Never as a $ cost per generation.

---

## 4. Where CaastorOS stands today (code map)

All paths are relative to the repo root. Line numbers are as of commit `6fafe38`.

### 4.1 Front-end
| Thing | Location | Today |
|---|---|---|
| Canvas engine | `src/portal-briefs.jsx:1180` `InteractiveCanvas` | Pan (pointer capture), wheel zoom, ± and Fit buttons top-right, JSON export, node drag, hover-dims wires, click → `onNodeClick`. Edges are **read-only** SVG beziers with arrowheads. Light dot grid. A "helper" pill bottom-centre. |
| Node frame | `src/portal-briefs.jsx:3513` `CanvasNode` | Colour stripe by `kind` (`CANVAS_COLORS` at `:1170`) |
| Overview bar | `src/portal-briefs.jsx:1477` `CanvasHeader` | About 90px tall: state, credits, serif title, tension, dept chips, expandable sharpened brief + refusals. **Keep it.** |
| Live run canvas | `src/portal-briefs.jsx:1614` `BriefRunCanvas` | Reads run context from `sessionStorage` (set by `HomeCreate`). Builds BIO → Brief → Specialists nodes (`buildInitialRunNodes` `:2684`, edges `:2719`). Client-side assembly loop with a progress bar per specialist. |
| Saved brief canvas | `src/portal-briefs.jsx:2757` `BriefViewCanvas`, graph `:3067` | Same canvas, rebuilt from DB |
| Node detail | `BriefDrawer :2190`, `DeliverableDrawer :2239`, `SpecialistNotepad :2324` | Read, edit, copy, save; **re-run with model + revision feedback** (`:2330–2580`). The re-run creates a new run row, but the canvas node is **not** updated (comment at `:2142`). |
| Re-run model lists | `src/portal-briefs.jsx:2176–2187` | ⚠️ Shows vendor model names. Must become tiers. |
| Home composer | `src/portal-brandolph.jsx:247` `HomeCreate` | Composer → sharpen → "Proceed to assembly" → canvas |
| Floater (context helper) | `src/portal-floater.jsx` | Separate from the canvas |
| Library | `src/portal-briefs.jsx:3563` `Library`, `LibraryFolderDetail :3796`, `LibraryAssetCard :3894`, `LibraryViewer :3946` | Folders by brief, kind and status filters, search, viewer with delete |
| Keyboard helpers | `src/lib/editing-shortcuts.js` | Composer-only (keeps native ⌘A/C/V/X/Z; ⌘↵ submits) |
| Tokens | `public/caastor/ds-tokens.css`, `caastor-tokens.css`, `portal.css` | Inter Tight / Geist Mono / Instrument Serif; brand `#F5B400`, accent `#4F46E5`; radii 6–22; light and dark themes |
| Dept colours | `src/portal-data.js:135` `CI_DEPT_COLORS` | Strategy yellow-600, Concept purple, Copy green, Visual pink, Web blue, Motion orange, Research neutral |

### 4.2 Back-end (reuse, don't rebuild)
| Capability | Location | Use in plan |
|---|---|---|
| Run or re-run **one specialist**, streaming (SSE). Takes `specialistId, briefText, brandId, briefId, briefMeta, modelOverride, revisionFeedback, deliverableSpec` | `server/src/routes/runs.js:41` `POST /api/runs/stream` | Per-node ↑ Run, variations (each run is a new row), tier override (map tier → `modelOverride`) |
| BIO certification gate (409 `BIO_NOT_CERTIFIED`) | `runs.js` (inside `/stream`), `lib/load-brand-bio.js` | Show it on the BIO node and block Run with a clear message |
| Credit estimate and caps (`estimateRunCredits`, `RUN_CREDIT_CAP`, `MONTHLY_CREDIT_CAP`, `OUT_OF_CREDITS`) | `server/src/lib/credits.js:63–110`; uses `spec.payload.cr_estimate` | Approval card ("will spend N credits"), node footer "≈ N cr", tier credit ranges. **Needs a small read-only estimate endpoint**; see P2-3. |
| Fetch run | `runs.js:523` `GET /api/runs/:id` | Version history for review mode |
| Output edit, delete, steward workflow | `server/src/routes/outputs.js:16` PATCH, `:76` DELETE, `:100` `POST /:id/workflow` | Inspector edit, Delete in the context menu, "Send to steward" / Approve |
| Brandolph ask + memory | `server/src/routes/brandolph.js:20` `/ask`, `:73` `/memory` | Docked chat; memory hints ("you approve 92% on Premium") from `brand_specialist_stats` |
| Sharpener | `server/src/routes/briefs.js:17` `/sharpen` | Unchanged |

### 4.3 What does NOT exist yet (back-end)
- **Canvas layout persistence.** Node x/y, user-added nodes, user-drawn edges and notes are not stored; positions are lost on reload. → **new migration needed** (P1-6).
- **Comments** (pinned or threaded). No table → cut from the 15-day scope, or stub as an output note (see §7).
- **Estimate endpoint** for the UI (the logic exists in `credits.js`; it isn't exposed).
- **Variations as a first-class concept.** Today, re-runs make sibling run rows. We present them as variations of a node by grouping on `(brief_id, specialist_id)`.

---

## 5. Gap matrix (CaastorOS vs Melius baseline)

✅ have · 🟡 partial · ❌ missing · ★ we're ahead · **P0** must ship by 10-19 · **P1** ship if time · **Cut** post-MVP

| # | Capability | Melius | CaastorOS | Status | Priority |
|---|---|---|---|---|---|
| 1 | Pan, zoom, fit | ✓ + minimap, zoom in dock | ✓ (top-right) | 🟡 | P0 (move to dock + minimap) |
| 2 | Node drag | ✓ | ✓ | ✅ | — |
| 3 | **Selection model** (outline, port tags, inspector, model bar) | ✓ | ❌ (click opens a drawer) | ❌ | **P0** |
| 4 | **Right-click node menu** | ✓ | ❌ | ❌ | **P0** |
| 5 | **Add a node** (+ / N / right-click / wire-drop) via one picker | ✓ | ❌ | ❌ | **P0** |
| 6 | **Connect nodes** (drag between ports) | ✓ | ❌ (read-only edges) | ❌ | **P0** |
| 7 | @mention nodes in prompts | ✓ | ❌ | ❌ | Cut |
| 8 | **Run per node** (↑/■, state on the node) | ✓ | 🟡 (drawer re-run, node not updated) | 🟡 | **P0** |
| 9 | Variations on the node (‹ n/N ›) | ✓ | ❌ (sibling rows hidden) | ❌ | **P0** |
| 10 | Quality-tier picker with credit chips + Auto | ✓ (models) | ❌ (vendor names!) | ❌ | **P0** (also fixes a rule violation) |
| 11 | Running tray + ready toast + Space to review | ✓ | 🟡 (progress bars) | 🟡 | **P0** |
| 12 | **Brandolph docked beside the canvas**, run log, "View N nodes" | ✓ | 🟡 (separate page + floater) | 🟡 | **P0** |
| 13 | **Credit approval card** (Approve / Always / Deny) | ✓ | ❌ ("Proceed to assembly", no cost shown) | ❌ | **P0** |
| 14 | `/` ask about the selection | ✓ | ❌ | ❌ | P1 |
| 15 | Agent presence on nodes (outline + "Brandolph · building") | ✓ | ❌ | ❌ | P1 (cheap once #12 exists) |
| 16 | Review mode (versions, provenance, QA, steward approve) | ✓ (no QA) | 🟡 (drawers) | 🟡 | **P0** (light version) |
| 17 | Pinned comments | ✓ | ❌ | ❌ | Cut |
| 18 | Non-destructive image tools (upscale, remove BG…) | ✓ | ❌ | ❌ | Cut (P1 stub: Upscale only if fal route is cheap) |
| 19 | Notes / stickies | ✓ | ❌ | ❌ | P1 |
| 20 | Share modal (link access) | ✓ | ❌ | ❌ | Cut (P1: Copy link only) |
| 21 | Keyboard shortcuts + ⌘/ dialog | ✓ | 🟡 | 🟡 | **P0** (N, /, ⌫, ⌘D, ⌘↵, Space, ⇧1, Esc, ?) |
| 22 | Layout persistence | ✓ | ❌ | ❌ | **P0** |
| 23 | First-run tour | ✓ | ❌ | ❌ | P1 |
| 24 | Home: thumbnail suggestion chips, Recently viewed mosaics, "still working" card | ✓ | 🟡 | 🟡 | P1 |
| 25 | Library: multi-select bar, On canvas badge, tags, archive | ✓ | 🟡 | 🟡 | P1 (multi-select bar + badge only) |
| 26 | Templates with INPUTS → OUTPUTS + cost per run | ✓ | ❌ | ❌ | Cut |
| 27 | BIO as the root node + certified status | — | ✓ | ★ | Keep; add typed BIO port |
| 28 | QA scores + steward approval on deliverables | — | ✓ | ★ | Surface on node + review |
| 29 | Hard refusals visible | — | ✓ (header) | ★ | P1: guardrail pins on wires |
| 30 | Brand memory (`brand_signals`, stats) | — | ✓ (back-end) | ★ | P1: hint in tier picker |

---

## 6. Target design (what the mockup encodes)

**Visual direction.** This keeps our identity and doesn't copy Melius:
- **Dark desk, light frames** (already confirmed in `docs/2026-08-04-canvas-figma-gap-plan.md`). Desk `#14151A` with a `#2A2C35` dot grid; nodes are white cards with a 12px radius.
- Chrome stays light (Metronic-style), so the canvas reads as "the work".
- **Brand yellow `#F5B400`** = selection, primary actions and credits. **Indigo `#4F46E5`** = Brandolph (presence, run log, chips).
- Inter Tight for UI, Instrument Serif for titles and tension, Geist Mono for status and credits.

**Port / data types** (our analogue of Melius's colour legend):

| Port | Colour | Produced by | Consumed by |
|---|---|---|---|
| BIO | `#F5B400` | BIO node | Brief, every specialist (implicit) |
| Brief | `#4F46E5` | Sharpened brief node | every specialist |
| Text | `#10B981` | Strategy / Concept / Copy / Web & UX / Research specialists | any specialist |
| Image | `#EC4899` | Visual specialists, uploads | Visual, Web & UX |
| Video | `#F97316` | Motion & Sound (**greyed, "coming soon"**) | — |

**Node card (specialist):** caption row (title · tier) → header (dept dot + DEPT label · status chip: DONE / RUNNING / QUEUED / FLAGGED / CERTIFIED) → title → body (text preview, image with ♥ / QA chip / steward stamp, or dot-matrix while running) → variation strip "‹ 2/4 ›" (+ hover tray for images) → footer (QA score or "≈ N cr" · count stepper · **↑ Run / ■ Stop**) → ports (inputs left, stacked by type; output right; the output port glows on fresh nodes).

**Floating chrome on the desk:**
- **Top centre:** the model bar for the selected node: `Tier Auto ▾ | 4:5 ▾ | 2K ▾ | ✂ Tools ▾ | ◆ Ask | ⬇ | 🔗 | ⛶`.
- **Right:** the inspector (268px).
  - Name · Quality tier · Format · Context-in chips · Quality gate (Brand / Voice bars) · Tools grid (images) · Brandolph memory hint · **↑ Run · ≈ N cr** · ⛶.
  - BIO node: version / certified by / refusals / "Open BIO".
  - Brief node: tension, crew, "Re-sharpen".
- **Bottom centre: the dock.** Yellow **+** · Select ▾ · Note ▾ · Assets · Ask Brandolph (◆) · Minimap · Zoom % (click = Fit).
- **Bottom right:** the minimap (it moves left of the inspector when the inspector is open) and the "Running N specialists" tray above it.
- **Top centre toast:** "✓ Hero KV is ready `Space`".

**Picker (N / + / right-click / wire-drop):**
- Search "Search 50 specialists…" · tabs **Specialists | Utilities | Inputs**.
- First row **◆ Ask Brandolph `/`**, then specialists grouped by department with dept colour dots. Motion & Sound shows as "Coming soon".
- No match: "No specialist matches — ask Brandolph to build it".
- Adding a node wires it to **Brief** automatically, plus the source node if it was opened from a dragged wire.

**Right-click node menu:**
- ◆ Ask Brandolph `/`
- ↑ Re-run `⌘↵` · ↑ Re-run on Premium
- Copy ⌘C · Copy output ⌘⇧C · Duplicate ⌘D · Duplicate (no connections) ⌘⇧D · Rename ⌘E
- ✓ Send to steward · ⬇ Download
- Delete ⌫

**Tier picker (replaces vendor model names):**

| Tier | Copy | Speed chip | Credit chip | Maps to existing routes |
|---|---|---|---|---|
| Auto (toggle) | "Brandolph picks per run from your approval history" | — | — | current spec default route |
| Premium | "Hero work, fine type, campaign KVs" | ~40s | 180–360 cr | text: `anthropic/claude-opus-*`; image: `vendor/fal/flux-1.1-pro`, `recraft-v3` |
| Balanced | "Most deliverables" | ~15s | 60–120 cr | text: `anthropic/claude-sonnet-*`, `openrouter/google/gemini-2.5-pro`; image: `flux-1.1-pro` |
| Fast | "Volume: social, mood boards, mockups" | ~4s | 12–24 cr | text: `anthropic/claude-haiku-*`, `openrouter/google/gemini-2.5-flash`; image: `vendor/fal/flux-schnell` |

Credit ranges are placeholders. Compute them from `spec.payload.cr_estimate` × the tier multiplier in `credits.js`, never from raw API cost. Below the list, a memory hint: "◆ You approve 92% of Hero KV runs on Premium and 41% on Fast" (from `brand_specialist_stats`).

**Brandolph docked panel (left, 320px, collapsible via a yellow edge tab):**
- **Tabs:** brief threads, plus + and 🕘.
- **User bubble:** inline chips (attachments, `/skill`), then the text.
- **Run log card** "› Assembled the crew 38.4s":
  - ✓ Read BIO v3 (voice, palette, refusals)
  - ✓ Sharpened brief · tension found
  - ✓ Picked 6 specialists from memory
  - ✓ Created 6 nodes · wired to BIO
  - ● Running Strategy → Copy
- **Approval card** (yellow outline): "**Run the Visual specialists?** Hero KV and Social Post Designer will spend **1,240 credits**. You have 18,420." with **Approve** · Always approve · Deny.
- **Prose answer** with node chips, then **⛶ View 6 nodes**.
- **Composer:** "Ask a follow-up… @ to mention a node" · + menu (Attach files · BIO skills › `/spring-launch` `/clinical-voice` · Create skill from BIO · Brand context settings) · ▷ Auto-run · ☰ Plan · mic/send/stop.

**CanvasHeader (kept, slimmed to 44px):**
- Breadcrumb "Briefs / *Spring night-serum launch*" (serif italic) · tension pill "◐ Clinical proof vs. ritual comfort ▾" (click expands the **sharpened brief + hard refusals** panel, i.e. the current expanded content) · dept chips "Strategy·1 Copy·2 Visual·2 Web·1" · "6 specialists · 3 done" · credits pill · Share.
- Below 1280px the dept chips and progress text are hidden.

**Review mode (⛶ / Space):**
- **Versions** rail (tier · QA · approved/flagged reason).
- Large image on black, with a bottom bar (Tier · ratio · res · zoom · tools · comment · ⬇ · 🔗).
- Right panel:
  - **Prompt** with `@Headlines·v2` / `@BIO` chips;
  - **Provenance** (BIO v3 certified by …, Specialist, Tier · credits, Size, Created by);
  - **Quality gate** (Brand match bar, Refusals hit count) with **✓ Approve as steward** / Flag;
  - Comments (cut for MVP; show "Steward notes" from the existing workflow instead).

---

## 7. The 15-day plan

**Capacity assumption:** one full-time front-end engineer plus part-time back-end (or one full-stack engineer with Claude Code), and design sign-off from the owner. If there are two FE engineers, run Track A (canvas) and Track B (Brandolph panel + review) in parallel from Day 3.

**Principle:** build it as a **new canvas layer inside `InteractiveCanvas`**, behind a feature flag (`tweaks.canvasV2`; the tweaks panel already exists in `src/tweaks-panel.jsx`). Ship flag-on for design partners and keep v1 as the fallback. `portal-briefs.jsx` is 4.4k lines: **extract** the new canvas into `src/canvas/` (state store, node renderer, picker, context menu, inspector, dock) rather than growing the file.

### Day 0 (Sun 10-04): today
- [ ] **Owner sign-off** on §9 decisions (scope, tiers, dark desk, persistence migration).
- [ ] Commit this branch: docs and mockup only, no `src/` changes.

### Phase 1: canvas interaction core (Mon 10-05 → Fri 10-09, 5 days)
| ID | Task | Files | Acceptance |
|---|---|---|---|
| P1-1 | Extract canvas state into a reducer: nodes, edges, selection, view, ui (picker / menu / inspector open). Keep the `onNodeClick` contract for v1 callers. | `src/canvas/store.js`, `InteractiveCanvas` | v1 canvases render identically with the flag off |
| P1-2 | **Selection model:** click selects (yellow outline + port tags); click on empty space deselects; Esc deselects; the drawer opens from the inspector "Open" button or a double-click, **not** a single click. Respects the pointer-capture rule (#7). | `CanvasNode`, store | Click selects, double-click opens the existing drawer; drag still works |
| P1-3 | **Dock + minimap + zoom readout** (move ± / Fit out of the top-right; zoom label click = Fit; ⇧1 = Fit). Dark desk theme tokens. | `src/canvas/Dock.jsx`, `Minimap.jsx`, tokens | Matches the mockup; minimap shows the viewport rect |
| P1-4 | **Picker** (+ / N / right-click empty / wire-drop): search across `CI_SPECIALIST_SPECS` (50 live), dept groups, Motion & Sound greyed, "Ask Brandolph" row (opens the panel in Phase 3; a toast before then). New node = queued specialist node auto-wired to Brief (+ source). | `src/canvas/Picker.jsx` | Adding a node takes ≤ 2 interactions from any door |
| P1-5 | **Ports + drag-to-connect:** typed ports (BIO / Brief / Text / Image); drag out → dashed preview in the port colour → drop on a node (compatible type) = edge; drop on empty = picker. Incompatible drop = shake + toast. | `src/canvas/Ports.jsx`, `edges.js` | Edges can be created and deleted (select edge + ⌫, or delete the node) |
| P1-6 | **Layout persistence:** migration `canvas_layouts (brief_id pk/fk, workspace_id, nodes jsonb, edges jsonb, notes jsonb, updated_at, updated_by)` + RLS matching briefs; `GET/PUT /api/briefs/:id/layout` (debounced 800ms save). System nodes keep their DB identity; user nodes store `specialist_id` and are run through the same `/runs/stream`. | `supabase/migrations/2026100500…_canvas_layouts.sql`, `server/src/routes/briefs.js` | Reload keeps positions, user nodes and user edges; RLS tested cross-tenant |
| P1-7 | **Right-click node menu + shortcuts:** N, /, ⌫, ⌘D, ⌘⇧D, ⌘E, ⌘↵, Space, ⇧1, Esc, ? (shortcuts dialog). Reuse `editing-shortcuts.js` guards so composer typing never triggers canvas keys. | `src/canvas/ContextMenu.jsx`, `src/lib/editing-shortcuts.js` | Every menu item works or is visibly disabled; no key leaks from inputs |
| P1-8 | **CanvasHeader slim mode** (44px, tension pill expands the existing brief/refusals panel). | `CanvasHeader` | Everything in today's header is still reachable in one click |

**Fri 10-09 checkpoint (go/no-go):** demo add → connect → select → right-click → delete → reload with persistence. If P1-6 slips, persist positions only and keep user edges in memory (flagged).

### Phase 2: run on the node (Mon 10-12 → Wed 10-14, 3 days)
| ID | Task | Files | Acceptance |
|---|---|---|---|
| P2-1 | **↑ Run / ■ Stop on node and inspector:** calls `POST /api/runs/stream` with the node's `specialistId`, the brief text, upstream outputs as context (the current behaviour, plus user-drawn edges), and `modelOverride` from the tier. Streaming fills the node (skeleton → text; dot-matrix → image). Stop = abort the fetch. | `src/canvas/run.js`, `BriefRunCanvas` | A single node runs without re-running the crew; BIO 409 shows "Certify BIO first" on the BIO node |
| P2-2 | **Variations:** group runs by `(brief_id, specialist_id)`; the node shows "‹ n/N ›" (+ image hover tray); the picked variation is what flows downstream and is stored in `canvas_layouts.nodes[].pickedRunId`. Fixes the `:2142` "node not updated after re-run" gap. | node renderer, layout | After a re-run the node shows the new version as N+1 and you can flip back |
| P2-3 | **Tier picker** replacing `TEXT_/IMAGE_RERUN_OPTIONS` in the UI. Server: `GET /api/runs/estimate?specialistId&tier` → `{ credits }` using `estimateRunCredits`; map tier → route server-side (**the client never sees routes**). | `server/src/routes/runs.js`, `server/src/lib/credits.js`, `src/canvas/TierPicker.jsx` | No vendor or model names anywhere in the SPA; every Run button shows "≈ N cr" |
| P2-4 | **Running tray + ready toast + Space → review.** | `src/canvas/Tray.jsx`, `Toast` | Matches the mockup |
| P2-5 | **Inspector:** name, tier, format (image), context-in chips, QA scores (existing `qa-vision` / `qa-voice` results), memory hint (`/api/brandolph/memory`), Run · ≈ cr, Open drawer, ⛶. | `src/canvas/Inspector.jsx` | Every field is real data or omitted (no fake values) |

### Phase 3: Brandolph docked beside the canvas (Thu 10-15 → Fri 10-16, 2 days)
| ID | Task | Files | Acceptance |
|---|---|---|---|
| P3-1 | **Left docked panel** on the canvas route (collapsible edge tab), reusing the Brandolph composer and `/api/brandolph/ask`. One thread per brief (tabs are P1). | `src/portal-brandolph.jsx` (extract `BrandolphPanel`), `BriefRunCanvas` | The canvas is still usable with the panel open or closed |
| P3-2 | **Run log** fed by the existing assembly loop events (read BIO → sharpen → crew → nodes created → per-specialist run), with timers, collapsible to "› N steps". | panel | The log mirrors real progress, not canned text |
| P3-3 | **Credit approval card** before any batch run: total from P2-3 estimates; **Approve / Always approve (per brand, stored in localStorage for MVP) / Deny**. Replaces the silent spend after "Proceed to assembly". | panel, `HomeCreate` handoff | No credits are spent from the agent path without explicit approval or "always" |
| P3-4 | **"View N nodes"** (fit to the created nodes) + indigo presence outline on nodes Brandolph is creating or running. | store, `CanvasNode` | Clicking jumps the canvas; outlines clear when done |

### Phase 4: review mode lite + hardening (Mon 10-19 morning is buffer; work Sat/Sun only if needed)
| ID | Task | Files | Acceptance |
|---|---|---|---|
| P4-1 | **Review overlay** (⛶ / Space): versions rail (the runs from P2-2), large preview (image or formatted text), provenance (BIO version + certifier, specialist, tier, credits, created), quality gate bars, **Approve as steward / Flag** via `POST /api/outputs/:id/workflow`. | `src/canvas/Review.jsx` (reuse `DeliverableDrawer` internals) | A steward can approve from review; status updates on the node stamp |
| P4-2 | **QA pass:** `docs/manual-qa-checklist.md` + a new canvas section; cross-tenant RLS on `canvas_layouts`; `npm run test:run`, `test:router`; Chrome + Safari; 1280 / 1440 / 1920 widths; `prefers-reduced-motion`. | — | Zero P0 bugs open |
| P4-3 | Flag on for design-partner workspaces; v1 fallback documented. | `tweaks-panel.jsx` / workspace setting | Can be rolled back in one toggle |

### P1 stretch (only if a phase finishes early; in this order)
1. `/` ask-about-selection (selection chip → panel thread).
2. Notes / stickies (stored in `canvas_layouts.notes`).
3. Refusal guardrail pins on wires into Visual nodes (from BIO refusals).
4. First-run tour (4 steps: BIO → Crew → Run → Approve; "first run on us" = a credit grant, which needs owner approval).
5. Library: multi-select bar + "On canvas" badge.
6. Home: "Brandolph is still working" card + Recently viewed mosaics.
7. Share → Copy link only.

### Explicitly cut (post-10-19)
@mentions in prompts · pinned comments · non-destructive image tools (Upscale / Inpaint / Remove BG / Outpaint / Crop) · templates with INPUTS → OUTPUTS · multi-chat tabs + history · skills authoring UI (`/skill` from BIO) · marquee multi-select · groups/frames · guest-browsable app · passwordless auth · onboarding questionnaire · Playground / Cast / voice equivalents · referral program.

---

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `portal-briefs.jsx` (4.4k lines) becomes unmanageable | Slower delivery, regressions in v1 | Extract into `src/canvas/*`; v1 untouched behind a flag |
| Pointer-capture swallows new controls (Run, ports, variation arrows) | "Buttons don't work" bugs | Hit-test in `endDrag` or `stopPropagation` on `pointerdown` for every control; add a manual QA row per control |
| User-added nodes vs the brief model (runs need `briefText`, crew assumptions) | Odd outputs, credit surprises | User nodes always inherit the BIO + sharpened brief; upstream edges add context only; Run always shows "≈ N cr" first |
| Tier → route mapping drifts from `router.js` / spec defaults | Cost regressions | Map server-side in one table next to `credits.js`; `npm run test:router` covers each tier |
| Persistence migration on prod Supabase (`yemzrohzqfuxmekcgnnh`) | Data / RLS mistakes | Additive table only; RLS mirrors `briefs`; cross-tenant test with `scripts/make-test-client.mjs` |
| The credit approval card adds friction to the current one-click assembly | Lower completion | "Always approve" per brand; the card only appears when the batch is above a threshold (owner to set, e.g. > 300 cr) |
| 15 days is tight for P0 | Miss the date | Hard checkpoint on Fri 10-09; the P1 stretch only starts after the P0 demo passes; Phase 4 review mode can fall back to the existing `DeliverableDrawer` with a versions list |

---

## 9. Decisions needed from the owner (blocking)

1. **Approve the scope:** P0 = §7 phases 1–4; the stretch and cut lists as written. (Standing rule: no flow or feature change without sign-off.)
2. **Tiers instead of model names** in the re-run UI (Premium / Balanced / Fast + Auto). The tier → route mapping stays internal.
3. **Single click selects; double-click (or Open) opens the drawer.** This changes today's click behaviour.
4. **Dark desk with light node frames** (per the Aug Figma plan), with the CanvasHeader slimmed to 44px but expandable.
5. **New table `canvas_layouts`** (additive migration on prod).
6. **The credit approval card** before agent batch runs, and its threshold.
7. **"First run on us"** for the tour (a credit grant): yes or no (stretch only).
8. **Who builds:** one or two FE engineers. It changes whether phases 2 and 3 run in parallel.

---

## 10. Definition of done (10-19)

On a design-partner workspace, with the flag on, a user can:
1. Open a brief canvas: BIO → Brief → crew rendered on the dark desk, with CanvasHeader present.
2. Add a specialist from **+, N, right-click or a dragged wire**, and connect it to another node.
3. Select a node, see the inspector + model bar, pick a **tier** (credits shown, no model names), and **run just that node**.
4. See it stream on the node, get a ready toast, flip **variations**, press **Space** to review, and **approve as steward**.
5. Ask Brandolph in the docked panel, watch the run log, **approve the credit spend**, and jump with **View N nodes**.
6. Reload the page with everything still in place (positions, user nodes, edges, picked variations).
7. Do all of it from the keyboard (N, /, ⌫, ⌘D, ⌘↵, Space, ⇧1, Esc, ?).

All existing smoke tests pass (`npm run test:router`, `test:run`, `test:discovery`), cross-tenant RLS is verified, and no vendor, model or $ cost appears anywhere in the SPA.

---

## 11. Next actions (in order)

1. The owner answers §9 (one pass).
2. Commit `docs/2026-10-04-melius-parity-handoff.md`, `docs/competitors/melius/*` and `docs/mockups/melius-parity/*` on this branch, then open a PR for visibility.
3. Create tickets P1-1 … P4-3 (IDs above) in the tracker.
4. Start P1-1 / P1-2 on Mon 10-05. Write the `canvas_layouts` migration on day 1 so the back-end is ready by Wednesday.
