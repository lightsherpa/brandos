# CaastorOS MVP: development assessment and implementation handoff

Assessment date: 2026-09-10. Source: current local working tree, HEAD 62324e4, and Oscar's agreed product decisions. This is a source review, not a production certification. Uncommitted frontend/design changes are present; preserve them.

## Current position

The product has substantial foundations: reference/BIO intake, certification machinery, brief sharpening and crew proposals, text/image specialist execution, a canvas and Library, output editing, credit accounting, invitations and ownership infrastructure. The implementation is not yet aligned end to end with the newly agreed MVP. Treat this as an integration and completion stage, not a finished release or a rebuild.

Local validation: `npm run build` passed; `npm run test:units` passed 263/263. Build reported a large bundle warning. A test emitted an EPERM WebSocket bind warning but passed. No production journeys, deployed migrations, external generation, billing or live permissions were tested. Passing existing tests does not prove the new requirements.

## Evidence and gaps

| Area | Source evidence | Gap against agreed MVP |
| --- | --- | --- |
| Brief persistence | `src/portal-brandolph.jsx:247` keeps the composer/questions in React state and hands off through sessionStorage at line 384. `server/src/routes/briefs.js` exposes sharpening; `runs.js` creates a brief during execution. | Durable autosaved drafts, recovery after navigation/session loss, resume listing and explicit start are not established in this path. |
| Certification gate | `server/src/routes/briefs.js:48` and `server/src/lib/load-brand-bio.js` allow sharpening after self-certification. Specialist production requires certified BIO. | Brief analysis and crew assembly must also wait for Creative Director certification and user acceptance of CD changes. Draft entry must remain available. |
| BIO review | Certification jobs, notifications, BIO versions and evidence intake exist. `server/src/routes/steward.js` still implements steward/lead workflows. | Verify Caastor assignment and automatic CD notification, user acceptance of changed BIO, and exact-version unlock. Replace old product terminology. Do not assume old calibration flows equal the new journey. |
| Output and crew approval | Sharpener provides specialist proposals/delivery plans; HomeCreate forwards them to canvas. | Verify/edit the concrete output list before crew/cost approval and enforce the final fixed quote server-side. Existing proposals are not proof of complete approval enforcement. |
| AI revisions | `runs.js:84` appends revision feedback and uses the run credit path. | Implement explicit free short-text versus paid image/complex regeneration policy. Prices, complexity boundary and usage limits remain open. |
| Version history | Runs persist; `outputs.js` preserves original body and overwrites `edited_text`. | Complete revision history, comparison and restoring previous outputs are not equivalent to retaining the original text plus the last edit. |
| Sharing and roles | `permissions.js` has workspace_admin/user; `access.js` has invitations. Migrations include single active owner index and atomic ownership transfer. | Add Viewer/Commenter/Editor behavior, brief privacy and sharing, and Owner approval for whole-brief reruns. Existing broad brief.run permission does not express that distinction. |
| Library and exports | `portal-briefs.jsx:3653` provides Library grouping/filtering; line 4064 handles individual image/text downloads. Other exports produce JSON or have no handler. | Verify brand → brief hierarchy/type filters and deliver a ZIP containing only user-selected files. No complete selected-file ZIP flow found in reviewed paths. |
| Human verification/polishing | `server/src/routes/craft.js:22` and `portal-briefs.jsx:2246` hardcode 40 credits and immediately request craft. | Replace with platform suggestion → CD quote → user approval, agreed scope and up to 3 included feedback rounds. Extra rounds/scope require a new approved quote. 40 is existing code, not an agreed tariff. |

## Recommended order

1. **Reliable brief lifecycle and gates.** Implement autosaved recoverable drafts first, then align analysis/assembly/production gating with certified BIO and accepted CD changes. This stops lost work and prevents progressing on an unapproved brand foundation.
2. **Permissions and approved execution.** Viewer/Commenter/Editor/single Owner, private/shared briefs, output and crew proposal approval, Owner approval for entire-brief reruns, and fixed quote enforcement. Reuse existing membership infrastructure.
3. **Output completion.** Free/paid revision policy, version history/compare/restore, Library brand → brief/type filters, individual downloads and selected-file ZIPs.
4. **Human service workflow.** Scope-based CD quotes, approval, delivery, three included feedback rounds, and extra-credit approvals.
5. **Release evidence.** Test the complete journey on staging with representative roles and failure/recovery cases. Reconcile Notion status with evidence before claiming Done.

