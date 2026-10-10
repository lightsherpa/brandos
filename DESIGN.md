# CaastorOS design system

The user-confirmed current platform is `http://localhost:5189/` (BIO at `#/bio`), served by `../caastoros-mvp-review-d969b6` at revision `334029e`. This worktree previously used the older `6fafe38` visual baseline; that assumption was explicitly rejected on 4 October 2026.

## Authority and layers

Current source: `public/caastor/plex-registry.css`, source `ds-tokens.css`, shell defaults and `artifacts/plex-registry-ui-findings/DESIGN.md`. Load `ds-tokens.css`, `portal.css`, `caastor-tokens.css`, then `plex-registry.css`. The skin is copied from the current platform with a marked integration bridge for this persisted canvas and existing theme toggle. Both app and mockup entry points select `plex-registry`/`plex`; stale yellow/purple/Inter defaults migrate as in the source platform.

Plex Registry uses mineral paper `#F7F8F6`, white surfaces, graphite `#15191F`, cobalt actions `#2457D6`, and signal green `#1D9A63`. Typography is IBM Plex Sans for UI, IBM Plex Serif for names/headings, and IBM Plex Mono for provenance/credits. Controls and artifacts have 4px corners with thin graphite rules. Arabic retains the self-hosted Plex fallback. Light mode is the current reference; the dark companion preserves this integration's existing toggle and is not claimed to be a separately approved source design.

The canvas remains an Operate surface built around certified BIO, specialist work and review. Preserve graph/run/approval flows; visual alignment does not authorize feature changes. Provider identities and dollar costs remain in internal operations; client execution shows credits.

## Tokens

| Role | Tokens | Rules |
| --- | --- | --- |
| Product surfaces | --bg-app, --bg-canvas, --bg-elevated, --bg-muted | Paired light/dark values; never introduce a separate feature palette. |
| Text | --text-primary, --text-secondary, --text-on-brand | Secondary readable content uses secondary, not disabled/faint text. |
| Border/focus | --border-default, --border-focus | Focus uses a visible 2px outline with offset. |
| Actions | --brand, --accent | Cobalt identifies actions/selection; signal green identifies successful/live status. |
| Desk/artifacts | --canvas-desk, --canvas-grid, --canvas-wire, --canvas-artifact* | Mineral desk and white artifacts follow the current reference; dark companions follow theme. |
| Spacing | --space-1 through --space-15 | Existing 2/4/8/12/16/20/24/32px steps cover common controls. |
| Shape | --radius-xs/sm/lg | 4px controls, inputs, artifacts and dialogs. |
| Metrics | --control-height, --touch-target, --focus-width, --panel-width, --reading-measure | 36px desktop controls; at least 44px touch targets; 70ch prose measure. |
| Motion | --dur-fast, --ease-out | Short state transitions. Compatibility spring token now resolves to smooth deceleration. Reduced motion preserves immediate state feedback. |

Do not restore legacy Inter, Instrument Serif, Geist Mono, yellow or purple defaults. The previous detector exception reflected the superseded baseline.

## Shared components

src/design-system/primitives.jsx supplies:
- ActionButton: existing primary/ghost button variants, className and native button props. Native disabled and focus behavior; type defaults to button.
- IconButton: icon and required accessible label, native button props.
- Dialog: label, onClose, children, compact/wide, optional restoreFocusTo element. Portal, background inert state, Tab trap, Escape dismissal and deferred focus restoration after portal removal.
- PanelHeader: title and onClose, labelled dismiss control.

Fields reuse the ds-field pattern and native labelled inputs/selects/textareas. EmailPreview and media derivatives consume shared action controls. Canvas uses the shared dialog, header and icon controls; task-specific node, inspector and version patterns remain in src/canvas.

## Component states and verification

Reviewable reference: /docs/mockups/design-system/index.html on the local Vite server. Includes semantic surfaces, primary/secondary/disabled/focus controls, editable and locked fields, approval dialog, and an artifact with provenance. Theme switch verifies paired values. Use keyboard activation to test focus trap/return; pointer activation also restores the supplied trigger.

Dialogs never treat approval as implied by adding nodes. Nodes expose run/history/review distinctly. Errors explain recovery; save conflicts preserve downloadable local edits. Media “reconcile” indicates uncertainty and never offers blind resubmission.

Browser checks cover 390/768/1440 widths, light/dark, reduced motion and Chromium/WebKit. RTL canvas snapshots are in the editor check. This is targeted product verification, not a claim that every legacy screen meets WCAG AA.

Status captions use paired `--text-danger` and `--text-warning` foregrounds. Vivid `--status-*` fills remain for icons and ports; they are not small-text colors on white artifacts.

## Current verification limit

The provided BIO URL opens at sign-in in the agent browser. Source discovery used the actual listener process on port 5189, not a guessed branch. Current CSS/font/palette/corner values, desktop inspector and reference dialog/theme rendering were checked in the updated local preview. A 390px inspector and approval dialog check also passes: no horizontal overflow, 44px controls, 366px dialog and focus restoration to the run trigger after Deny. Direct authenticated BIO visual parity and broad both-engine/locale regression evidence for the new skin remain pending; previous browser reports establish the earlier functional baseline only.

## Typography constraint — user instruction

Inter typography is prohibited throughout this implementation. Only IBM Plex Sans, Serif and Mono are offered; the self-hosted Plex Arabic face remains. Legacy Inter, Geist and Instrument preset definitions, settings options and mockup font requests are removed. Stored preferences normalize to Plex on boot. Keep the actual Plex Registry composition and restrained materials: functional graph grid, graphite rules, small corners and clear text hierarchy. Avoid decorative gradients, glass effects, stock imagery, fake metrics and unrelated display styling.
