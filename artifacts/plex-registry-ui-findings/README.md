# Plex Registry — UI findings asset pack

This pack records the visual direction selected for the CaastorOS rebrand and the gap found during prototype review.

## The finding

The first implementation was a token recolor of the existing app and surfaced the wrong route (`Specialists`). The approved visual is a Canvas workspace: persistent rail, workspace header, graph canvas, right inspector, and bottom asset library. The implementation now exposes that composition at:

`http://127.0.0.1:5173/#/canvas/prototype`

The original `#/canvas` route still preserves run/view context so existing production flows are not discarded.

## Included

- `assets/plex-registry-palette.svg` — color roles and contrast intent.
- `assets/plex-registry-type.svg` — IBM Plex Sans / Serif / Mono roles.
- `assets/canvas-grammar.svg` — the five-zone Canvas anatomy.
- `reference/approved-agents-direction.png` — the approved Plex Registry visual reference.
- `tokens.json` — implementation-ready semantic tokens.
- `DESIGN.md` — durable product rules copied from the repository root.

## What to replace with real product assets

The prototype uses the existing Brandolph logo/profile image and CSS-native thumbnails for the sample asset rail. Replace those thumbnails with real brief outputs when the asset service is connected; the layout and interaction contract should remain unchanged.
