# Optional Brand OS pixel-art pack

No new artwork is required for the current prototype. It uses Pixel Agents' bundled sprites and renderer. These prompts are for making Brand OS visually distinctive later.

## Shared visual direction

Use a top-down three-quarter view matching the existing sprites. The renderer uses a 16×16 world tile, crisp pixel edges, nearest-neighbor scaling, and PNG transparency. Avoid isometric angles, perspective grids, antialiasing, soft shadows, gradients, baked backgrounds, or text embedded in sprites.

Generate visual concepts first. A generated sprite sheet still needs inspection and pixel cleanup: frame alignment, exact cells, transparency, and animation continuity are not guaranteed by a prompt. Keep character proportions and camera angle identical across the pack.

## Prompt 1 — Brandolph concept

> Design an original pixel-art agency director called Brandolph for a top-down office simulation. Calm, approachable, slightly eccentric creative director; warm amber jacket, charcoal trousers, a small notebook, distinctive dark hair and glasses. Match the proportions of a 16-pixel-wide, 32-pixel-high character. Three-quarter top-down camera, facing down toward the viewer. Compact silhouette, readable at native size, restrained palette, intentional single-pixel details. Transparent background, no scenery, no text, no outlines around the image, no smoothing. Provide a clean standing character concept, not a full illustration.

## Prompt 2 — Specialist concepts

> Create six original pixel-art agency teammates in one consistent style: strategist with a notebook; concept designer with a rust-colored shirt; copywriter with a blue cardigan; visual designer with a coral overshirt; web designer with a sage hoodie; quality reviewer with a cream shirt and glasses. Diverse skin tones, hairstyles, ages, and genders. Each character should remain recognizable in a 16×32 pixel cell. Top-down three-quarter camera, all facing down, equal scale and shared baseline. Transparent background, crisp pixel edges, no scenery, no text, no antialiasing. Keep accessories small enough to stay inside the character cell.

## Production character contract

Each character is a separate **112×96 PNG**, consisting of **7 columns × 3 rows**, with **16×32 pixels per cell**. No gaps or padding between cells.

| Row | Facing direction |
| --- | --- |
| 1 | Down |
| 2 | Up |
| 3 | Right; the renderer mirrors this for left |

| Columns | Animation |
| --- | --- |
| 1–3 | Walk frames |
| 4–5 | Seated typing frames |
| 6–7 | Reading frames |

Every frame has the same anchor and body proportions. Match the existing pack's seated poses before replacing it. Default filenames are `char_0.png` through `char_5.png`; the current loader discovers those names through `index.json`.

Follow-up sheet prompt after a character is approved:

> Turn the approved character into a production sprite sheet. Exact 112×96 transparent PNG, 7 columns and 3 rows, each cell exactly 16×32 pixels, no gutters. Row 1 faces down, row 2 faces up, row 3 faces right. In every row: columns 1–3 are a three-frame walk cycle; columns 4–5 are seated typing; columns 6–7 are reading. Preserve the approved appearance, baseline, scale, and pixel style in every cell. No labels, guides, background, smoothing, or extra frames.

## Prompt 3 — Furniture concepts

> Design an original modular pixel-art furniture pack for a warm creative agency. Top-down three-quarter view matching 16×16 floor tiles. Include a wooden desk, office chair, computer monitor, sofa, coffee table, bookshelf, whiteboard, floor plant, wall poster, and coffee cup. Natural wood, muted green, warm cream, amber accents. Each item isolated on transparency. Crisp pixels and consistent lighting from upper left. No people, floor, shadows extending beyond the asset cell, text, isometric camera, or antialiasing. Show each item separately so it can be exported as a sprite.

Use approved concepts to produce separate PNGs with these initial sizes:

| Asset | PNG dimensions | World footprint |
| --- | --- | --- |
| Front desk | 48×32 | 3×2 tiles |
| Cushioned bench / single seat | 16×16 | 1×1 tile |
| Front monitor | 16×32 | 1×2 tiles; place on desk |
| Front sofa | 32×16 | 2×1 tiles |
| Coffee table | 32×32 | 2×2 tiles |
| Small floor plant | 16×32 | 1×2 tiles |
| Large floor plant | 32×48 | 2×3 tiles |
| Painting / whiteboard | 32×32 | 2×2 tiles; wall placement |
| Coffee cup | 16×16 | 1×1 tile; place on surface |

Footprints, rotations, surface placement, and background rows belong in the furniture manifest, not in the image. New items need catalog entries; a furniture PNG alone does not define collision or seating behavior.

## Prompt 4 — Floor patterns

> Create a seamless pixel-art floor tile for a top-down agency office: [oak boards / subtle carpet / polished concrete]. Exact 16×16 pixels, grayscale pattern so the application can recolor it. Small readable texture, consistent lighting, no perspective, no shadows, no objects, no border. Opposite edges must tile seamlessly. Crisp pixels, no smoothing.

Walls use a **64×128 PNG** with sixteen **16×32** cells in a 4×4 grid, indexed by neighbor bitmask. This is best assembled from approved wall pieces with a pixel-art tool rather than generated as an unchecked full sheet. Keep the bundled wall pack until its replacement is tested against every adjacency.

## What to provide if commissioning original art

Start with one approved Brandolph concept and one desk/monitor/chair set. We can test them at native size before commissioning the full crew. Deliver PNGs with transparency and source files if available. Confirm ownership or redistribution rights for new packs before distributing them to users.

The prototype does not yet include uploading arbitrary asset packs. It already supports choosing among six bundled characters, changing floor colors, switching office presets, and placing/moving/rotating furniture. Additional pack ingestion can follow once the art direction is approved.
