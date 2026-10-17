# Quinn review: restoration and deletion audit

Compared with `origin/dev` at `296aa4962d0856fe68b18c62965f9e6722ee2372` using `git diff origin/dev --unified=0 -- src/portal-briefs.jsx src/task-pipeline.jsx`. Line numbers below refer to the dev version. Every minus hunk is listed; pure additions are not deletions.

## src/portal-briefs.jsx

| Dev lines | Remaining replacement and reason |
| --- | --- |
| 1196 | InteractiveCanvas accepts optional initialFit; existing defaults and controls remain. Grouped nodes fit once without resetting dragged positions on polling. |
| 1220, 1222–1225 | Replace one-time height measurement and its comment with ResizeObserver measurement/cleanup. Grouped thumbnails load asynchronously; connectors must continue to meet node centers. |
| 1638 | Add locale to the existing locale hook for translated grouped controls. |
| 2083–2088 | Replace the live per-agent graph surface wiring with LiveDeliveryCanvas using the SAME InteractiveCanvas. Brand Core, Brief, Delivery, toolbar, helper and image export remain. AGENCY_OFFICE remains off. |
| 2090–2098 | Replace direct clicks on individual agent/output nodes with grouped preview clicks, source-node callbacks, and production tools. SpecialistNotepad verify/edit/copy, original DeliverableDrawer, and sendToHuman remain reachable; internal per-agent detail is collapsed and gated. |
| 2100–2101 | Use the combined Working label while running and a completed-state helper describing deliverables instead of individual streamed specialist progress; en/es/ar supplied. Assembled helper remains. |
| 2290, 2301 (DeliverableDrawer) | Hide specialist attribution in the drawer eyebrow and JSON export from customers using the existing internal gate. Copy, Export, human handoff, status and QA behavior remain. |
| 2855 | CanvasView accepts a linked brief ID so authenticated share URLs reopen the original saved-brief loader and its fixture/not-found states. |
| 2873–2874 | Restrict legacy CrewCanvas dispatch to its supported requested crew and prototype to internal access. Linked/multi-type plans use the grouped Canvas; the legacy task workflow remains available. |
| 2888 | Add locale and internal-access hooks to BriefViewCanvas. |
| 2998 | Add persisted output ID, explicit type and part to saved specialist nodes. Explicit Granada a12 Email metadata must override the agent’s usual Landing role; original brand/asset metadata remains. |
| 3149–3154 | Replace saved per-agent graph wiring with saved/fixture grouped surface, retaining the original loader, empty/not-found states, header, toolbar, clear/back and drawers. Fixture mode groups fixture data directly without requesting a nonexistent saved brief. |
| 3156–3161 | Replace agent-node click routing with grouped preview/source callbacks and gated production tools; replace specialist-count helper with grouped helper. All original handlers remain available. |
| 4214 | Gate the Library viewer’s per-agent credit attribution; full customer Library retrieval, folders, filters, search, view, copy, download and delete remain intact. No 50-item replacement. |

## src/task-pipeline.jsx

| Dev lines | Remaining replacement and reason |
| --- | --- |
| 34 | Export Stepper so the regression test renders the actual six-stage component. Its implementation and UI remain intact. |
| 96 | Export ItemCard and accept brief/count for customer-friendly download names; retain all original checks, edit/rule-save and workflow controls. |
| 245 | Remove the stray literal closing brace rendered after the metrics span. No conditional or behavior is removed. |
| 253 | Pass brief title and item count into ItemCard for meaningful localized download names. |

The original task attribution span (including skills) is retained inside a gated collapsed section. CheckPanel remains available to customers, including Save as rule. RuleForm, save/re-run handlers, task Stepper and rerun button remain unchanged. The Delivery node and the authenticated download backend are retained.

## Verification

- Full suite: 1,034 passed, 0 failed, 0 skipped.
- Independent server suite: 786 passed, 0 failed, 0 skipped (included in the full-suite count).
- Build passed; existing large-chunk advisory remains.
- Mapping regression uses sanitized real local Granada output metadata; no DB or schema changes in this review fix.
- Rate-limit tests: first 10 delivery requests succeed, 11th returns 429 with Retry-After; generic API budget remains independent.
- ZIP tests validate CRC, entry offsets, streaming cancellation, Unicode names, and image embedding without arrayBuffer().
- Workspace raw-run access is denied; platform designer, steward and existing qualified Certify actors retain access. Existing Certify routing remains unchanged.
