# Melius teardown, part 5: Library, Projects, Settings, Billing, Team, Growth loops

Source: Refero (site id 1166, melius.com, "The AI-native operating system for creatives"). Every screen cited below is site 1166; results from other sites were discarded. The Refero flow IDs exist (14085–14100), but `refero_get_flow` returns `INVALID_FLOW_ID`, so each flow below was rebuilt from individual screens. Their order is inferred from UI state such as toasts, counts and badges. Where an order or step is a guess, the text says so.

I inspected 23 full-size screenshots by eye. Those are marked **[seen]**. The other screens are described from Refero's own screen descriptions, and quoted copy is verbatim from the screenshot or the Refero text.

Refero flow index (Melius):

| Flow | ID | Screens |
|---|---|---|
| Filtering assets by project | 14091 | 5 |
| Moving assets to folder | 14090 | 5 |
| Creating folder | 14089 | 4 |
| Adding tags to assets | 14088 | 6 |
| Deleting files | 14087 | 4 |
| Deleting project | 14085 | 5 |
| Uploading team photo | 14062 | 3 |
| Inviting member to team | 14096 | 5 |
| Subscribing to Creator Pro | 14063 | 4 |
| Canceling subscription | 14099 | 6 |
| Inviting friends through referral program | 14098 | 3 |
| Submitting product feedback | 14100 | 4 |
| Searching template catalog | 14094 | 3 |
| Submitting template request | 14095 | 4 |
| Copying link to clipboard | 14071 | 3 |
| Sharing canvas access | 14081 | 5 |

---

## 0. Global shell and visual language (applies to every screen below)

**App shell (collapsed rail, used on /assets, /projects, /library/templates)** [seen]
- A rail about 42–48px wide down the left edge, separated from the content by a 1px `#292929` line.
- From top to bottom: a coral bow-tie / hourglass brand mark; a circular white team avatar (the uploaded team photo, here a black "R"); a white rounded-square "+" button (create); then nav icons for Home, Playground, Library (active, on a brown-gray rounded tile) and Academy.
- At the bottom: a settings gear and a help "?".

**App shell (expanded sidebar, about 135px, seen on /academy and behind the settings modal)** [seen]
- "Melius" wordmark, with a collapse-sidebar icon at the right.
- Team switcher row: R avatar, "Team", chevron.
- A white full-width "+ New project" button.
- Groups:
  - "Home"
  - "Create": Playground; Cast, with a coral "New" pill
  - "Library": Projects, Assets, Templates
  - "Learn": Academy
- Bottom: gear and "?"; a "Documentation" row and a "Share feedback" pill (0c97ca03).

**Palette**
- Backgrounds: #0F0F0F–#161616.
- Panels and controls: #1B1B1B–#242424.
- Borders: #292929–#363637.
- Primary text: #E5E2DF–#F2F2F2. Muted text: #8C8C8C–#A5A5A5.
- Warm taupe accents: #6D5A50 and #C3B0AA.
- One accent colour: coral / orange-red, #EF4C23–#F14C23. It is used for Upload, New project, Invite, Create, Share and the Professional plan. Destructive actions use a deeper red, #B62525.
- Success: a green dot. Toggles turn green when on.

**Type**
- Interface: Inter / Geist-style sans at 9–12px. Dense, desktop-first.
- Editorial accents in Instrument Serif: plan names "Creator / Growth / Professional", the word "imagination" in "Plan your imagination", template section headers, Academy article titles.
- Onboarding uses a glowing dot-matrix pixel font for display headlines.

**Modals**
- Centered, radius 10–14px, 1px border, black scrim at about 0.65–0.72.
- Title at top-left, ~14–16px medium.
- Footer: secondary "Cancel" (dark, outlined) on the left; primary action (coral, or red if destructive) on the right.
- Small confirm dialogs have no X; larger modals (Tags, Share, settings) do.

**Toasts**
- A small dark pill at top-center with a green check-circle and one short sentence.
- Copy seen: "Folder created", "6 files deleted", "Project unarchived", "Link copied to clipboard", "Team photo updated", "Invite sent to account@refero.design", "Subscription will cancel at end of period".
- No Undo action is ever offered.

---

## 1. Assets library — `app.melius.com/assets`

### 1.1 Default library state
Refs:
- https://refero.design/pages/58361834-e969-444d-93fa-24fc84415a62
- https://refero.design/pages/f30a1bc5-e8b6-422e-aed8-cf2fedbd2dc0
- https://refero.design/pages/3e782ba1-1376-4db7-afcb-ec03731d74ae
- https://refero.design/pages/29daf9bd-d178-40aa-a22f-d7c718ba593a [seen]

**Header row**
- "Assets" (white, ~14–16px medium) on the left.
- On the right: "New folder" (dark outlined, folder-plus icon) and "Upload" (coral filled, upload icon).
- A 1px divider sits below.

**Toolbar row**, left to right:
1. Search field, about 300px: magnifier and the placeholder "Search assets by name".
2. A segmented group of four source/state tabs, each with a count pill: "Uploads 4" · "Generations 13" · "Favorites 1" · "Archived 0". Counts change across captures (2/11/1/0 → 4/13 → 6/15).
3. Right-aligned: a view selector (grid icon plus chevron, for grid or list) and "Filter & sort" (sliders icon plus chevron).

**Folder row**
- Wide folder tiles (~175–190 × 32px) with a folder icon and a name, e.g. "portrait" and "Starter project".
- "Starter project" appears to be an auto-created folder.
- In multi-select mode the folder tiles also show a checkbox, so folders can be selected [seen 29daf9bd].

