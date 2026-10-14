# Agency office validation build

The first validation version changes presentation only. Agent selection, specialist execution, BIO checks, credits, output persistence, editing, and human craft use the existing application flow. Larger-scale orchestration and database migration are deferred until user feedback supports the direction.

## Open the preview

Run `npm run dev` and visit [the local office preview](http://127.0.0.1:5173/office-preview.html). It needs no login, makes no provider calls, and uses no credits. Play the simulated coffee campaign, select staff members, inspect the brief and outputs, pause/resume, and reset. The preview is also emitted by the production build as `dist/office-preview.html`.

In the authenticated app, creating a real brief now opens its crew in the office. Existing saved projects open there too. The Office / Canvas switch changes only the presentation, with the preference saved locally. Real specialist and deliverable clicks open the existing drawers. Real execution retains the current browser-driven sequence and requires the current production prerequisites; this version does not add background recovery after closing the tab.

The office uses the Pixel Agents Canvas renderer, walking/working sprites, furniture catalog, and layout editing helpers from pinned upstream commit `3537e140c2094761beae748592aeb92ece8edfdd`. Provenance and the MIT license are retained in `src/vendor/pixel-agents/UPSTREAM.md` and `public/pixel-office/`. Three presets offer a classic agency, creative studio, and headquarters. Users can name their office, recolor floors, select character appearances, place/move/rotate/remove furniture, and save each preset locally per brand. Customization persists in this browser only; cross-device storage and custom asset uploads are not implemented. The scene uses existing task state and does not invent agent conversations. No backend endpoint or database schema was added.

The standalone preview uses scripted tasks and sample captions. It demonstrates workflow timing and concurrent QA activity; it does not validate model quality or produce actual generated images. Browser-only scene animation does not establish backend capacity at 1,000 or 10,000 concurrent users.

## User validation

Start with 5–8 people who would use Brand OS. Let each person perform the same tasks without instruction:

1. Read the brief and identify Brandolph's role.
2. Start the sample project and identify who is working versus waiting.
3. Select the copywriter and inspect the task.
4. Find and open a completed output.
5. Explain what review means and what they would do next.
6. Choose a preset, customize a character and furniture, save, and reload.
7. In the authenticated pilot, try a real brief and compare Office with Canvas.

Record time to first output, missed/incorrect status interpretations, difficulty finding actions, and which presentation people prefer. Ask whether the office helps them understand the crew or adds distraction. Keep performance feedback separate from whether the artwork appeals to them.

Suggested acceptance criteria: most participants find an output without help; they distinguish waiting, working, and complete; existing editing/export/craft actions remain reachable; there are no status changes or duplicate runs caused by switching surfaces; narrow-screen users can complete the same tasks through the roster and output tray.

## Deployment sequence

1. Review the local preview and adjust the scene and interactions.
2. Publish a staging build using the current stack; share `/office-preview.html` for a no-credit visual test.
3. Pilot authenticated real brief runs with a small invited group using the existing backend.
4. Use the feedback to decide whether the office becomes the default production interface.
5. Design and load-test the separate orchestration/database architecture for 1,000–10,000 concurrent users after validation. The earlier architecture plan is exploratory, not a requirement to keep Supabase at that scale.

No public deployment or user invitations were performed in this task.

## Verification

- `npm run build` builds both application and standalone preview.
- `npm run test:office` checks the presentation adapter, existing brand pinning safeguards, generated layouts, and saved-layout validation.
- Browser checks cover play/pause/reset, task selection, brief/output dialogs, zoom, reduced motion, and a narrow viewport.
- Paid specialist execution and production-scale load tests are outside this prototype verification.

## Optional custom art

Use `docs/brandos-pixel-art-prompts.md` for character concepts, animation sheet specifications, and compatible furniture/tile prompts. The bundled artwork is sufficient for initial testing. Generated art needs pixel cleanup and frame alignment before replacing assets.

## October 8 — studio connected to real briefs

The generated boutique studio is now the default AgencyOffice scene in both active BriefRunCanvas and saved BriefCanvasView. Node IDs and task state come directly from those views. Existing run/start controls, pinned brand context, credits, specialist drawers, deliverable editing, and export actions remain the production flow. The alternate Pixel layout editor is still available. The generated room image is now served from public/agency-office/creative-studio-v1.png and included in the production build.

The actual paired image run records `inputFrom` using its copy specialist node ID. Only that explicit relationship produces a copy-to-design handoff; unrelated specialist starts display an assignment, never an invented dependency. Terminal outputs go to the gallery. Already completed saved runs and token updates do not replay animations. QA states reflect existing node state; no separate QA run or approval gate is added to production.

Sprite glitch cause: the standalone test animated a three-cell distance using two steps, selecting a half-cell offset mid-animation. The standalone now switches explicit whole frames; the connected React scene computes integer sprite frame indices (walk 0–2, typing 3–4) with stable 16×32 source cells. Tests check frame boundaries, event deduplication, and explicit handoff sources.

Real-run verification blocker observed locally: API server starts on :8787, but configured Supabase project hostname yemzrohzqfuxmekcgnnh.supabase.co fails DNS resolution. github.com and supabase.com resolve on the same host. Browser shows Supabase fetch failures and cannot finish loading brand/BIO. No real specialist run was initiated or paid output generated. Confirm the active project configuration before claiming an end-to-end run has passed.
