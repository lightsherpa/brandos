# Melius teardown, part 2: the Canvas

Source: Refero (site id 1166, melius.com, "The AI-native operating system for creatives"). I found about 140 Melius canvas screens across around 30 queries and result pages. I read the full Refero descriptions for 90 of them and looked at 38 full screenshots myself. Every screen comes from one canvas instance:

`https://app.melius.com/projects/fb26da34-4224-4889-94d5-1140f39c016c/canvas/a5bff83b-884a-4494-b262-986966bea402`

There is also one variant with a `?newChat=1` query param.

Citations use the form `[uuid8]`. The full link is `https://refero.design/pages/<uuid>`, and the complete index is at the end of this report.

`refero_get_flow` does not work for Melius, so I rebuilt each flow from individual screens. Refero lists these Melius flow names, which confirms the flows exist: "Creating note" (8 screens), "Sharing canvas access" (5), "Copying link to clipboard" (3), "Adding comments to canvas" (5), "Upscaling image" (6), "Creating new project" (7), "Configuring custom skill" (9), "Filtering voice models" (10), "Attaching file to chat" (3) and "Submitting feedback on AI response" (3).

Two caveats about the screenshots:
- Screenshots are 800×450, so pixel sizes are approximate.
- Hex values come from Refero's sampled palettes plus my own visual check.

---

## 0. TL;DR: what Melius's canvas is

- **A node graph, not a whiteboard.**
  - Every object is a typed node: Text, Image, Video, Audio, Upload, Note or Comment.
  - Nodes have typed, colour-coded ports on their left (inputs) and right (outputs).
  - Nodes are joined by thin bezier "wires".
  - Each generative node carries its own prompt, a model chip, a variation count and a Run button.
- **An agent lives on the canvas.** The agent, "Mel", can be reached through:
  - a centered empty-state composer ("What would you like to create?");
  - a docked left chat panel that plans, asks for approval ("Start generation? This generation will spend 169 credits" with Approve / Always approve / Deny), and then builds nodes on the canvas itself ("Mel · Creating nodes");
  - an inline "Ask Mel" composer bound to the current selection ("1 selected"), opened with `/`.
- **The chrome is minimal and floats.** There are four floating pieces:
  - a top-left project/canvas capsule;
  - a top-right orange Share button;
  - a contextual top-center model bar for the selected node;
  - a bottom-center dock: **+** · pointer ▾ · Note/Comment ▾ · Assets · (grid) · Minimap · Zoom %.
  - A right-hand inspector ("Name" plus "Generation settings", or asset metadata plus Tools) appears when something is selected.