**Grid**
- Dense, 6–8 columns at 800px width. Each card has:
  - A rounded thumbnail of about 96px (portrait or landscape, object-fit cover).
  - Top-left: a square checkbox (only visible in hover or selection mode).
  - Top-right: a duration pill, e.g. "0:05", "0:13".
  - Video cards have a centered play glyph. Audio cards are black tiles with a music-note glyph.
  - A title line, truncated with an ellipsis: "Glowing poppy petals…", "Editorial Look 2 — Nig…", "Serum Application Vi…", "Dramatic Portrait.png".
  - A meta line: relative age · source ("32m ago · Generated", "35m ago · Uploaded").
  - Small tail icons with counts: a tag icon (number of tags, e.g. "🏷 1"), a stacked-versions icon ("3"), and a comment bubble ("1").

**Selection state** [seen 29daf9bd]
- Checked cards get a coral 1px outline and a coral checkbox with a white tick.
- A floating bulk bar appears at bottom-center: "4 assets selected" | "Move" (folder icon) | "Tag" (tag icon) | "Download" (download icon) | red filled "Delete" (trash icon) | "×" to clear the selection.

### 1.2 Filter & sort popover
Refs:
- https://refero.design/pages/29d04e4c-5a88-4ad9-9722-ad67d9884137 [seen]
- https://refero.design/pages/7ae70bcb-9698-4fc3-b3d9-128993405a61

