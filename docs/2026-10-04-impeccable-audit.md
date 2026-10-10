# CaastorOS integrated MVP: Impeccable audit

4 October 2026. Scope: the canvas workspace, extracted controls, component reference, media/email review additions, route loading and operator execution evidence. This is a focused technical audit, not a site-wide WCAG certification or proof of client outcomes.

## Implementation integrity verdict

**Pass within this scope.** The editor is an operating surface built around certified BIO, brief inputs, specialist artifacts, versions, credit approval and review. The original report preserved a legacy identity incorrectly assumed current. It is superseded by the user-confirmed Plex Registry correction. Mineral graph surfaces, IBM Plex typography and cobalt controls now load; borders and typography carry the hierarchy. No decorative metrics, invented customer claims or generated stock hero imagery were added.

The bundled detector was run once on the earlier visual scope. Its Geist exception and health score below are historical, not current Plex Registry validation. Its two warnings were checked: the Geist warning conflicts with the incumbent typography and is intentionally retained; the overshooting `--ease-spring` curve was replaced with the existing smooth `--ease-out` alias. Subsequent loading, measurement and status-caption changes were reviewed directly. Detector results are in `/tmp/caastoros-impeccable-audit.json` on this test host; they are not a global clean bill of health.

## Health score

| Dimension | Score / 4 | Evidence and limit |
| --- | --- | --- |
| Accessibility | 3 | Keyboard graph editing/connections; focus trap, inert background, Escape and pointer/keyboard focus restoration pass in Chromium/WebKit. Sampled text contrast passes. Manual screen-reader and complete zoom testing remain. |
| Performance | 3 | Route split reduces main JS from 774.66 to 526.11 kB; production navigation passes. Network/CPU-throttled LCP, INP and CLS remain unmeasured. |
| Responsive design | 3 | Canvas list/inspector/picker checks at 390/768/1024 coarse widths and desktop 1440; Spanish/Arabic, long titles and 200% CSS zoom pass in both browsers. Interactive coarse targets measure ≥44 px. Physical devices, native browser zoom and assistive technology remain untested. |
| Theming | 3 | Semantic surfaces, paired status text colors, light/dark reference and reduced-motion controls verified. Legacy screens outside this slice still contain literal styles. |
| Implementation integrity | 4 | Real shared primitives, explicit simulated-preview banner, credit-only client execution UI, persisted approval/provenance, role-gated operator costs; detector exceptions documented. |
| **Total** | **16 / 20** | **Good; scoped pilot evidence, with release gates below.** |

## Remediated findings

- **P1 — Dialog focus loss in WebKit:** cleanup now restores focus after portal removal; pointer triggers are captured explicitly, including Review. Tested both entry methods.
- **P1 — Low-contrast status captions:** failure/running text used vivid fill colors on small artifact captions. Added `--text-danger` / `--text-warning` light/dark pairs and switched captions to those foregrounds. Fill colors remain available for ports/icons.
- **P1 — Text approval transaction gap:** quote consumption, run insertion and credit hold now share `create_canvas_text_run`. Concurrent claims have one winner; failed reservation rolls back the quote/run. Interrupted execution after commitment now has durable evidence and operator reconciliation; see the recovery drill below.
- **P2 — All routes loaded at startup:** `portal-briefs` and `portal-discovery` now load on navigation with a localized Suspense fallback. The existing error boundary handles rejected imports. Shared boot primitives remain eager.
- **P2 — Duplicate component styles:** Dialog, PanelHeader, IconButton and ActionButton now have a shared source; control metrics and focus/reading tokens are documented in `DESIGN.md`.
- **P2 — Incomplete outcome evidence:** atomic database events and the operator view now expose real review transitions, content revisions, errors and usage provenance. Internal approval is distinct from client acceptance; unknown costs remain null.

- **P1 — Interrupted canvas text execution:** `text_execution_evidence` persists submission boundary, provider receipt, completed generation, usage/finalization and heartbeat. A local Inngest cron quarantines expired executions without retry/refund. An MFA-protected operator can recover completed output or release credits only with an explicit no-charge confirmation/reference. Interrupted QA recovery yields a flagged draft. The SSE contract remains intact. `settle_canvas_text_run` rejects stale workers and altered finalization; service-only RPCs serialize settlement/recovery.
- **P2 — Translated state used as an internal identifier:** status codes, workflow actions and physical Delete keys now stay fixed across languages. Labels and known errors translate; source catalog JSON imports are compatible with the Node test runtime.
- **P2 — Physical coarse targets and long notices:** reused unscaled node list through 1024 px coarse layouts; field/action targets ≥44 px, Arabic direction retained, long content wraps. Notices do not intercept taps and clamp to three lines instead of covering the list.

## Remaining findings

