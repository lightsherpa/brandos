# Melius teardown, part 1: entry and app shell

Source: Refero site 1166 (melius.com, "The AI-native operating system for creatives"). Every screen cited below has site.id 1166. I read about 60 Melius screens as full text descriptions and looked at 22 full-size screenshots (marked **[viewed]**). Refero's `get_flow` does not work for Melius, so I rebuilt the flows from routes, on-screen state and copy. Screens with a gap in the reconstruction are flagged.

Refero screen URL pattern: `https://refero.design/pages/<uuid>`

---

## 0. Global visual language (applies to every surface below)

| Token | Value (observed) | Usage |
|---|---|---|
| App background | `#0F1010`–`#151515` (near-black); sidebar `#101010`–`#171717` | Shell, canvas |
| Raised surface / card | `#181818`–`#1D1D1D` | Cards, modals, composer |
| Input fill | `#151515`–`#1B1B1B` | Search, text fields |
| Hairline border | `#242424`–`#303030` (cards), `#343434`–`#4A4543` (inputs) | 1px everywhere; no heavy shadows |
| Primary text | `#F2F2F2` / `#F5F5F4` / `#F6F5F3` (warm off-white) | Headings, labels |
| Secondary text | `#9A9691`, `#A5A5A5`, `#8B8B8B` | Descriptions, metadata |
| Brand / primary CTA | Orange-red `#EB522C` / `#F04B24` / `#EF4D25` / `#F24B23` (one hue rendered at slightly different values) | Brand mark, Create, Send, Try template, Verify code, Upgrade |
| Disabled/pressed CTA | Burgundy-brown `#833929` / `#703625` / `#A94B32` | The same button while disabled, loading ("Sending code…", "Verifying…") or empty-form |
| "New" badge | `#C25C28` text on dark red tint | Cast nav item, promo cards |
| Secondary button (light) | White `#F5F8F8` / `#F1EEED` fill, near-black text | "New project" (sidebar), "Go to Cast", "Request a template", "Read docs", "Start creating" |
| Success | Green `#35C96B` / `#3BB66B` icon in a dark toast | Toasts, Cloudflare widget |
| Accent gradients | Vertical-stripe band black → navy → orange `#BA4417` → amber `#FAA73B` → pale yellow | "Request a template" banner art; Academy request card uses an orange/blue blur (`#E76E37`, `#3D5767`) |

**Typography**
- Display: **Instrument Serif** (Refero detects it on nearly every screen). Used for H1/H2 section headings: "What will you create today?", "Recently viewed", "Discover", "Playground", "Featured", "Tutorials", "Related content", "First generation, on us", "Now you're ready", plan names on pricing, and the image captions in the auth carousel. Sizes run about 20–28px in the app and 36–56px on marketing. Weight is regular, line-height tight (1.05–1.15).
- UI: a neutral grotesk (Inter/Geist-like). Navigation is 11–13px, body 11–13px, metadata 9–11px. Buttons are 11–12px, medium weight.
- Onboarding only: a **glowing dot-matrix / pixel display face**. White, with a soft bloom halo on pure black, about 64–74px, two centred lines.

**Shape and density**
- Card radius 10–16px, modal radius 12–16px (the auth shell is 16–20px), input radius 4–6px, button radius 5–8px. Onboarding pills use 8–12px.
- UI controls are compact: 24–28px high in modals and 32–38px on pages.
- Separation comes from 1px borders and tone, not from shadows. Modals get a black scrim of about `rgba(0,0,0,0.65–0.78)`.
- Background texture: a faint **dotted grid** behind the Home hero, the pricing page and the canvas tour cards. It ties the shell to the canvas.
- Content imagery is cinematic and photographic (people, products, fashion). Chrome is monochrome, and colour lives in the imagery.

---

## 1. Marketing site → entry

### 1.1 Landing page: `www.melius.com/`
Refero: https://refero.design/pages/aca9e76c-a8c1-457e-945d-4c37b32f5e56

The page scrolls top to bottom through these sections:
1. **Hero** on light grey `#E5E4E4` with a micro dotted grid. The serif H1 reads "Create any campaign you imagine" in `#1B1414`. Below it sits a perspective-stacked carousel of campaign images (cards recede toward the centre), then a short explainer. Next is a **black rounded prompt bar** with an abstract icon on the left, placeholder copy and a circular arrow submit. In other words, the app's composer is reused as the marketing CTA. A trust row follows: "Trusted by creatives from" plus monochrome logos.
2. **Product showcase**: an orange → pink → violet → blue blurred gradient. A photographic beverage can sits on the left. On the right is a dark node-graph canvas with orange curved edges, image thumbnails and a large output image.
3. **Use-case selector**: a central white card stack ("Agencies", serif title, photo, paragraph) with floating cards labelled "Concept Boards", "Campaign Variants", "Treatment Decks" and "Spec Ads" (yellow labels). A bottom segmented strip offers **Agencies | CD/Filmmakers | Marketers | E-commerce | GTM/Growth**. The active tab is coral `#E54C2C` with white text.
4. **Pricing** on dark `#1B1414`. Serif "Our Pricing". An **Individual/Team** segmented toggle sits left and a **Monthly/Annual** switch right, with a coral indicator and a yellow savings badge. There are three off-white cards: Creator (coral glow), Growth, and Professional (organic cut-out corner with a photo sphere; its CTA is a coral → blue → lavender gradient). Each card shows a price, struck-through original, "per month", savings badge, a credit-summary panel with a circular grayscale image, and a checklist.
5. **FAQ**: serif "Frequently asked questions" over a single-column accordion with plus icons. Topics: what Melius is, the AI canvas, suitable work, video generation, free access, supported models, ownership, comparisons.
6. **Footer**: a rounded `#292929` panel with a giant low-opacity Melius wordmark watermark behind it. "Don't miss out" newsletter field with an arrow. Columns: PRODUCT / COMPANY / COMMUNITY. Legal row: Terms of Service, Privacy Policy, Cookie Preferences.

