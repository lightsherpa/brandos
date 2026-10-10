# CaastorOS canvas implementation plan

Date: 4 October 2026. Status: functionality implemented locally behind a workspace flag; visual design alignment reopened following user rejection of the reference. See `2026-10-04-canvas-v2-implementation.md` for validation, activation and remaining rollout gates.

Build an editable, persistent canvas around certified BIO, specialist outputs and review. Use Melius for interaction requirements and the current CaastorOS design system for the interface. The handoff mockup is a behavior reference, not a production visual specification.

## Visual baseline correction — 4 October 2026

The previous reference assumed the token files at `6fafe38` represented the current platform. The user explicitly rejected that assumption. The corrected source is the user-provided `http://localhost:5189/#/bio`, served by `caastoros-mvp-review-d969b6` at `334029e`. Its Plex Registry skin, IBM Plex fonts, 4px geometry and shell defaults now load in the integration checkout. Source hashes are in `docs/2026-10-04-design-alignment-source.json`. The implementation plan must now start with rendered comparison against the user-confirmed current platform: shell/navigation, typography, surfaces, spacing, forms, buttons, panels and dialogs. Record URL/checkout/revision, reuse its actual components, then review the canvas inside that shell at desktop and mobile sizes. Preserve the existing backend and interaction contracts while replacing only the mismatched presentation. Do not declare design parity from automated interaction or contrast checks.

## Previously inspected local baseline

Inspected the handoff, mockup source, current application at `6fafe38`, token files, shell defaults, canvas implementations, run route, credit functions and Brandolph route. This is a source audit, not a rendered visual review or verification of deployed database state.

- App and reference entry points now select `plex-registry` and `plex`, matching port 5189. Shell preferences migrate stale legacy defaults. Cobalt actions use white text; the graph uses mineral paper, white artifacts and graphite rules.
- Styles load `ds-tokens.css`, then `portal.css`, then the legacy alias bridge `caastor-tokens.css`. Append `plex-registry.css` after that bridge, matching the current platform. New components should consume semantic tokens directly.
- The August dark-desk direction is superseded by the user-confirmed Plex Registry reference. The source saved design describes the persistent rail, workspace header, graph, right inspector and asset region. Existing graph/review behavior stays intact; additional asset-library features require their own agreed scope.
- `BriefBoard` already has local add/connect behavior and canned Brandolph replies. The missing capability is a production, persistent editor integrated with real runs. Do not promote its canned replies into the new canvas.
- The run route currently loads prior outputs across a brief, excluding the current specialist. Drawing an edge will not automatically change this behavior. Explicit upstream input resolution is required.
- Grouping variations by `(brief_id, specialist_id)` merges two copies of the same specialist. Each placed node needs its own stable identity.
- `/api/brandolph/ask` streams Q&A; it does not expose graph-editing tools. Agent node creation requires a structured, validated proposal contract.
- Credit estimation includes deliverable count/platforms and a route multiplier applied in the run route. A specialist-only estimate cannot quote every run accurately.
- Browser fetch abort is not confirmed provider cancellation. The UI must distinguish loss of connection from stopped work.

## Visual contract

Keep the existing Inter Tight UI, Instrument Serif for the brief title/tension only, and the mono token for compact numerical metadata. Verify the actual mono font loading: the token names Geist Mono, while the main Google font import currently includes Geist and IBM Plex Mono. Retain Arabic fallback typography.

Use existing `Icon`, `Credit`, buttons and Brandolph mascot. Do not swap fonts or icon libraries to satisfy generic design advice. Preserve the workspace switcher and palette settings.

| Surface | Implementation rule |
| --- | --- |
| Desk | Dedicated semantic desk/grid tokens; quiet dark field, subtle stationary dots. Add these centrally because the proposed desk tokens are not present in the inspected CSS. |
| Nodes | 12px radius from `--radius-lg`, restrained border, typed content preview. A node is an artifact, so its visual weight comes from its content. |
| Chrome | Existing theme-aware surfaces, text and border tokens. Header targets 44px at desktop but may grow for localization and zoom. |
| Color | Brand yellow for primary action and selection; existing purple for Brandolph context. Department/port colors are small semantic markers paired with labels. Status uses status tokens. |
| Typography | 14px body, 12–13px controls/metadata where legible. Sentence case; mono only where it aids scanning. Avoid uppercase badge stacks. |
| Motion | Existing 150/220ms tokens for panel/menu transitions. Pointer dragging tracks immediately. Reduced-motion support; no animated edge streams or ambient glow. |

Define paired artifact background/foreground tokens for both themes. The preferred light-mode composition is dark desk with light frames; dark-mode frames must remain readable with an explicit token pairing, not inherited dark text on a forced white card.

