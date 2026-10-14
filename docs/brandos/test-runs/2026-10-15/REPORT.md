# VDS harness rehearsal — executed 14 October 2026

Requested evidence folder is 2026-10-15; actual execution date is 14 October. **Engineering is improved; the complete v3 demo has not passed.**

## Integration and branches

`test/vds-integration` implementation tip `57bb4ea`: A→B→C merged in order. Shared migration inventory/test registration resolved by orchestrator. **757 tests and build PASS.** Root writes no feature code. Review-only `test/vds-gate-candidate` includes A/B/C/D plus shared locale/test integration, **772 tests and build PASS**, but D live state gate FAIL, so D is not merged into integration. Discovery is separate from fix/discovery-quality, 612 registered tests/build PASS.

| Stream | Branch | Feature commit / latest feature branch tip | Checks | Outcome |
|---|---|---|---|---|
| A | fix/vds-reference-intake | 5f088d2 | 21 focused +6 real DB +5 pgTAP; build | engineering PASS; v3 human pending |
| B | fix/vds-image-export | f1687c4 (initial72ab4bb) | 14 focused +717 branch units/build | actual v2 social/email/export PASS after repair |
| C | fix/vds-reviewer-durability | 32b717e | 51 focused +717 branch units/build | real restart recovery PASS |
| D | fix/vds-canvas-library | b5b2a06 | 14 helper +718 branch units/build | FAIL shelf Complete vs needs_review, unmerged after2 rounds |
| E | fix/vds-discovery-extraction | 5ab09d4 / d75190d test registration | 612 registered units/build | real-site extraction PASS, honest foundation still gated |

All five feature branches pushed. No push to dev/main, integration or gate candidate. No production writes or seeds. Local schema backed up, additive reference intake migration applied in one transaction; no reset. Paid model calls used only the existing local v2 foundation.

## Actual rehearsal steps

| Step | Outcome | Seconds | Provider estimate $ |
|---|---|---|---|
| Owner/client/CD login + recovery + client admin/team denials | 200 on reads; client403 restrictions; 3 old tasks recover | 0.337 /0.159 /0.177 | 0 |
| NEW photo upload → rights → v3 | BLOCKED: user must upload and deliberately confirm rights | not run | 0 spent |
| v3 CD S2 brief + client question/answer + certify | BLOCKED on v3 and actual human decisions; no scripted impersonation | not run | 0 spent |
| Existing-v2 social engineering run | provider used3 approved old refs, uses_reference=true, OCR0, all checks pass; embedded logo/Fraunces/photo | 92.884 | 0.0943 |
| Initial existing-v2 three emails | FAIL CLOSED: standalone full-font HTML >80KB | 28.998 | 0.0280 |
| Repaired existing-v2 three emails | all3 checks/model review pass; standalone ~525KB, transport ~12.4KB; delivery_ready=false, hosting needed | 28.899 | 0.0322 |
| Saved social PNG API export | 200 image/png, real1080×1350; stable embedded assets | 1.264 | 0 |
| Library social PNG download via UI | actual download observed in Downloads; viewer says Needs review | browser check | 0 |
| Restart integrated API and replay new social/email | recovered=true, v2/source provenance retained, all item checks pass; PNG200 | 0.231 /0.167 reads | 0 |
| Library three cards / Canvas / office | Library/graph pending review correct; office shelf erroneously COMPLETE | browser checks | 0 |
| La Más Bonita public extraction rerun | actual75×95 logo.webp, primary#6fd4e4 declared CSS; score70 and rights/font gaps retained | 0.54 | 0 |

Total current-session provider estimates **$0.1545** including failed attempt. No individual run exceeded $0.30 or120s. Costs are recorded adapter estimates, not invoices. CSS text/logo in social composite are drawn after generation; generated photograph has no legible text per OCR and visual inspection. v2 tests do not substitute for NEW-v3 acceptance.

## Evidence

02 recovered board; 03 email Library cards; 04 failing office shelf; 05 email graph; 06 real reference upload controls; 07 actual social viewer. engineering-v2-social_post.png is the actual generated composite, not a mock. engineering-v2-repaired-email_sequence-*.html are actual stable exported emails. Failed original email evidence is retained. Recovery JSON contains role/status/provenance, not auth tokens. Actual markup/CSS manifest and fixtures are on E branch; discovery-extraction-rerun.json here is read-only evidence, not a new persisted paid Discovery run.

## Not demo-ready / Oscar actions

1. User uploads NEW product photos in Cake Me Brand Core and confirms actual rights; owner attests exact new version, CD reviews with S2/client conversation and certifies. None was manufactured by this agent. Follow the actual product flow.
2. D shelf status mapping still false; two authorized repair rounds exhausted. Request for one extra focused round is pending. D remains unmerged unless authorized and fixed.
3. Email transport drafts are not send-ready until stable hosted assets are configured. Standalone offline HTML and social PNG are verified. Outbound email remains disabled.
4. Active workers/failed rerun attempts without outputs are still transient; completed snapshots recover. Remote deployment needs installed configured browser runtime for PNG; missing runtime fails closed503.
5. Task credits12 social/6 email/2 rerun remain labeled provisional in settlement source and require Oscar pricing sign-off. This rehearsal did not approve prices.
6. La Más Bonita still needs rights-confirmed stored logo and a licensed display font; extraction fixes do not certify it or fabricate a higher score.

Local integration UI/API: http://127.0.0.1:5196 /8796. Review-only D candidate: http://127.0.0.1:5197 /8797. Existing local test accounts from the14October report remain; no passwords are duplicated in new evidence.
