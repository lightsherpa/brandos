# Unified MVP completion matrix

4 October 2026. This is the current integration status, not the completion of the real client goal. “Implemented” means code exists; its proof column states the limits. “External proof pending” cannot be inferred from synthetic fixtures. “Deferred” preserves the handoff/accepted plan's cuts or stretch scope. See `2026-10-04-unified-mvp-checkpoint.md` for commands, files, migration history and runnable URLs.

## Routing, media and costs

| Requirement | Status | Implementation / proof | Remaining gap or gate |
| --- | --- | --- | --- |
| Server-owned model catalog, stable identities, model/version/settings/gateway distinctions | Implemented | `server/src/lib/models/catalog.js`; routing contract tests | Live catalog/capability/rate qualification remains operator work. No model equivalence is inferred from its name. |
| Quality-first ranking and explicit overrides | Implemented, external proof pending | Catalog + `creative/plan.js`; higher-quality route precedes cost/latency; override constraints/credits tested | Real comparative accepted-output evaluations; no winner has been promoted from fixtures. |
| JEV narrow eligible-choice classifier, timeout/no retries/fallback | Implemented, external proof pending | `models/jev.js`; unit contracts + 120 mock cases | Real SystemOne/API contract and latency/billing validation with approved credentials/budget. |
| Shadow decisions persist without changing execution | Implemented; local persistence/UI proof | Durable job routing includes chosen route/recommendation/confidence/fallback; operator API/UI reads synthetic persisted decisions | A real shadow task over eligible measured candidates and observed impact. |
| Active JEV qualification gate | Implemented; deliberately inactive | ≥100 measured labels, ≥95% agreement, zero violations, confidence ≥.90, human acceptance/artifact tests | Genuine labels/measurements/human artifact; mock fixtures are not qualification. |
| JEV on every legacy text route | Not implemented | Text specialists retain their existing router | Separate durable text classification/budget integration if this is required; current JEV rollout is the durable media path. |
| New OpenRouter image/video and APImart adapters | Implemented, external proof pending | `creative/providers.js`, normalized contract tests, qualified settings gates | Real endpoint/model version/settings/task/storage/billing proof. Experimental routes remain gated. |
| Preserve legacy fal routes and Flux Schnell | Implemented | Existing identities/router/default behavior retained | Live legacy paid smoke test awaits budget. |
| Durable image/video job orchestration, reconnect/outbox recovery | Implemented; contracts and local DB proof | Inngest worker/CAS/state machine; duplicate/restart/retrieval/storage/settlement tests; one atomic job/run/hold | Real provider task recovery and cloud Inngest deployment proof. |
| Uncertain submission never blindly regenerates/refunds | Implemented | `reconcile` blocks replay; contract tests preserve holds | Operator reconciliation drill with provider evidence; no automatic uncertain-job refund. |
| Approved image reference → image/video, exact scoped snapshot | Implemented; graph/server contracts | One same-canvas approved stored image; capability checks; video derivative node and server snapshot | Actual qualified edit/video generation. Video chaining is deliberately unsupported. |
| Private durable asset storage and refreshed access | Implemented; real local storage proof | `creative-outputs` bucket, stored bucket/path, signed retrieval, denied client access | Hosted storage/output retention and cross-provider asset retrieval proof. |
| QA and review preserve failed/flagged outputs | Implemented; synthetic/API proof | Image QA contracts, video human-review flag, review transitions and separation of duty | Real image vision QA accuracy, real video reviewer acceptance. QA is not human acceptance. |
| HTML email components, escaped content, links and required brand content | Implemented; rendering/contracts | `creative/email-html.js`, a13 output format, output preview/export; 375/600 px browser rendering | Real generated email and Gmail/Outlook/Apple Mail checks; reviewed public assets for export. |
| Hard media per-request/monthly spend plus credit reservation | Implemented; local transaction proof | `create_creative_job` locks workspace, checks conservative eligible generation+QA+JEV bounds; deduplicates holds | Verified provider upper bounds/fees/settings. Provider charges cannot be undone retroactively. |
| Atomic canvas text quote/run/credits | Implemented; real local concurrent/rollback proof | `20261004040000_canvas_text_claim.sql`, SSE route; one winner/one hold and no run on failed reservation | Private evidence/heartbeat quarantine, exact settlement fence and MFA operator recovery now pass 26 crash/DB and 12 browser checks. Genuine provider/staging proof remains pending. |
| Interrupted canvas text execution: durable evidence + operator reconciliation | Implemented; local crash/API/UI proof | `text_execution_evidence`, lease/cron, protected recovery routes/UI; actual SIGKILL, one settlement/refund, unknown holds and flagged draft recovery. Zero provider calls. | Genuine provider receipt/billing and hosted recovery; no lost-stream resume or automatic re-generation. |
| Shared atomic canvas text/media dollar reservation | Implemented; local proof | `20261004060000_execution_spend.sql`, qualified full-context generation/QA bound, shared ledger, unknown cross-month holds and MFA billing amendments; 6 unit, 30 API/DB and 12 browser checks | Live qualifications/receipts/invoices remain required. Text JEV is off; legacy paths outside staged canvas are excluded. |
| Uniform atomic dollar reservation for legacy text | Not implemented | Existing text token limits, credits and legacy guardrails retained | Staged canvas text now shares the media dollar ledger. Brandolph, Discovery and other legacy text paths retain existing behavior; do not claim global enforcement. |
| Usage cost provenance and generation+QA+JEV accounting | Implemented; unit/local API/UI proof | Reported/estimated/reconciled/unknown distinct; unknown total null; known subtotal shown; media settlement includes JEV | Real bills/fees/reconciliation and accepted-output costs. |
| Benchmark aggregate hold safety across restart | Implemented; boundary tests | Lock, persisted holds, finite/nonnegative committed spend, resumed-ledger validation | Reviewed paid cases/budget; no paid runner executed. |
| Real acceptance/revisions/time/errors and baseline/shadow measurement | Implemented; real local transitions with synthetic values | Transactional event triggers, `creative/measurements.js`, `/api/opex/measurements`, protected FinOps tab | Genuine client outcomes. Prospective coverage and per-run timing are explicit; not full historical/project-lifetime inference. |

