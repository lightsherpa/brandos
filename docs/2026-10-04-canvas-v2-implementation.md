# Canvas v2 implementation

4 October 2026. Implemented in the existing `claude/melius-competitor-analysis-e18b7d` worktree. Production migration, workspace activation and paid generations have not been performed.

## Delivered

- Persistent UUID graph with typed connections, exact selected upstream output snapshots, independent histories for duplicated specialists, cycle prevention and downstream stale indicators.
- Pointer drag, pan/zoom, minimap, fit, unified specialist picker, wire connections, context menu, undo/redo and scoped keyboard shortcuts. Mobile uses a readable node list.
- Canonical brief canvas creation, revision CAS autosave, conflict recovery and local JSON export. Existing v1 remains available when the workspace flag is off or an older backend lacks the new access route.
- Per-node generation through existing run and credit services. Quality tiers and actual server credit estimates replace provider names in client controls. Approval expires and is invalidated by edited inputs, changed settings, BIO/spec versions or pricing. One persisted quote can create at most one run, with a unique active run per node.
- Output version selection, editing, QA evidence, provenance and existing role-aware review transitions. Changing a selected output marks downstream work stale.
- Brandolph streams real replies with selected work context. Crew proposals use allowlisted specialist IDs, preview before application, atomic revision checks and replay prevention. Adding nodes does not authorize generation; batches require a separate credit approval.
- Corrected Plex Registry styling from user-confirmed port 5189: IBM Plex typography, mineral desk/white artifacts, cobalt actions, graphite rules and 4px corners. Existing modal, RTL and reduced-motion behavior retained; earlier visual checks do not establish parity for the new skin.

## Files and contracts

`src/canvas/` contains the graph contract, provider, API adapter, editor, panels and scoped CSS. The server imports the same pure graph validator. `server/src/routes/canvases.js` owns bootstrap, persistence, estimates, quotes, versions and proposals; `canvas-service.js` owns tenant, permission, input and quote validation. Existing run and Brandolph routes consume authorized canvas context.

`supabase/migrations/20261004000000_canvas_workspace.sql` adds the opt-in flag, layouts, quotes, proposals and nullable run provenance. Layouts have scoped authenticated read access; writes and internal quote/proposal records are server-only. Service-role routes independently validate tenant and permission scope.

## Validation

This is the original canvas stream note. The current integrated checks, loading measurements, media reference path and remaining gates supersede the early counts/limits below; see `2026-10-04-unified-mvp-checkpoint.md` and `2026-10-04-unified-mvp-completion-matrix.md`.

- `npm run test:canvas`: 14 passing graph, review, authorization, quote invalidation, replay and CAS tests.
- `npm run test:units`: all 201 existing unit tests pass.
- `npm run build`: passes. Existing application bundle-size warning remains.
- `npm run test:canvas:db`: passes in an ephemeral PostgreSQL 17 container. Checks migration application, tenant RLS, denied client mutations, proposal replay/conflict transactions and active-run uniqueness. Bootstrap uses a minimal synthetic kernel and permission stub; this does not replace a staging test against the complete Supabase schema/auth system.
- `scripts/canvas-browser-check.mjs`: Chromium and WebKit with intercepted APIs. Checks add/run/approval/review, duplication, deletion, undo/redo, native input shortcuts, dragging, wire and keyboard connections, denied quote with no run submission, and autosave. Captures desktop 1280/1440/1920, dark, RTL and mobile screenshots. These tests verify editor/API behavior without invoking paid providers.

Browser check example (Playwright must be available locally):

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=canvas-test-fixture npm run dev -- --host 127.0.0.1 --port 5183
CAASTOR_CANVAS_PREVIEW=http://127.0.0.1:5183/docs/mockups/canvas-v2/index.html node scripts/canvas-browser-check.mjs
```

Set `CAASTOR_BROWSER_ENGINE=webkit` for the second engine. `CAASTOR_BROWSER_MODULE_ROOT` can point to an existing Playwright installation. The DEV-only preview is an automated fixture; its APIs must be intercepted by the script.

## Activation and rollout gates

Apply the migration through the project’s normal reviewed migration process, deploy the API and frontend together, then enable `workspaces.canvas_v2_enabled` for a selected staging workspace. `CANVAS_V2_DEV=true` bypasses the workspace flag only outside production. Disable the workspace flag to return to v1; graph/history records remain available.

Before production activation, verify existing brief hydration and reload, full Supabase membership/RLS and review transitions with real staging accounts, and one approved text/image run with the configured providers and credit ledger. No paid smoke test was run here. Browser run responses and proposal generation were mocked; the SQL proposal transaction and API authorization were tested independently.

Current integration accepts approved stored image references for qualified image/video routes; real provider proof remains pending. Each image node produces one image per run. Always-approve spending policy and provider cancellation remain deferred. Chat history is session-local. Quote claim, text run creation and credit reservation now commit atomically. A process crash after commitment remains a reconciliation case: inspect the claimed quote and matching run before permitting another submission; do not blindly replay or automatically refund work whose status is unknown. The UI conservatively blocks a run while its outcome is unresolved. Private execution evidence, heartbeat quarantine, exact settlement fences and MFA operator reconciliation now pass local SIGKILL/DB and actual operator UI drills; see the unified checkpoint. This does not resume a lost SSE stream or prove live provider billing recovery.