### 1.2 The app is browsable while logged out (key finding)
In every auth screen the dimmed background is the **real app shell with a guest sidebar**. The guest sidebar has a "Sign up" item at the top (person icon), then Home, Inbox, Playground, Cast, Projects, Assets, Templates, Learn, Academy, plus an orange **"Sign up for free"** button at the top-right of the content area **[viewed: a675a733, b355a9f6]**. The guest Home shows the same Discover and Playground cards ("Try it", "Connect"). Login and sign-up are **modals over app.melius.com**, not standalone pages, even though the URL changes to `/login` or `/signup`.

---

## 2. Authentication: "Logging in" (8 screens) and the auth part of "Signing up and onboarding"

### 2.1 Shared auth modal anatomy
- A large modal, about 680×420px in an 800px frame, with a 16–20px radius, a hairline border and a soft shadow, centred over the dimmed app.
- **Left column (about 48%)** holds a smaller inner dark card, about 245×290–320px, with a `#2A2A2A` border, 10–12px radius and roughly 24px padding. Everything is centre-aligned on one axis about 196px wide.
- **Right column (about 52%)** is a tall **cinematic media carousel card**, about 320×455px with a 12–16px radius, showing an AI-generated still or video:
  - an "×" close button top-right (about 14px inset);
  - a bottom dark gradient with an **Instrument Serif caption** (17–21px, off-white, 2 lines) naming the prompt that made the clip;
  - a **thin white progress bar** underneath (an active segment over a dark track), which auto-advances like a story or reel.
  - Observed captions (each is a generation prompt): "Porsche 930 off-road drifting through the desert during sunset"; "Cinematic creation of a couture dress creative process in a gothic style"; "Fisheye POV: Skater girl jumping over 3 mega sharks with a rewind effect"; "Dramatic zoom in of a cartoon dog playing chess in a cathedral"; "A cowboy, a samurai, and a caveman walk into Wall Street".
  - The auth wall doubles as a showcase of what the product generates.
- **Brand mark**: an orange-red bow-tie / double-loop glyph (about 25px) centred at the top of the form card.

### 2.2 Login: route `/login`
| Step | Screen | What the user sees and does |
|---|---|---|
| 1. Empty | https://refero.design/pages/bda00b7a-844c-4ec3-9e68-549dc777ba7c | Title "Log in to Melius". White **"Log in with Google"** button (196×24, 5px radius, multicolour G). Divider "or". Label "Email address". Input with an envelope icon and placeholder "you@company.com". Link "Don't have an account? **Sign up**". Legal: "By continuing, you agree to our **Terms of Use** and **Privacy Policy**." The right carousel shows the fisheye surfer clip. |
| 2. Filled | https://refero.design/pages/7a5aad7e-e385-45e6-ae71-90113ea2593d | Email entered. The primary **"Send login code"** button appears (orange `#F04A2A`, full width). Focus border is a warm `#C98A69`. Carousel: rally car / Porsche. |
| 3. Sending | https://refero.design/pages/90e2b3e9-c66b-42bc-9d9a-432f3556b253 **[viewed]** | The button turns burgundy `#A94B32` with a spinner and the label "**Sending code...**". No password field exists: login is **passwordless (email OTP) or Google**. |
| 3b. Bot check | https://refero.design/pages/1c57140c-a992-4f29-8ad9-7324ace8bacc | A **Cloudflare Turnstile** widget (about 177×39px: green check, "Success!", Cloudflare logo, "Privacy · Help") appears at the bottom of the card while sending. |
| 4. Check email | https://refero.design/pages/895d4e29-2b29-4173-94f7-10c1bedfa539 | Heading "**Check your email**", sub-line "We sent a code to {email}". A single centred, letter-spaced code input. **"Verify code"** (orange), **"Resend code"** (dark grey `#343435`), and a text link "**Use a different email**". The Turnstile success stays at the bottom. |
| 5. Error | https://refero.design/pages/4c2880ba-fa02-44a3-98a9-ed925fac94c2 | Bad code "32845" entered. Inline orange-red error "**The code was incorrect. Try again**" (`#F05A38`, 8px) under the field. Buttons are unchanged, so the user can recover in place. Carousel: samurai. |
| 6. Success | (implied) | Lands on `/home`. |

