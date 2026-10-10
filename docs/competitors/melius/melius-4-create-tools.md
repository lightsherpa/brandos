# Melius teardown, part 4: Create tools and studios outside the canvas

Source: Refero MCP, site id 1166 (melius.com). Only records with `site.id == 1166` are used.
Method: semantic screen search ("Melius cast studio", "Melius model picker", "Melius playground", "Melius voice", "Melius avatar", etc.), paging through results while Melius hits continued, then `refero_get_screen` for full descriptions and `refero_get_screen_image` (full) to check **22 screens** by eye. Labels in quotes are verbatim from the screenshots. Where Refero's AI-written descriptions disagreed with the pixels (for example "Melvis avatars" or "UG review"), the screenshot wins.

**Coverage gaps (stated plainly):**
- **"Upscaling image" flow (6 screens): not found.** About 10 query variants failed ("Melius upscale", "Melius upscaling image playground", "Melius canvas upscale", "Melius Topaz upscaler", "Melius upscale factor 2x 4x", "Melius Utilities", and others). `refero_get_flow` does not work for Melius IDs. Indirect evidence says Upscale is a **canvas utility**, not a standalone Create page: the Academy lesson "Templates, tools, and utilities" lists "Upscale" under "Tools used", and the canvas add-node menu has a collapsed "Utilities" group (see §6). This needs a manual capture.
- **Lip-sync: no Melius screens found.** In Cast, lip-sync is implicit: you script an avatar and a voice and get a talking video.
- **"Filtering voice models" flow:** reconstructed from 4 canvas screens plus 2 Cast screens that share the same voice-picker component. The full 10-step sequence was not reachable.

---

## 0. Global shell and how you get into creation tools

### 0.1 Left navigation, expanded (Home and Academy)
Screens: https://refero.design/pages/af66ff31-f7b7-4f85-8c21-2828e6b9e0c0 (Home), https://refero.design/pages/c27ed43b-4dc1-479e-ad08-6251322eb170 (Academy)

Sidebar, top to bottom:
- Brand row: red "bow-tie" Melius mark, "Melius", collapse-sidebar icon at the far right.
- Workspace switcher: circle avatar "R" (white on black), "Team", chevron.
- Primary CTA: full-width white pill "+ New project".
- "Home" (active state is a filled dark-grey rounded row).
- Section label **"Create"** (small muted grey):
  - "Playground" (palette icon)
  - "Cast" with a small red-outlined **"New"** badge
- Section label **"Library"**: "Projects", "Assets", "Templates".
- Section label **"Learn"**: "Academy".
- Bottom corners: settings gear (left), help "?" (right).

**Takeaway:** "Create" has only **two** entries, Playground (the generic any-model generator) and Cast (the avatar/UGC video studio). There is no long tool catalog. Tools such as upscale, background removal, inpaint, outpaint, crop, magic resize and stitch live inside the canvas as utilities (§6).

### 0.2 Collapsed rail (inside a tool)
On `/create/*` routes the sidebar collapses to a ~44 px rail:
- Red mark, then "R" workspace circle.
- **White rounded-square "+"** (new project).
- Icons: home, palette (Create; active, with a dark rounded highlight), book (Library), mortarboard (Academy).
- Gear and help at the bottom.

### 0.3 Home as the Create launcher (`/home`)
Screen: https://refero.design/pages/af66ff31-f7b7-4f85-8c21-2828e6b9e0c0 (also https://refero.design/pages/1046005d-481a-41f4-a67b-6543b2259e9c)

From the top:
1. Hero on a dotted-grid band: serif display headline "What will you create today?". Subline: "Describe it, and Mel builds it across every model in one place."
2. Prompt composer. Placeholder "Describe what you want to generate...". Attach (paperclip) and send (arrow-up square) buttons at the bottom right.
   - Suggestion chips, each with a tiny thumbnail: "Neon rose still life", "Pearl strand close-up", "Sunlit portrait study", "Studio glassware".
3. Dismissible promo card:
   - "New" red badge, serif "Introducing Cast".
   - Body: "Choose an avatar, write the script, and customize every part of the video".
   - White button "Go to Cast". Photo strip of avatars. "X" close.
