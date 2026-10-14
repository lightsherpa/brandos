# Brand OS original office — asset production plan

Reference inspected: ReScienceLab/star-office-world, commit a1d8854c4ba01f52439aae875923a395ea1d498e (2026-10-08).
Reference only: its frontend artwork is explicitly excluded from MIT and restricted to learning/demo use. No reference art will be shipped. The current prototype remains unchanged.

## Art direction

An original creative agency studio: warm oak, cream plaster, ink-blue joinery, amber task lights, sage plants, muted coral accents. Large windows, a project wall, and welcoming furniture. Quiet floor textures; detail concentrated around useful objects. Character silhouettes and workstation tools distinguish roles. No borrowed mascots, television posters, branded props, or trace-over compositions.

Use an orthographic three-quarter top-down camera, matching the current office engine's camera convention. Avoid isometric diamonds. Compose a recognizable agency rather than a generic computer room. Keep UI text, task details, and real output previews as live interface elements, never baked into artwork.

## Visual and technical decision

Create concepts first at presentation resolution. After choosing a direction, clean and export production pixel assets on a proposed 32×32 world grid, with characters in 32×64 cells. This doubles the current pack's logical resolution and supports larger, more expressive silhouettes. Treat this as a proposed target to validate with one character/workstation at actual browser display size.

The current Pixel Agents extraction assumes 16×16 tiles and 16×32 character cells. New 32px assets are NOT drop-in replacements: rendering, catalog loading, character frame extraction, wall composition, selection, and collision coordinates need an adapter or consistent coordinate scaling. Do not resize the files and call them integrated. Keep the existing prototype working until the vertical slice is verified.

Static production sprites: transparent PNG, no matte, no antialiasing; integer-scale display. Ground-contact anchor recorded separately from image size. Walls can extend above their collision footprint. Furniture requires footprint, anchor, placement rules, depth, variants, and seat/surface anchors in a manifest. Workstation parts should move as a group when appropriate.

Room shell and furniture must remain separate. An attractive flattened concept image can guide composition but cannot serve as the editable production room.

## Asset inventory

Counts below are initial designs, excluding animation frames, directional variants, and palette variants. Alternatives can reuse the same geometry after the first studio is approved.

| IDs | Asset | Initial count | Purpose |
| --- | --- | ---: | --- |
| ENV-01 | Room composition concept | 1 | Validate camera, scale, palette, zones, and visual density; reference only |
| ENV-02..04 | Seamless oak, plain carpet, concrete floors | 3 | Customizable floor surfaces |
| ENV-05 | Modular wall family: straight pieces, ends, corners, junctions | 1 family | Rearrangeable rooms; final variant count follows adjacency rules |
| ENV-06..07 | Large window, doorway | 2 | Establish room structure |
| ENV-08..09 | Rug, low divider | 2 | Visually organize departments |
| CHAR-01 | Brandolph | 1 | Recognizable orchestrator; warm amber accent, distinctive silhouette |
| CHAR-02..07 | Strategy, concept, copy, visual, web, review characters | 6 | A reusable role cast; names/agent IDs come from Brand OS |
| CHAR-08 | Character palette/wardrobe variant specification | 1 specification | Personalization without regenerating every agent |
| WORK-01..02 | Modular desk, office chair | 2 | Common workstation foundation |
| WORK-03..05 | Monitor, laptop, pen tablet | 3 | Role-specific workstation cues |
| WORK-06..08 | Notebook, research folders, reference pinboard | 3 | Strategy/copy/concept cues |
| WORK-09 | Brandolph briefing table | 1 | Open project plan and next decision |
| WORK-10 | Review counter | 1 | Open drafts requiring user approval |
| WORK-11 | Output display/gallery frame | 1 | Show actual campaign thumbnails/documents via live content overlay |
| WORK-12 | Small collaboration table | 1 | Indicate real task handoffs/dependencies where available |
| DECOR-01..03 | Sofa, coffee table, bookshelf | 3 | Warm, coherent studio furnishing |
| DECOR-04..06 | Floor plant, shelf plant, task lamp | 3 | Personality and depth |
| DECOR-07..09 | Coffee station, mug, original abstract wall print | 3 | Optional decoration |
| UI-01..06 | Queued, working, reviewing, needs input, complete, failed icons | 6 | Truthful state; accessible text remains in conventional UI |
| UI-07..09 | Hover highlight, selection highlight, attention marker | 3 | Discoverable interactions |
| UI-10 | Handoff indicator | 1 | Only animate on actual assignment/transition events |

Both QA agents can share the review role silhouette initially with different palettes/accessories. The seven-character cast does not cap the number of agents: persistent agent IDs map to appearances, and multiple agents can use variants.

## Animation inventory

For every production character: neutral standing pose; 3-frame walk in down/up/right directions (left mirrored); 2-frame typing; 2-frame reading/review. Match the existing action vocabulary for the first integration. Brandolph adds a small briefing gesture after the base sheet works. Do not generate all animation sheets before one is integrated.

A compatible proposed sheet is 224×192 PNG: 7 columns × 3 rows, each 32×64; down/up/right rows; walk columns 1–3, typing 4–5, reading 6–7. Seated pose anchors must be matched to the chair/desk. Direction-specific clipping and accessories need inspection. Only enable left mirroring where it preserves the design.

Object animation: monitor working loop (2–3 frames); restrained needs-attention pulse; brief completion cue; optional coffee steam (3 frames, later). No permanent confetti, constant decorative motion, or invented conversations. A person walking across the room must not delay backend execution or imply unavailable progress telemetry.