## Canvas parity: handoff gap IDs

| ID | Requirement | Status and evidence | Remaining work |
| --- | --- | --- | --- |
| 1 | Pan/zoom/fit/minimap in dock | Implemented; intercepted browser gesture/screenshots | Real-device performance/native browser zoom; coarse list/inspector targets and 200% CSS zoom now tested. |
| 2 | Node drag | Implemented; pointer and persistence checks | Real touch pointer-cancel drill. |
| 3 | Selection, outline, ports, inspector, quality bar | Implemented; browser checks | Complete screen-reader verification. |
| 4 | Node context menu | Implemented; shared protected dialog/actions | Browser menu focus/action coverage beyond existing smoke. |
| 5 | Unified picker from + / N / context / wire drop | Implemented; browser gestures/keyboard | Full long-list and Arabic search coverage. |
| 6 | Typed port connections | Implemented; graph contracts and gesture/keyboard tests | Physical port target checks at low zoom; live approved upstream generation. |
| 7 | @mention nodes | Deferred: original cut | No parser or special mention authorization added. |
| 8 | Per-node run and truthful state | Implemented; text/media API paths, local missing-provider failure/refund, synthetic worker results | Real paid text/image/video and genuine provider billing recovery; local text crash/operator path now verified. Stop/cancel is not presented as a verified refund. |
| 9 | Selected variations and downstream stale propagation | Implemented; graph/browser tests | Real generated history and reload proof after live media execution. |
| 10 | Auto/Premium/Balanced/Fast with credits | Implemented; shared quote resolver/planner and inspector | Real route quality benchmarks. Auto does not promise adaptive text routing. |
| 11 | Running tray, ready notice, Space review | Implemented; intercepted browser run/review | Live provider disconnect/billing drill; local SIGKILL and operator UI paths now verified. |
| 12 | Docked Brandolph, selection context, proposals/log/View nodes | Implemented; allowlist/CAS/replay contracts | Actual Brandolph provider reply/proposal on client brief, plus persistent chat across devices if required. Current chat is session-local. |
| 13 | Explicit credit approval / deny | Implemented; quote binding and approval tests | **Always approve is deferred** by the accepted implementation plan; no localStorage spending policy. |
| 14 | `/` asks about selected work | Implemented | Actual provider response proof. |
| 15 | Dedicated agent “building” presence/outline | Deferred stretch | Running states exist; no distinct planning/presence protocol or animation claims. |
| 16 | Review versions/provenance/QA/internal/client workflow | Implemented; role-aware actions, real local workflow with separate actors | Genuine steward/client outcome; complete media/video/browser review proof. |
| 17 | Pinned comments | Deferred: original cut | No commenting backend introduced. |
| 18 | Non-destructive image utilities/upscale | Deferred: original cut/stretch | No fake enabled tool; requires qualified bounded route if resumed. |
| 19 | Notes/stickies | Deferred stretch | Graph currently models BIO, brief and specialists. |
| 20 | Share/access modal | Deferred: original cut | No public link or access-policy implementation. |
| 21 | Scoped keyboard shortcuts/help | Implemented; native input/IME/modal guards, graph keyboard tests | Complete OS/layout/screen-reader key matrix; see audit. |
| 22 | Layout persistence/UUID identities/reload | Implemented; actual local authenticated save/reload, SQL CAS | Deployed migration/backfill and staging history check. |
| 23 | First-run tour | Deferred stretch | Help exists; no onboarding tour claimed. |
| 24 | Home mosaics/suggestions/resume cards | Deferred stretch; existing Home preserved | Separate product work after canvas validation. |
| 25 | Library multi-select/badges/tags/archive parity | Deferred stretch; existing Library and new output integrations preserved | Multi-select and canvas badges are not complete. |
| 26 | Templates INPUTS→OUTPUTS/run costs | Deferred: original cut | No template execution/publishing flow added. |
| 27 | Certified BIO root with typed port | Implemented; graph/server gate + real local decertification denial | Human certification: local fixture explicitly synthetic. |
| 28 | QA/reviewer evidence on artifacts/review | Implemented for state/evidence; numeric scores partial | No fabricated scores; a full numeric score display requires actual score data. |
| 29 | Brief/refusals/tension/departments visible | Implemented in retained expandable header | Wire-level guardrail pins deferred stretch. |
| 30 | Brand memory/routing hints | Existing signals retained; hint/adaptive text selection deferred | Measured memory-informed routing and quality evidence. |