4. "Recently viewed": project tile "Welcome to Melius", "Liam Basil · Updated today". "View all projects →" at the right.
5. "Discover" bento grid:
   - Large Cast card: "Cast" / "Any script, a world of possibilities" / "Choose an avatar, background, and more to bring your ideas to life" / "Go to Cast".
   - Three stacked model cards on the right:
     - "Seedance 2.5 / Frontier video generation up to 30 seconds" with "Try it →".
     - "GPT Image 2.5 / State of the art image generation from OpenAI" with "Try it →".
     - "Melius MCP / Connect ChatGPT, Claude, and more to your canvas" with "Connect →".
6. "Playground" band: image mosaic, "Playground" / "Every model in one interface" / "Generate images, video, and audio in one place" / white "Open Playground".

**Pattern:** individual **models are marketed like products** ("Try it" cards deep-link into the Playground with that model preselected; route pattern `/create/playground/<model-slug>`).

---

## 1. Playground: the multi-model generator (`/create/playground/<model-slug>`)

Routes seen: `/create/playground/gpt-image-2-high`, `/create/playground/seedream-5-pro`. The model slug is in the URL, which makes each model deep-linkable.

Screens:
- Model picker open (2 models checked): https://refero.design/pages/a219e2dd-f218-4d60-9403-641f5bdbbc88
- Model picker with provider submenu: https://refero.design/pages/99310ce3-2529-4350-903a-9591275078e0
- Generating (2-model compare, ×4): https://refero.design/pages/d9264ca9-0af1-418e-9cf2-fa3d4ba36954
- Results (2-model compare, carousels): https://refero.design/pages/598b2631-7e26-4b60-a292-0183a45ee3c4
- Related states: https://refero.design/pages/bd4c8628-37b9-45ad-98c1-cfb3e400122a, https://refero.design/pages/51b00506-c820-4605-b7f5-ad764cd78de9

### 1.1 Layout
Collapsed rail, then a ~250 px left settings panel, then a large dotted-grid canvas for outputs.
- Header: plain title "Playground", top left. No breadcrumb.
- A vertical drag handle sits between the panel and the canvas, so the panel is resizable.

### 1.2 Left panel, top to bottom (verbatim)
1. **Modality tiles**, a 2×2 grid of outlined tiles with icons: "Image" (selected: brighter border and fill), "Video", "Audio", "Text". **All four modalities share one generator.**
2. **MODE** (small uppercase, letter-spaced label): select row "Text to image ›".
3. **MODEL**: one select row per chosen model, each with a provider logo:
   - "GPT Image 2 (High)" (OpenAI logo)
   - "Nano Banana Pro" (Google "G")
   - With only one model chosen, the second row becomes a ghost row **"Compare to ›"**.
4. **ASPECT RATIO**: "1:1 ›" / "16:9 ›".
5. **RESOLUTION**: "2K ›".
6. **INPUTS**: dashed-feel card holding an upload icon button, "Upload or drag image", and an outlined "Browse assets" button (pulls from the Library).
7. **PROMPT**: multiline field.
   - Empty-state ghost prompt: "A minimalist concrete beach house at golden hour, cantilevered over sand dunes, floor-to-ceiling glass glowing from inside, architectural photography".
   - Inline hint chip: **"tab to fill prompt"** (press Tab to accept the suggested prompt).
