# Supplied office generation integration

The agency view now uses the supplied `Brand-OS-Pixel-Assets-Fixed.zip`, replacing its former furnished studio image. The empty room shell is `ENV-01-empty-studio.png`; desks, chairs, laptops, lamps, notebooks, mugs, frames, abstract art, cabinets, plants, lounge furniture, bookshelf and coffee equipment are independently rendered PNG objects.

45 non-character sources are copied unchanged to `public/agency-office/generated`. The new seven-character cast remains in `public/agency-office/characters`. Source padding is handled by CSS view bounds recorded in `src/lib/agency-office-assets.json`; no source pixel files were modified. This trims rectangular excess padding, not all semi-transparent fringes.

`src/generated-agency-scene.jsx` assembles the furnishings. `src/lib/generated-office-layout.js` contains ground anchors and side-room doorway routes. Four workstation desks can switch between the supplied oak and cream variants, and artwork can be hidden/restored independently. The Customize office panel provides a 24-item catalog, direct dragging, keyboard movement, resizing, removal, undo, and default restoration. Surface props follow their parent furniture. Layouts save to browser localStorage by brand ID in the full product and to a separate preview scope in the standalone demo. They survive route changes and reloads; cloud synchronization is not implemented.

Both live runs and saved briefs render this same component with real project nodes and existing output/brief click handlers. The agency office is the default workspace surface. Canvas remains accessible. The legacy Pixel layout editor is available only in the interactive preview, keeping its distinct assets out of the full-product interface.

The shell supplies permanent walls/windows and the six side rooms. Construction modules and additional orientations are available in the source registry but are not all placed simultaneously. Seated/typing animation and uniform native pixel cleanup remain outstanding.

Validation: 28 office tests pass; production build passes with its existing large-chunk warning. In the interactive browser preview, all 75 scene images load, desk swapping and artwork toggling work, and the simulated coffee project completes with six specialists and three outputs. No provider calls or credits are used by this test.

## Full-product localhost verification

Tested on 2026-10-08 in the signed-in Chrome session at `http://127.0.0.1:5173/#/canvas`, using Geoking’s saved “Saudi Arabia, now on the map” brief. The office rendered eight specialist runs and seven output cards, including an existing review flag. Added a snake plant, moved it, reloaded the product, and verified the same prop ID and position survived. Opened the actual Social Captions deliverable from the office output shelf. Removed the temporary test prop and left Customize office open. No new AI run was launched for this verification. The localhost API health check passed. Screenshot: `artifacts/agency-office/full-product-office-localhost.png`.