### Definition-of-done assessment

The seven core interaction paths in handoff §10 are available locally: canvas opening, picker/connection, inspector/tier/run, version/review, docked Brandolph/approval, saved layout, and scoped keyboard actions. Editing/navigation/storage/permission/credit behavior has local proof. The paid provider/agent portions have contract/simulation proof only. No design-partner workspace trial has happened. Existing paid smoke scripts were not executed. Vendor/$ information is hidden from the new client canvas execution surface; the authorized internal FinOps surface intentionally shows provider/cost evidence, and legacy client screens are not claimed to have completed a global model-label cleanup.

## Design system and audit

| Requirement | Status | Evidence / remaining gap |
| --- | --- | --- |
| Use current checked-in identity/tokens | Implemented | Corrected to user-confirmed port 5189 Plex Registry: IBM Plex, mineral/cobalt/graphite, 4px geometry. Source hashes recorded; authenticated BIO comparison pending. |
| Shared controls and protected dialog | Implemented | Extracted primitives reused; both-browser pointer/keyboard focus, inert, Escape and reduced motion pass. |
| Component reference from production primitives | Implemented | Light/dark reference at 390/768/1440; contrast samples ≥4.5; coarse actions ≥44 px. |
| Full portal migration to primitives/tokens | Partial | New slice migrated; legacy portal inline styles remain. |
| Loading improvement | Implemented; production verification | Main 774.66→526.11 kB; locale/recovery additions included; heavy routes lazy. LCP/INP/CLS on slow real devices remain unmeasured. |
| Anti-slop/technical audit and remediation | Implemented report | `2026-10-04-impeccable-audit.md`: 16/20; detector exceptions, fixes, no open local P1/three P2 remaining. No universal AA/completion claim. |
| Canvas i18n/coarse/layout zoom | Implemented within tested slice | EN/ES/AR catalogs, stable IDs, 132 rendered Spanish/Arabic checks, long content and 200% CSS zoom. Coarse list/inspector/picker targets ≥44 px in both browsers. |
| Complete accessibility/language/device review | Partial | Manual screen-reader/native browser zoom/physical touch, linguistic sign-off, uncatalogued backend errors and legacy operator copy remain. |

## Client trial

| Requirement | Status | Dependency |
| --- | --- | --- |
| Real client/brief/data consent | Pending external input | Human selection and authorization. |
| Human-certified BIO and named reviewers | Pending external input/action | Local synthetic certification does not substitute. |
| Approved provider qualifications and API ceiling | Pending external input/action | Explicit budget and rate/capability evidence before paid calls. |
| Real end-to-end deliverable approval and measured value | Not performed | Requires the above; use the platform evidence and trial protocol, not fixture outcomes. |
| Deployment/migration repair/rollback drill | Not performed | Inspect actual remote migration history; deploy reviewed flag-controlled change and test recovery. |