8. Sticky footer:
   - **Count stepper** "− 1 +" (shows 4 in the generating state).
   - Wide **Generate** button with an inline **credit pill** (number plus coin icon):
     - Idle or not ready: muted grey, e.g. "Generate 476", "Generate 169".
     - Ready: bright orange-red (#E8552B-ish), "Generate 1904".
   - **The credit total updates live with model count, resolution, and output count.** 476 → 1904 when the count goes 1 → 4, so it scales linearly.

### 1.3 Model picker popover (the key component)
Opens from a MODEL row. It is a ~190 px dark popover with:
- "Search" field (magnifier icon).
- Section header **"Featured models"**, then rows. Each row has:
  - A checkbox (multi-select; checked is a filled orange square with a white tick)
  - A bold model name
  - **Speed badge**: grey pill with the typical latency, e.g. "2m", "30s", "4s", "40s"
  - **Credit badge**: grey pill with the cost or cost range plus a coin glyph, e.g. "67", "188–376", "39–49", "85–169"
  - A one-line description underneath

Featured rows seen (name | speed | credits | description):

| Model | Speed | Credits | Description |
|---|---|---|---|
| GPT Image 2.5 Sunburst | 2m | 67 | "Fine detail and precise image editing" |
| GPT Image 2.5 Flare | 2m | 67 | "High-quality images with faster generation" |
| Nano Banana 2 Lite | 4s | 39–49 | "Ultra-fast image generation" |
| Nano Banana Pro | 30s | 188–376 | "Detailed images with clear text" (selected) |
| Seedream 5.0 Pro | 40s | 85–169 | "ByteDance's flagship image editing model" |

- Below the featured section are **provider groups** with a logo and a chevron: "OpenAI ›", "Microsoft ›" (more presumably below).
- Hovering a provider opens a **flyout submenu** of variants, each with speed and credit badges:
  - "GPT Image 2.5 Sunburst 2m 67"
  - "GPT Image 2.5 Flare 2m 67"
  - "GPT Image 2 (High) 2m 275–513"
  - "GPT Image 2 (Medium) 50s 75–138"
  - "GPT Image 2 (Low) 30s 25–50"
  - **Quality tiers are exposed as separate model variants with their own cost and speed.**
- Footer: "× Clear selection".

**How selection works:** ticking a second checkbox turns the run into a **side-by-side model comparison**. Each checked model becomes its own output column on the canvas.

### 1.4 Generation progress
- One output column per model. Each column has a small label at its top left ("GPT Image 2 (High)", "Nano Banana Pro") and a thin vertical divider between columns.
- Placeholder is an **animated pixel/dot-matrix field** in the output's shape (16:9 here). There is no spinner and no percentage.
- A floating pill at the bottom left of the canvas: red dot plus "Generating...".
- The Generate button stays orange with the credit pill, and the stepper still shows 4.

### 1.5 Results
- Each model column shows **one large result card with a carousel** for the N variants: a right-arrow "›" button on the image edge and dot pagination underneath (4 dots for count 4).
- The two models' results sit side by side at equal size, which makes comparison direct.
- In the screens captured, no per-variant action toolbar is visible (download, upscale, send-to-canvas, favourite). Actions likely appear on hover or through a viewer; this is unverified.

### 1.6 Visual language (Playground)
- Near-black canvas (#141414–#181818) with a fine dotted grid.
- Panel surface about #1B1B1B, borders about #292929.
- Uppercase 8–9 px tracked section labels; 11–13 px UI text.
- One saturated accent: orange-red for the primary CTA and the checked state.
- Compact select rows with right-aligned "›" chevrons.

---

## 2. Cast Studio: avatar video from a script (`/create/cast/studio`)

Header: breadcrumb "Cast › Studio" ("Cast" muted, "Studio" bright). Top-right buttons:
- "+ New cast" (outlined)
- Once something exists, also a filled-grey **"History"** button with a clock icon.

### 2.1 Flow A: empty state, pick an avatar ("Searching for avatars")

**Step A1. Landing with the avatar grid**
Screen: https://refero.design/pages/5be231ad-3e96-4539-9f08-46849b82eead

Left panel "Script" (~220 px):
- Helper text "Type, paste, or upload your script for your video".
- Large textarea, placeholder "Type or paste your script".
- Outlined full-width "⤒ Upload a script".
- Divider label "or start from a script template".
- **3×3 template grid.** Each card has an icon, a name, and a **duration estimate**:
  - "Advertisement 21s", "Podcast clip 25s", "UGC review 25s"
  - "Tutorial 22s", "Unboxing 22s", "Announcement 26s"
  - "Explainer 26s", "Founder story 27s", "Vlog 26s"
- Footer: muted, disabled **"Generate"** plus a settings-gear icon inside the button at the right.

Centre: floating card on the dotted canvas.
- Title "Cast an avatar to start", sub "Pick an avatar to cast, or create your own".
- Row: "Search avatars" field, then a segmented control "All" (selected, lighter fill) / "Custom avatars" / "Melius avatars".
- 4-column grid of avatar cards. Each card has a portrait thumbnail with a neutral studio background and a name beneath.
  - Names include "Loopy", "Big Dawg", "Zach", "Brian", "Tiffany", "Michael", "Nikki", "Stacy".
  - Row 3 mixes in **stylised 3D characters** (a cartoon face, a banana, a tomato).
- Floating action bar over the bottom of the grid:
  - **white "+ Create avatar"** (primary)
  - outlined "Hide avatars" (eye-slash icon)
  - ghost "Generate for me" (wand icon)
- A vertical 4-dot pager on the canvas to the right.

**Step A1-alt. Carousel variant (collapsed library)**
Screen: https://refero.design/pages/80f4d014-ab24-484b-8fcf-7d5537ddfff3
- Same card, but avatars appear as a **horizontal carousel** of larger cards with name and a demographic line ("Big Dawg / Middle aged man from California.", "Zach / Young man from San Francisco.").
- Edge cards are clipped to signal more content.
- The action row reads "+ Create avatar" / **"Browse avatars"** / "Generate for me". "Browse" expands to the grid; "Hide avatars" collapses back.

**Step A2. Search with results**
Screen: https://refero.design/pages/116fff9f-c02b-4eee-aa5f-1523b4357b4a (also https://refero.design/pages/ca447b53-1f38-4d3c-986c-f1720c4c420c)
- Query "ama" returns one card, "Amara".
- **Selected state: a warm red/terracotta outline on the card**, the only colour on the screen.
- The panel shrinks to fit the results.

**Step A3. Search with no results (empty state)**
Screen: https://refero.design/pages/4ac56e3d-567d-4382-9db5-f27418e2318d
- Query "sama" shows small grey text "No avatars match your search".
- The action row stays visible, so "Create avatar" and "Generate for me" act as the recovery paths.

### 2.2 Flow B: configure "Your cast" (after an avatar is chosen)
Screens:
- https://refero.design/pages/7a89f730-a54d-4f71-8529-0855f68c0d3f
- https://refero.design/pages/908dad66-9033-43df-862f-b9bee04115f5
- https://refero.design/pages/e2dfa4e3-f64f-4f59-a1bd-8673c54d5e74

Central card, two columns:
- **Left:** large portrait preview of the avatar (Amara, sage tank top, grey seamless). A small expand icon sits at the top right.
- **Right: "Your cast"** list with "Clear all" at the top right. There are six rows. Each row has an icon or thumbnail, a muted label, a bright value, and a "›" chevron:
  1. **Avatar**: "Amara" (portrait thumbnail)
  2. **Voice**: "Rachel" / "Adalina" (music-note icon)
  3. **Background**: "Auto" (image icon)
  4. **Prop**: "None" / "Commercial Skincare Hero Photo" (product thumbnail)
  5. **Tone**: "Not set" / "Calm" (smiley icon)
  6. **Aspect ratio**: "TikTok / Reels · 9:16" / "LinkedIn · 1:1" (frame icon)

Smart defaults: Background "Auto", Prop "None", Tone "Not set". A cast is generatable with only an avatar and a script.

**Each row opens an anchored popover to the left of the list, overlapping the preview:**

**B1. Voice picker** (same component as the canvas voice node; §3)
Screens: https://refero.design/pages/b8ceaa6c-8195-4464-8361-621df303efa6, https://refero.design/pages/f5cfd89a-4978-440e-9c2f-3ec69532dd44
- Segmented tabs "Standard" / "Custom".
- "Search voices" field, plus a "Filters" button. The button shows a **count badge** ("Filters 1") when filters are active.
- Active filter chips, e.g. "Female ×", with "Clear all" on the right.
- List sections:
  - **"Selected"**: the current voice pinned at the top with a highlight, e.g. "Adalina - Professional & Friendly".
  - **"Favorites"**: "Francesca´s Secret".
  - Then the full list: "Cruella - poison personified", "(Hinglish) Krishna Gupta", "Aakancha- warm,perceptive, deeply human", "Aakif - Professional Pakistani Accent", "Aaron", "Aaron - Conversational American Male", "Aaron - Educational"…
- Each row is a name plus a descriptor, with a **speaker icon at the right for preview playback**.
- Footer: **"Auto" toggle**, which lets the system pick the voice.

**B2. Tone picker**
Screen: https://refero.design/pages/4358d28c-39c6-44d5-8911-7c08c4968409
- Search field "Search or describe a tone": free text is allowed, not only presets.
- Chip cloud: "Hype", "Casual", "Educational", "Deadpan", "Warm", "Urgent", "Playful", "Sincere", "Confident", "Cheeky", "Calm" (selected, lighter fill), "Dramatic".
- Single-select. The row updates to "Tone / Calm".

**B3. Aspect-ratio picker**
Screen: https://refero.design/pages/87c1f3a8-5265-4278-858e-c7ded198023e
- Each option has a shape icon, a ratio, and a **use-case caption**:
  - "9:16 / Commonly used on TikTok, Reels, Shorts" (✓ selected)
  - "1:1 / Commonly used on LinkedIn, Instagram feed"
  - **"4:5" disabled** with the inline reason: *"Seedance 2.5 renders in 9:16 or 1:1 or 16:9 — pick another model to use this shape"*
  - "16:9 / Commonly used on YouTube, X"
- **Model constraints show up as explained disabled options, not hidden ones.** This also reveals that Cast runs on Seedance 2.5 underneath.

**B4. Background picker**
Screen: https://refero.design/pages/57c6666d-64e6-4148-853f-ed4ec3067741
- Header buttons: "⤒ Upload" (outlined), "+ Create" (white primary).
- "Search backgrounds" field.
- Grid of tiles. The first is "Auto", a wand icon in a terracotta-outlined (selected) tile. More tiles would follow.

**Prop picker:** not captured. The value "Commercial Skincare Hero Photo" with a product thumbnail suggests props come from Assets or canvas outputs.

### 2.3 Flow C: script authoring, then generate, then result

**C1. Typing a script**
Screen: https://refero.design/pages/a7ddb407-8ad9-4226-8ee8-6f01a8a049af
- The textarea gets a **terracotta focus border**. Example content: "Tired of dry, stressed skin? Reset your moisture barrier with our deeply hydrating serum. Just pure, clean ingredients for a natural, healthy glow. Tap to transform your skin today."
- The template grid **collapses into horizontal chips** under the field ("Advertisement 21s", "Podcast clip 25s"…).
- An orange **"Use this script"** button appears. Generate stays disabled until the script is committed.

**C2. Structured script (after "Use this script")**
Screen: https://refero.design/pages/7051cbeb-0c95-4603-a9f0-cecdc116820f
- Panel subtitle changes to **"What your avatar says, and what they do"**, with a meta line "1 section · 11s". "Clear all" sits at the top right.
- **Section card:** drag handle "⋮⋮", number badge "1", title **"Hook"**, duration "11s" on the right, the script text, and "+ Add action" (stage directions).
- Below the cards: two buttons, **"+ Section"** and **"+ Action"**.
- Generate becomes **orange, "Generate 1897"** (credit pill with coin), with the gear icon kept for advanced settings.

**C3. Generating**
Screen: https://refero.design/pages/ea7c0530-6b2d-4345-a4fb-e5b885c38424
- The canvas switches to a 3-column studio:
  - script on the left
  - output frame in the centre
  - "Your cast" on the right, now a tall panel with a large avatar hero image captioned "Amara" over the list
- The output frame has a **terracotta border** and the same **animated dot-matrix fill** as Playground.
- Header label: **"Casting Amara… Est. 5–12 min"**. This is a time estimate, not a progress bar.

**C4. Result**
Screen: https://refero.design/pages/567e3a32-6405-4790-b4f8-8ada11f44af2
- The frame becomes a video player:
  - The avatar holds the prop (serum bottle) and speaks.
  - Overlay controls: play "▶", speed "1x", volume, time "0:00 / 0:11".
  - **Download** and **fullscreen** icons at the top right.
- "History" (top right) keeps past casts. "Generate 1897" stays available for re-runs.

**Onboarding:** the first-run coach mark is anchored to the script box: "Write your script" plus explanation, with a terracotta "Got it" button. https://refero.design/pages/52948af9-ed1a-4217-aa0e-1e7d43f01d0c

---

## 3. Voice models: the "Filtering voice models" flow (canvas voice node)

Route: `/projects/<id>/canvas/<id>`. This is the voice picker on an audio node and the same component as the Cast voice popover.

Screens (in order):
1. Unfiltered list, "No favorites yet": https://refero.design/pages/934cc42d-c431-4675-947f-c41829cf5201
2. Filters panel open, Accent dropdown open: https://refero.design/pages/1cf0ac0d-ce3d-4314-89eb-6e8efec3be29
3. 5 filters applied, row hover reveals favourite: https://refero.design/pages/df924ce4-17b5-4881-b57f-b0846215bf8f
4. Voice favourited and moved to Favorites: https://refero.design/pages/81ab756e-8946-4bcc-9580-c45f757fa5ac
5. Related: https://refero.design/pages/e30bd412-30e1-44ae-8cca-4b65b4247c55

### 3.1 Context chrome
- Floating node toolbar above the audio node: "Model: ElevenLabs v4 ⌄" | "Rachel ⌄" (current voice chip) | sliders icon (settings) | expand icon.
- Right inspector: "Name" (with a copy icon), a collapsible "Generation settings" section, "Model" dropdown "ElevenLabs v4".
- Top-left project capsule: "#12/ss26 / Canvas 1 ⌄", then a **credit balance chip "19k"** with a coin icon. This is the only place a balance is shown.
- Top right: orange "Share" plus a link icon.

### 3.2 Steps
1. **Open the voice chip, unfiltered.**
   - Tabs "Standard" / "Custom".
   - "Search voices" field and "Filters" button.
   - "Favorites" section with the empty state "No favorites yet".
   - Alphabetical list, a speaker icon on every row.
2. **Click Filters.** A side panel opens to the left of the list with labelled dropdowns:
   - "Quality": Studio
   - "Use case": Social media
   - "Gender": Female
   - "Age": Middle aged
   - "Language": English
   - "Accent": Any
   Each dropdown is its own searchable menu. The Accent menu shows "Search..." with options "Any" (highlighted), "American", "British", "Australian", "Irish", and more.
3. **Pick a value.** The Filters badge counts up ("Filters 4", then "Filters 5"). Applied values show as **removable chips** under the search ("Studio ×", "Social media ×", "American ×", "Female ×", "Middle aged ×"), with "Clear all" on the right. The list narrows ("Angela", "Francesca´s Secret", "Glinda - Confident, Sly, Sultry", "Maya June - Bedtime Comfort", "Nayva for Social Media, e-Learning, Non…", "Rachel - Social Media Narrator").
4. **Hover a row.** The row highlights and shows a **heart (favourite) and a speaker (preview)** on the right. The speaker button gets a filled background on hover or play.
5. **Favourite it.** The heart turns **solid orange**, and the voice moves into the "Favorites" section at the top. The empty state disappears.
6. **Click the row** to select. The node chip updates to that voice name; in Cast, the row moves into the "Selected" section.

Footer (Cast variant): **"Auto"** toggle.

---

## 4. Avatar creation ("Create avatar" / "Generate for me")
- Entry points: the white "+ Create avatar" pill and the "Generate for me" wand button in the avatar card (§2.1).
- The resulting create screens were **not found in Refero**.
- Filtering into "Custom avatars" vs "Melius avatars" shows that user-made avatars live alongside stock ones.

---

## 5. How credits and cost are surfaced (the pattern across all create tools)

| Surface | What's shown | Where |
|---|---|---|
| Model picker rows | Per-model **credit range** badge (e.g. "188–376", coin glyph) plus a **speed** badge ("30s", "2m") | Playground model popover and provider submenus |
| Generate button | **Live total** inside the CTA ("Generate 476", "Generate 1904"; Cast "Generate 1897") | Sticky footer of every tool |
| Count stepper | "− N +" next to Generate; the total scales with N | Playground |
| Balance | "19k" coin chip | Canvas project capsule (top left) |
| Time | "Est. 5–12 min" on long jobs | Cast generating header |

All amounts are **credits** with a coin icon, never money. The range format ("85–169") reflects resolution or quality-dependent pricing. Variants of one model family (GPT Image 2 High/Medium/Low) are listed with their own price, so users trade quality against cost explicitly.

---

## 6. Utilities (where upscaling lives): indirect evidence
- **Canvas "+" menu** (https://refero.design/pages/4c7ea8f2-6c9a-4ba7-92d2-52c2a9afc0ac): "Ask Mel /", "Text T", "Image I", "Video V", "Audio A" (each with a keyboard shortcut badge), then a collapsed **"Utilities ⌄"** group.
- **Academy lesson** "Templates, tools, and utilities", 7:50 (https://refero.design/pages/c27ed43b-4dc1-479e-ad08-6251322eb170):
  - "Tools used" chips: "Templates", "Magic resize", "Upscale".
  - Copy mentions Custom Text, Studio Mode, stitching video clips, Magic Resize (new aspect ratios), inpainting, background removal, upscaling, outpainting, cropping.
- **Conclusion:** upscaling is a **canvas node or utility applied to an existing image**, not a page under Create. The 6-step "Upscaling image" flow could not be retrieved from Refero.

---

## 7. Visual language summary (create tools)
- **Palette:**
  - Canvas #141414–#171717 with a **dotted grid**; panels #1B1B1B–#242424; borders #292929–#373432.
  - Text #F4F4F4 (primary), #9A9795 / #ACACAC (secondary).
  - **One accent: orange-red/terracotta** (#E8552B / #C65432 / #B95636), used only for the primary CTA, the selected state, focus borders, the favourite heart and the brand mark.
- **Type:** compact grotesk (Inter/Geist-like) at 9–13 px UI sizes. Section labels are uppercase and tracked. Serif display type only on marketing surfaces (Home hero, Academy titles).
- **Components:**
  - Select rows with a right "›"
  - Popovers anchored next to the triggering row
  - Segmented controls (Standard/Custom; All/Custom/Melius)
  - Chip clouds for tone, removable filter chips, pill badges for speed and credits
  - White pill for primary actions inside dark panels; orange for spend actions
- **Loading:** an animated **dot-matrix/pixel field** shaped like the output frame, plus a small "Generating..." pill or an "Est." time label. No percentage bars.
- **Empty states:** one-line grey text ("No avatars match your search", "No favorites yet") with recovery actions left visible.

---

## Key generation-tool UX patterns worth matching (for CaastorOS)

1. **Cost on the button, live.** Put the credit total inside the Generate CTA and recompute on every parameter change (models × count × resolution). Grey while incomplete, accent once ready. This fits our "only show credits" rule.
2. **Per-option price and speed badges in pickers.** Every model or specialist option shows a credit range and a typical time ("30s · 188–376"). Users self-select cheap or fast vs premium without seeing API costs. This maps to our hybrid routing tiers (fluxSchnell vs premium).
3. **Quality tiers as visible variants.** "GPT Image 2 (High / Medium / Low)" each carry their own price. For CaastorOS, "Re-run premium / Re-run cheap" could be shown as variants with credit deltas.
4. **Multi-model compare by checkbox.** Ticking a second model splits the output into labelled side-by-side columns. Useful for showing two specialist outputs or two routes on the BIO-grounded canvas.
5. **Explained disabled options.** Show incompatible choices, but disabled with a one-line reason ("Seedance renders in 9:16 / 1:1 / 16:9 — pick another model"). Better than hiding them.
6. **"Your cast"-style recipe card.** One compact list of every creative parameter (avatar, voice, background, prop, tone, aspect ratio) with smart defaults ("Auto", "None", "Not set"). Each row opens an anchored popover, and "Clear all" resets. A good model for a brief or specialist config card above our canvas.
7. **Templates with duration estimates that collapse into chips once the user starts typing.** They keep the help available without crowding the editor.
8. **Script becomes structure.** Raw text turns into numbered, draggable sections ("Hook 11s") with "+ Action" stage directions and a "1 section · 11s" summary. A strong pattern for turning a sharpened brief into editable blocks.
9. **Rich voice and asset pickers:** Standard/Custom tabs, search, a Filters panel of labelled dropdowns, an active-filter count badge, removable chips, "Selected" and "Favorites" pinned sections, hover-revealed preview and heart, and an "Auto" toggle.
10. **Honest progress.** A shaped dot-matrix placeholder plus an "Est. 5–12 min" label for long jobs, and a lightweight "Generating..." pill for short ones. Pairs well with our queue-and-poll image specialists.
11. **Deep-linkable tools.** `/create/playground/<model-slug>`, with marketing cards ("Try it →") that land on a preselected configuration.
12. **Two front doors, not a tool zoo.** Create has only a generic Playground and one opinionated studio (Cast); utilities (upscale, remove background, inpaint, magic resize) live in the canvas, which keeps the canvas central. This matches our "canvas is the moat" stance.
13. **"Generate for me" / Auto everywhere.** Every manual choice (avatar, voice, background) has an AI-pick escape hatch. That fits Brandolph proposing crew and choices by default.