### 2.3 Sign up: route `/signup`
| Step | Screen | Detail |
|---|---|---|
| 1. Empty plus captcha | https://refero.design/pages/a0d8bf13-5519-40ec-9d48-b99862f0eea5 | Title "**Create your account**". The Turnstile **checkbox** sits *above* the Google button (unchecked state). "**Sign up with Google**", "or", Email address ("you@company.com"), "Already have an account? **Log in**", and the legal line. Carousel: cartoon dog playing chess. |
| 2. Fields | https://refero.design/pages/f448b954-b8b5-41bc-b6a5-3aab01d5d90d | After the captcha passes ("Success!"), the form shows the Email field plus **First name / Last name** side by side (placeholders "First" and "Last"). Below them, a "**Have a code?**" link and the primary "**Send one-time code**" button. |
| 3. Filled | https://refero.design/pages/a675a733-ce72-4a41-9163-be444694e354 **[viewed]** | Values: email, "Liam", "Basil". Orange CTA active. The guest app shell is visible behind. |
| 4. Verify | https://refero.design/pages/b355a9f6-9b19-450e-9551-634720d1b731 **[viewed]** | "Check your email / We sent a code to refero.design.team@gmail.com". A **6-digit** code shown spaced, "1 2 3 4 5 6". **Verify code**, **Resend code**, "Use a different email". |
| 5. Verifying | https://refero.design/pages/cee1968d-86ce-4f2e-baaf-40324f0a217f | The primary button turns muted terracotta `#B8472F` with "**Verifying…**". "Resend code" is greyed out (disabled while in flight). |

Auth UX takeaways: there is one form pattern and two entry points, and the UI never shows a password. The Google button is always the first option. Captcha is invisible-first: it only shows when needed and confirms with "Success!". Loading and disabled states use a darker burgundy of the brand colour rather than generic grey.

---

## 3. Onboarding questionnaire (full-screen, route stays `/home`)

After verification the user gets **full-black, chrome-free screens** with no sidebar, logo, progress bar or back button. Each step is one glowing pixel-font question with **one-click pill answers**. Clicking a pill advances immediately; there is no "Next" button. Pills are `#1C1C1C`, 32px tall, 8–12px radius, with 6–8px gaps and a thin line icon before the label.

Reconstructed order (Refero lists a 17-screen "Signing up & onboarding" flow, and these are its post-auth steps):

| # | Screen | Question (pixel font, 2 lines) | Answers (exact) |
|---|---|---|---|
| Q1 | https://refero.design/pages/1873ce19-b72c-4f54-870a-3f093db59926 **[viewed]** | "Individual / or team?" | [person icon] **Individual** · [group icon] **Team** |
| Q2 | https://refero.design/pages/2b9fe183-8de7-49ef-87d1-dbe442403731 **[viewed]** | "What type of work / do you do?" | **Founder · Marketing · Brand · Creative director · Other** (text only, no icons) |
| Q3 | https://refero.design/pages/7968dff7-ab9d-462a-a62f-538b4664fcfc **[viewed]** | "Where did you / hear about us?" | [X logo] **X** · [in] **LinkedIn** · [people] **A friend** · [⋯] **Other** |
| Q4 (Team path) | https://refero.design/pages/98b14dfe-4042-4b24-9109-1fafffd472ce · https://refero.design/pages/e2ea5251-4bf3-4eb5-bb23-ce9cd0b32ab9 | "Invite your / team" | See 3.1 |
| Q4 state: team photo set | https://refero.design/pages/87f282af-d28f-435d-b96b-63bc3e60c577 | same | A top-centre toast "**Team photo updated**" (green check). This implies an earlier **team name and photo** step that I could not locate in Refero (gap). |
| Q4 state: role menu | https://refero.design/pages/0b432b76-a7c2-44f0-88a8-9921ffbfbfc3 **[viewed]** | same | Role dropdown open |
| Q4 state: chip entered | https://refero.design/pages/3ac475a8-8a01-4c49-9fe7-5b726a9e1421 **[viewed]** | same | Email chip entered, send enabled |

### 3.1 "Invite your team" step anatomy
- **Team row** (about 330×35px, `#1C1C1C`, 10–12px radius): a white circular avatar with a black "R" monogram, then the label "Team". It is read-only context showing which workspace you are inviting into.
- **Invite row**: a multi-email **chip input** (placeholder "Enter emails"). Each typed email becomes a grey `#343434` chip, e.g. "refero.john.doe@gmail.com ×", and the caret stays to the right for more entries. On the right of the same row is a **role dropdown "Editor ⌄"**. The open menu lists **Admin / Editor ✓ / Viewer**, and hovering shows the tooltip "**Create projects & generate content**" (the permission is explained in place).
- **Actions** (right-aligned): a muted text link "**I'll do this later**" (skip) and "**Send invites**". The button is burgundy `#70392A` when the input is empty and becomes saturated orange `#EF4E25` once an email chip exists.