**No open P1 in the exercised local paths; three P2 verification/migration findings remain.** Paid provider and staging proof are separate release gates, not established by this score.

### P2 — Complete accessibility and language verification needs human/device review

The existing node list already replaced the graph below 640 px; this was never evidence that mobile users had to operate scaled graph ports. The list now also serves coarse pointers up to 1024 px, with a localized inspector, native connection selects, picker and review controls. Named header/panel/field/tier targets measure ≥44 px in Chromium and WebKit, including WebKit selects that ignored `min-height` until an explicit height was supplied. The desktop graph retains its coordinates and zoom controls; tiny transformed ports are not claimed to meet touch target criteria.

`check-canvas-locales.mjs` passes 132 checks across Spanish/Arabic, 390/768/1024/1440 widths, long Arabic names, localized run approval and 200% CSS zoom. This is automated layout zoom, **not a completed native browser zoom or physical-device accessibility audit**. Manual screen-reader, real touch pointer-cancel/scroll and complete OS shortcut testing remain. Static canvas controls, status/workflow labels, dates/numbers, graph connection errors and known API error codes use the shared catalogs. Proper specialist/department names and authored/provider content remain as supplied; uncatalogued backend errors and legacy operator UI still need a broader language review. Catalog presence is not linguistic sign-off.

### P2 — Initial loading still needs real-device performance measurement

Location: `src/main.jsx` eager shared, team/admin, auth and shell modules. Main JS is 526.11 kB (165.69 kB gzip), React/Supabase add 352.32 kB before gzip. Further splitting team/admin without an export-boundary refactor risks settings consumers that read those globals during boot. The low-risk heavy screen split is complete. Capture cold-cache waterfalls and LCP/INP/CLS on a low-end mobile device under throttling before another split. Suggested command: `$impeccable optimize`.

### P2 — Full legacy token migration remains outside the extracted slice

Location: legacy portal screen inline styles. Existing shared controls are adopted by the new media/email/canvas surfaces, but the full app is not uniformly composed from them. Extend the reference to settings/review states as those screens are changed; preserve their existing behavior. Suggested command: `$impeccable extract`.

A final visual pass should follow physical-device and language review.

## Browser and contrast evidence

- `scripts/check-mvp-browser.mjs`: Chromium and WebKit, actual local auth/API; home → lazy Briefs → lazy BIO → Canvas; save/reload; reference light/dark at 390/768/1440; keyboard/pointer dialog restoration; reduced motion. Also passes against the production build at port 5185.
- `scripts/canvas-browser-check.mjs`: intercepted provider-free graph/text/media contracts; desktop 1280/1440/1920, dark/RTL/mobile screenshots; gestures, keyboard connections, review and approval. Chromium and WebKit pass.
- `scripts/check-design-reference.mjs`: sampled body/value/placeholder/action/status text contrast ≥4.5:1 in both settled themes; 390 px coarse-pointer actions ≥44 px; no reference overflow. The body/background theme transition must finish before sampling. This checks named samples, not every state or status in the entire application.
- `scripts/check-measurement-browser.mjs`: real local TOTP/AAL2 operator account; execution outcomes table renders acceptance, revision/error counts, cost provenance and shadow recommendations. Evidence values are synthetic.
- `scripts/check-text-reconciliation.mjs`: 26 real local checks; actual SIGKILL after claim and durable generation, expired-heartbeat hold, AAL1/client denial, incomplete evidence rejection, one refund, concurrent recovery/normal settlement, stale-worker/finalization fences and safe client state. Zero provider calls.
- `scripts/check-text-recovery-browser.mjs`: 12 checks in Chromium/WebKit; actual AAL2 UI, reason/reference/confirmation requirements, Escape/focus restoration, flagged draft recovery, unknown cost and one refund.
- `scripts/check-canvas-locales.mjs`: 132 rendered locale/touch/layout zoom checks in Chromium/WebKit.
- Local screenshots/results: `.mvp-local/browser/`; WebKit canvas screenshots: `/tmp/caastoros-canvas-webkit-final/`. Local evidence is ignored by Git; scripts reproduce it.

## Visual baseline correction

The user rejected the older design reference and identified `http://localhost:5189/#/bio` as current. Its listener serves `caastoros-mvp-review-d969b6` (`334029e`) with Plex Registry. The source skin/font definitions and shell defaults now load in this integration, with a marked canvas/theme bridge. Desktop reference colors/fonts/corners, inspector, dialog dismissal and theme rendering were inspected; production build passes. Previous Chromium/WebKit/mobile/locale reports refer to the earlier skin and do not establish new visual parity. The 390px inspector and approval dialog have no horizontal overflow and 44px action/input/select targets; Deny restores focus to the run trigger. Direct authenticated BIO comparison and broad both-engine/locale regression remain pending. See `DESIGN.md` and `2026-10-04-design-alignment-source.json`.