## Remaining code gaps versus external prerequisites

**Concrete code/product gaps:** uniform dollar reservation outside staged canvas text; JEV integration for legacy text if in scope; broad backend/legacy UI language coverage; manual physical touch/native zoom/screen-reader verification; global legacy token/model-label cleanup if required. Canvas SSE now has durable evidence and an operator recovery path, not a resumable provider stream or a separate autonomous text worker. Original cuts/stretch features remain explicit above. Provider cancellation is not a billing guarantee and has no invented user promise.

**External prerequisites:** real client/brief/permission/reviewers/BIO, budget, credentials, reviewed live route/billing qualification, genuine JEV labels/acceptance, hosted storage/Inngest/staging/deployment validation, real email clients and real-device performance. These cannot be closed by more simulated runs. The full goal remains incomplete.

## Visual baseline correction

The user rejected the older design reference and identified `http://localhost:5189/#/bio` as current. Its listener serves `caastoros-mvp-review-d969b6` (`334029e`) with Plex Registry. The source skin/font definitions and shell defaults now load in this integration, with a marked canvas/theme bridge. Desktop reference colors/fonts/corners, inspector, dialog dismissal and theme rendering were inspected; production build passes. Previous Chromium/WebKit/mobile/locale reports refer to the earlier skin and do not establish new visual parity. The 390px inspector and approval dialog have no horizontal overflow and 44px action/input/select targets; Deny restores focus to the run trigger. Direct authenticated BIO comparison and broad both-engine/locale regression remain pending. See `DESIGN.md` and `2026-10-04-design-alignment-source.json`.

## 9 October 2026 — office integration acceptance slice

| Requirement | Status | Evidence / remaining limit |
| --- | --- | --- |
| Generated office/assets integrated into MVP | Implemented locally | 201 source-hashed imports, manual portal/package/Vite merges; provenance manifest |
| Office default; canvas authoritative and reachable | Implemented; focused local proof | Same CanvasProvider/run/review/approval; six nodes and pending run retained across switch |
| Browser-local office customization | Verified synthetic | Snake plant move/keyboard/reload and Cream preference; no cloud sync |
| Selected image/video output and review provenance | Verified presentation | Typed shelf; same Review; video playback unverified (empty fixture stub) |
| Quote/approval/pending protection | Verified preflight | Deny, inert background, expiry rejects approval, duplicate pending quote blocked; no successful paid generation |
| Current Plex / mobile office remediation | Implemented and rechecked | No Inter; 390px page fits, office controls >=44px, 366px dialog; 1024px fits, physical coarse touch pending |
| Office tests/build | Pass | 35 office +16 canvas +6 text spend +26 creative; build/diff check |
| Broader office acceptance | Partial | Legacy fallback browser path, locale/dark/AA/screen-reader/real devices, authentic video, animation polish pending |
| Genuine client trial/deploy/billing verification | Still pending | No paid calls, client data mutations or hosted migration; earlier external gates unchanged |

See `2026-10-09-office-mvp-integration.md` for evidence and scoped remaining P2 findings. No earlier synthetic proof is promoted to a real client or deployment result.


### 9 October office remediation follow-up — concrete P2s closed

Media-specific original links are translated; expired/required preflight quotes clear optimistic state and restore persisted review status, while accepted/unknown submission remains reconciliation. Before/after synthetic database snapshots are identical: four runs, three outputs, unchanged ledger, zero execution-spend holds and the same flagged/stale selected output with steward approval. Stock and added prop catalog/control/selection copy uses EN/ES/AR with stable IDs and category values; focused Spanish/Arabic rendering and RTL are checked.

Operational controls use both Plex themes reliably across entry-point CSS order. Enabled-control contrast samples are >=15.85:1 light / >=12.50:1 dark; 200% CSS zoom at 390px has no page/control overflow and keyboard focus works. Source art remains unchanged. Office tests now **38/38**; canvas **16/16**, prior unchanged text-spend **6/6** and creative **26/26**; final production build and diff check pass. See the updated office report/audit and output/office-integration/rejection-regression.json.

These updates supersede the previous four open office P2 implementation findings. Physical touch, native/text-only zoom, screen-reader, all artwork contrast/readability and full linguistic qualification remain unverified; CSS zoom/synthetic fixtures do not close live generation/client/deployment gates.