- **The first run is a scripted, gamified tour.** It is a four-step "Generate → Variations → Edit → Iterate" walkthrough with a "1/4" ring and Mel speech bubbles, and the first generation is free ("First generation, on us").
- **The visual language** is a near-black canvas (#131313–#151515) with a subtle dot grid. It uses one hot accent (#EF4E25 orange-red) for add, share, approve, the active node and progress. White circular ↑ Run buttons sit on each node. Type is small (9–12 px) Inter-like sans, with editorial serif headlines only in onboarding moments.

---

## 1. How a canvas opens, and the canvas header

### 1.1 Route and entry
- The route is `app.melius.com/projects/<projectId>/canvas/<canvasId>`, so canvases belong to projects. The "Creating new project" flow exists in Refero, but no project-list screen came up for the canvas queries. Part 1 covers it.
- `?newChat=1` loads a **full-screen loading state** `[a094486e]`:
  - a solid #141313 background;
  - a centered red-orange **pixel-art "node-connection" glyph** (two bracket clusters joined by a dotted bridge, #C5705C / #794236 / #380605);
  - the caption **"Connecting nodes..."** in tiny #767676.
- The same bow-tie / hourglass glyph is the Mel avatar tile used in every tour bubble. It is a brand motif.

### 1.2 Header capsule (top-left, about 9 px inset, about 172×30 px) `[1740230d] [56ed6438] [45877034]`
From left to right:
1. A **hamburger** icon. When the menu is open it turns into an **×** `[56ed6438]`.
2. The **project name**, e.g. `#12/ss/26` (the project's name is a date-like slug).
3. A `/` separator, then the **canvas selector "Canvas 1" ▾**. This implies multiple canvases per project, and the menu has a "Rename canvas" item.
4. A thin divider, then a **credits indicator**: a small globe/coin glyph plus a compact value such as `20k`, `19k` or `15k`. It counts down as you generate. Hovering shows a tooltip **"15,430 credits"** `[11c1e83a]`. Only credits are ever shown, never dollars.
- Styling: #1B1B1B fill, 1 px #343333 border, about 8 px radius, soft shadow, 10–11 px #A5A3A3 text.

### 1.3 Project/hamburger menu (verbatim) `[56ed6438] [b3558787]`
Dropdown, about 130 px wide, #1D1D1D, 8 px radius, with dividers between groups:
- **Back to home**
- —
- **Rename project**
- **Rename canvas**
- —
- **Project settings**
- **Settings**
- **Help ›** opens a submenu with **Documentation** (book icon), **Keyboard shortcuts** (`⌘/` keycap) and **Share feedback** (speech bubble)
- —
- **Manage plan**

### 1.4 Share (top-right)
- A split pill in #EF4E25: **"Share"** label plus a separate **link-icon segment** divided by a darker hairline. It is about 59×20 px with a 4–5 px radius.
- Hovering the link segment shows the tooltip **"Share asset"** when a node is selected `[ac110c88]`. That suggests the link segment is context-aware: it shares the selected asset, not the canvas.

### 1.5 Bottom dock (bottom-center, about 208×31 px, floating) `[1740230d] [892247a4] [fc6554c3]`
From left to right:
1. **Orange "+" square** (#EF4E25, 20×20, white plus). This is the add-node trigger.
2. **Pointer ▾**: the select tool, with a dropdown chevron. It is highlighted as the active tool in a lighter pill.
3. **Sticky-note ▾**: opens a **Note / Comment** popover `[bc0aca17]`.
4. | divider
5. **Document icon**: toggles the **Assets** panel. It is shown active when Assets is open `[fc6554c3]`.
6. **Stacked-rows/grid icon**: function not captured. I found no screen showing it active. It is probably the layout/list or "workspace layout" toggle; see §9.
7. | divider
8. **Map icon**: toggles the **minimap**. It is shown active when the minimap is visible `[892247a4]`.
9. **Zoom readout**: "100%", "79%", "64%", "46%", "225%" and so on. It is text only; no +/− buttons appear in the dock.
- Styling: #1B1B1B to #242424 fill, #343333 border, about 10 px radius, soft shadow. Icons are 12–14 px #C1BFBE.

### 1.6 Minimap `[892247a4]`
- Bottom-right, about 140×100 px, a #1B1B1B rounded card with a **× close** in its corner.
- It shows grey rounded rectangles for nodes, joined by thin lines (wires are drawn in the minimap too).
- It is toggled by the map icon in the dock.

### 1.7 Left-edge orange tab
- A vivid orange vertical half-pill (#ED4E26) sits on the left viewport edge with a **›** chevron `[4c7ea8f2] [c546ace1]`.
- When the chat panel is open, the tab moves to the panel/canvas seam and shows **‹** `[93f056f0]`.
- It is the **chat panel collapse/expand toggle**, the main "layout" switch between canvas-only and chat + canvas.

### 1.8 Status toasts (top-center pill)
- **"Your generation is ready"**, with a green check-circle and a `Space` keycap hint (Space probably jumps to or opens the result) `[9d5851df] [c5d56f88] [a8ecebb2]`.
- **"Link copied to clipboard"**, with a green check `[e573c6f9] [bf630e99]`.

### 1.9 Background-job tray (bottom-right)
- A pill reading **"Generating 1 node" ⌃**, with a thin orange progress line along its bottom edge. It is collapsible `[277097eb] [5ed047f4] [1eb207d2] [d7d82f01]`.

---

## 2. Empty canvas and entry points for creation

### 2.1 Empty state (post-tour) `[1740230d] [34b8419a] [360a73b9] [b2b5233e]`
- Dotted grid on #131313. Centered hint: **"Right click or press `N` to start imagining"**, with N shown in a dark keycap.
- Below it is a **prompt composer** (about 423×78 px, #171717, 1 px #343333, 8 px radius):
  - placeholder **"What would you like to create?"**;
  - bottom-left toggles **▷ Auto-run** and **☰ Plan**;
  - bottom-right **+** (attach menu) and a **white circle**. The circle is a **mic** when the composer is empty and turns into **↑ send** once there is text.
- **Slash-command chips** appear inline in the composer, e.g. `/generate-skincare-image ×` (these are skills). File chips also appear, e.g. a thumbnail plus `shot2.jpg` `[1740230d]`.
- The **"+" menu** `[384f0567] [8ec22616]` contains:
  - **Attach files** (paperclip);
  - **Skills ›**, which opens a side panel showing "No skills yet" and **+ Create skill**;
  - **Go to agent settings**.
- **New skill modal** `[9c024671]`:
  - **Name** ("A name for this skill", with helper text saying it becomes the slash command);
  - **Description (optional)** ("A short description of what the skill does", 0/200);
  - **Instructions** (a multiline field whose placeholder mentions brand voice, audience, products, palette, taglines and examples; 0/50k);
  - **Images (optional)** (ⓘ, "+ Add image", 0/20);
  - footer: **Cancel** on the left and **Create skill** on the right in terracotta, disabled until valid.
  - Brand-context "skills" are reusable slash commands, which is directly relevant to our BIO.

### 2.2 Keyboard shortcuts dialog (verbatim) `[4b4dc9bd]`
- A centered modal titled **"Keyboard shortcuts"** (⌘ glyph), with a search field **"Search shortcuts…"** and a **General** section:

| Action | Keys |
|---|---|
| Keyboard shortcuts | ⌘/ |
| Find node | ⌘F |
| Open agent prompt | / |
| Add node | N |
| Copy selected | ⌘C |
| Copy prompt | ⌘⇧C |
| Paste | ⌘V |
| Paste (no connections) | ⌘⇧V |
| Duplicate | ⌘D |
| Duplicate (no connections) | ⌘⇧D |
| Duplicate and place | ⌥drag |
| Rename | ⌘E |

- The list scrolls, so more sections probably follow.
- Note the **"(no connections)" variants**: copy, paste and duplicate preserve wires by default.

---

## 3. Adding nodes: every entry point

| Entry point | What happens | Evidence |
|---|---|---|
| **Dock "+"** (orange) | Opens the **Nodes / Utilities** picker above the dock | `[b800c63b] [45877034]` |
| **Press `N`** | Same picker at the cursor ("Right click or press N") | `[1740230d]` |
| **Right-click empty canvas** | Picker or menu at the cursor; the hint names it as the primary entry | `[1740230d]` |
| **Drag out from an output port and release on empty canvas** | A dotted teal wire follows the cursor, the picker opens at the drop point, and the new node is **auto-wired** | `[832da4c6] [e9cfbbbf] [7bce79cc]` |
| **"+" inside an image node** (dashed square under the image) | Adds a downstream / "edit with this asset" node ("Use the + to edit with an existing asset") | `[3338bb7c] [adb93576]` |
| **Agent (Mel)** | Chat or composer prompt → plan → **Mel creates nodes** ("Creating nodes" pill) | `[93f056f0] [6e9de6f8]` |
| **Assets panel** | Browse and place generated or uploaded assets ("On canvas" badge) | `[fc6554c3]` |
| **Upload node / drag-drop / clipboard** | Chat help says images can be "dragged and dropped, copied from the clipboard, or selected from the canvas toolbar"; an Upload node is also available | `[107bf4b1] [87c001df]` |
| **Note / Comment** (dock sticky ▾) | Places a sticky note or a comment pin | `[bc0aca17]` |

### 3.1 Node picker, tour variant (verbatim) `[b800c63b] [e9cfbbbf] [4b9350ca]`
- A narrow panel (about 130×150 px) with two tabs: **Nodes** (active, grey pill) | **Utilities**.
- Rows have an icon, a label and a single-key shortcut badge:
  - **T Text** `T`
  - **Image** `I`
  - **Video** `V`
  - **Audio** `A`
  - — divider —
  - **↑ Upload** `U`
- The hovered or recommended row gets a **burnt-orange outline and fill** (#9C3F29 / #9B432B).
- When the picker is opened by dragging from a port, a **dotted teal bezier** runs from the port to the picker `[e9cfbbbf]`.

### 3.2 Node picker, post-tour variant (verbatim) `[4c7ea8f2] [cb77fde2] [f7602915]`
- Top row: **✕ Ask Mel** `/`. Then **Text** `T`, **Image** `I`, **Video** `V`, **Audio** `A`.
- A separate collapsible card below: **Utilities ▾**.
- Upload moved out of this list in the post-tour variant. "Ask Mel!" is labelled "Ask Mel" in the clearest screenshot.

### 3.3 Note / Comment popover (from the dock sticky icon) `[bc0aca17]`
- **Note** `S`
- **Comment** `C`

---

## 4. Node types and node anatomy

### 4.1 Shared anatomy (all media nodes)
- **Caption row above the card**, sitting outside the frame: a type icon (T, image, video, waveform, file) plus a **node title** on the left, and a **model label** on the right.
  - Title examples: "Waterfall Prompt", "Commercial Skincare Hero Photo", "Image 2026-09-29 at 5.37.27 PM", "shot2", "pexels-cottonbro-10210354 (1)".
  - Model examples: "GPT-5.6", "Nano Banana Pro", "Nano Banana 2", "Seedream 5.0 Pro", "Seedance 2.5", "ElevenLabs v4". Uploaded nodes show "Uploaded".
  - Caption text is 9–10 px grey.
- **Card**: #1B1B1B to #222 fill, 1 px #343333 border, 10–14 px radius (smaller, 5–8 px, on the zoomed-out campaign board).
  - **Selected or running** nodes get a **1–2 px orange-red outline** (#E2512C / #EF4B22) with a faint glow.
  - Nodes being built by the agent get a **teal outline** (#47777A) `[93f056f0]`.
- **Body**: the media preview (image, video frame, waveform) on top, then a divider, then the **prompt area** below.
- **Prompt area**: light grey 10–12 px text.
  - **@mentions of other nodes** render in accent orange, e.g. "Use **@Waterfall Prompt** and add golden light through the trees".
  - Mentions can also render as inline **thumbnail chips** (🖼 `shot2`).
  - Agent-written prompts show `[cite: 3]` / `(Image 1 reference)` markers `[277097eb] [a33b89d9]`.
  - Placeholder: **"Describe your image, or @ to mention nodes"**. For video: **"Describe your video, or @ to mention nodes"**.
- **Footer controls** (bottom-right of the prompt area):
  - a **variation stepper pill** "− 5 +" (tour), or a compact "1x" chip (post-tour);
  - a **white circular ↑ Run button**, which becomes a **■ stop** button while generating.
- **Ports**: small circles about 7–10 px on the card edges.
  - Port fill colour encodes type: teal/green = Text, orange = Image, magenta/pink = Video, violet/purple = Audio, amber = Last frame.
  - When a node is selected, **labelled port tags** appear: "Inputs" header with chips "Text", "Image", "Video", "Audio" on the left; "Outputs" header with chips such as "Image", "Video", "Last frame", "Audio" on the right `[40430289] [dbc5be27] [c5d56f88]`.
  - There is a resize grip at the bottom-right corner of a selected node `[adb93576]`.
- **Variation browser** (generated image nodes), attached under the card `[bdf77d69] [45024e5e]`:
  - a strip **"Prev [thumb] 5/5 Next"**;
  - on hover, a **thumbnail tray** in a grid (4 + 1 thumbnails), with the selected one outlined in coral.
  - Tour copy: "Variations landed here, hover the tray to open".
- **Reference row** (image nodes): small circular thumbnails of the inputs used (avatars of the source images), plus a **dashed "+" square** to add references or branch an edit `[adb93576] [cb77fde2]`.
- **Favourite**: a small red ♥ in the top-left corner of the image `[cb77fde2]`.

### 4.2 Text / prompt node ("Waterfall Prompt", model GPT-5.6) `[0ab8a67d] [832da4c6] [7e58182d]`
- About 200×120 px.
- The upper block holds the **expanded/generated prompt** ("A majestic forest waterfall tumbling into a misty emerald pool").
- A divider follows, then the **user instruction** ("Describe a forest waterfall").
- A white ↑ button sits bottom-right. A **teal output port** sits on the right edge and **glows** (radial pulse) to invite dragging.
- **Writing state**: the upper block shows 3 grey skeleton bars, ↑ becomes ■, and Mel's bubble says "Writing your prompt…" `[7e58182d]`.
- So the text node is an LLM node: you give an instruction, it writes the prompt, and you wire it into image nodes.

### 4.3 Image generation node ("Waterfall", Nano Banana Pro / Seedream 5.0 Pro) `[0eaadd6b] [adb93576] [40430289]`
- About 200×210 px when filled. It is a tall portrait card in the post-tour workflows.
- **Empty state**: a dark preview with a small image glyph and the text **"Add references or describe your image."**, then the prompt placeholder.
- **Contextual top model bar** (floats above the selected node, top-center) `[adb93576] [c546ace1]`:
  - `Model: Auto ▾` | `4:5 ▾` | `2K ▾` | `✂ Tools ▾` | ⬇ download | share | ⛶ fullscreen.
  - On empty nodes: `Model: Seedream 5.0 Pro ▾ | 3:4 ▾ | 2K ▾ | ⛶`.
- **Input tags** "Text" (teal) and "Image" (orange) on the left; an output "Image" tag on the right.

### 4.4 Upload / asset node ("Golden hour", "shot2") `[69f909b2] [ae6d2214]`
- An image card captioned "Uploaded" on the right. Its footer shows ⬆ `golden-hour.jpg`. It has an orange output port only.
- **Tour upload picker** `[de5d3ca6]`: a card with **"⬆ Upload an asset"**, three suggested thumbnails, and the caption "Pick a golden-hour shot to bring in".

### 4.5 Video node (Seedance 2.5) `[dbc5be27] [2c586b0b] [a1694646]`
- Caption "Video 2026-09-29 at 6:02:33 PM · Seedance 2.5". The empty preview shows a camera glyph.
- **Inputs**: Text (teal), Image (orange), Video (magenta), Audio (violet).
- **Outputs**: Video, **Last frame**, Audio. "Last frame" is an output port for chaining clips.
- Top bar: `Model: Seedance 2.5 ▾ | 3:4 ▾ | 13s ▾ | 720p ▾ | 🔊 | ⛶`.
- **Duration popover** `[2c586b0b]`: "Duration **4s**", with a ruler-style tick slider and a white handle.
- Inspector: Model, Aspect ratio "Vertical (3:4)", Duration "13s"/"4s", Resolution "720p", and **Generate audio** (green toggle on).
- **@-mention autocomplete inside the prompt** `[dbc5be27]` lists every node on the canvas, each with a thumbnail: "Commercial Skincare Hero Photo", "Ethical skincare hero photo", "pexels-cottonbro-10210354 (1)", "shot2", "Calming skincare routine".

### 4.6 Audio node (ElevenLabs v4) `[c5d56f88] [6bc90678] [2a101c04]`
- Caption "Calming skincare routine · ElevenLabs v4".
- Body: a grey **waveform**, ▶, a scrubber with a white knob, "0:00 / 0:12", then the script text below ("Give your skin the calm it deserves…").
- Ports: Inputs "Text"; Outputs "Audio" (violet).
- Top bar: `Model: ElevenLabs v4 ▾ | Francesca's Secret ▾ (voice) | ⚙ | ✂ Tools ▾ | ⬇ | share | ⛶`.
- **Voice picker** `[20a7a790] [934cc42d]`:
  - tabs **Standard | Custom**;
  - a search field;
  - **Filters (2)** with **Clear all**. The filter panel has Quality (Studio), Use case (Social media), Gender (Any / Male / Female / Neutral), Age, Language and Accent;
  - a voice list with 🔊 preview buttons ("Anandmay Devotional – Spiritual", "Ananya K – Clear & Polished Reel Voice").
- **Speech generating state**: "Generating speech…" plus a dot matrix `[d7d82f01]`.

### 4.7 Note (sticky) `[e702b0cf] [56787d30] [10e306f8] [11c1e83a]`
- A square sticky (about 86×86 px at 46% zoom) with placeholder **"Add a note…"** and an author label at the bottom-left.
- **Note toolbar**: a colour dot ▾ plus a size dropdown ("Small" / "Medium"; Large presumably).
- **Colour menu**: **Yellow ✓, Pink, Blue, Green, Purple**, each with a swatch.
- Filled example: a pink note headed "Next Steps & Iterations" containing bullets, with an author footer.
- Notes have **no ports**. They are annotation, not graph.

### 4.8 Comment `[bc0aca17]`, plus the comment mode in the asset viewer (§7)
- Placed from the dock (`C`). In the asset viewer, a **pin** sits on the image (§7.3).

---

## 5. Connecting nodes (wires)

- **Gesture**: press on an **output port** (right edge) and drag.
  - While dragging, the wire is a **dotted bezier in the port's colour** (teal for text) `[e9cfbbbf]`.
  - Drop it on a compatible **input port** to connect, or on empty canvas to open the node picker and auto-create a connected node.
  - Tour copy: **"Drag out from the glowing port to build on this prompt."** / **"Drag out from the glowing port on the right to work off this image."** / **"Drag Golden hour's output port into the edit's empty image input."**
- **Resting wires**: thin (1–1.5 px), smooth horizontal-tangent beziers.
  - Neutral grey (#6B6B6B) in the tour. Warm orange/brown (#B08C5E to #E4492A) in production boards.
  - No arrowheads; direction is always left to right.
- **Numbered connection badges**: on agent-built graphs, an orange circle with a number ("1", "2") sits on the wire at the target port. It matches the `[cite: N]` / "(Image 1 reference)" numbers in the prompt `[4c7ea8f2] [277097eb]`. Wires double as citation indices.
- **Reference wires** (secondary image input) can be **dashed orange** `[2a86272b]`.
- **Port colour legend**: teal = Text, orange = Image, magenta = Video, violet = Audio, amber = Last frame.
- **Typed input slots**: a node shows labelled empty slots ("Inputs: Text, Image, Video, Audio"). Multiple wires into one slot type are allowed (the "Image" slot showing "2").
- **@mentions are the second connection channel**. Typing `@` in any prompt opens a node list, and the mention renders as an orange token or a thumbnail chip. Wiring and mentioning are interchangeable ways to reference context.

---

## 6. Selecting and acting on nodes

- **Single select**: click a node. It gets an orange outline, labelled port tags, a resize grip, the **contextual top model bar** and the **right inspector**.
- **Inspector, generation node** `[c546ace1] [40430289] [0edde52f]`: **Name** (copy icon) → **Generation settings ▾** → **Model** (select) → **Aspect ratio** (select) → **Resolution** (select). Video adds Duration and Generate audio.
- **Inspector, finished asset** `[adb93576] [9d5851df] [5112da1b]`:
  - header: a truncated name plus ⧉ copy, share and ⬇ download;
  - metadata rows: Format "PNG", Size "5.0 MB", Resolution "1856 × 2304 (2K)", Created "9/29/2026, 5:15 PM", Model "Nano Banana 2", Aspect ratio "Vertical (4:5)". After upscaling it adds **Tool used "Topaz Upscale"**;
  - **Tools — Show all ›**, with an icon row: edit pencil, inpaint, remove object, erase BG, upscale, outpaint/crop;
  - then **Generation settings** (so you can re-run with other settings).
- **Model dropdown** `[0edde52f]`:
  - a search field, then **Featured models**. Each row shows a name, a **time chip** and a **credit-cost chip**, plus a one-line description:
    - **GPT Image 2.5 Sunburst**: 2m, 67 credits. "Fine detail and precise image editing".
    - **GPT Image 2.5 Flare**: 2m, 67. "High-quality images with faster generation".
    - **Nano Banana 2 Lite**: 4s, 39–49. "Ultra-fast image generation".
    - **Nano Banana Pro**: 30s, 188–376. "Detailed images with clear text".
    - **Seedream 5.0 Pro**: 40s, 85–169. "ByteDance's flagship image editing model".
  - **OpenAI ›** is a provider submenu.
  - **Auto** toggle (green). In Auto mode the top bar reads "Model: Auto".
  - Cost is shown **in credits per model**, never in dollars.
- **Aspect ratio dropdown** `[40430289]`: grouped **Square**: 1:1 · **Horizontal**: 21:9, 16:9 ✓, 3:2, 4:3 · **Vertical**: … (labels in the inspector read "Horizontal (16:9)", "Vertical (3:4)").
- **Resolution dropdown**: **1K**, **2K ✓** `[0d40fe15]`.
- **Selection toolbar, "Tools ▾" menu** `[5112da1b]` (above the selected image):
  - icons: ⬆ export · ✂ Tools ▾ · ⬇ · share · ⛶;
  - menu: **Edit image · Inpaint · Remove object · Remove background · Upscale · Outpaint · Crop**.
  - Choosing **Upscale** opens a **"Topaz Upscaler" popover** `[f331a42f]`: Enhancement **Standard V2 ▾** · Scale slider **1.0x** · **Face enhancement** toggle (on) · Face enhancement strength **0.8** · Face enhancement creativity **0.0** · Format **PNG | JPEG** segmented · white ↑ run.
  - Upscale creates a **new output node** wired from the source (the "Outputs → Image" tag), not a destructive edit.
- **Right-click node context menu (verbatim)** `[c546ace1]`:
  - **Ask Mel** `/`
  - —
  - **Copy** `⌘C`
  - **Copy prompt** `⌘⇧C`
  - **Duplicate ›** (submenu, presumably with/without connections)
  - **Paste ›** (disabled when the clipboard is empty)
  - —
  - **Rename** `⌘E`
  - **Download**
  - —
  - **Delete** `⌫`
- **Ask Mel inline composer** `[7cb24af9]`: a floating input next to the cursor with a chip **"1 selected"** and a prompt ("how to upload image?") with an orange ↑. This is selection-scoped agent chat.
- **Multi-select / marquee**: no screen shows a marquee rectangle or multi-select bar. "1 selected" implies multi-select counts exist. "Copy selected" and "Paste (no connections)" imply group operations.
- **Find node** is ⌘F (from the shortcut list).

---

## 7. Running generations: states, variations, output handling

### 7.1 Run
- Click the white ↑ on the node, or press ↑ (the tour copy says "hit ↑"). Mel's tour bubble: **"Nice, now hit ↑ to render all 5."**
- The **variation stepper** "− 5 +" sets the batch size (tour). Post-tour nodes show a compact "1x".
- **Credit gate (agent path)** `[93f056f0]`: the chat panel asks **"Start generation?"** with "This generation will spend **169 credits**" and three choices: **Approve** (orange), **Always approve** (dark), **Deny** (text). This is per-generation consent with an opt-out.

### 7.2 In-progress
- The node outline turns hot orange. The header says **"Generating…"**.
- The preview becomes a **dot-matrix loader**: about a 9×8 grid of grey, white and lavender dots shimmering (in the video and audio nodes too).
- ↑ turns into **■ stop/cancel**. A Mel bubble says "Rendering all 5 variations…" or "Editing your image…" or "Applying the golden-hour look…".
- The global tray shows **"Generating 1 node"** with an orange progress underline.
- While the agent builds nodes, the target node has a teal outline and a top pill reads **"Mel · Creating nodes"** `[6e9de6f8]`.

### 7.3 Done and reviewing
- A toast says **"Your generation is ready"** (`Space`). The image fills the card.
- The **"Prev [thumb] 5/5 Next"** strip appears, and hovering opens the **thumbnail tray**. Tour copy: **"Pick the one that best matches what you asked for"** `[bdf77d69]`.
- **Picking an output**: click a thumbnail to make it the node's current output. Downstream wires carry the picked variant.
- **Sending output onward**: drag from the right output port, or use the dashed "+" under the image, or @mention the node in another prompt.
  - Tour copy: "This one's free too, hit ↑", "Your prompt's wired straight in. Hit ↑ — this one's on me", "Your asset's wired in — hit ↑ to bathe the shot in golden light".
- **Asset viewer / review mode** (opens from ⛶ fullscreen on a node) `[0425f82e] [a33b89d9] [2ff1b78c] [d5cbf935] [622b3db8]`:
  - **Left: "Versions" rail.** Version cards show a thumbnail, a title ("Ethical skincare hero ph…" / "Image 2026-09-29 at 5…"), a model ("Seedream 5.0 Pro") and a size ("1776 × 2368"). The selected card has a red-brown outline and a ♥.
  - **Center**: the image on black, with a title pill above it. The bottom bar holds `Model: Seedream 5.0 Pro ▾ | 3:4 ▾ | 2K ▾ | − 100% + | ✂ | 💬 comment | ⬇ | share | 📄`.
  - **Right: inspector.**
    - Title plus ×. **Details ▾** → **Prompt** (with an inline source chip, e.g. "Commercial Skincare Hero Photo").
    - **Tags**: Filename, Model, Dimensions, Aspect ratio, File size, Created, Created by "Liam Basil".
    - **Comments (n) ▾**. The empty state shows a 💬 icon, "No comments yet" and **"💬 Add comment"**.
  - **Comment mode**: the tooltip reads **"Click anywhere on the image to comment"** with "Esc to exit".
    - Clicking drops an **orange pin**. A composer appears: "Add a comment…", 📎 attach, **Cancel**, **Comment** (orange).
    - The posted comment shows an avatar "L", **Liam Basil · just now**, "Approved for PDP header", ✎ and 🗑 actions, and an orange **Reply** link.
    - These are spatial, pin-anchored comments on assets.

### 7.4 Error state
- No error or failed-generation screen was captured. The only failure-adjacent states are the disabled Paste menu item and the disabled "Create skill" button.

---

## 8. Guided tour ("First generation, on us"): full script

- The tour is a **4-stage** coached flow. A bottom-left **progress ring** shows "1/4" to "4/4" (red-orange arc) next to a **stage pill**: **Generate → Variations → Edit → Iterate**, then **Done**. The pill has ‹ › step chevrons and an **⊗ exit** circle.
- Coaching comes from **Mel speech bubbles**: a bow-tie avatar tile plus a dark pill placed right next to the relevant node.
- The dock is dimmed during the tour except for the control being taught.

| # | Stage | Screen | Mel / UI copy (verbatim) |
|---|---|---|---|
| 0 | Intro card | `[3dbd534f]` | Particle bow-tie logo · serif headline **"First generation, on us"** · "Mel will show you how the canvas works, starting with your first creation" · white **→** button |
| 1 | 1/4 Generate | `[45877034]` | **"Click "+" to add a node, then pick Text"**. The dock "+" glows orange |
| 1 | 1/4 | `[b800c63b]` | Picker open, **Text** highlighted |
| 1 | 1/4 | `[7e58182d]` | Text node "Waterfall Prompt · GPT-5.6", skeleton bars · **"Writing your prompt…"** |
| 1 | 1/4 | `[0ab8a67d]` | Prompt written · bubble explains text nodes can be used as context |
| 1 | 1/4 | `[832da4c6]` | Teal port glowing · **"Drag out from the glowing port to build on this prompt."** |
| 1 | 1/4 | `[e9cfbbbf]` | Picker from wire, Image highlighted · **"Choose Image to turn the prompt into a picture"** |
| 1 | 1/4 | `[b1f7a47e]` | Image node wired · **"Your prompt's wired straight in. Hit ↑ — this one's on me."** |
| 2 | 2/4 Variations | `[0eaadd6b] [e9558f31]` | Stepper set to 5 · **"Nice, now hit ↑ to render all 5."** |
| 2 | 2/4 | `[c48a2ca1]` | "Same prompt can give different results" (with a keyboard shortcut hint) |
| 2 | 2/4 | `[5ee48980]` | Dot-matrix · **"Rendering all 5 variations…"** |
| 2 | 2/4 | `[8b73b66e]` | "Variations landed here, hover the tray to open" |
| 2 | 2/4 | `[bdf77d69]` | Tray open · **"Pick the one that best matches what you asked for"** |
| 3 | 3/4 Edit | `[f8a864af]` | **"Drag out from the glowing port on the right to work off this image."** |
| 3 | 3/4 | `[4b9350ca] [7bce79cc]` | Picker · **"Choose image to edit it"** / **"Choose Upload from the menu"** |
| 3 | 3/4 | `[45024e5e]` | "Waterfall edit" node · **"This one's free too, hit ↑"** |
| 3 | 3/4 | `[5688cd81]` | "Generating…" · **"Editing your image..."** |
| 4 | 4/4 Iterate | `[3338bb7c]` | Hint: use the plus to edit with an existing asset |
| 4 | 4/4 | `[de5d3ca6]` | "⬆ Upload an asset" picker · **"Pick one of your golden-hour shots"** |
| 4 | 4/4 | `[2a86272b] [ae6d2214]` | **"Drag Golden hour's output port into the edit's empty image input."** |
| 4 | 4/4 | `[69f909b2]` | **"Your asset's wired in — hit ↑ to bathe the shot in golden light"** |
| 4 | 4/4 | `[eb296d59]` | **"Applying the golden-hour look…"** |
| 4 | Done | `[fccf735e]` | Pill reads "Done" |
| 5 | Outro | `[d2d2d357]` | Serif **"Now you're ready"** · "You've run the whole flow: generate, explore variations, animate, and iterate. The canvas is yours now." · **Start creating** (white) · **Restart tour** (text link) |

There is also a **settings coach-mark tour** with dimmed backgrounds:
- **"Select an aspect ratio"**: "Set the aspect ratio before you generate — 16:9 for video and hero images, 1:1 for social, 9:16 for mobile and stories", with × and **Next** `[5fe687b3]`.
- **"Select a resolution"**: lower resolutions are cheaper and faster, higher ones are for production-ready output. Buttons **Back** and **Got it** `[e880b6a1]`.

---

## 9. Layout, chat panel, assets, sharing and copy-link flows

### 9.1 Workspace layout: canvas-only vs chat + canvas `[d58be421] [87c001df] [93f056f0] [6e9de6f8] [107bf4b1] [dfce6810]`
- **Canvas-only**: the left edge holds the orange **›** tab, and the agent is reachable only through the composer or Ask Mel.
- **Chat + canvas (split)**: a **left docked chat panel**, about 255 px or 31% of the width, separated by a hairline. The orange tab sits on the seam with **‹** to collapse it. Panel contents:
  - **Header**: a thread tab ("Skincare product pho…", "Image upload help", "New chat") plus **+ new chat** and **🕘 history**.
  - **User message card**: a file chip ("shot2.jpg"), a red skill command ("/generate-skincare-image") and the prompt.
  - **Agent run log**: a collapsible checklist with timers, e.g. "Waiting for input… 26.5s", "Ideating… 30.0s", "Daydreaming…", "Thinking…", then steps **Read canvas · Load guide · Updated plan · Create nodes · Read canvas · ✓ Start generation**.
  - **Approval block** (§7.1) and **"View 1 node"** buttons that jump the canvas to the created nodes.
  - **Composer**: "Ask a follow-up…" with ▷ Auto-run, ☰ Plan, +, and a ● mic/stop button.
- Refero's "Switching workspace layout" flow most likely captures this toggle. The unidentified dock "grid" icon may also change the layout (for example, a list or grid view of nodes), but no screen confirms that.

### 9.2 Assets panel `[34100035] [fc6554c3] [8aac0dd7]`
- A centered floating panel (about 310×275 px) titled **"Assets 📄"** with a ⊟ dock/expand button.
- **Search**: "Search assets (image, video, audio)", plus **"+ Project only"** and **"Filter & sort ▾"**.
- **Chips**: **All 24 · Generations 14 · Uploads 10 · Favorites 1**.
- A 3-column thumbnail grid. Thumbnails carry an orange **"On canvas"** badge, a ♥ favourite and a ▶ for video. Audio shows as a waveform tile.

### 9.3 Sharing canvas access (five-screen flow) `[9586ec77] [71f0159e] [f028f365] [e573c6f9]`
1. Click **Share**. A dim scrim (rgba(0,0,0,.65)) appears with a modal (about 300×205 px, #201D1C, 12–14 px radius).
2. The modal title is **Share "#12/ss/26"** with ×. It is the **project** name, so sharing works at project or canvas level.
3. Section **General Access**:
   - Row: 🔒 **Restricted**, "Only members with access can open this canvas", with a select **Restricted ▾**.
   - The dropdown offers **Restricted ✓** and **Can view**.
   - Switching changes the row to 🌐 **Anyone with the link**, "Anyone with the link can view this canvas", with a select **Can view ▾**.
4. An outlined **🔗 Copy link** button. Clicking it shows the top toast **"✓ Link copied to clipboard"** (the "Copying link to clipboard" flow).
5. Divider. Then 👥 **Team · 1 member**, with **👤+ Add people** on the right.
6. Footer: **Done** (orange, bottom-right).
- Permission vocabulary is minimal: Restricted / Can view (no "Can edit" option was visible in link access).

### 9.4 Creating a note (eight-screen flow, reconstructed)
1. Dock sticky ▾, then the **Note `S`** / **Comment `C`** popover `[bc0aca17]`.
2. Choose Note or press S, then click to place. A yellow sticky appears with "Add a note…" `[e702b0cf]`.
3. A floating note toolbar appears with the colour dot ▾ and the size **Medium ▾** `[e702b0cf]`.
4. The colour menu offers Yellow ✓ / Pink / Blue / Green / Purple `[10e306f8]`.
5. The size menu offers Small / Medium `[56787d30]`.
6. You type the content. The finished note is pink, titled "Next Steps & Iterations", with an author label `[11c1e83a]`.

### 9.5 Adding comments to the canvas (five-screen flow) `[622b3db8] [d5cbf935] [a33b89d9] [2ff1b78c] [0425f82e]`
- Asset viewer → "Add comment" or the 💬 toolbar button → hint "Click anywhere on the image to comment / Esc to exit" → click to place a pin → composer: "Add a comment…" → Comment → the thread appears in the right panel with Reply.

---

## 10. Visual language

| Token | Value |
|---|---|
| Canvas bg | #131313 (empty) / #141414 / #151515 (busy); review mode #0A0909 |
| Grid | Dot grid about 12–16 px pitch, dots #252525–#2E2E2E; faint ruled lines in some states |
| Surface 1 (nodes, panels) | #1B1B1B / #1D1D1D |
| Surface 2 (popovers, dock) | #222222 / #242424; modal #201D1C to #2F2624 (warm) |
| Border | 1 px #343333 (neutral); warm #352727 / #5A483F on menus |
| Text primary | #D4D4D4 / #E9EAEA / warm #F0E9E1 |
| Text secondary | #8C8C8C / #A5A3A3; muted #656362 |
| Primary accent | #EF4E25 (range #DA522E to #F24B23). Used for add, Share, Approve, Done, Comment, active node, progress, ports |
| Selected menu row | burnt #9C3F29 fill with an orange outline |
| Text port / agent | teal #48D5C1 (glow), #789897 (rest), agent outline #47777A |
| Video port | magenta #D958A8 |
| Audio port | violet #8B5EC7 |
| Success | green #63C76A (toggles, toast check) |
| Run button | white #F2F1EF circle with a black ↑ (or ■ while running) |
| Radii | Nodes 10–14 px (5–8 px on dense boards), popovers 8–10 px, modals 12–14 px, keycaps 4 px, ports and buttons circular |
| Type | Inter / Geist-like sans at 9–12 px UI, 10–12 px prompts at 1.35 line-height, 15–16 px modal titles. Editorial display serif (about 40 px) only for onboarding moments ("First generation, on us", "Now you're ready") |
| Shadows | Very soft; depth comes mostly from tonal steps and hairlines |
| Density | High. Chrome is about 6% of the viewport, and the canvas is everything else |
| Motion (inferred) | Glowing port pulse, dot-matrix shimmer, popovers fading in over 150–200 ms, a progress line filling |

---

## Key canvas UX patterns worth matching

1. **Typed, colour-coded ports with labelled slots** ("Inputs: Text, Image, Video, Audio" / "Outputs: Image, Last frame…"). The colour legend makes compatibility obvious without docs. For CaastorOS, map ports to *brand inputs* (BIO, brief, reference, copy, image).
2. **Drag from an output port onto empty canvas → node picker → auto-wired node.** This is the fastest add-and-connect gesture. Pair it with the **glowing-port affordance** on fresh nodes.
3. **One add menu, many doors**: dock "+", the `N` key, right-click, port-drag and the agent all open the same **Nodes / Utilities** picker with **single-letter shortcuts** (T/I/V/A/U).
4. **@mentions as a second wiring channel**: typing `@` in any prompt lists canvas nodes with thumbnails, and mentions render as coloured tokens or thumbnail chips. Wires and mentions stay in sync, with numbered wire badges matching `[cite: n]`.
5. **Per-node Run (white ↑ that turns into ■) plus a variation stepper**, an in-node **dot-matrix generating state**, a global **"Generating N nodes"** tray and a **"Your generation is ready"** toast. Run state stays on the node, not in a modal.
6. **Variations stay attached to the node** ("Prev · 5/5 · Next" plus a hover tray). The picked variant is what flows downstream.
7. **A contextual model bar above the selected node** (Model · Ratio · Res · Tools · ⬇ · share · ⛶) plus a **right inspector** (Generation settings, or asset metadata plus Tools). There are no global settings panels.
8. **Model picker with time and credit chips per model plus an "Auto" toggle.** This is transparent cost in **credits only**, which fits our "credits, never $" rule exactly.
9. **Credit-consent gate on agent runs**: "Start generation? This generation will spend 169 credits" with Approve / Always approve / Deny.
10. **Agent that builds on the canvas**: a chat panel run-log (Read canvas → Load guide → Updated plan → Create nodes → Start generation), a teal "Mel · Creating nodes" outline, and "View 1 node" jump links. Chat and graph are two views of one plan. **Brandolph should do exactly this**, building specialist nodes on our canvas.
11. **Selection-scoped "Ask Mel"** (`/`, with a "1 selected" chip). It is in the context menu and is the first row of the add menu.
12. **Skills as reusable slash commands**, with instructions (brand voice, palette, taglines) plus up to 20 reference images. This is a direct analogue to exposing BIO fragments as slash commands.
13. **Non-destructive tools**: Edit / Inpaint / Remove object / Remove BG / Upscale / Outpaint / Crop each spawn a new connected node. The Topaz Upscaler has a rich parameter popover.
14. **Asset review mode with a Versions rail plus pin comments plus full provenance** (Prompt, Model, Dimensions, Created by). This is a natural home for our steward approvals ("Approved for PDP header").
15. **Gamified first-run tour** with a 1/4 ring, a stage pill (Generate / Variations / Edit / Iterate), contextual coach bubbles next to the actual node, a free first generation and serif "moment" screens.
16. **Minimal floating chrome**: one capsule, one Share, one dock, plus an optional minimap and inspector. The canvas gets about 94% of the pixels.
17. **Clipboard semantics that preserve the graph**: Copy, Paste, Duplicate and Duplicate-and-place (⌥drag) all have "(no connections)" variants.

---

## Interaction model summary (spec)

**Objects**
- `Node {id, type ∈ Text|Image|Video|Audio|Upload, title, model, prompt (with @mentions), params (ratio, res, duration, count, audio), inputs[] (typed slots), outputs[] (typed), variants[], selectedVariant, state ∈ empty|writing|generating|ready|error}`
- `Note {color ∈ yellow|pink|blue|green|purple, size ∈ S|M|L, text, author}`. Notes have no ports.
- `Comment {anchor (asset + x,y), thread[]}`
- `Edge {from: outputPort, to: inputPort, type, index n}`

**Add**
- `+` (dock), `N`, right-click on canvas, or dragging an output port onto empty canvas all open the **picker**.
  - Nodes tab: Text T · Image I · Video V · Audio A · Upload U.
  - Utilities tab: utilities.
  - Post-tour, the first row is Ask Mel `/`.
- The picker places the node at the cursor or drop point and auto-wires it if it was opened from a port.
- Dock sticky ▾ gives Note `S` / Comment `C`.
- Assets panel gives existing media. Drag-drop or paste gives an Upload node.
- The agent can create and wire nodes itself after approval.

**Select**
- Click a node. It gets an orange outline, labelled ports, a resize grip, the contextual model bar above it and the right inspector.
- The `/` key or "Ask Mel" opens the selection-scoped prompt.
- ⌘F finds a node.
- Right-click opens: Ask Mel · Copy · Copy prompt · Duplicate › · Paste › · Rename (⌘E) · Download · Delete.
- Multi-select is implied ("N selected") but no marquee screen was captured.

**Connect**
- Drag from an output port; the wire previews dotted in the type colour.
- Drop on a compatible typed input slot, or on empty canvas to create and wire a node.
- Alternatively type `@` in a prompt to reference any node.
- Edges are left-to-right beziers with numbered badges at targets.
- Copy, paste and duplicate keep edges unless you use the "(no connections)" variants.

**Run**
- Set the count (− n +) and settings (model, with Auto; ratio; res; duration).
- Hit ↑ on the node, or ↑ when it is focused.
- Agent-initiated runs ask for credit approval first: Approve / Always approve / Deny.
- During a run: the node shows "Generating…" with a dot-matrix and a ■ stop, the global tray shows "Generating 1 node", and Mel bubbles narrate.
- When done: the toast "Your generation is ready" (Space) appears, plus a variants strip (Prev n/N Next) and a hover tray. Choosing a variant sets the node output.

**Inspect**
- The right inspector shows Name and Generation settings for configurable nodes, and metadata (Format, Size, Resolution, Created, Model, Aspect ratio, Tool used) plus Tools and Generation settings for assets.
- ⛶ opens **review mode**: Versions rail, a large preview, a Details / Tags / Comments panel, and click-to-pin comments with Reply.

**Navigate**
- Zoom readout in the dock, minimap toggle (map icon, close ×), and pan or zoom on the canvas.
- The left orange tab toggles the chat panel (layout).
- The capsule ▾ switches canvases and opens the project menu.

**Share**
- Share opens a modal with General Access (Restricted ↔ Anyone with the link · Can view), Copy link (with a toast), Team · N members, Add people and Done.

---

## Screen index (Refero URLs)

All are `https://refero.design/pages/<uuid>`.

- **Loading and empty state**: a094486e-e190-4570-9300-23f0a4207da5 · 1740230d-d6b6-4c98-9cb9-63ab5fc761b5 · 34b8419a-d6e7-403c-85e7-449152ed2042 · 360a73b9-eace-4dd6-93c8-41af30c4f0a4 · b2b5233e-c4ca-494c-ab2c-03e7a3df4aaf
- **Project menu, composer menus and skills**: 56ed6438-b213-4a54-bab7-1663e2fa8e91 · b3558787-5f5f-4071-a666-db1f35ce896e · 384f0567-84af-4950-801b-9c8bdb85c87f · 8ec22616-a75a-4305-b749-78f81824822a · 9c024671-7ec2-4707-9947-315c80d21124 · 4b4dc9bd-1a8d-4612-b2d1-9978f5c3ab6c
- **Tour**: 3dbd534f-14ea-46c3-80cf-606076fe0355 · 45877034-5ebb-4ec7-a8cf-ebe7f4ddadf4 · b800c63b-a459-45f0-ba1f-96c725ed9e29 · 7e58182d-5114-4ec7-9219-d406d84fa064 · 0ab8a67d-5163-4b51-9b8b-bd51f6d06a46 · 832da4c6-a487-4be6-beda-51aa1c368279 · e9cfbbbf-301a-499f-a8b6-83b67b7799cc · b1f7a47e-7e38-4fe1-bf91-b074741ab961 · 0eaadd6b-4247-424c-8756-9a30f7f9946f · e9558f31-ad51-4f73-8361-730afae61890 · c48a2ca1-33de-4b9d-a1fd-c7b168a382ad · 5ee48980-e380-4c96-9599-9e73661b3e10 · 8b73b66e-2d57-4df2-9284-c42284da391c · bdf77d69-4fb5-47b4-b329-c8c0e38a2fc1 · f8a864af-2477-4360-8258-6eaa343e37e4 · 4b9350ca-bdfd-4e4f-9cb7-d157c6a5d84e · 7bce79cc-30fb-4b63-be84-b101afc227f5 · 45024e5e-ff74-467e-b093-6c547b0508aa · 5688cd81-468d-4248-b5e3-31bede72bf64 · 3338bb7c-d3ce-49b6-8252-7a3a3a0c6121 · de5d3ca6-6472-48d7-9ff5-4de25e215f1c · 2a86272b-c6cd-40ac-8c51-e3d1dceb41fd · ae6d2214-15e2-474d-9c95-737e73dc1fe4 · 69f909b2-1992-4449-96ba-b8142bf675ac · eb296d59-9a3f-4cb1-93a1-94dd5962cbee · fccf735e-d661-4c89-a7d7-94a17a3b1fad · d2d2d357-b69d-4485-9aa0-e51c1644c80d · 5fe687b3-7b11-4720-865d-54f74dad4f1f · e880b6a1-ec45-42b4-8939-26454d6006cd
- **Nodes, menus and selection**: 4c7ea8f2-6c9a-4ba7-92d2-52c2a9afc0ac · cb77fde2-8fff-4020-8136-dd2bfbdd978b · f7602915-61d7-4d14-9a12-2ff0f3dd10ac · c546ace1-0ea0-4b32-85b7-71aecca74c3d · 5112da1b-cbad-421e-a846-1b1b7e1c04b1 · f331a42f-770f-4b75-8d60-b730345212c9 · adb93576-5875-4730-8f63-99e022cfbf6b · ac110c88-4c56-4a12-809b-872d22e974f7 · 0edde52f-70ec-4b73-bb0d-d5c410777c3f · 40430289-13b2-4414-ac9f-49886c9fe19f · 0d40fe15-a694-42c0-a434-8c90d78f1ef1 · 7cb24af9-55c3-494f-b2bb-575b950d818c · 84e24760-c919-4c53-a717-5c8a7d002724 · 9d5851df-a31e-42b6-ab40-625b03d01df3 · bf630e99-3f80-4fd1-b977-0c04eeacd755 · cf788406-bf64-4535-ac28-6156dd169384 · 36d7aa7a-50f6-4b89-88f9-8f0aed2efdf3 · a6609ecb-d726-4b20-995a-23938398b645 · 170dba1c-6fcd-4432-8fa4-a51050333a7b · a20640f3-a805-420c-91a7-9bced53a28a7 · 761571a3-5841-4dc6-9b5b-cb1bde5bd23e · 416253e3-2a35-4532-93b4-86ac4987751e · bf44da0f-2f01-4d4a-b2ad-a4d750b4c9d5 · bf100e20-187f-4bf2-b255-53fb808c8760 · 0444bab5-1083-4f6b-87a8-dda877c33eb8 · f4b4e24e-892a-4364-a63a-be86655a2a16 · 2b2e2f29-8449-4a5e-8c08-7520580a74c0
- **Generation states**: 277097eb-bbec-438a-a8d7-684af5d0d9ca · 5ed047f4-b069-466e-a733-fc5fe0bd94cd · da16861f-8865-4aa8-b03e-b63d942adc95 · d7d82f01-dbfd-4da2-9e3c-568781e23760 · 1eb207d2-8802-436f-b7ca-d3c209f2b6c0 · bcb8397b-0b77-4eca-86de-3ea6623c36de · b5907133-9150-44d1-8c5b-4e0de69e5dd9
- **Video and audio**: dbc5be27-ea9f-44f7-9724-28496edc187a · 2c586b0b-849e-4342-896d-4ef49478b7c6 · 6ef0aaf3-5fcf-4c13-8378-b481f82a8d92 · 18a7f57a-9ce2-4fb9-a7ef-01b0ab892710 · a1694646-d899-4cac-b055-cbf880c2cd88 · 1b2b7877-3363-4f9e-8e47-644747f8bc9e · 26bdcffb-b1f1-484f-91ed-97feb67b41f3 · 2d97374d-de34-4e99-8098-2f2a4a081c98 · 8bbd93a2-5c89-493d-bdd9-cd4bc8e4e218 · 22a766b7-1afc-40cf-8095-154a69a923a2 · 46324f19-9817-4eb0-a42a-1515b3a212f6 · 2d55bb28-344e-45f3-989a-fdcc8079215f · 995277eb-b023-429f-a541-a7e2a2ed19eb · d11e6689-6ce8-40e1-9db5-bd1ed61c6607 · c5d56f88-a0de-461c-bc6e-ffbcc6e9734b · 6bc90678-da72-413e-939c-0ad299b92a18 · c18045db-f772-4c64-b3b1-5116912349d1 · 2a101c04-2341-4c83-80de-54a68d48efc8 · d2485a06-e8f1-4360-b1d1-b46e162e011f · fb4668c6-c4af-44f2-9ef0-2e599c38a854 · 02975f9f-93dc-4099-948d-3335001beeb2 · 45cdc422-63a5-44e2-958e-c753f79a9846
- **Voice filters**: 20a7a790-d0b6-4fad-952b-0dc018681745 · 934cc42d-c431-4675-947f-c41829cf5201 · 852dcee2-2835-49d6-9dd8-088752f49e39 · 3bbb94c6-cedd-481e-86e6-12d5dc01af97 · 81531778-67dc-40d1-a5a7-9fd84b655d37 · 060a86c3-36ee-4311-bff7-b904073c50da · bc6d0314-300f-4017-9912-145b48f434c5 · 81ab756e-8946-4bcc-9580-c45f757fa5ac · df924ce4-17b5-4881-b57f-b0846215bf8f · 1cf0ac0d-ce3d-4314-89eb-6e8efec3be29 · 3564af64-94f0-41dd-b05f-35ad0319d67f · e30bd412-30e1-44ae-8cca-4b65b4247c55 · 6b2a79eb-9cf8-4776-afa2-b8f8df4ce840
- **Chat panel (layout)**: d58be421-561f-4ce5-a91a-929e45275828 · 87c001df-a12a-42f5-ad8f-b5a193ae9d7f · 7ddd95ce-ac6e-43bd-8334-10b5829027a9 · 93f056f0-aa6c-4d43-b122-d768daba881c · 6e9de6f8-9d2f-4746-9340-be3321f090cf · 107bf4b1-c834-4d3b-b5db-34a26b244e04 · dfce6810-7d96-4228-bc27-fb1c695192e7 · a8ecebb2-1d2f-4599-9af3-0357b2d0eb58
- **Campaign board, notes, minimap and assets**: 892247a4-0539-4f6b-9c52-5442a4067e80 · bc0aca17-e0ec-4c00-84a0-bd4af4cf0647 · 10e306f8-f104-4aa1-912a-8e036c81e4b6 · 56787d30-27d3-4dbb-bc1b-c1f1660fca59 · e702b0cf-2b79-4d1d-aecf-d72909327c87 · e7e4debf-65f8-4be9-98f0-d2aa81252232 · 11c1e83a-3e48-44c0-9747-cb18a68acbae · d89e21f6-dfbb-48ce-852e-69a152780e7d · d6bcf7ce-7370-497d-b987-556d7358002a · 34100035-bdf6-4f6b-8538-3990376e41da · fc6554c3-bb96-435f-bd17-fac3df1a3470 · 8aac0dd7-349b-4323-a904-a698d6c19cc6
- **Share and copy link**: 9586ec77-dbd8-4b99-98ec-f168c1dbc938 · 71f0159e-542c-4935-90fa-e8e20716eacb · f028f365-1c16-4410-8ae1-d13814c4801a · e573c6f9-e7f3-4bd6-ae3b-38581a76e5e9
- **Review mode and comments**: 622b3db8-7930-457b-a802-ff940e205429 · d5cbf935-1a78-4030-981d-6dc35e0aa4b9 · a33b89d9-56ce-48ca-9963-24738fff15c3 · 2ff1b78c-f2fb-41d9-945d-ae7b49a5c0df · 0425f82e-6dfb-4f65-8e9d-9fe9a415aaf3

### Gaps (not captured in Refero)
- marquee or multi-select visuals;
- a group or frame node;
- the "Utilities" tab contents;
- what the dock "grid" icon does;
- the pointer ▾ dropdown items (likely Select / Hand);
- the canvas switcher dropdown contents (other canvases, "New canvas");
- error and failed-generation states;
- drag-drop file onto canvas visuals.