Node hierarchy: title and status, substantial output preview, then a quiet footer with BIO provenance, version and Run. Show ports and secondary actions on selection/focus. Put detailed QA, settings and provenance in the inspector. Omit unsupported settings rather than showing inert Tools, Share, microphone, comments or resolution controls.

Keep a single inspector as the detailed settings surface. The contextual bar, if needed, contains quick actions only. Avoid repeating the full tier/settings form above the node and in the inspector.

Brandolph opens in a collapsible side panel. At 1280px, avoid simultaneous wide chat and inspector panels consuming the desk; opening the second switches the active side panel while retaining its state. Wider layouts may show both if the working area remains useful. On smaller screens provide a usable output/review list and progressive panels; do not compress the desktop editor into tiny targets.

Review uses a neutral viewer, version rail, actual provenance and permission-aware steward actions. Use real output samples for visual validation. No random photography, invented scores, fabricated approval percentages, gradient cards, sparkle decorations, glass dock, glowing ports or fake progress narration.

## Architecture and data contracts

Extract a `src/canvas/` feature with `CanvasWorkspace`, `CanvasProvider`, pure reducer, graph validation, coordinate helpers, persistence client, run client, node renderers, picker, context menu, dock, inspector, Brandolph panel and review. Keep `portal-briefs.jsx` as route/data adapters. Both saved and live canvases use the same feature.

Use the existing React 18 stack and canvas transform engine initially. Separate document state, transient interaction state and server run state. Use reducer/context for document commands, refs for pointer bookkeeping, and frame-batched drag updates. Keep hot pointer state out of broad context subscriptions. No graph-library migration is required for this scope. React's official reducer/context guidance was checked through Context7: https://react.dev/learn/scaling-up-with-reducer-and-context. Use React 18-compatible Provider syntax.

Proposed persistence:

- `canvas_layouts`: ID, workspace/brand/brief scope, schema version, revision, document JSON, timestamps. One canonical canvas per brief for MVP.
- Document nodes: stable UUID, type, specialist reference, position, title, settings, selected run/output IDs. Edges: stable UUID, source/target node and port IDs. Do not embed output bodies or run status as canonical layout data.
- Add nullable canvas/node references to runs, or an equivalent relational binding table, with validated ownership. Preserve legacy runs without forced reassignment. A version can contain multiple outputs; record the selected output as well as the selected run.
- Keep viewport and panel preferences per user; shared graph edits use revision-based compare-and-swap. Debounce saves, show unsaved/error state, and reject stale overwrites with a recoverable conflict flow.
- Add tenant policies and server ownership checks for every referenced brief, node, run and output. Verify role permissions, not membership alone. Deleting a canvas node detaches it; permanent asset deletion remains a separate existing action.

Run request contract should include canvas/node IDs, quality tier, deliverable settings, revision feedback and idempotency key. Server resolves and snapshots authorized upstream selected output IDs, BIO version and effective settings. Reject incompatible ports, duplicate/self edges and cycles. A downstream run requires ready selected inputs. Changing a selected input marks dependent results stale; it never silently launches paid work.

For older runs, show only recoverable provenance. Do not invent historical graph relationships. Duplicating a node creates a new UUID and independent future history. Handle deletion of referenced outputs explicitly.

## Delivery sequence

| Stage | Target | Concrete deliverable and exit check |
| --- | --- | --- |
| 1. Contracts and visual slice | 5–6 October | Add feature boundary; define persistence/run contracts and semantic tokens. Render BIO, brief, text/image nodes, selected/failed/blocked states, inspector and review with deterministic fixtures using real components. Check 1280/1440/1920 widths and both themes. |
| 2. Durable editor | 7–9 October | Add/select/drag/rename/duplicate/delete, typed connect/disconnect, one picker for +/N/context/wire-drop, fit/zoom/minimap, local undo/redo for graph edits and persistence. Reload restores graph. Two copies of one specialist remain distinct. |
| 3. Paid execution | 12–14 October | Server tiers, matching quotes and debits, input snapshots, per-node execution, truthful failure/cancellation states, variations and reload reconciliation. Full vertical workflow passes before adding more chrome. |
| 4. Brandolph and review | 15–16 October | Docked chat with selection context; validated graph proposals, explicit batch approval, factual run log and View nodes. Review versions, QA and steward workflow. |
| 5. Release decision | 19 October | Browser/accessibility/tenant checks, design review, design-partner flag and rollback drill. Release only if exit criteria pass. |

