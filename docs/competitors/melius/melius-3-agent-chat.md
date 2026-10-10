# Melius teardown, part 3: how the user talks to the AI ("Mel")

Source: Refero, site id 1166 (melius.com, "The AI-native operating system for creatives"). All in-app screens are on one canvas route, `app.melius.com/projects/{projectId}/canvas/{canvasId}`, plus `/home` and the Settings modal. That modal is opened from the Academy page in the captures: `/academy/templates-tools-and-utilities`.

What I did: I searched about 30 queries, paged through all ~185 Melius screens, pulled full descriptions for about 45 of them, and looked at 24 at full size (marked **[viewed]** below). Refero lists these Melius flows: *Attaching file to chat* (14068, 3 screens), *Configuring custom skill* (14067, 9), *Submitting feedback on AI response* (14070, 3), *Submitting product feedback* (14100, 4), *Creating new project* (14064, 7) and *Walking through tutorial* (14092, 4). `refero_get_flow` returns `INVALID_FLOW_ID` for all of them, so I rebuilt the flows from individual screens.

**Gap:** I could not find the 3 screens of flow 14070, *Submitting feedback on AI response*, through any screen search. In every captured chat state, AI messages show no thumbs or rating controls. The only feedback UI I could document is the global "Share feedback" flow (§9).

---

## 0. Vocabulary and identity

- The agent is called **Mel**. Evidence:
  - Home subtitle: "Describe it, and **Mel** builds it across every model in one place."
  - Slack integration: "**@Mel** in Slack to generate creatives."
  - A presence pill labeled "**Mel** · Creating nodes" appears on canvas nodes while the agent works.
  - Onboarding copy: "Mel will show you how the canvas works, starting with your first creation."
