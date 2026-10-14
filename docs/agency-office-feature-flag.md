# Agency office branch

Based on `origin/dev` at `6d04d01b5f42bcbe49273a005c14c399f43284b9`.

## Enable locally

`AGENCY_OFFICE=1 npm run dev` enables the live-run and saved-brief office and `/office-preview.html`. `AGENCY_OFFICE=true` also enables it. Any other value, including an unset value, is off. Restart Vite after changing the value. This is a build-time flag: use `AGENCY_OFFICE=1 npm run build` for an enabled build.

With the flag off, both views render dev's `InteractiveCanvas` with the original props, handlers, helpers and toolbar. Office styles, assets and storage hooks are not loaded. Dev's newer prototype/empty canvas, task pipeline, foundation checks, and certifier S1/S2 are retained. No server, schema, API or data changes are made.

With the flag on, switch between agency and canvas without restarting runs. The agency includes 24 prop types, drag/keyboard movement, furniture resizing, removal, undo, surface-aware accessories and per-brand browser persistence. The supplied art and seven role identities are retained; the designer uses the black-haired v2 avatar. The standalone preview also includes the legacy pixel editor and its upstream MIT license.

Asset hashes preserve the supplied modular pack's provenance without requiring the duplicate raw extraction directory in the checkout. Generation prompts and reference documentation are in `docs/agency-generation-kit/`.

## Validation

- `npm run test:units`: 687 passing tests, no failures or skips.
- `npm run test:office`: 31 passing tests.
- Production build checked with the flag off and on.
- Flag-off render tests cover the live-run and saved-brief delegate, matching legacy markup and original props, and reject loading the office module.

## Unfinished

- Sitting/typing sprites and corresponding animation.
- A fresh end-to-end AI run on the updated dev baseline (the prior localhost test opened an existing Geoking brief).
- Cross-browser/cloud layout synchronization; persistence is browser-only.
- Walls/room construction editing and richer collision/path planning; the current shell is fixed.
