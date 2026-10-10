# Office integration into the unified MVP — 9 October 2026

Implemented only in `.claude/worktrees/melius-competitor-analysis-e18b7d`. The main checkout and real client workspaces were not modified. This is production-source integration with local synthetic verification, not a deployment or client trial.

## Result and architecture

Agency office is the default brief workspace; the explicit Canvas preference remains available. Both surfaces use the same CanvasProvider, persisted document, selected output, run polling, inspector, Review and approval dialog. The office adapter is a read-only projection; it carries actual canvas node/output IDs, selected versions and explicit upstream links. Switching surfaces does not create another run or approval state. The graph stays mounted but hidden in office mode. Historical runs load before the office mounts, preventing artificial assignment replay.

Legacy saved/live brief wrappers also use AgencyOffice with their existing handlers and brand scope; no-context Create opens the clearly labelled simulation. The dedicated office-preview build entry is included. Legacy fallback end-to-end browser regression remains pending; current browser proof covers the persisted canvas-v2 path.

Videos receive a typed placeholder on the shelf and open the existing video Review element. Only the selected persisted output is projected. Stale inputs and QA flags remain separate from steward approval and client acceptance. Checking/reconciliation remain uncertain states, never simulated completion. Customization is browser-local, brand scoped, sanitized, and retains the existing storage key for compatibility. No cloud synchronization is implied.

## Source and merge provenance

201 files were imported individually from the uncommitted main office implementation, including generated art, role characters, vendor code and licenses. Source SHA-256 hashes and integrated hashes are in `2026-10-08-office-integration-provenance.json`. All 201 source hashes still matched at verification. No credentials, local fixtures or unrelated demo package scripts were copied. Existing package scripts, Vite chunks, JEV, execution spend, recovery and canvas feature gates were preserved.

Adapted source files: AgencyOffice gains shared selection/workflow/media handling; office-model handles uncertain/pending review states; office-preview selects Plex; the asset test uses original source SHA hashes rather than requiring an unshipped artifacts directory. Additional adapter/surface-preference tests and the synthetic seeder are recorded in the manifest. Original generated assets are unchanged; the original source handoff document remains historical evidence, not acceptance evidence for this integration.

## Verified locally

| Check | Result | Scope |
| --- | --- | --- |
| Office unit tests | 38/38 | Selection projection, video/image distinction, workflow, uncertainty, storage, attachment geometry, assets and existing brand flow |
| Canvas unit tests | 16/16 | Permissions, selected upstream snapshot, quote claims/expiry, CAS, graph and review controls |
| Text spend unit tests | 6/6 | Local HTTP mock only; no paid requests |
| Creative unit tests | 26/26 | Contracts and fail-closed boundaries |
| Production build / diff whitespace | Pass | App plus office-preview entry; build log in output/office-integration |
| Customize/reload | Pass | Add Snake plant, move by controls and keyboard, Cream desks; persisted geometry and controls after reload |
| Image/video Review | Pass | Exact selected persisted image URL; video element with empty synthetic stub, playback unverified |
| QA/workflow review | Pass | Flagged/stale text retains steward approval; image shows client approval; video remains Draft |
| Quote Deny | Pass | Single shared dialog, closes without a run |
| Quote approval preflight | Pass | Forced expiry on synthetic quotes; Approve rejected with QUOTE_CHANGED before execution |
| Surface protection | Pass | Background switch inert while modal open; six graph nodes and pending run retained across surface round trip |
| Pending quote guard | Pass | Existing pending node cannot obtain duplicate quote |
| Ledger/run safety | Pass | Four runs, three outputs, one ledger row, signed credit sum -300 before and after; all runs remain synthetic, pending row retained |
| 390px responsive remediation | Pass | Page scrollWidth 390; usable office controls >=44px, keyboard focus visible, dialog 366px and all dialog buttons 44px |
| 1024px tablet width | Pass | Page scrollWidth 1024; office buttons >=44px; real coarse pointer unavailable, width rule verified |

Evidence: `output/office-integration/browser-checks.json`, `ledger-check.json`, `build.log`, `creative-unit.log`, `impeccable-detector.json`, and desktop/mobile/tablet/customization/review PNGs. Focused IAB checks are not a second-engine, screen-reader, full language or physical-device suite. Fixture credentials remain in ignored `.mvp-local/office-fixture.json`, never in evidence. The synthetic certification is not human client certification. The video stub is deliberately unplayable.

## Impeccable remediation and remaining limits

The narrow office pass preserves Plex Sans/Serif/Mono and supplied art. Fixed mobile topbar overflow with route-scoped wrapping, enlarged office controls and label hit areas, retained scroll inside the scene, and raised review-label legibility to graphite 11px on white. Current platform tokens now control office panels, selection and review labels. No Inter was introduced. The unused office-map width transition is overridden off; the detector still reports its original declaration, which is not effective in this integration.

The four concrete follow-ups are now remediated: image/video original links use translated media-specific labels; proven QUOTE_CHANGED/QUOTE_REQUIRED rejection clears optimistic busy state while accepted/unknown submission stays reconciliation; all stock/custom catalog names, controls, placement hints and scene selection labels use EN/ES/AR catalogs with persisted IDs/values unchanged; operational controls now use light/dark Plex colors independent of CSS import order. Two submission regressions and complete stock/catalog locale coverage are added to the office suite (38 total).

The measured expired-approval regression has identical before/after database snapshots: four runs, three outputs, one ledger row, signed credits -300, zero execution-spend holds, same selected output ID with flagged status, steward approval and stale=true. Browser status restores immediately without reload. Evidence is rejection-regression.json and rejection-restored.png.

Focused IAB checks render the 24 catalog items in Spanish and Arabic, preserve stored selection/geometry and category values, and verify RTL. A separate synthetic harness at docs/mockups/office-check renders the same production office components with a dedicated storage scope, theme controls and CSS zoom; it makes no API or generation requests. Enabled customization buttons/selects and desk controls have sampled minimum contrast 15.85:1 light and 12.50:1 dark. At 200% CSS zoom and 390px width, page scrollWidth is 390, no operational controls extend past the viewport, and keyboard prop movement has a visible focus outline. This is CSS zoom, not native browser/text-only zoom. Dark, dark-zoom-200, light-zoom-200, Spanish and Arabic screenshots are saved.

Remaining limits are manual/artwork qualification rather than the four concrete implementation defects: screen reader, native zoom, physical/coarse touch and drag, illustration micro-label readability, all-state contrast and linguistic sign-off, animation semantics and slow-device performance. Legacy fallback end-to-end browser acceptance and broad full-product localization remain pending.

No provider calls, real client changes or hosted migrations occurred. Successful live generation, valid video playback, genuine client acceptance, hosted storage/Inngest recovery, deploy/rollback and paid route qualifications remain external gates. Current office integration does not close those gates or imply platform-wide parity completion.

Validation exit statuses are recorded separately in `output/office-integration/validation-status.json`: office units 0 (38 pass), canvas units 0 (16 pass), production build 0, diff check 0, detector 2 (one known inactive source width-transition warning). The detector status is not a test/build/diff failure. No new effective layout-transition finding was verified.