- The agent is never called "chat" in the UI. Labels say "agent chat", "agent settings", "agent prompt" and "agent call".
- Visual language: near-black background (#131313–#171717) with a dotted grid. Panels are charcoal (#1B1B1B–#242424) with 1px borders around #343433. Text is warm off-white (#CFCECD / #F0E9E1); muted text is around #666565.
- The single accent is orange-red #EF4E25, used for Share, the add-node button, Approve, Create skill, Connect, slash-command text and the selected-node outline. Teal (#47777A-ish) means "agent is working on this node".
- Type is a compact sans at 9–13px. Editorial serif headings (Instrument Serif) appear only on Home and Academy.

---

## 1. The prompt composer, empty canvas state (first contact)

Screens: **[viewed]** https://refero.design/pages/384f0567-84af-4950-801b-9c8bdb85c87f , 34b8419a, b3558787

**Layout**
- Infinite dotted canvas.
- Top-left floating pill: ☰ · `#12/ss/26 / Canvas 1 ⌄` · globe icon `20k`. The 20k is the credit balance; it drops to 19k after a generation.
- Top-right: split orange button `Share | 🔗`.
- Bottom-centre dock: orange `+` (add node), pointer tool ⌄, sticky/shape ⌄, doc, frame, layout, `100%`.

**Centre of the canvas**
- Hint: "Right click or press `N` to start imagining". The N sits in a keycap.
- Below it, a composer about 420×80px:
  - Placeholder: "What would you like to create?"
  - Bottom-left: `▷ Auto-run` and `☰ Plan`. These are mode toggles: run immediately, or plan first.
  - Bottom-right: a small `+` circle, then a **white circular mic button**.
  - The mic becomes a **white ↑ send** button as soon as there is content (chip or text). See b2b5233e.
  - While the agent is running, the button becomes a **■ stop** button. See 87c001df.

**The `+` menu** (popover anchored above the + button)
1. `📎 Attach files`
2. `☑ Skills  ›`. Hovering opens a submenu:
   - When empty: "No skills yet" plus a `+ Create skill` row.
   - When populated: skill rows show the name, e.g. `/generate-skincare-image`, with a one-line description ("Generates high-quality, PDP-ready market…"), a divider, then `+ Create skill`. See **[viewed]** https://refero.design/pages/7f7716d3-c077-4ed4-89a7-2a8b58bf7809
3. `⚙ Go to agent settings`. This deep-links into the Settings modal → Agent tab.

**Keyboard shortcuts** (from the shortcuts modal, **[viewed]** https://refero.design/pages/4b4dc9bd-1a8d-4612-b2d1-9978f5c3ab6c)

| Action | Shortcut |
|---|---|
| Open agent prompt | `/` |
| Add node | `N` |
| Copy prompt | ⌘⇧C |
| Find node | ⌘F |
| Keyboard shortcuts | ⌘/ |

Also listed: Duplicate (no connections), Rename (⌘E), and others. The shortcuts modal is reached from ☰ → Help › Keyboard shortcuts (56ed6438).

**Project menu** (☰, 56ed6438 / b3558787): Back to home · Rename project · Rename canvas · Project settings · Settings · Help › (Documentation, Keyboard shortcuts ⌘/, Share feedback) · Manage plan.

---

## 2. Flow: Attaching a file to chat (3 screens)

1. **Open the menu.** Click `+` in the composer; the `Attach files` row is highlighted. The composer already holds a skill chip. **[viewed]** https://refero.design/pages/8ec22616-a75a-4305-b749-78f81824822a
2. **File attached.** The OS picker is not captured. A filename chip appears inline in the text field:
   - The chip is a tiny thumbnail plus `shot2.jpg` on a slightly lighter pill.
   - It sits next to the skill chip `/generate-skincare-image ✕`.
   - The mic button has become the white **↑ send**.
   - **[viewed]** https://refero.design/pages/b2b5233e-c4ca-494c-ab2c-03e7a3df4aaf
3. **Prompt typed after the chips.** The text reads "High-resolution photo of a minimalist skincare product in, warm natural lighting, commercial photography style." The send button is ready. **[viewed]** https://refero.design/pages/1740230d-d6b6-4c98-9cb9-63ab5fc761b5

**Pattern:** attachments and skills are **inline tokens inside the text field**, not a tray above it. Skill chips get an ✕ to remove. The file chip shows a thumbnail.

**Alternative help path** (107bf4b1, below): Mel itself explains three ways to upload:
- drag and drop onto the canvas,
- paste with Cmd+V / Ctrl+V,
- the toolbar upload/add button.

The empty canvas can also show a big "⬆ Upload image" drop target (87c001df).

---

## 3. The agent chat side sheet (conversation view)

Screens: **[viewed]** https://refero.design/pages/87c001df-a12a-42f5-ad8f-b5a193ae9d7f , d58be421, 6e9de6f8, 93f056f0, 7ddd95ce, a8ecebb2, 107bf4b1, dfce6810

**Where it lives**
- After you submit from the centred composer, the composer collapses into a **left docked side sheet**: about 255px, about 31% of the viewport, full height, rounded, inset 10px.
- An **orange vertical tab `‹`** on the sheet's right edge collapses or expands it. When collapsed, the tab sits at the far-left screen edge as `›` (7cb24af9).
- The canvas stays live beside it.
- Transition route: `?newChat=1` shows a full-screen loader. A pixel-art red Melius bow-tie logo sits above "Connecting nodes…". **[viewed]** https://refero.design/pages/a094486e-e190-4570-9300-23f0a4207da5

**Header: chat tabs**
- Browser-like tabs. The first is "New chat"; it auto-renames to the task ("Skincare product pho…").
- Each tab has a small grid/streaming icon, which the active tab shows while running.
- `+` opens a new chat; `🕘` opens history.
- Several chats can be open at once: "Skincare product pho…" and "Image upload help ✕". **[viewed]** https://refero.design/pages/107bf4b1-c834-4d3b-b5db-34a26b244e04
- A new tab first takes a generic name ("Image") while thinking (dfce6810), then gets a title.

**User message**
- Right-aligned charcoal bubble (#353434), radius about 8.
- Content in order: attachment chip (thumbnail + filename, e.g. `1f2b5fe4-…jpg` after upload, which renames the file), then the skill slash-command in **orange** (`/generate-skincare-image`), then the prompt text.

**Agent turn: run/status block**, a collapsible card below the user bubble. A sequence of live states:

| State | Header (with elapsed timer, right-aligned) | Body |
|---|---|---|
| Waiting | "Thinking…" (1.4s, 1.6s) | single grey row (87c001df, dfce6810) |
| Planning | "Daydreaming…" (11.6s) | expandable `›` steps: Read canvas · Load guide · Updated plan (d58be421 **[viewed]**) |
| Building | "Ideating…" (30.0s) | Load guide · Updated plan · Create nodes · Read canvas · ✓ Start generation (highlighted row) (6e9de6f8 **[viewed]**) |
| Waiting for approval | "Waiting for input…" (26.5s) | step list, then an **approval card** (93f056f0 **[viewed]**) |
| Done | the whole block collapses to "› 6 tool calls" (or "› 1 tool call") | final prose answer + action button (7ddd95ce **[viewed]**) |

Each step row is itself expandable (›), so the tool trace is inspectable.

**Approval card (human in the loop)** (https://refero.design/pages/93f056f0-aa6c-4d43-b122-d768daba881c)
- Title "Start generation?"
- Body "This generation will spend 169 credits"
- Buttons: `Approve` (filled orange) · `Always approve` (dark, bordered) · `Deny` (text).
- This is the cost gate: the agent builds nodes for free, but **spending credits needs explicit consent**. "Always approve" escalates to auto-approval.

**Final answer**
- Plain prose, with no bubble, on the panel background. Example: "I've queued up Commercial Skincare Hero Photo using your attached serum bottle as the reference. It's styled with a minimalist, warm natural aesthetic — placing the amber bottle on a warm stone plinth with sand and river pebbles, bathed in soft morning window light."
- Followed by an outlined button **`⛶ View 1 node`**, which jumps or zooms the canvas to what was created.
- Help answers (107bf4b1) end with a collapsible "› Read docs" row with its own timer (10.2s). In that capture the same paragraph is rendered twice, which looks like a duplication bug.

**Composer while running:** "Ask a follow-up…" placeholder, the same `Auto-run` / `Plan` toggles, `+`, and a **■ stop** button. When idle, the button is back to the mic.

**No per-message action row was captured.** No copy, retry, thumbs or regenerate controls appear in any of these states.

---

## 4. How AI responses create and modify canvas nodes (agent ↔ canvas)

1. **Before.** The canvas holds only the uploaded image node `shot2` (d58be421).
2. **Agent creates a node** (6e9de6f8 **[viewed]**)
   - A tall new node, "Commercial Skincare Hero Photo · Seedream 5.0 Pro", appears to the right.
   - It is wired from `shot2` with a curved connector and numbered orange ports (①).
   - It has a **teal outline + glow**, and a **teal presence pill on top: "Mel · Creating nodes"**. The agent behaves like a multiplayer cursor.
   - Its body: "Generating…" over an animated dot-matrix (about 7×8 dots), then the **agent-written prompt** with an inline node-reference token ("…amber glass serum bottle from [🖼 shot2] featuring a clean minimalist aesthetic…").
   - Bottom-right of the screen: a global status bar, "Generating 1 node ⌃".
3. **Waiting on approval.** The node shows an empty image placeholder while the chat holds at the approval card (93f056f0).
4. **Generating.** The outline switches from teal (agent editing) to **orange (selected/generating)** (7ddd95ce).
5. **Done.**
   - Top-centre toast: "✓ Your generation is ready [Space]". The Space keycap hints at a shortcut, probably to jump to or preview the result.
   - The node fills with the image, and its model label now reads "Nano Banana 2".
   - Credits go 20k → 19k.
   - Screen: a8ecebb2 **[viewed]** https://refero.design/pages/a8ecebb2-1d2f-4599-9af3-0357b2d0eb58
6. **Everything stays editable.** Nodes carry their prompt text with an `@` hint: "Describe your image, or @ to mention nodes". A properties inspector on the right holds Name · Generation settings › Model / Aspect ratio / Resolution. A per-node toolbar reads `Model: Seedream 5.0 Pro ⌄ · 3:4 ⌄ · 2K ⌄ · ⛶`.

### Model selector

The model selector lives **on nodes, not in the chat composer**. **[viewed]** https://refero.design/pages/0edde52f-70ec-4b73-bb0d-d5c410777c3f

- Search box at the top, then "Featured models".
- Each row: model name, a **time chip** and a **credit-cost chip**, plus a one-line description.

| Model | Time | Credits | Description |
|---|---|---|---|
| GPT Image 2.5 Sunburst | 2m | 67 | Fine detail and precise image editing |
| GPT Image 2.5 Flare | 2m | 67 | |
| Nano Banana 2 Lite | 4s | 39–49 | |
| Nano Banana Pro | 30s | 188–376 | |
| Seedream 5.0 Pro | 40s | 85–169 | ByteDance's flagship image editing model |

- Provider group row: "OpenAI ›".
- Footer: an **`Auto` toggle** (green, on). The node toolbar then shows "Model: Auto".
- Note: unlike CaastorOS, Melius shows **per-model credit costs** to the user.

---

## 5. Inline "ask about selection" prompt (canvas → chat)

Screens: **[viewed]** https://refero.design/pages/84e24760-c919-4c53-a717-5c8a7d002724 , **[viewed]** https://refero.design/pages/7cb24af9-55c3-494f-b2bb-575b950d818c

- With a node selected (and the chat sheet collapsed), a **floating one-line prompt bar appears at the cursor** on the canvas.
- Its content: a grey chip `1 selected`, then the placeholder "Imagine anything…", then a small orange ↑ (disabled until you type).
- Typing "how to upload image?" and sending (7cb24af9) **opens a new chat tab ("Image")**.
- The selected node appears in the user bubble as a **context chip** (orange dot + "Image 2026-09-29 at 5.37.27 PM") ahead of the question (dfce6810 **[viewed]**).
- So canvas selection is passed into the conversation as explicit, visible context.

---

## 6. Flow: Configuring a custom skill (9-screen flow, rebuilt)

| # | State | Screen |
|---|---|---|
| 1 | Composer `+` → Skills › → "No skills yet" / `+ Create skill` | 384f0567 **[viewed]** |
| 2 | **New skill** modal, empty | **[viewed]** https://refero.design/pages/9c024671-7ec2-4707-9947-315c80d21124 |
| 3 | Modal filled | **[viewed]** https://refero.design/pages/af14066c-9a50-483a-9341-f850fa67a2d2 |
| 4 | Skills submenu now lists the skill | 7f7716d3 **[viewed]** |
| 5 | Skill selected → chip in composer `/generate-skincare-image ✕` + placeholder | **[viewed]** https://refero.design/pages/360a73b9-eace-4dd6-93c8-41af30c4f0a4 |
| 6–7 | Attach file → file chip (the §2 flow) | 8ec22616, b2b5233e |
| 8 | Type prompt and send | 1740230d |
| 9 | Chat side sheet shows the orange slash-command in the user bubble, agent "Thinking…" | 87c001df |

### The "New skill" modal

Centred modal, about 320px wide. Title "New skill", ✕ to close.

| Field | Placeholder / content | Helper text and limits |
|---|---|---|
| **Name** (required) | "A name for this skill" | Helper: "Type a name to set the slash command". Once filled (e.g. `/generate-skincare-image`), it changes to: "Type **/generate-skincare-image** (orange) at the beginning of your agent chat to apply this skill's context" |
| **Description** (optional) | "A short description of what the skill does" | Counter `0/200`. The filled value reached 115/200: "Generates high-quality, PDP-ready marketing images for a skincare brand b…" |
| **Instructions** | "Add brand voice, audience, products, palette, taglines, examples, and dos and don'ts the agent should follow" | Copy icon, resize handle, counter `0/50k`. Filled example at 757/50k: "Act as a professional Beauty & Skincare Product Photographer and Digital Artist. / Role & Goal…" |
| **Images** (optional, ⓘ) | dashed area "+ Add image" | `0/20` reference images |

Footer: `Cancel` (text) and `Create skill`. The button is dim terracotta (#5D3A31) until valid, then bright orange.

**What a skill is:** a named, reusable context pack (instructions plus up to 20 reference images) invoked as a **slash command at the start of a message**. In practice it works as a **per-brand or per-use-case brief**. Plan gating: pricing lists "up to 3 or 10 agent skills" by tier (seen in pricing descriptions).

---

## 7. Agent settings and integrations (Settings modal)

Shared shell:
- Modal about 640×380.
- Left rail "Settings": Account & team · Referrals · Usage · Plans & billing · **Agent** · **Integrations** · Advanced.
- Bottom of the rail: `Manage plan`.

### Agent tab

**[viewed]** https://refero.design/pages/1cfd6ed4-afc5-4779-a982-f954fd1dcb06

- **Recommended**
  - Intro line: "Accelerate your workflow by connecting Melius to your breadth of tools".
  - Card: "**MCP: Connect Melius**", with body "Manage your API keys in Integrations to give Claude, Cursor, and more access to Melius".
  - Orange `Learn more ↗` button, and an illustration tile of app icons (Claude asterisk, Cursor, etc.).
- **Context**
  - Helper: "Plain-text rules. Keep it concise — this runs on every agent call."
  - Large textarea, placeholder "e.g. Always use our brand voice. Prefer the Inter typeface. Keep copy concise and friendly."
  - Copy icon and resize handle; counter `0 / 4000`.
- This is the global, always-on system prompt. Skills are the opt-in, per-message equivalent.

### Integrations tab

**[viewed]** https://refero.design/pages/13b73e36-42b9-4309-bd03-9e9975803cee

- **Apps** ("Connect the other tools your team works in"), as two cards:
  - **Slack**: "@Mel in Slack to generate creatives" `Connect`.
  - **ElevenLabs**: "Import custom voices from ElevenLabs" `Connect`.
- **API keys** ("Let the Melius API, CLI, and MCP server act on your behalf"):
  - "Create a new key" row: input "Key name (optional)", dropdown "No expiry ⌄", orange `Create`.
  - Empty state: "No API keys yet".
- Melius exposes **itself as an MCP server**. In the captures it does not show a way to plug MCP tools *into* Mel.

**Advanced** (from sibling capture e9839534): Custom seed (team), Seedance precheck (warns before prompts likely to be rejected), "Hide dedicated prompts on media nodes" (user).

**Brand kit / memory:** I found no dedicated brand-kit or memory UI. Brand context lives in three places:
1. Agent → Context (4,000 characters, global),
2. Skills (50k characters + 20 images, invoked by slash command),
3. Advanced → custom seed.

---

## 8. Home: natural-language project creation

Screens: **[viewed]** https://refero.design/pages/25e2eb1b-ca4f-48db-9e80-ef49da06930b , 1046005d, af66ff31, **[viewed]** https://refero.design/pages/ecc3733a-7384-4c03-9641-98dc124e682a

**Hero**
- Serif "What will you create today?" with subtitle "Describe it, and Mel builds it across every model in one place".
- Wide composer (about 520×86):
  - Placeholder "Describe what you want to generate…"
  - **Suggestion chips** with thumbnails: "Neon rose still life", "Pearl strand close-up", "Sunlit portrait study", "Studio glassware".
  - 📎 attach and a light-grey square ↑ send.
- A rail popover "Create" offers Playground / Cast, as alternate destinations.

**Flow** (*Creating new project*, 7 screens):
1. A **"New project"** modal appears with a pre-filled name (`#12/ss/26`), `Cancel`, and `Create` with a spinner.
2. Then the canvas loads: either the "Connecting nodes…" loader, or the empty-canvas composer.

Below the hero: "Introducing Cast" promo, "Recently viewed" project cards, Discover (including an **MCP integration card with `Connect`**), and Playground.

---

## 9. Feedback

- **Product feedback** (*Submitting product feedback*, 4 screens):
  1. Entry from ☰ → Help › "Share feedback", or the sidebar "Share feedback" pill (0c97ca03).
  2. Modal "Share feedback" with a multiline field, placeholder "Tell us about your experience, bugs you've found, or features you'd like to see..." (dd11b5ca).
  3. Filled state; `Cancel` / orange `Share` (**[viewed]** https://refero.design/pages/29b18118-e29f-4d29-bae7-f1562e8320a8).
  4. Toast, presumably.
- **Per-response feedback** (flow 14070): exists in Refero's flow list but its screens are not retrievable. No thumbs or reason UI is visible on any captured agent message, so I cannot describe its anatomy.

---

## Key conversational UX patterns worth matching

1. **Composer that morphs by state:** mic (empty) → ↑ send (has content) → ■ stop (running). One button, three meanings; no clutter.
2. **Inline tokens, not trays.**
   - Skills (`/slug ✕`), file chips (thumbnail + name) and node references (`[🖼 shot2]`) all live inside the text.
   - The same token style appears in the user bubble, so what you sent reads exactly as you composed it.
3. **`+` menu as the single entry point:** Attach files · Skills › · Go to agent settings. Settings are one click from the prompt.
4. **Skills = named brief + reference images, invoked by slash command.**
   - The Name helper live-teaches the invocation ("Type /x at the beginning of your agent chat…").
   - CaastorOS analogue: a skill per brand/BIO facet or per specialist brief, invoked as `/hero-kv` etc.
5. **Global "Context" rules** with a hard character cap and copy that says it runs on every call.
6. **Narrated, collapsible run log**
   - Named phases with live timers (Thinking… / Daydreaming… / Ideating… / Waiting for input…).
   - Expandable tool steps (Read canvas, Load guide, Updated plan, Create nodes).
   - Collapses to "› N tool calls" when done, so the transcript stays short without hiding work.
7. **Credit-spend approval gate** inside the chat: "Start generation? This generation will spend 169 credits" with `Approve / Always approve / Deny`. Planning is free; spending needs consent; "Always" lets power users opt out.
8. **Answer ends in a canvas jump** (`View 1 node`). Each reply points to the artifacts it made.
9. **Agent presence on the canvas**: a teal outline plus "Mel · Creating nodes" pill on nodes being built, a dot-matrix "Generating…" fill, a global "Generating 1 node" status bar, and a "Your generation is ready [Space]" toast.
10. **Selection-aware inline prompt** at the cursor ("1 selected · Imagine anything…") that spawns a chat tab with the selection as a context chip.
11. **Multi-tab chats** per canvas, auto-titled from the task, with history (🕘) and new (+).
12. **Auto-run vs Plan toggles** in the composer: run immediately, or have Mel propose a plan first.
13. **Shortcut culture:** `/` opens the agent prompt, `N` adds a node. The hint is taught on the empty canvas.

## How chat and canvas relate

**Chat drives the canvas**
- The agent reads the canvas ("Read canvas" step), loads a guide, writes a plan, then **creates nodes and wires them** to existing ones.
- It writes the node prompts itself, embedding `@node` reference tokens, and picks the models. The model can change, e.g. to Nano Banana 2.
- It queues generation behind an approval gate. Chat replies summarise what was built and link to it (`View 1 node`).
- The canvas, not the transcript, is the durable output: chat is ephemeral steering, nodes are the record.

**Canvas feeds the chat**
- Selecting nodes and using the inline cursor prompt sends them as context chips ("1 selected" → "Image 2026-… " chip in the bubble).
- Uploaded or attached images become nodes (`shot2`) and are referenced back in agent-written prompts.
- Users can bypass chat entirely: edit node prompts directly with `@` mentions, change model/ratio/resolution in the inspector, and re-run per node. Chat and direct manipulation are two views on the same graph.
- Global Agent Context, Skills and Advanced settings are layered onto every agent call. Integrations expose the same agent outside the canvas: Slack "@Mel", and the API/CLI/MCP keys.

**Implication for CaastorOS:** Melius makes the canvas the outcome and the agent a visible collaborator *on* the canvas (presence pill, node outlines, approvals). This is close to our "canvas is the moat" stance. The parts worth matching are:
- the run-log → node-link handoff,
- the credit approval card (shown in credits only),
- slash-invoked skills as reusable briefs,
- selection-as-context.

---

### Screen index (Refero URLs, all `https://refero.design/pages/<id>`)

| Area | Screen ids |
|---|---|
| Composer / menus | 384f0567, 34b8419a, b3558787, 56ed6438, 8ec22616, 360a73b9, b2b5233e, 1740230d, 7f7716d3, 4b4dc9bd |
| Skills | 9c024671, af14066c |
| Chat sheet | 87c001df, dfce6810, 107bf4b1, d58be421, 6e9de6f8, 93f056f0, 7ddd95ce, a8ecebb2, a094486e |
| Inline canvas prompt | 84e24760, 7cb24af9 |
| Model picker | 0edde52f, fb4668c6, 45cdc422 |
| Settings | 1cfd6ed4 (Agent), 13b73e36 (Integrations), 94b1cb52 (Referrals) |
| Home | 25e2eb1b, 1046005d, af66ff31, ecc3733a |
| Feedback | 0c97ca03, dd11b5ca, 29b18118 |
| Onboarding hints | 45877034, 0ab8a67d, e9cfbbbf, b1f7a47e, d2d2d357 ("Now you're ready… The canvas is yours now." `Start creating`) |