## First implementation slice: durable brief drafts

Build an independently reviewable change that saves an unfinished brief as Draft and lets its user resume it. Include raw input and entered answers, brand/workspace association and any existing supported selections/attachments; investigate current schemas before adding migrations. Keep the same draft ID across saves and resume. Persist across navigation, reload, tab closure and reauthentication. Display save state/failure and preserve unsaved text on failed writes. Debounce/flush appropriately; do not rely solely on unload events or sessionStorage. Prevent stale responses from overwriting newer edits and prevent cross-brand/workspace leakage.

Saving/resuming must not sharpen, assemble, generate or charge credits. Keep draft entry available before certification. Once certification is complete, saved briefs stay idle until the user chooses one to start. Do not erase another brand's draft on brand switch. Preserve current production behavior while creating an explicit draft-to-start handoff.

Add meaningful persistence/recovery and authorization tests and run the relevant regression suite. Do not silently implement undecided sharing defaults or paid revision limits. Deliver a focused change and an evidence-based next step for the certification gate.

## Agreed product contract

- Say **users** and **Creative Director**, not customers/Brand Steward in product copy.
- User supplies flexible but mandatory references (website, guidelines, social/print/photos/previous work). BIO must use actual references. Manual palette/type entry belongs to V2.
- Automated checks precede Caastor-assigned CD review/notification. Approved states: Automated checks passed → Awaiting Creative Director review → Awaiting your approval when CD changes BIO → Certified for production. Unchanged CD-certified BIO unlocks directly; changed BIO unlocks after user acceptance without a second review.
- Before unlock: draft briefs only. No brief analysis, crew assembly or generation. After unlock, user selects a saved brief explicitly.
- User reviews/adjusts output list, reviews/adds/removes specialists, then approves final fixed credit cost and runs. Quote must reflect changes.
- Image/complex regenerations cost approved credits; short text revisions/regenerations are free. Exact amounts and usage limits are TBD.
- Preserve output versions; users can compare and restore them.
- Library: brand → brief, output type filters. Date/status filters were not confirmed.
- Users control brief privacy and sharing. Invite others to workspace as Viewer, Commenter or Editor. Exactly one workspace Owner.
- Editors work on specific specialists/outputs. Rerunning the entire brief requires Owner approval. Do not infer unlimited spending permission for Editors.
- Individual asset downloads and ZIP of only explicitly selected files.
- Combined verification/polishing: platform suggests price to CD, CD checks scope/proposes to user, user approves before work. Up to 3 feedback rounds included; further rounds and scope changes cost additional approved credits. Tariffs TBD per service/agent.
- Direct human work without generated output is deferred to a future version.

## Open decisions and tracker caveat

Unresolved: free short text/complexity boundary and round limits; exact tariffs; default brief privacy and output permission inheritance; invitation/permission management authority; initial-run approval and Editor spending limits; download permissions and formats; deletion/archive/retention; failure/refund policy; notification channels; reference sufficiency and full certification transition details.

Notion tracker: https://app.notion.com/p/3d6e2d88658c81ddb53be5e612a50478
Coverage register: https://app.notion.com/p/3d6e2d88658c8198a4e8c836dcee1c8f
The recent decisions were saved to the main page via Chrome. They have not all been converted into individual linked tasks/change records. The main page's inline database views rendered without rows during our browser review; this does not prove the source databases are empty. Inspect and reconcile the real databases before creating duplicates. Notion requirements are not proof of implementation.

## Handoff execution constraints

Use a Codex worktree starting from the current working tree so existing uncommitted changes are retained in the starting snapshot. Verify that this document and current edits arrived; do not reset or overwrite user work. Read applicable AGENTS.md. Use Context7 for library/API documentation when needed. Do not send invitations/messages, deploy, charge credits, or change live data as part of this implementation without the relevant authorization. No new subagents were requested. Start with local implementation and focused tests; report unverified deployment/migration steps explicitly.