## Generation batches and acceptance gates

1. **Direction board:** three original variants of the same room brief: warm creative studio, bright modern agency, cozy loft. Include one Brandolph concept and one workstation in each. Pick a coherent direction, not individual assets from incompatible styles.
2. **Vertical slice:** selected room composition + Brandolph concept + desk/chair/monitor + floor/wall/window + review/gallery frame. Export cleaned production pieces and one complete Brandolph sheet. Integrate to verify readability, anchors, occlusion, click targets, and real task state.
3. **Crew:** generate the six specialist concepts using the approved Brandolph/workstation as style references. Then produce and clean sheets one at a time. Preview every direction and seated pose.
4. **Modular studio pack:** remaining structure, role tools, decor, status markers. Build one furnished preset; demonstrate rearrangement and saving.
5. **Customization packs:** palette/wardrobe variants, then Modern Agency and Cozy Loft furniture/material variants. Keep workflow affordances consistent.

For every asset inspect native-size readability, palette consistency, clean alpha, grid alignment, looping seams, and ground-contact anchor. For every scene inspect status clarity, actual deliverable visibility, mobile access, and reduced motion. Generated sheets need manual pixel cleanup and alignment; image generation alone does not produce guaranteed valid game assets.

## First generation prompt — direction board

Create an original pixel-art visual development board for Brand OS, an AI creative agency office. Present three clearly separated alternatives with the same functional layout: (A) warm creative studio, oak and cream with ink-blue furniture and amber light; (B) bright modern agency, pale concrete, glass, clean muted accents; (C) cozy loft, warm brick, plants, soft lighting. Orthographic three-quarter top-down view, no isometric diamond floor. Each room includes an orchestrator briefing desk, a few specialist workstations, a review counter, and an empty campaign display frame. Include a small original human creative-director character wearing an amber jacket, with a distinctive readable silhouette. Restrained intentional pixel detail, consistent pixel scale, no photorealism, no soft gradients, no borrowed characters or brand logos, no readable text. Prioritize a welcoming useful workplace, generous circulation space, quiet floor textures, larger characters and furniture. This is a concept board, not a sprite sheet or final editable background.

## First production concept prompts

### Brandolph

Create an original human pixel-art creative agency director for Brand OS. Calm, approachable, confident; amber jacket, ink-blue trousers, notebook tucked under one arm, distinctive dark hair and glasses. Orthographic three-quarter top-down camera, facing down. Designed to remain legible in a 32×64 pixel cell, consistent intentional pixel clusters, no antialiasing. Transparent background, isolated character, neutral standing pose, no scenery, no text. Match the approved Brand OS studio direction board. Concept only; no animation sheet yet.

### Workstation

Create a modular original pixel-art creative agency workstation matching the approved Brand OS style board. Show a wooden desk, office chair, monitor, and small task lamp separately on transparency, at a consistent scale and orthographic three-quarter top-down angle. Quiet oak surfaces, ink-blue hardware, warm amber light accents, crisp intentional pixels. No characters, baked floor, text, logos, or soft edges. Desk must plausibly fit a seated character designed for a 32×64 cell. Concept asset collection; final footprints and pixel dimensions will be assigned during production cleanup.

### Room composition

Create a furnished original Brand OS creative agency studio concept matching the approved direction board. Briefing area near the entry; specialist workstations around a shared project wall; distinct review counter and output gallery with blank display surfaces. Welcoming oak/cream/ink-blue palette, generous walkways, large windows, plants, restrained detail, orthographic three-quarter top-down view. No people, no logos, no readable text, no borrowed posters or recognizable reference-room layout. Include convincing depth and furniture occlusion while keeping interactive objects easy to identify. This is composition reference only; all movable furnishings will be exported separately later.

## Product integration

Map the room to the existing Brand OS agent IDs, task states, and output IDs. Decor is independent of execution. Actual outputs populate gallery surfaces; review markers link to existing approval/edit controls. Clicking Brandolph opens the real brief/plan. Keep roster, task details, and output controls keyboard-accessible. Room zones must not imply that agents have changed execution roles.

Next generation action: generate the three-direction concept board. No source art was imported, and no new original art has been generated yet.

## Creative-office photo direction — October 8

The user supplied five real creative-office photos. These supersede the domestic reference-room details. Translate: oak floors/storage; charcoal sofas; orange ergonomic chairs; banks of desks and monitors; cream/concrete walls; black steel glass partitions; planter dividers; daylight windows; restrained red/amber lighting. Remove beds, franchise posters, decorative server racks, and pets from the agency concept.

Functional plan: left briefing room; central production studio with strategist/creative lead/copywriter/designer workstations; upper-right QA room with two computer desks; lower-right delivery gallery/presentation room. Connect zones through a broad corridor. Character movement represents simulated handoff events and never blocks actual task execution.

Generation asset: `artifacts/agency-office/creative-studio-v1.png` (original raster background, built-in imagegen). This is the furnished composition test; furniture is baked in and not yet editable. Future modular assets will replace flattened furnishings.

Prompt summary: Original wide 16:9 crisp pixel-art boutique agency, orthographic three-quarter top-down rectangular cutaway; photographed materials as reference only. Left oak briefing table/charcoal sofa, central four computer desks, right two glass-partitioned rooms for QA and delivery, unobstructed lower circulation corridor. Light oak/cream/concrete, black steel, sage plants, burnt orange chairs, amber lights and muted red accents. No people, bed, branded posters, cats, server racks, text, logos or UI. Separate characters and live task labels added by the demo.