A right-anchored panel about 190–205px wide (#1B1B1B, 1px border, soft shadow), stacked into sections split by hairlines:
- **Project**: a dropdown with a folder icon, default "All assets".
- **Canvas**: a dropdown that is disabled ("Select a project") until a project is picked; it then becomes "All canvases".
- **Sort by**: a dropdown ("Date added") plus two square ↑ / ↓ direction buttons (↓ active).
- **File type**: a dropdown, "All types".
- **Tags**: a "+ Create tag" link on the right of the header, a "Search tags" field, and a checkbox list of existing tags ("video").
- Footer: a muted "Reset filter & sort" link, centered.

### 1.3 Flow — Filtering assets by project (14091)
1. Click "Filter & sort", and the popover opens. Ref: 29d04e4c [seen].
2. Click the Project dropdown. A nested list opens, starting with a "Search projects…" input (focused, outlined), then "All assets", a divider, and project names "12", "#12/ss/26", "13", "14", "15", "25". Ref: https://refero.design/pages/14eb9717-c066-4a0e-8e65-1f79594002a0 [seen]
3. Pick a project. The Project field shows its name, the Canvas dropdown becomes active ("All canvases"), and the grid drops to the 4 matching assets. Ref: 7ae70bcb.
4. Close the popover to see the filtered grid. The folder row and the "New folder" button are hidden in project scope; only "Upload" remains. Ref: https://refero.design/pages/f92c076a-85e5-4bf3-a848-942f18c7872e
5. The fifth screen is not separately indexed. It is likely the filtered grid with the popover closed, or a Reset.

### 1.4 Flow — Creating folder (14089)
1. Start in the library, which has only the "Starter project" folder tile. Ref: f30a1bc5.
2. Click "New folder". A modal of about 300×110 opens, titled "New folder", with one input (placeholder "Folder name", bright focus outline) and footer buttons "Cancel" / "Create" (coral). There is no X. Ref: https://refero.design/pages/44551188-17c0-4f41-99f3-09998dcd7aa5
3. Type the name: the field shows "portrait". Ref: https://refero.design/pages/64cfe6c3-5e66-4a6a-81c4-ee9d5062aff8
4. Click Create. The toast "Folder created" appears at top-center and a new "portrait" tile shows up before "Starter project". Ref: 3e782ba1.

### 1.5 Flow — Moving assets to folder (14090)
1. Tick 4 cards, and the bulk bar shows "4 assets selected". Refs: https://refero.design/pages/82afffdd-2dda-45f5-b2cf-82f53f141717, https://refero.design/pages/335b9099-216e-4f9b-96ca-a1257533afbd
2. Click "Move". A modal of about 300×240 opens [seen 4f4755a5]:
   - Title "Move to folder", subtitle "Choose where to move 4 assets".
   - Full-width "Search folders" field.
   - A bordered list under the label "Assets" (the root) with rows "portrait" (selected: darker row and a coral ✓ at the right), "Starter project", and "New folder" (folder-plus icon, for creating a folder inline).
   - Footer: "Cancel" / "Move" (coral).
   - Ref: https://refero.design/pages/4f4755a5-4881-4a17-95c7-c3e7d0a72034
3. Steps 3–5 (result toast and the folder view) are not indexed separately. The success pattern is presumably the same as the other toasts.

### 1.6 Flow — Adding tags to assets (14088)
1. Select 4 assets, then click "Tag" in the bulk bar. Ref: 29daf9bd [seen].
2. **Empty Tags modal** (~335×170):
   - "Tags" title with an X; subtitle "4 assets"; helper "No tags yet — create one below".
   - A bottom row: input (placeholder "New tag name") and "+ Create" (coral).
   - Ref: https://refero.design/pages/ce0521a2-3efd-49db-b1bf-f6636c0b119c
3. Type "video" in the input. Ref: https://refero.design/pages/0cc873bb-aa94-476b-86fe-f9472b6def64
4. Click Create. The modal now has a "Search tags" field at the top, then a tag row with a coral checked checkbox and the label "video", a divider, and the "New tag name" / "+ Create" row again. The tag is applied straight away; there is no separate Save button. Ref: https://refero.design/pages/ec991b3a-a29e-45f7-8f1d-33cd9afb1a1a [seen]
5. Close the modal. Tagged cards now show "🏷 1" in their meta line, and "video" appears as a checkbox under Tags in Filter & sort. Ref: 29d04e4c [seen].

### 1.7 Flow — Deleting files (14087)
1. Select 6 assets: "6 assets selected", then click "Delete" (red).
2. **Confirm dialog** (~245×100, no X) [seen 249a2534]:
   - "Delete files?"
   - Body: "6 assets will be removed from Assets, file searches, and every canvas where they appear" (it names the downstream impact).
   - "Cancel" / "Delete" (red #B62525).
   - Ref: https://refero.design/pages/249a2534-ed60-4877-9ff4-fd1b010bd55a
3. Result: the toast "6 files deleted" (green dot) and the grid reflows. There is no undo. Ref: https://refero.design/pages/264be206-a0e2-4483-a405-a9321c44008c

Note: an "Archived" tab with a count exists, but deleting from the bulk bar is a hard delete. Archiving assets is a separate state, and its entry point was not captured.

### 1.8 Asset detail / review view — `/assets` (overlay)
Refs:
- https://refero.design/pages/bdc05995-9085-4669-8417-d363c4bc836d [seen]
- https://refero.design/pages/d5cbf935-1a78-4030-981d-6dc35e0aa4b9
- https://refero.design/pages/a33b89d9-56ce-48ca-9963-24738fff15c3

A full-screen view in three columns:

**Left: "Versions"**
- A list of version cards, about 190×50. Each has a thumbnail, a truncated title "Editorial Look 3 — Leath…", the model "Seedream 5.0 Pro" and the size "1584 × 2816".
- The active version has a warm brown (#AE8D6E) outline.

**Center**
- A black canvas with the image fitted to it.
- A floating pill toolbar at the bottom: "−" "100%" "+" | comment | download | share.

**Right: details drawer (~190px)**
- Title and an X.
- A collapsible "Details" section containing:
  - "Prompt": the full generation prompt in small text.
  - "Tags"
  - Key/value rows: Filename ("Editorial Look 3 — Leather Studio Ope…"), Model ("Seedream 5.0 Pro"), Dimensions ("1584 × 2816"), Aspect ratio ("9:16"), File size ("425 KB"), Created ("Sep 30, 11:11 AM"), Created by ("Liam Basil").
  - A full-width "Open canvas" button (dark gray).
- A collapsible "Comments (0)" section. The empty state is a bubble icon, "No comments yet", and an "Add comment" button. In a33b89d9 there is a floating comment composer pinned on the image (point annotations).

### 1.9 In-canvas asset browser — canvas route
- Ref: https://refero.design/pages/fc6554c3-bb96-435f-bd17-fac3df1a3470 (plus 8aac0dd7 and 34100035)
- A floating "Assets" panel (~310×275) over the canvas.
- Search placeholder: "Search assets (image, video, audio)". A "Project only" toggle filter.
- Chips: "All 24", "Generations 14", "Uploads 10", "Favorites 1". A "Filter & sort" control.
- A 3-column grid. Cards already placed on this canvas carry a coral "On canvas" badge. There is a heart / favorite on the thumbnail.

---

## 2. Projects — `app.melius.com/projects` and `/archive`

### 2.1 Projects grid (thumbnail view)
Refs:
- https://refero.design/pages/0408a02a-5a8e-45a0-a6bc-d02c3e5ffdb7
- https://refero.design/pages/851f0836-6e0e-4c50-bc53-146e5368c140

**Header**
- "Projects".
- Right side: "New folder" (white / off-white #F5F4F1 filled, dark text, folder icon) and "New project" (coral). On this page the secondary button is light, not dark.

**Tabs and search**
- Tabs: "All projects" (active, white with a thin underline) and "Archive".
- Search field, about 305px: "Search by name or owner".
- Right side: a view dropdown.

**Grid**
- 4 columns. Each card has a ~172×96 collage preview built automatically from the project's assets (one tall image plus 2–4 small tiles; empty slots get muted purple-gray placeholders). An empty project shows a faint brand-mark placeholder (project "25").
- Under each card: the name ("15", "14", "13", "12", "prom", "25", "Playground", "#12/ss/26", "Welcome to Melius") and "Liam Basil · Updated today / yesterday".
- New projects are auto-named with a date-style code, "#12/ss/26".

### 2.2 View toggle
- Ref: https://refero.design/pages/14141713-06d7-4c66-bbc8-02dba2106d84
- The dropdown has "Thumbnail" (grid icon, selected) and "List" (lines icon).

### 2.3 List view
- Ref: https://refero.design/pages/bc88b9d9-d85b-4264-a7b2-75e263555a04 [seen]
- Columns: "Name" (a 22px square thumbnail plus the name), "Owner", "Last modified ↓" (sortable, descending).
- Rows are ~33px with hairline dividers. Values: "Liam Basil" / "today" / "yesterday".

### 2.4 Project overflow menu
- Ref: https://refero.design/pages/ebb8d6bf-8481-4ac5-8c00-b02b9cb61261 [seen]
- A "⋯" appears at the right of the card's meta line on hover.
- The menu (dark popover, ~32px rows): "Open in new tab" · "Copy link" · "Move to folder" · "Duplicate project" · "Make private" · "Archive project". The last item is set in coral text on a hover-highlight row.
- There is no "Rename" item; renaming probably happens inline or inside the canvas header.

### 2.5 Flow — Deleting project (14085). Melius "deletes" by archiving.
1. Open "⋯", then "Archive project". Ref: ebb8d6bf [seen].
2. **Confirm dialog** (~300×92, no X) [seen]:
   - "Archive this project?"
   - Body: "“25” will be moved to the archive"
   - "Cancel" / "Archive" (red #B62323).
   - Ref: https://refero.design/pages/b6f9beeb-c267-4c04-b570-a84b2b3cb64c
3. On the Archive tab (`/archive`):
   - Search "Search archived projects".
   - One card ("25", placeholder preview) with the meta "Archived today" and an outlined "Unarchive" button.
   - Ref: https://refero.design/pages/85a9501e-ca7c-4b59-a662-9accd4769117
4. Click "Unarchive". The toast "Project unarchived" appears, along with the empty state "Archive is empty" / "Archived projects will appear here" (text only, no illustration). Ref: https://refero.design/pages/32bc8cdf-d35b-4fc5-8077-7fa70e86c59d
5. A permanent-delete step was not seen in any indexed screen. The archive appears to be the end state.

### 2.6 New project naming modal
- Refs: https://refero.design/pages/df67dd6b-ddce-45a1-a741-f4159f9c93af, 63ff9b39, ecc3733a (from Home)
- A ~300×110 modal titled "New project". The input is pre-filled with an auto-generated name ("#12/ss/26").
- Footer: "Cancel" / "Create" (coral). ecc3733a shows a loading state after Create.

---

## 3. Templates catalog — `app.melius.com/library/templates`

### 3.1 Catalog
- Ref: https://refero.design/pages/65f116af-13cb-47b0-b427-b354ce4c6811
- Title "Templates", plus "All templates (30)".
- Search field, then category pills with counts: Featured, Lifestyle/Fun, Marketing/Ads, Clothing, Professional.
- Sections "Featured", "Lifestyle/Fun", "Marketing/Ads", "Clothing", "Professional", "More templates", each headed in serif display type. Each section is a horizontal carousel: 3 cards plus a clipped 4th.
- **Card** (~185×178, radius 12–14):
  - Image with a media-type badge at top-left (image or video).
  - Title and a 1–2 line description.
  - Footer: a coral Melius avatar and "Melius" (the author).
- **Bottom promo panel**:
  - "Request a template" / "Can’t find what you need? Tell us what you’re looking for and we’ll build it for you."
  - A white "Request a template" button.
  - A vertical-stripe gradient artwork (black → blue → orange → yellow) and an X to dismiss.

### 3.2 Flow — Searching template catalog (14094)
1. Catalog (65f116af).
2. Type "pictu". The category pills shrink to only the categories with matches ("Featured 1", "Professional 2"). Results show as a flat grid. Ref: https://refero.design/pages/e03badaa-5f4f-4513-af6c-947a08d55428 [seen]
   - Card 1: "Picture to Headshot" / "Turn any photo into a professional headshot".
   - Card 2, in hover state: the image dims and two buttons appear, "View details" (dark) and "Try template" (coral). Text: "High-end Fashion Commercial" / "Create a high-end fashion commercial in a studio scene using pictures of a model and a piece of clothing".
   - The Request-a-template banner stays below the results.
3. Template detail modal: https://refero.design/pages/96d7bcb4-7f55-40bd-9263-97fb8b140353 (metadata, tags, coral primary action).

### 3.3 Zero results leads to a template request (flow 14095, a growth / feedback loop)
- Ref: https://refero.design/pages/af00ef2f-7564-4d68-94ee-c689ceb3bec7
- The query "pppp" returns no cards. Only the Request banner remains, and that is the no-results state.
- Modal "Request a template":
  - Text: "Describe the outcome you want. We ship the most-requested templates each month."
  - A textarea (example input: "A complete skincare product launch workflow: automatically turn 1 product both into a set of PDP hero images, a 15-sec video with voiceover, and promotional social media assets.").
  - "Cancel" / "Send request" (coral).

---

## 4. Settings modal (global overlay; captured over `/academy/...`, with no dedicated route)

### Structure
- Refs: https://refero.design/pages/681bfd2d-6ce4-48e2-90e9-1a4500a53c85 [seen] and all section screens below.
- A modal of about 640×380 with radius ~14 and a #141414 surface.
- Left nav column, ~116px wide, under a small "Settings" label. Items, each with a line icon:
  1. **Account & team** (people icon)
  2. **Referrals** (gift icon)
  3. **Usage** (bar-chart icon)
  4. **Plans & billing** (card icon)
  5. **Agent** (sparkle / robot icon)
  6. **Integrations** (plug icon)
  7. **Advanced** (sliders icon)
- The active item has a #242424 rounded fill and brighter text.
- **A "Manage plan" button (gray, full-width) is pinned at the bottom of the nav on every pane**, so there is always an upgrade or billing path.
- The content header holds the section title (or a breadcrumb), an X at top-right, and a hairline divider.

### 4.1 Account & team [seen 681bfd2d]
- **Account**: a 46px avatar photo; "Name: Liam Basil"; "Email: refero.design.team@gmail.com". Read-only here.
- **Team**: a 45px team logo (white circle with a black "R"); "Team name: Team"; a dark "⚙ Settings" button on the right (opens team settings, where the photo and name are presumably edited).
- **Members**:
  - A "Search teammates" field and a coral "+ Invite teammates" button.
  - Table columns "Member" / "Role" / "Credit limit".
  - Row: avatar, "Liam Basil (you)" with the email below; "Owner"; a dropdown "No limit". **Each member has their own credit limit**, set right in the table.

### 4.2 Flow — Inviting member to team (14096)
1. Account & team, then "Invite teammates". Ref: 681bfd2d [seen].
2. Sub-page with the breadcrumb "Account & team > Invite teammates" [seen 485c2d55]:
   - A decorative illustration strip: three orange/teal badge-lanyard ID-card illustrations with a ghost mascot.
   - Invite row: "Enter emails" field (accepts several emails as chips), a role dropdown ("Editor"), a coral "Invite" button, and an attached coral square link-icon button (copy invite link).
   - Table "Email" / "Role" / "Status": "refero.john.doe@gmail.com", "Editor", a "● Pending" badge (yellow dot), and a trash icon to revoke.
   - Ref: https://refero.design/pages/485c2d55-d7c7-40d2-90ae-8b00beeccb73
3. Type an email (it becomes a chip with an ×) and set the role to "Admin". Ref: https://refero.design/pages/cd321fdc-2bfb-4891-8228-eaec7f04c4ce
4. Click Invite. The toast "Invite sent to account@refero.design" (green check) appears, and the table gains a new Pending row: Admin plus the existing Editor. Ref: https://refero.design/pages/1924ef4b-5d4f-4852-acdf-2ba895c9a87b
5. The roles available (seen in the onboarding variant, below) are **Admin / Editor / Viewer**, with a ✓ on the current one. Helper text under the form: "Create projects & generate content" (the Editor permission description).

### 4.3 Onboarding team setup (same objects, onboarding skin) — `/home` first run
- **"Individual or team?"** Pixel-font glow headline, with two pills, "👤 Individual" and "👥 Team". Ref: https://refero.design/pages/1873ce19-b72c-4f54-870a-3f093db59926
- **Flow — Uploading team photo (14062)**:
  1. "Invite your team". The team row shows a gray square "L" initial tile and "Liam Basil’s team". Ref: https://refero.design/pages/e2ea5251-4bf3-4eb5-bb23-ce9cd0b32ab9
  2. Click the team tile and pick an image. A loading / upload state follows. Ref: https://refero.design/pages/98b14dfe-4042-4b24-9109-1fafffd472ce
  3. The toast "Team photo updated" appears, and the tile becomes the uploaded round logo ("R"), labelled "Team". Ref: https://refero.design/pages/87f282af-d28f-435d-b96b-63bc3e60c577
- **Invite form** [seen 3ac475a8]:
  - A ~330px column with the team row and then an email field that turns entries into chips ("refero.john.doe@gmail.com ×") with a "Editor ▾" role dropdown inside it.
  - Right-aligned: "I’ll do this later" (muted link) and "Send invites". The button is muted brown (#703626) while disabled and coral once there is an email.
  - Role menu: Admin / Editor / Viewer. Ref: https://refero.design/pages/0b432b76-a7c2-44f0-88a8-9921ffbfbfc3
  - Refs: https://refero.design/pages/3ac475a8-8a01-4c49-9fe7-5b726a9e1421

### 4.4 Referrals — growth loop (flow 14098)
- Ref: https://refero.design/pages/94b1cb52-6086-4df7-aca1-ff9a843dfb60 [seen]
- **Hero**: three glowing 3D brand-mark bow-ties (dark gray, coral, iridescent cyan/orange). The brand mark doubles as a reward graphic.
- **Left column**: "Earn $20 for each referral", then a numbered 3-step list in circle badges:
  1. "Share your invite" / "Send an email invite or use the referral link"
  2. "Your friend creates an account" / "They sign up with your invite and start creating with Melius"
  3. "They make their first purchase" / "Your team gets $20 in credits and they get $10"
- **Right column**, behind a vertical divider:
  - "Invite by email", a field with placeholder "name@company.com".
  - "🔗 Copy invite link" (dark) and "👤 Send invite" (coral, dimmed until a valid email is entered).
- The reward is paid as **credits to the team**, not cash, and only once the friend's **first purchase** goes through.
- The other two flow screens (link copied, invite sent) are not separately indexed; they presumably use the same toast pattern.

### 4.5 Usage — credits visibility
- Ref: https://refero.design/pages/92bee7e0-25b2-4e03-b213-04b07c2952cd [seen]
- **Summary row**: a coin icon and "11,306 credits used". Right side: dropdowns "All projects" and "This billing period".
- **Chart card**:
  - Metric dropdown "Generations".
  - Stacked bar chart over time (axis labels "Sep 29, 9 AM", "Sep 29, 11 PM", "Sep 30, 1 PM"). Legend: Images (coral), Videos (blue), Audio (teal), Other (gray).
  - Three stat tiles: "Net credits used 11,306", "Generations 22", "Models used 9".
- **Tabs**: "Credit usage" (active, white underline) | "Generation history".
- **Table**: "Member" / "Credits used" / "Generations" / "Credit limit". Row: "L" avatar, "Liam Basil", "Owner", coin "11,306", "22", dropdown "No limit".
- **Only credits are shown. There is no dollar cost per generation and no model price anywhere.**

### 4.6 Plans & billing
- Refs: https://refero.design/pages/ba8410c6-2d02-4d86-aafa-ea71c87e9391 [seen], https://refero.design/pages/f91e08eb-ff8f-43d3-a20f-15251a842bc9
- **"Your current plan"** / "Your team’s plan and remaining credits":
  - A card with "Creator" (large), a gray pill "Renews Oct 29, 2026", and a coin line "8,694 credits remaining".
  - A coral "Manage plan" button on the right.
  - After cancelling, the pill reads "Ends Oct 29, 2026" with an orange tint (f91e08eb).
- **"Add credits"** / "Buy one-time credits on top of your plan":
  - Four selectable tiles: "$10 / 10k credits", "$20 / 20k credits" (selected: coral border and warm tint), "$50 / 50k credits", "Custom / Any amount".
  - Note: "Credits are added to the **Team** team and never expire".
  - An outlined "Purchase credits" button.
  - The top-up rate is a flat **$1 per 1,000 credits**.
- **"Payment method"** / "Used for this team’s plan and credit purchases": a card icon, "Visa ending in 3619", "Expires 09/2031", "Update", and a trash icon.
- **"Auto top-ups"** / "Keep generating without running out of credits" (the controls are below the fold).

### 4.7 Agent
- Ref: https://refero.design/pages/1cfd6ed4-afc5-4779-a982-f954fd1dcb06 [seen]
- **"Recommended"** / "Accelerate your workflow by connecting Melius to your breadth of tools":
  - Card "MCP: Connect Melius" / "Manage your API keys in Integrations to give Claude, Cursor, and more access to Melius".
  - A coral "Learn more ↗" button and an app-cluster illustration.
- **"Context"** / "Plain-text rules. Keep it concise — this runs on every agent call.":
  - A large textarea with placeholder "e.g. Always use our brand voice. Prefer the Inter typeface. Keep copy concise and friendly."
  - A copy icon, a resize handle, and a "0 / 4000" counter.
  - This is a workspace-level brand-rules prompt.

### 4.8 Integrations
- Ref: https://refero.design/pages/13b73e36-42b9-4309-bd03-9e9975803cee [seen]
- **"Apps"** / "Connect the other tools your team works in". Two cards, each with a coral "Connect":
  - "Slack" / "@Mel in Slack to generate creatives".
  - "ElevenLabs" / "Import custom voices from ElevenLabs".
- **"API keys"** / "Let the Melius API, CLI, and MCP server act on your behalf":
  - Box "Create a new key": "Key name (optional)", expiry dropdown "No expiry", coral "Create".
  - Empty state: "No API keys yet".

### 4.9 Advanced
- Ref: https://refero.design/pages/e9839534-8b3b-4363-8319-5906689eb014 [seen]
- **"Team"** / "Applies to everyone on this team":
  - "Custom seed" / "Set a specific seed value for reproducible generations" (toggle off).
- **"User"** / "Applies only to you, on every team":
  - "Seedance precheck" / "Warn before running Seedance prompts that are likely to be rejected" (toggle ON, green).
  - "Hide dedicated prompts on media nodes" / "Only show prompts on media nodes when you directly hover over the node" (off).
- Each setting is explicitly labelled as team-level or user-level.

---

## 5. Pricing / plans — `app.melius.com/pricing-plans`

### 5.1 Pricing page (monthly, current plan = Creator)
- Ref: https://refero.design/pages/975376e0-b6af-4c32-b335-454db547608d [seen]
- **Top bar**: "← Go back" (outlined) at top-left. Headline "Plan your **imagination**", with the last word in serif.
- **Controls**: Segment "Individual | Team" (left). Toggle "Monthly ◯ Annual" plus a coral pill "Save 20%" (right).
- **Three cards** (radius ~12). Every card has the same structure, which makes them easy to compare:
  - Name (serif) with a badge.
  - Tagline.
  - Price with a strike-through and a discount pill.
  - Billing line.
  - CTA.
  - Credits block (a coin-medallion icon, credits per month, and a "≈ N images or M videos" equivalent).
  - Divider.
  - "Everything in X, plus" with a coral-check feature list.

| | Creator | Growth | Professional |
|---|---|---|---|
| Badge | "Current" | "Popular" | "Best value" (coral) |
| Tagline | "Explore possibilities on Melius" | "Start creating on your own" | "Go pro on your terms" |
| Monthly | **$18** ~~$20~~ "Save 10%" · "billed monthly" | **$45** ~~$50~~ "Save 10%" | **$99** ~~$110~~ "Save 10%" |
| Annual | **$17** ~~$20~~ "Save 15%" · "/month · $204 billed annually" | **$43** · "$510 billed annually" | **$93** · "$1,116 billed annually" |
| Credits | 20,000 credits/mo ≈ 300 images or 14 videos | 50,000 credits/mo ≈ 745 images or 35 videos | 110,000 credits/mo ≈ 1,650 images or 77 videos; segmented "110K / 300K" tier picker |
| CTA (when current) | "Cancel subscription" (outlined) + "Renews Oct 29, 2026" | "Upgrade to Growth" (white) | "Upgrade to Professional" (coral) |
| Features | Access to all models · Unlimited agent usage · Import custom voices (annual view adds "Up to 10 seats") | Everything in Creator, plus · Up to 3 agent skills (annual adds "Up to 10 seats") | Everything in Growth, plus · Up to 10 agent skills · Slack agent access · Search with AI · AI prompt enhancement · Better fonts · And more… |

- The Professional card has a warm coral border, and a dotted-matrix decoration sits at the right edge (annual view).
- Quirk: the toggle's "Save 20%" pill does not match the per-card "Save 15%" in annual mode or "Save 10%" in monthly. The anchor "strike-through" prices are shown even on monthly billing.

### 5.2 Flow — Subscribing to Creator Pro (14063). The UI label is "Creator"; "Creator Pro" is Refero's name.
1. Annual view with no plan yet: all three cards show upgrade buttons, "Upgrade to Creator" (white), "Upgrade to Growth" (white) and "Upgrade to Professional" (coral). The annual toggle is green when on. Ref: https://refero.design/pages/963fa053-08fd-4a50-838f-dc328b87d5fa [seen]
2–3. The checkout steps (likely Stripe-hosted or embedded) are not indexed.
4. Result: the Creator card shows "Current" and "Renews Oct 29, 2026", and its CTA becomes "Cancel subscription" (975376e0).

**Upgrade entry points seen**:
- "Manage plan", pinned at the bottom of the settings nav on every pane.
- "Manage plan" (coral) in the Plans & billing current-plan card.
- Upgrade CTAs on /pricing-plans.
- The canvas top bar shows a credit-balance chip ("◉ 15k") next to the project name [seen 9586ec77], so the balance is always visible while working.

### 5.3 Flow — Canceling subscription (14099): six steps with soft retention
1. Settings → Plans & billing → "Manage plan". Ref: ba8410c6 [seen].
2. /pricing-plans: the Creator card has an outlined "Cancel subscription" button. This is deliberately low-emphasis, while Upgrade buttons are filled. Ref: 975376e0 [seen].
3. **The cancel modal opens** (~300×340, no X):
   - "Cancel subscription".
   - Body: "Your Creator plan will remain active until Oct 29, 2026. After that, you will be moved to the free plan."
   - Bordered box **"Before you go"**, with three ⓘ rows (the retention arguments):
     - "Your existing credits will be preserved, but you will stop receiving monthly credits"
     - "If you subscribe to a different plan in the future, you will be charged the full plan price with no prorated discounts" (loss of the promo price)
     - "Switching to a different plan instead of cancelling lets you keep your current billing cycle and avoid paying full price again" (nudges a downgrade or switch instead of cancelling)
   - **"What’s the main reason you’re cancelling?"** A required single-select radio list:
     - "Too expensive for how I use it"
     - "Output quality wasn’t what I needed"
     - "Missing a feature, model, or integration"
     - "Too hard to get the results I wanted"
     - "Just finished my project / one-time use"
     - "Switched to another tool"
     - "Other"
   - Footer: "Keep my plan" (outlined, left) and "Cancel subscription" (red). The red button is **disabled or dimmed until a reason is picked**.
   - Ref: https://refero.design/pages/47c20cac-569a-4bdf-9421-98c147455b91 [seen]
4. Pick a reason: the radio fills and the red CTA becomes active. Ref: https://refero.design/pages/20f7db81-a4a6-49a2-919e-decba9b9f207
5. Confirm. The toast "Subscription will cancel at end of period" appears. The Creator card now reads "Active until Oct 29, 2026", and its CTA becomes an outlined **"Reactivate"** button (one-click win-back). Ref: https://refero.design/pages/930adc30-7cc9-4865-968e-a62ee3d27b33 [seen]
6. Back in Settings → Plans & billing, the badge reads **"Ends Oct 29, 2026"** (orange tint). Ref: f91e08eb.

There is no discount or coupon offer, and no pause option. Retention relies on stating what is lost, pointing to a plan switch instead, a required exit survey, and a visible Reactivate button.

---

## 6. Sharing and copy link (canvas) — flows 14071 and 14081

- Refs:
  - https://refero.design/pages/9586ec77-dbd8-4b99-98ec-f168c1dbc938 [seen]
  - https://refero.design/pages/71f0159e-542c-4935-90fa-e8e20716eacb
  - https://refero.design/pages/f028f365-1c16-4410-8ae1-d13814c4801a
  - https://refero.design/pages/e573c6f9-e7f3-4bd6-ae3b-38581a76e5e9
- **Entry**: the coral "Share" button plus a link-icon button at the top-right of the canvas. The canvas top-left pill shows "☰ #12/ss/26 / Canvas 1 ▾ | ◉ 15k".
- **Modal** "Share “#12/ss/26”" with an X:
  - **"General Access"** row:
    - Lock icon, "Restricted" / "Only members with access can open this canvas", and a "Restricted ▾" dropdown.
    - Switching it gives a globe icon and "Anyone with the link" / "Anyone with the link can view this canvas" with a "Can view ▾" dropdown (71f0159e shows the dropdown menu).
  - "🔗 Copy link" (outlined).
  - Divider.
  - "👥 Team · 1 member" with "👤+ Add people" on the right.
  - "Done" (coral).
- **Copying link to clipboard**: click "Copy link" and the toast "Link copied to clipboard" appears; the modal stays open (e573c6f9).
- Projects also offer "Copy link" from the card ⋯ menu (ebb8d6bf).

---

## 7. Product feedback — flow 14100

1. **Entry**: a persistent "Share feedback" pill at the bottom of the expanded sidebar, next to "Documentation". Ref: https://refero.design/pages/0c97ca03-65e9-4bb3-89f5-74994caaacaa
2. **Modal** (~260×145) [seen]:
   - "Share feedback".
   - A textarea with placeholder "Tell us about your experience, bugs you’ve found, or features you’d like to see…".
   - "Cancel" / "Share". The Share button is muted brick while the textarea is empty.
   - Ref: https://refero.design/pages/dd11b5ca-d1a8-47f6-b46f-7b42e51fa8fe
3. Text entered: "Share" turns full coral. Ref: https://refero.design/pages/29b18118-e29f-4d29-bae7-f1562e8320a8
4. Submit (the toast is not indexed separately).
- A separate flow, "Submitting feedback on AI response" (14070), covers per-message thumbs feedback inside the agent chat. It is out of scope here.

---

## 8. Empty, loading and confirmation states (catalog)

| Context | Copy / treatment |
|---|---|
| Tags modal, none | "No tags yet — create one below" |
| API keys | "No API keys yet" |
| Comments | bubble icon + "No comments yet" + "Add comment" |
| Archive | "Archive is empty" / "Archived projects will appear here" |
| Template search, 0 results | Only the "Request a template" banner (no-results turns into a request) |
| Empty project card | Faint brand-mark placeholder in the preview |
| Delete assets | "Delete files?" + names downstream impact (Assets, search, every canvas) |
| Archive project | "Archive this project?" / "“25” will be moved to the archive" |
| Cancel plan | Required reason, "Before you go" consequences, "Keep my plan" |
| Disabled primaries | Muted brown/brick fill (#703626 / #833423) until input is valid (Send invites, Share feedback, Send invite, Cancel subscription) |
| Toasts | Top-center dark pill + green check; one sentence; no Undo |

---

## Key UX patterns worth matching

1. **One selection model across the library.** Hover a card to reveal its checkbox. Selected cards get a coral outline and a filled check. A floating bulk bar ("N assets selected · Move · Tag · Download · Delete · ×") appears for the selection. Every bulk action opens a modal that repeats the count ("Choose where to move 4 assets", "Tags · 4 assets").
2. **Inline creation inside pickers.** "New folder" sits inside the Move-to-folder list, and "New tag name + Create" sits inside the Tags modal. Applying a new tag is immediate, so there is no create-then-assign round trip.
3. **Destructive confirms that name the blast radius.** "…removed from Assets, file searches, and every canvas where they appear." Archiving is the soft-delete for projects, with an Archive tab, "Unarchive" and a toast.
4. **Filter & sort as one popover:** Project → Canvas (dependent, disabled until a project is picked) → Sort with direction buttons → File type → Tags (with "+ Create tag") → "Reset filter & sort". Source tabs with live counts (Uploads / Generations / Favorites / Archived) sit outside the popover.
5. **Asset cards carry provenance.** Each card shows "age · Generated/Uploaded", plus counts for tags, versions and comments. The detail view lists versions, prompt, model, dimensions, aspect ratio, size, creator and comments, plus "Open canvas". In the canvas asset browser, "On canvas" badges show reuse. This maps directly to a BIO-certified asset lineage.
6. **Project cards are auto-collages of their outputs**, with a Thumbnail ⇄ List toggle, a sortable list view and a ⋯ menu (Open in new tab, Copy link, Move to folder, Duplicate, Make private, Archive).
7. **One settings modal with seven panes and a "Manage plan" button pinned on all of them.** Each setting is marked team-scope or user-scope ("Applies to everyone on this team" / "Applies only to you, on every team").
8. **Credits-only economics, shown throughout.** The pricing card gives credits per month with a plain-language equivalent ("≈ 300 images or 14 videos"). Usage shows credits by project and billing period, split by media type, with a per-member table. **Per-member credit limits** sit in the team table. Top-ups are $10 per 10k with Custom, "never expire", plus Auto top-ups. A credit balance chip is visible in the canvas. No per-model or per-call cost is ever shown. This matches CaastorOS's standing rule to show only credits.
9. **Pricing page that is easy to compare:** identical card anatomy, a serif plan name, a strike-through anchor price with a discount pill, an Individual/Team segment, a Monthly/Annual toggle, and a capacity sub-picker on the top tier (110K/300K). The current plan's CTA becomes a quiet "Cancel subscription"; the other tiers keep filled upgrade buttons.
10. **Retention without dark patterns:** a "Before you go" consequences box, a nudge to switch plans instead, a required 7-option exit survey (useful product data), "Keep my plan" as the safe default, access until period end, a one-click "Reactivate", and an "Ends <date>" badge in billing.
11. **Growth loops built into existing surfaces:**
    - Referrals as a settings pane: two-sided **credit** reward ($20 to the team, $10 to the friend), triggered by the friend's first purchase, with "Copy invite link" and email invite.
    - Team invites with Admin / Editor / Viewer roles, chips, "Pending" status with revoke, and a copy-link companion button.
    - An onboarding "Individual or team?" fork, with "I’ll do this later" as an escape.
    - "Request a template" turns zero-result searches into demand signals ("We ship the most-requested templates each month").
    - A persistent "Share feedback" pill.
12. **Ecosystem hooks in settings:** an Agent "Context" brand-rules prompt ("runs on every agent call", 4000 characters), a promoted MCP card ("give Claude, Cursor, and more access"), Slack "@Mel", ElevenLabs voices, and API keys with expiry. For CaastorOS, the Agent Context field is a direct analogue of BIO-level brand rules.
13. **Restrained visual system:** near-black surfaces, a single coral accent (with a deeper red reserved for destructive actions), muted brick for disabled primaries, serif used only on editorial moments, dense 9–12px UI type, and one-sentence green-check toasts.