### 3.2 Plan selection
No forced paywall was observed inside onboarding. Plans live at `/pricing-plans`, reached from Settings → "Manage plan" or upgrade prompts:
- https://refero.design/pages/963fa053-08fd-4a50-838f-dc328b87d5fa (annual) · https://refero.design/pages/975376e0-b6af-4c32-b335-454db547608d (monthly, current = Creator) · https://refero.design/pages/930adc30-7cc9-4865-968e-a62ee3d27b33 (cancelled state with a "Reactivate" button and a toast saying the plan cancels at period end).
- Top-left an outlined "**← Go back**" button. Serif H1 "**Plan your imagination**" over a dotted texture.
- **Individual | Team** segmented control on the left. **Monthly ◯ Annual** toggle on the right with a "**Save 20%**" red badge.
- Three dark cards (not light, unlike marketing):
  - **Creator**: badge "Current", subtitle "Explore possibilities on Melius", $18.
  - **Growth**: badge "Popular", "Start creating on your own", $45.
  - **Professional**: badge "Best value", warm-orange border, "Go pro on your terms", $99.
  - Each price shows a strike-through comparison, a savings chip and "billed monthly" (or "/month · $204 billed annually").
- CTAs: Creator "Cancel subscription" or "Reactivate" (outlined); Growth "**Upgrade to Growth**" (white fill); Professional "**Upgrade to Professional**" (orange fill).
- **Credit row** on each card: a small textured coin icon, then **20,000 / 50,000 / 110,000 credits/mo**, then "≈ N images / videos". Professional adds a **110K | 300K** capacity segmented toggle.
- Checklists: "Everything in Creator, plus…". Items include access to all models, unlimited agent usage, import custom voices, 3 or 10 agent skills, Slack agent access, search with AI, AI prompt enhancement, and better fonts.

### 3.3 First-run guided tour (on the canvas)
After the questionnaire the user lands in a seeded project, **"Welcome to Melius"** (visible in Projects as the oldest item), at route `/projects/{projectId}/canvas/{canvasId}`.
- **Tour intro**: https://refero.design/pages/3dbd534f-14ea-46c3-80cf-606076fe0355 **[viewed]**. A centred card (about 520×366px, `#1C1C1C`, 14–16px radius, dotted-grid interior). At the top a **particle-dot rendering of the Melius bow-tie logo**. Serif H1 "**First generation, on us**" (with a soft glow), sub "Mel will show you how the canvas works, starting with your first creation", and a single white square **→** button. "Mel" is the agent's name. The free first generation is the hook.
- (The intermediate tour steps on the canvas are covered in another teardown, since the canvas is out of this scope.)
- **Tour complete**: https://refero.design/pages/d2d2d357-b69d-4485-9aa0-e51c1644c80d. Serif "**Now you're ready**", body "You've run the whole flow: generate, explore variations, animate, and iterate. The canvas is yours now." White button "**Start creating**", text link "**Restart tour**" below. The dotted canvas background has a small glowing dot cluster.

---

## 4. Home dashboard: `app.melius.com/home`

Screens:
- https://refero.design/pages/af66ff31-f7b7-4f85-8c21-2828e6b9e0c0 **[viewed, full scroll]** (expanded sidebar)
- https://refero.design/pages/1046005d-481a-41f4-a67b-6543b2259e9c (expanded)
- https://refero.design/pages/5bfab967-9233-4af5-b163-75ed51e4ec52 **[viewed]** (collapsed rail plus "New project" tooltip)

Top bar: page title "**Home**" (white, 14–16px) at the left. The top bar has **no search, no notifications bell, no credits meter and no avatar menu**, so the content header is bare. A hairline divider sits below it.