These are target gates, not a guarantee. One full-stack engineer has limited margin in 11 working days; the original “80% frontend” assumption understates graph execution and billing work. On 9 October, if persistence and interaction are not stable, narrow the 19 October pilot to manual canvas editing, per-node runs and review. Defer agent graph creation and use the existing review drawer with a version rail if necessary. Never reduce credit or tenant correctness to preserve the date.

### Execution and approval details

Use one server-side tier resolver and quote calculation for display and execution. Auto means the configured specialist route until memory-based selection is actually implemented. Do not promise adaptive routing or approximate speed without measured support.

Quotes include all nodes/counts/platforms, resolved settings, available balance, cap failures and a revision/expiry. Approval binds to that quote; changed inputs or settings require a new quote. Preserve existing reservation/finalization/refund primitives, validate their concurrent behavior, and add request-level deduplication. Show estimated credits honestly rather than promising an exact amount where that is not guaranteed.

For MVP, show credits at every manual Run and require explicit approval for every agent batch. Defer Always approve; localStorage is insufficient as the authoritative spending policy. No speculative paid generations during validation.

Brandolph proposals use an allowlisted structured operation set, validated by the server, then applied through the same editor commands as manual edits. Chat text never directly mutates the graph. Persist enough proposal/run identity to prevent replays and recover after reload. Planning/building graph nodes must not silently trigger generation.

Before exposing Stop, establish cancellation support through server and provider. If cancellation is unavailable, label the supported action accurately and continue reconciling the run; closing the panel must not claim work was cancelled or credits refunded.

### Interaction contract

Single click selects; Enter/Open or double-click opens detail. Keep the existing `onNodeClick` integration and isolate buttons/ports from wrapper pointer capture. Distinguish click from drag, cancel gestures on Escape/pointer cancellation, and transform wire drops into graph coordinates at any zoom.

Shortcuts operate only when the canvas owns focus, never during text entry, IME composition or an open modal. Space opens review only outside pan gestures. Add a keyboard alternative to port dragging, visible focus, accessible menu navigation, focus restoration and status announcements. Preserve the current LTR graph coordinate space while chrome follows RTL. Keep header overview, tension, departments, brief and refusals accessible at every width.

## Validation and release

- Pure tests: coordinate transforms, graph compatibility/cycles, identity and variation selection, undo/redo, document migration and save conflict handling.
- Integration tests: foreign-tenant references rejected; role enforcement; quote/run parity; double submission; credit caps and concurrent reservations; failed/cancelled runs; event replay and reconnect; selected upstream output actually reaches execution.
- Browser workflows: add through each entry point, connect, run one node, switch versions, review, approve with an authorized steward, reload. Verify deleting a node does not delete its outputs. Test Chrome/Safari, keyboard, Arabic/RTL, reduced motion and browser zoom.
- Visual review: dense and empty graphs, long names/text, mixed image ratios, two same-specialist nodes, missing images, quota/BIO errors and save failure. Compare screenshots against the stage-1 component slice. Main work remains legible with panels open; no overlapping dock/minimap/inspector.
- Run `npm run build` and relevant local unit checks. Existing live router/run/discovery scripts can invoke services or spend credits: use controlled fixtures first and run paid checks only within an agreed test budget.
- Use a workspace-controlled rollout flag; the tweaks toggle is a development convenience, not authorization. Flag-off restores v1 without deleting v2 layout or outputs. Additive migrations remain compatible with v1.

Deferred: Home/Library redesign, public share, notes, comments, image editing tools, multi-chat, skills authoring, tour credit grants, multi-select/groups and new providers. No visible dead controls for these features.

## Decisions when implementation starts

This plan recommends the existing Caastor palette, dark desk, persistent expandable header, single-click selection, server-owned tiers, additive persistence and explicit batch approval. The user requested planning, so these are proposals rather than approved flow changes. Confirm this concrete scope at the implementation handoff; no approval is needed to finish this document. Production migration/deployment is a separate action from preparing and testing the changes.

## Corrected visual completion gate

Confirm the authenticated BIO and workspace shell against port 5189; this browser currently sees sign-in. Review the persisted canvas inside the shell, not only a standalone swatch page. Check desktop/mobile, Arabic, long names, dialogs, approval focus and loading/empty/error states with the new skin. Previous automated reports used the older identity and must not be presented as visual proof for Plex Registry. Preserve the existing functional/backend evidence and keep visual changes reviewable. No decorative gradients, fake metrics, unrelated illustrations or new product flows are part of this correction.

User typography constraint: no Inter. Remove legacy font presets/options/imports from shipped UI and local mockups; retain only the current IBM Plex role system. Do not add generic AI dashboard decorations or alter product flows while applying this visual correction.