Sections, top to bottom:
1. **Creation hero** over a dotted-grid band:
   - Serif "**What will you create today?**"
   - Sub "**Describe it, and Mel builds it across every model in one place**"
   - **Composer**, about 520×86–95px, `#171818`, 8px radius, 1px border:
     - placeholder "Describe what you want to generate…";
     - a bottom-left row of **suggestion chips with tiny image thumbnails**: "Neon rose still life", "Pearl strand close-up", "Sunlit portrait study", "Studio glassware";
     - bottom-right a paperclip (attach reference) and a light-grey square **↑ submit**.
   - One variant shows a **model-selection chip** in the composer (https://refero.design/pages/ecc3733a-7384-4c03-9641-98dc124e682a).
   - Submitting creates a project and drops you into the canvas with the prompt.
2. **Dismissible promo banner**: full width, 145px tall, with an "×" at the top-right. Red "**New**" badge, serif "**Introducing Cast**", copy "Choose an avatar, write the script, and customize every part of the video", a white "**Go to Cast**" button, and on the right a strip of 5 portrait video stills fading into the dark text panel.
3. **"Recently viewed"** (serif H2) with a right-aligned outlined pill "**View all projects →**". Project cards use a **2×3 mosaic of the project's generated images** (empty slots render as grey tiles), then the title ("Welcome to Melius") and metadata "Liam Basil · Updated today". Cards are about 140px wide in a horizontal row.
4. **"Discover"** (serif H2) in a bento layout:
   - Left: a large feature card with 4 portrait video panels, eyebrow "Cast", headline "**Any script, a world of possibilities**", copy "Choose an avatar, background, and more to bring your ideas to life", and a white "**Go to Cast**" button.
   - Right: a stack of three recommendation cards, each with a photo/abstract background, dark gradient, title, one-liner and a pill button:
     - **Seedance 2.5**: "Frontier video generation up to 30 seconds", "Try it →"
     - **GPT Image 2.5**: "State of the art image generation from OpenAI", "Try it →"
     - **Melius MCP**: "Connect ChatGPT, Claude, and more to your canvas", "**Connect →**". This is the integrations entry point on Home.
   - New-model launches surface as Discover cards: a model-of-the-week merchandising slot.
5. **"Playground"** (serif H2): a bento mosaic of about 14 generated images. On a left gradient: eyebrow "Playground", headline "**Every model in one interface**", sub "Generate images, video, and audio in one place", and a white "**Open Playground**" button.

There are no empty states on Home: a brand-new account already has "Welcome to Melius" in Recently viewed because of the seeded tour project.

---

## 5. Global navigation (left sidebar)

### 5.1 Expanded sidebar (about 135–150px)
From the Home, Templates and Academy screens **[viewed]**:
```
[bow-tie logo] Melius                [collapse-panel icon]
(R) Team                              ⌄        ← workspace/team switcher
[ + New project ]                              ← white filled button, full width
⌂ Home                                         ← active = #2A2A2A-ish rounded row
Create
  🎨 Playground
  ▣ Cast   [New]                               ← red "New" pill
Library
  ▢ Projects
  ▣ Assets
  ⊞ Templates
Learn
  🎓 Academy
…
⚙ (settings)                       ? (help)   ← bottom corners
```
- Group labels (Create, Library, Learn) are small muted text, about 10px, in `#7C7C7C`.
- Rows are 28–30px high with a 16px line icon and 12px text. Active rows get a filled charcoal pill and brighter text. Inactive rows have transparent backgrounds and muted labels.
- **Collapse toggle**: a sidebar-panel icon to the right of the wordmark.
- **No credits or usage meter, no plan badge, no search, no notifications and no user-avatar menu** appear in the sidebar. Credits are only visible in Settings → Plans & billing / Usage, in pricing, and as "Cost per run" on templates.

### 5.2 Collapsed rail (about 42–48px)
**[viewed: 5bfab967, bc88b9d9, e03badaa]**
- From top: brand mark, team avatar "R" (white circle), then a **white rounded-square "+"** (New project; hover shows a dark tooltip "New project").
- Then **one icon per group**: Home (house), Create (palette → Playground/Cast), Library (open book → Projects/Assets/Templates; highlighted on Projects *and* Templates), Learn (grad cap → Academy).
- Bottom: ⚙ settings, ? help.
- The active group is a lighter rounded square. The collapsed state persists across pages (Projects, Templates and the New-project modal all show it).

### 5.3 Help menu (the "?" icon)
https://refero.design/pages/0c97ca03-65e9-4bb3-89f5-74994caaacaa **[viewed]**
A small popover anchored bottom-left with two items: "**Documentation**" (book icon) and "**Share feedback**" (chat-bubble icon).
- Share feedback opens a modal: https://refero.design/pages/dd11b5ca-d1a8-47f6-b46f-7b42e51fa8fe (empty; placeholder "Tell us about your experience, bugs you've found, or features you'd like to see…"; burgundy disabled "Share") → https://refero.design/pages/29b18118-e29f-4d29-bae7-f1562e8320a8 (typed; orange **Share**) → https://refero.design/pages/66cce0bb-f148-4147-989a-7a7a4366de71 (toast "**Feedback submitted**").

### 5.4 Settings and account (the "⚙" icon, a modal and not a page)
https://refero.design/pages/681bfd2d-6ce4-48e2-90e9-1a4500a53c85 **[viewed]**
This is where the account, workspace and credits live. The modal is about 640×380px with a left list headed "Settings":
- **Account & team**: avatar, Name, Email. A Team block (big "R" logo, Team name "Team", "Settings" button). Members table with search "Search teammates", an orange "**+ Invite teammates**" button, and columns **Member / Role / Credit limit**. The credit-limit dropdown shows "No limit", i.e. per-member credit caps.
- **Referrals**: https://refero.design/pages/94b1cb52-6086-4df7-aca1-ff9a843dfb60. "Earn $20 for each referral" in 3 steps ("Share your invite" → "Your friend creates an account" → "They make their first purchase": "Your team gets $20 in credits and they get $10"). Invite by email, "Copy invite link", "Send invite".
- **Usage**: https://refero.design/pages/92bee7e0-25b2-4e03-b213-04b07c2952cd. Credit usage chart and member usage table.
- **Plans & billing**: https://refero.design/pages/ba8410c6-2d02-4d86-aafa-ea71c87e9391. Current plan "Creator", "Renews Oct 29, 2026", credits remaining, orange "Manage plan". **Add credits** tiles: $10/10k, $20/20k (selected, orange border), $50/50k, Custom/Any amount. "Credits are added to the team and never expire", "Purchase credits". Payment method "Visa ending in 3619", plus Auto top-ups.
- **Agent**, **Integrations** (connect services, API keys), **Advanced** (toggles).
- A bottom-left button "**Manage plan**" sits in the settings sidebar.
- Credits are always **team-scoped**; the unit is "credits" and dollars appear only at purchase. The team switcher (the "Team ⌄" row) dropdown state was not captured in Refero (gap).

---

## 6. Creating a new project (7-screen flow)

Entry points (all open the **same modal**):
1. The sidebar "**+ New project**" button (expanded) or the white "+" rail button (collapsed, with a tooltip).
2. The Projects page header, an orange "**New project**" button (next to a white "New folder").
3. Implicitly, submitting the Home composer, which creates a project from the prompt.

| Step | Screen | State |
|---|---|---|
| 1. Hover "+" | https://refero.design/pages/5bfab967-9233-4af5-b163-75ed51e4ec52 **[viewed]** | Dark tooltip "New project" to the right of the rail button. |
| 2. Modal empty | https://refero.design/pages/63ff9b39-8852-4906-a316-b97857e6574f | Centred modal, about 300×110px, `#2D2620`/`#202020`, 12px radius. Left-aligned title "**New project**". One input with placeholder "**Project name**". Footer: "**Cancel**" (dark outlined, left) and "**Create**" (**burgundy `#833929`, disabled** until there is text). |
| 3. Name typed | https://refero.design/pages/df67dd6b-ddce-45a1-a741-f4159f9c93af **[viewed]** | Value "#12/ss/26". The input border brightens to `#777`. **Create turns orange `#EB522C`** (enabled). |
| 4. Creating | https://refero.design/pages/ecc3733a-7384-4c03-9641-98dc124e682a | Create returns to burgundy with a **spinner icon + "Create"** (in-flight). |
| 5. Lands | (canvas route) | `/projects/{uuid}/canvas/{uuid}`, an empty infinite canvas (covered in the canvas teardown). |
| Library view | https://refero.design/pages/bc88b9d9-d85b-4264-a7b2-75e263555a04 **[viewed]** | `/projects`: title "Projects", buttons [📁+ New folder] (white) and [New project] (orange). Tabs "**All projects** \| Archive" (orange underline). Search "Search by name or owner". View toggle (list icon ⌄). Table **Name / Owner / Last modified ↓** with a thumbnail, rows like "15", "14", "prom", "Playground", "#12/ss/26", "Welcome to Melius", owner "Liam Basil", and dates "today" / "yesterday". |

The flow asks for **only a name**: no template picker, no type, no blank-or-template choice. Templates are a separate entry (section 7) that also creates a project.

---

## 7. Templates library: `/library/templates`

### 7.1 Catalogue
https://refero.design/pages/65f116af-13cb-47b0-b427-b354ce4c6811 **[viewed, full scroll]**
- Header "Templates". A sub-tab "**All templates (30)**" with a count badge and an underline.
- Toolbar:
  - search "**Search templates**" (about 305px wide, magnifier icon);
  - a single bordered **segmented filter group** with counts: **Featured 12 · Lifestyle/Fun 8 · Marketing/Ads 5 · Clothing 2 · Professional 4**. Clicking a filter narrows the results (the search screen shows only the matching filter chips, e.g. "Featured 1 · Professional 2").
- Body: **one section per category**, each with a serif H2 (**Featured, Lifestyle/Fun, Marketing/Ads, Clothing, Professional, More templates**) above a **horizontal carousel row**. About 3 cards are visible plus a clipped 4th, and a round "›" next-arrow sits on the right edge.
- **Card anatomy** (about 185×175px, `#1A1B1B`, 12–14px radius, 1px `#303231` border):
  - a 16:10 preview image with a 10px radius and a **media-type badge** top-left (dark translucent square with an image or video glyph);
  - title (11–12px white);
  - 1–2 lines of description (muted, truncated with an ellipsis);
  - footer: a tiny orange Melius logo plus the author "**Melius**".
- Sample titles and copy:
  - "I Love It – Replace the characters in the 'I Love It' music video"
  - "Hotel Lobby – Replace the two characters performing Hotel Lobby"
  - "Mii Template – Make your video look like the Miiverse"
  - "Vogue Magazine Cover – Add any photo into a Vogue style magazine"
  - "Film Camera – Turn any photo into a vintage film camera shot"
  - "Background Generator"
  - "3D Logo Render – Turn any 2D flat logo into different beautiful 3D renders"
  - "Poster Placement Mockup"
  - "Product 360° Video Generator – Convert pack shots into a rotating 360° video"
  - "Fashion Campaign Video"
  - "Fabric + Texture Analysis"
  - "Picture to Headshot"
  - "High-end Fashion Commercial"
  - "Image Style Analysis"
  - "Product In Hand Ad"
  - "Hand Jewelry Model"
- **Card hover state**: https://refero.design/pages/e03badaa-5f4f-4513-af6c-947a08d55428 **[viewed]**. The card border brightens to a light outline, the image dims, and two buttons overlay the bottom of the image: "**View details**" (dark grey) and "**Try template**" (orange).
- Footer: the **"Request a template"** banner (section 7.4).

### 7.2 Search states
- Results: https://refero.design/pages/e03badaa-5f4f-4513-af6c-947a08d55428 (query "pictu", 2-column results, no section headers) and https://refero.design/pages/1e2d313d-d817-4928-a105-eca6409eb14e.
- **Empty**: https://refero.design/pages/f66553c7-a2e8-40aa-86bd-36a8ce25cbf8 (query "pppp"). A minimal centred grey line "**No templates match your search**" with no illustration. The Request banner stays visible under it, so a failed search turns into a demand signal.

### 7.3 Template detail modal ("View details")
https://refero.design/pages/96d7bcb4-7f55-40bd-9263-97fb8b140353 **[viewed]**
- A large modal (about 610×445px):
  - Header: title "**High-end Fashion Commercial**" (19–21px), description "Create a high-end fashion commercial in a studio scene using pictures of a model and a piece of clothing", and an author row (Melius logo plus "Melius").
  - **Top-right CTA "Try template"** (orange).
- Body in two columns:
  - **INPUTS (2)**: square thumbnails with dark pill labels, "**Model**" and "**Clothing Item**".
  - **OUTPUTS (1)**: a wide 16:9 preview labelled "**Fashion Commercial**".
- Footer: **TAGS** pills ("Featured", "Professional") and **RUN DETAILS** "**Cost per run**" with a coin icon and "**6075**" (credits). The cost is shown before committing, as a credit number with no dollars.

### 7.4 "Request a template" flow
1. Banner: https://refero.design/pages/65f116af-13cb-47b0-b427-b354ce4c6811. A full-width rounded card. On the left, "**Request a template**" (20–22px), "Can't find what you need? Tell us what you're looking for and we'll build it for you!" and a white "**Request a template**" button. On the right, the stripe-gradient art, plus an "×" to dismiss the banner.
2. Modal (empty or typing): https://refero.design/pages/48a8f2fe-b51b-43df-8dce-77bb7cdaceaf. Title "Request a template". Helper "**Describe the outcome you want. We ship the most-requested templates each month.**" A multiline textarea with the example placeholder "e.g. Turn a flat-lay product photo into a six-shot seasonal campaign". Buttons "Cancel" and "**Send request**" (burgundy while empty).
3. Filled: https://refero.design/pages/af00ef2f-7564-4d68-94ee-c689ceb3bec7 **[viewed]**. Text: "A complete skincare product launch workflow: automatically turn 1 product bottle photo into a set of PDP hero images, a 15-sec video with voiceover, and promotional social media assets." "Send request" turns orange.
4. Confirmation: https://refero.design/pages/79cc3d68-81be-48b8-b0ae-98ae506cbeae. A top-centre toast "**Request sent**" with a green check. The page stays on the same view.

### 7.5 First-visit templates walkthrough (a 4-step modal carousel)
These are shown on the first visit to Templates. Each modal is about 330×270px: a preview image on top, a title and body, then **progress dots bottom-left** (the active one is an orange pill), "Back" and an orange "**Continue**" bottom-right, and an × top-right.

| Step | Screen | Title | Body |
|---|---|---|---|
| 1/4 | https://refero.design/pages/673e8f54-dc87-4c02-8f74-ac3a5ec45358 **[viewed]** | **Start with a template** | "A template is a workflow with the models, prompts, and connections done for you" (preview: a mini library screenshot) |
| 2/4 | https://refero.design/pages/af8649c4-3b61-4bd1-8f4d-f71a15db82a6 | **Add inputs and outputs** | "The template tells you exactly what photos or videos it needs." |
| 3/4 | https://refero.design/pages/60688631-bd0c-4dd9-87f2-bc22bad8f29a | **Generate and download asset** | "Hit Generate to run the workflow, then download the result or continue shaping it in canvas." |
| 4/4 | https://refero.design/pages/2d6c4fc0-9e79-4195-9ea6-37aa25f46385 | **Try other templates** | Browse related templates. CTA "**Browse templates**" (orange) and "Back". |

---

## 8. Academy: `/academy`

### 8.1 Hub
https://refero.design/pages/9725d5fa-3a33-4b66-b928-a7875a5983f1 **[viewed, full scroll]**
- **Hero card**: on the left, serif "**Learn with Academy**", "Get familiar with Melius through our tutorials and resources" and a white "**Read docs ↗**" button (external). On the right, a dark canvas animation with typed text "**Create with Melius|**" (a blinking cursor) and floating image tiles.
- **Search + filter**: a full-width "Search" input, then a segmented control **All | Tutorials | Courses | Articles** (All selected in a grey pill).
- **Tutorials** (serif H2, sub "Short walkthroughs to get you up and running on Melius"). 3-column cards with a dark product-screenshot thumbnail, a **duration badge** bottom-right (11:27, 7:08, 7:50) and a presenter avatar bubble bottom-left. Titles:
  - "Melius 101: Crash course – A tour of the fundamentals to get you started"
  - "How Mel agents expedite your workflow"
  - "Templates, tools, and utilities"
- **Courses** ("Step-by-step video courses to help you create anything you want on Melius"). Cards have a stacked-frame "deck" look and a **chapter badge** ("7 chapters", "4 chapters"):
  - "On-model fashion shots"
  - "UGC ads in an afternoon"
  - "A marketing campaign, start to finish"
- **Articles** ("Reference guides and deep dives on how Melius works"). Cards show a photographic banner with **large white overlay text**: Melius cheat sheet · Core concepts · Models overview · Uploads & assets · Nodes · Edges & data flow ("Connecting nodes & data flow") · Agent ("Configure MCP, team-wide context, and reusable skills for Mel").
- **Request card**: "**Can't find what you need?** Request a tutorial or topic and we'll add it to the Academy", with a white "**Request a tutorial**" button and an orange/blue blur art panel. This mirrors the template request pattern.

### 8.2 Tutorial detail: `/academy/templates-tools-and-utilities`
https://refero.design/pages/c27ed43b-4dc1-479e-ad08-6251322eb170 **[viewed]**
- Breadcrumb "Academy › Templates, tools, and utilities".
- Embedded **YouTube** player in a 12–14px rounded frame: a red play button, "Watch on YouTube", a presenter bubble and a link icon.
- Serif H1, then 3 paragraphs of copy that name the tools: Custom Text, Studio Mode, stitch video clips, Magic Resize, inpainting, background removal, upscaling, outpainting, cropping.
- Right **"Tutorial details" card**: Duration 7:50, "Tools used" pills **Templates · Magic resize · Upscale**.
- "**Related content**": 3 cards (a tutorial, a course and an article, mixed types).

---

## 9. Gaps (not found in Refero)

These were searched for and not found:
- the team-switcher dropdown when open;
- the team name and photo onboarding step (implied by the "Team photo updated" toast);
- the Individual-path variant after Q1;
- the intermediate canvas tour steps (out of scope);
- the marketing-site login button;
- any notifications surface or global search; neither is present in the shell.

---

## Key UX patterns worth matching

- **Guest-browsable app with auth as a modal.** Logged-out users see the real app shell, with "Sign up" in the nav and a "Sign up for free" CTA. `/login` and `/signup` are overlays, so users judge the product before committing.
- **The auth modal doubles as a showcase.** The right half is an auto-advancing reel of generated clips. Each clip is captioned in serif with its own prompt, and a story-style progress bar runs underneath.
- **Passwordless only**: Google first, then an email one-time code (6 digits). "Resend code" and "Use a different email" are always visible, errors appear inline, and Turnstile only shows up when needed and says "Success!".
- **The loading/disabled state is a darker shade of the brand colour.** Burgundy `#833929`/`#A94B32` with a spinner and a verb in progress ("Sending code…", "Verifying…", "Create"). Primary buttons stay disabled until the input is valid.
- **Onboarding is three or four one-click questions** on full black with a glowing pixel display font. There is no chrome, no Next button and no progress bar, so it feels fast and memorable. It covers Individual/Team, role (Founder/Marketing/Brand/Creative director/Other) and attribution (X/LinkedIn/A friend/Other).
- **The team invite step** uses an email chip input, an inline role dropdown (Admin/Editor/Viewer) with a hover tooltip explaining each permission, and an easy "I'll do this later" skip.
- **First-run tour on a seeded project** ("Welcome to Melius"), led by the named agent "Mel". The hook is "First generation, on us", and it ends with "Now you're ready" plus "Start creating" and "Restart tour". New users never see an empty Home.
- **Home is a prompt composer first.** Its serif question is "What will you create today?" and the composer carries thumbnail suggestion chips, an attach control, a model chip and an ↑ submit. Below it: a dismissible feature banner, "Recently viewed" mosaic cards built from project outputs, a Discover bento that merchandises new models and the MCP integration ("Try it" / "Connect"), and a Playground mosaic.
- **A two-state sidebar.** Expanded, it shows grouped labelled nav (Create / Library / Learn) with a "New" badge. Collapsed, it shows one icon per group, a white "+" with a tooltip and the team avatar. Settings ⚙ and Help ? sit in the bottom corners. The top bar is bare except for the page title.
- **One "New project" modal everywhere**: name only, Cancel / Create. Creation is instant and lands on the canvas. The Projects table has New folder, All/Archive tabs, search by name or owner, and sort by last modified.
- **Credits stay out of the shell but are explicit at decision points.** "Cost per run 6075" is shown on the template detail. Plans & billing has add-credit tiles ($10/10k … Custom), "credits never expire" and auto top-ups. Members get per-person credit limits. Plans are expressed in credits/mo with an "≈ N images/videos" translation.
- **Template system**:
  - filter chips with counts;
  - serif section headers, each above its own horizontal carousel row;
  - cards with a media-type badge and author;
  - hover reveals "View details" and "Try template";
  - the detail modal shows **INPUTS (n) → OUTPUTS (n)** with labelled example assets, tags and the run cost;
  - a 4-step first-visit explainer: Start with a template → Add inputs and outputs → Generate and download → Try other templates.
- **"Request a …" banners turn dead ends into demand capture.** They appear on the Templates library (persistent and on empty search) and in the Academy ("Request a tutorial"). Each is a modal plus a "Request sent" toast, with the promise "We ship the most-requested templates each month."
- **The Academy works as an in-app learning hub.** Tutorials show durations, courses show chapter counts and articles carry big overlay titles. Search plus a type filter covers all three. Detail pages pair a YouTube embed with a "Tutorial details" card (duration, tools used) and Related content.
- **Feedback and docs live behind the "?" icon.** A Documentation / Share feedback popover leads to a feedback modal and a "Feedback submitted" toast.
- **Settings is one modal with a sidebar**: Account & team, Referrals ("Earn $20 for each referral"), Usage, Plans & billing, Agent, Integrations, Advanced. It never navigates away from the current page.
- **The visual system pairs serif headings with grotesk UI**:
  - Instrument Serif headings over a compact grotesk UI;
  - near-black surfaces with 1px hairlines;
  - one orange-red action colour, and white buttons for secondary CTAs;
  - dotted-grid texture that links the shell to the canvas;
  - colour lives in photographic content, not in the chrome.
