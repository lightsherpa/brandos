# BrandOS harness: hero flow and UX for four screens (VDS Valencia, 21 Oct 2026)
Author: Maya (Head of Product) for Kai (CTO). Written Sun 11 Oct 2026 (Madrid), due Mon 12 Oct.
Sources: `brandos-harness.md`, `ui-v2-codex-brief.md` (Press Proof), `/workspace/ui-anti-slop-review.md`, `/workspace/caastoros-product-audit.md`, `/workspace/notion-vs-code-status.md`, repo snapshot `/workspace/caastoros/CaastorOS` (read only, nothing changed).
Wireframes: `/workspace/brandos/wireframes/01-04*.png` (rendered in Instrument Sans, Instrument Serif and Geist Mono). Reference images: `/workspace/brandos/refs/`.

Tags: **[exists]** = in the main code today. **[branch]** = only on `rc/caa-44-rc1` or PR #6, not deployed. **[build]** = has to be built. **[fake]** = staged for the demo only.

## 0. Alignment with Press Proof, and conflicts to settle
Matches the brief: Instrument Sans for UI, Instrument Serif for titles and big numbers, Geist Mono only for IDs, hex codes and timers. Warm grey paper, near-black primary, 1px hairlines, radii 4 / 8 / full, one primary button per view, sentence case, yellow `#F8C036` only for seal, highlight and logo (at most 3 per view), motion 120-240ms UI and 400-520ms ceremony on `cubic-bezier(.2,.7,.2,1)`, reduced motion respected. Oscar's font constraint and the brief agree, so there's no font conflict.

Conflicts and gaps to settle:
1. **Scope.** Press Proof is "CSS and markup only, no logic or API". All four screens in this spec need new data (plan object, check events, fix loop, output certificate, rules). Run them as a separate track that **uses** the v2 tokens, not inside the Press Proof PR.
2. **Status colour.** The brief has no status colours. I use green / amber / red only as 8px dots plus a word ("passed", "fixing", "failed"), never as fills, borders or text colour (except the struck word in the fix diff). Confirm with Claude.
3. **The highlight.** On the live screen the off-brand word gets a yellow highlight. That counts as 1 of the 3 yellow uses, with the logo as the second. No other yellow on that screen.
4. **Naming.** The seal must say "Creative Director". The Steward → Creative Director rename is branch only [branch]. It needs to land before the 16th freeze or the seal copy will contradict the UI.
5. **Seal meaning.** The brief's seal is for the brand profile. This spec adds a second seal for a **run's outputs**. Use the same shape with a different inner line ("Brand certified" vs "Proof certified · CRT-0142") so they aren't confused.

## 1. Hero flow: stage script (about 4 min 30 s)
Setup: laptop on a phone hotspot, demo brand already certified in production, replay mode loaded in a second tab, fallback video on the desktop. Demo brand (example used below): a specialty coffee roaster, never-say list includes "cheap", "deal", "hurry". **The off-brand catch must be seeded**: the golden brief invites price language, and Ada's prompt for the email writer is tested so the first draft trips the never-say check most of the time. If it doesn't trip live, the replay shows it (see fallback).

| # | Time | On screen | Oscar says (draft) | Live or staged | Fallback | Code status |
|---|---|---|---|---|---|---|
| 1 | 0:00-0:35 | Brand profile cover (Press Proof mock A): brand name in serif, yellow "Brand certified" seal, "Certified 2 Oct by Rana Ortega, Creative Director" | "This is a brand that a designer has certified. Everything an agent does from here starts from this, and only this." | Staged (opened before going on stage) | Screenshot | [exists] BIO + certification gate (`load-brand-bio.js`, `BIO_NOT_CERTIFIED`, 12/12 prod). Cover UI is Press Proof [build, in progress] |
| 2 | 0:35-1:05 | Brief composer: one sentence typed live, "Launch our spring blend to returning customers" | "I give it a brief, the way I'd give it to an agency." | Live typing; brief text pre-copied on clipboard | Paste from clipboard | [exists] brief intake + Sharpener (`lib/sharpener.js`). Skip the 2-3 clarifying questions on stage (pre-answered or hidden) |
| 3 | 1:05-1:45 | **Plan view** (screen A): goal sentence, 4 numbered steps (message spec, email, landing page, 3-slide deck), the crew per step, the checks per step, "max 2 fix passes" | "Before anyone writes a word, Brandolph shows me the plan: who works, in what order, and what each piece gets checked against." | Live call, fast (Sharpener `deliveryPlan` mapped into the plan object) | Replay of a recorded plan | [build] plan object + UI. Data partly [exists] in Sharpener `deliveryPlan` (deliverables × crew). Checks per step [build] (check registry) |
| 4 | 1:45-2:35 | **Live crew + checks** (screen B): steps tick through; email draft streams in; never-say check flags "cheap", highlighted and struck; fix instruction shown; draft 2 replaces the word; check turns to "failed → fixed" | "Here's the moment. The email writer used 'cheap'. This brand never says cheap. The check caught it, told the agent why, and the agent fixed it. No human had to see the bad version." | Live SSE stream. The catch is seeded but real | Replay mode plays the recorded event stream at real speed; video if replay fails | Streaming [exists] (`runs.js` SSE). Voice QA regex [exists] (`qa-voice.js`) but today it only marks `flagged`. Fix loop, fix instruction and the diff UI [build]. Cap of 3 agents per run (`.slice(0,3)`) is OK for this crew of 3-4 if the message spec is not a separate agent call |
| 5 | 2:35-3:15 | Formats side by side: email, landing page, 3-slide deck, all carrying the same headline. Oscar edits the headline once and all three update | "One message, three formats. Change the headline and every format follows." | Live render from Kai's demo-only preview | Static PNGs of the three | [build] Kai's demo-only preview (approved by Oscar). Production agents only output text for these today (audit) |
| 6 | 3:15-3:50 | **Seal ceremony** (screen C): three proofs, Creative Director (Rana, on stage or on a second laptop) clicks "Certify proof", yellow seal stamps in (480ms), certificate line shows ID, profile version, checks passed, fixes | "Then a real designer signs it off. That's the difference between us and a prompt box." | Live click; certificate record can be fake for demo | Pre-signed state on a second tab | [build] output certificate. BIO certification engine, four-eyes and `cert_decisions` audit [exists] and can be reused. For the demo a single insert is enough |
| 7 | 3:50-4:30 | **Learned a rule** (screen D): before/after, proposed rule "Never frame the coffee by price", Creative Director approves; Oscar reruns the same brief; the new run shows "Rule obeyed · 0 fix passes" | "And this is the part nobody else does. That correction is now a rule. Run it again and the agent doesn't make the mistake in the first place. The brand gets smarter every time a designer touches it." | Rule creation live; the rerun is **replayed** (a second full run costs time and money on stage) | Video of the rerun | [build] rule store + inject into agent context. `brand_signals` logs edits [exists] but doesn't change rules |
| 8 | 4:30 | Back to the cover, rule count went from 0 to 1 | "Certified brand, governed output." | Staged | — | — |

Timing guard: if beat 4 runs over 60s (slow model), Oscar says "while it writes…" and narrates the plan; at 75s switch to replay with one keystroke (see build notes).

## 2. UX spec for four screens
Common anti-slop rules for all four: no mono uppercase micro-labels (labels are sentence case Instrument Sans 13-14px in muted grey); no indigo or violet, no gradients, no glow; no coloured left borders on cards; no sparkle or magic-wand icons; no "AI is thinking" pill or shimmer; no chat bubbles, avatars or typing dots; no card soup (use hairline rules and a 12-column grid); one filled button per view; agents are named by role ("Email writer"), never with robot icons or emoji. Numbers that matter use big Instrument Serif. Timers and IDs use Geist Mono.

### A. Plan view
**Purpose.** Show that Brandolph thinks before it acts: what will be made, by whom, in what order, against which checks. It's the "execution plan as an artifact" from the harness doc. The user can read it in 10 seconds and press one button.

**Layout** (12-col; plan 7 cols, context 4 cols; see `wireframes/01-plan-view.png`):
```
| Caastor     | Run plan · Spring launch                         (serif 48)        |
| Brand prof. |-------------------------------------------------------------------|
| Briefs  ●   | Brandolph · plan v1 · 4 steps · est. 2 min    | Reads from       |
| Runs        | Goal                                          | brand profile v7 |
| Rules       | Launch the spring blend to returning…  (serif)| Voice: warm…     |
| Library     | ───────────────────────────────────────────── | Never say: …     |
|             | 01  Message spec   Copywriter · checks: voice | Palette: …       |
|             | 02  Email          Email writer · never-say…  | Certified 2 Oct  |
|             | 03  Landing page   Page writer · palette…     |                  |
|             | 04  3-slide deck   Deck writer · logo use     |                  |
|             | [ Run plan ]  [ Edit plan ]           ⋯       |                  |
```
**Components.** Serif step numbers (40px); step row = deliverable, crew role, check list as plain text; context column = the exact profile slices each agent will receive (the "context contract", made visible); plan meta line (version, steps, estimate, fix-pass cap); primary "Run plan", secondary "Edit plan", the rest under ⋯ (cost estimate, model per step).
**States.** Empty: "Write a brief and Brandolph will plan the work." Running (plan being written): steps appear one by one as they arrive, with the meta line saying "Planning… step 2 of 4"; no spinner. Error: "Brandolph couldn't plan this brief. Try a shorter brief or pick formats by hand." with "Pick formats" as the only button. Done: as drawn. Uncertified brand: plan is visible but "Run plan" is replaced by "Certify brand to run" (mirrors `BIO_NOT_CERTIFIED`).
**Microcopy.** "Run plan", "Edit plan", "Checks", "Reads from brand profile v7", "Max 2 fix passes". Never "Generate", "Magic", "AI-powered".
**Motion.** Steps fade and rise 4px, 160ms each, staggered 60ms. Hover a check name: the matching line in the context column underlines (shows the link between check and profile).
**Anti-slop specifics.** No flowchart/node graph with bezier lines (the current InteractiveCanvas reads as a toy); no checkbox to-do list styling (it's a plan, not tasks); no avatars per agent.

### B. Live crew + checks
**Purpose.** Make the work and the guardrails legible while they happen, and make the self-correction the star. The audience must see the off-brand word, the reason, and the fix in under 10 seconds.

**Layout** (steps rail 4 cols, current output 8 cols; see `wireframes/02-live-crew-checks.png`):
```
| Running · Spring launch                                                    |
| Step 2 of 4 · 0:47 · 1 fix pass  |  Email · draft 2                        |
| ● Message spec   done   0:12     |  Subject: The spring roast is back      |
| ● Email          fixing 0:31     |  Our spring blend returns this week…    |
| ○ Landing page   queued          |  Get it before it's gone — a [cheap]    |
| ○ 3-slide deck   queued          |  → a small ritual.                      |
|                                  |  ─────────────────────────────────────  |
|                                  |  Checks on this draft                   |
|                                  |  ● Never-say list   failed → fixed      |
|                                  |  ● Claims           passed              |
|                                  |  Fix instruction sent to Email writer:  |
|                                  |  "cheap" is on the never-say list…      |
```
**Components.** Step rail (dot + role + status word + mono timer), like a CI job list. Output pane that streams the real text. Inline flag: yellow highlight on the offending span, then strike-through in red with the replacement in green underneath (Grammarly-style, but on paper). Check list under the output with status words. "Fix instruction" block quoting the remediation text the check returned (that's the harness "fix-it message" made visible). Draft counter ("draft 2"). Header actions: "Stop run" secondary; no primary while running.
**States.** Empty: never shown (only reachable from a plan). Running: rail ticks; streaming text has a 1px caret, nothing else. Check failed: row says "failed", the span highlights, rail step says "fixing", fix-pass counter increments. Fix loop exhausted (2 passes): "Needs a designer: still fails Never-say list after 2 fixes" with "Send to Creative Director" as primary. Error (model or network): "Email writer stopped responding. Retry this step" (only that step reruns). Done: all dots green, header becomes "Ready for proof" and primary "Review proofs".
**Microcopy.** Status words: queued, writing, checking, fixing, passed, failed → fixed, needs a designer. Never "Thinking…", "Working on it ✨".
**Motion.** Highlight fades in 160ms; strike draws left to right 240ms; replacement slides in 200ms. Rail dots change colour with a 120ms cross-fade. No pulsing, no shimmer. Reduced motion: instant swaps.
**Anti-slop specifics.** No chat transcript of agents talking; no "agent avatars in an office" (the pixel-art Agency Office should not appear in the pitch); no raw JSON log; the log is available under ⋯ "Show trace" for the CTO, not on stage.

### C. Seal ceremony
**Purpose.** The human moment. A named Creative Director certifies the run's outputs; the certificate is specific and auditable, not a confetti screen.

**Layout** (see `wireframes/03-seal-ceremony.png`):
```
| Spring launch                                                              |
| [ Email proof ] [ Landing page proof ] [ Deck · 3 slides ]     ( SEAL )    |
| ────────────────────────────────────────────────────────────────────────── |
| Certificate CRT-0142 · brand profile v7 · plan v1 · 11 checks · 1 fix      |
| Signed 21 Oct 2026, 11:42 · Creative Director Rana Ortega                  |
| [ Certify proof ]   (after: [ Download proofs ])                           |
```
**Components.** Three proofs on paper with crop/registration marks at the corners (press-proof motif, hairline, not decorative everywhere). Seal: outline circle before, filled `#F8C036` after, serif "Certified", name and mono certificate ID. Certificate line = the audit summary. Signer block: name, role, timestamp. Primary "Certify proof" (only for the Creative Director role); client sees "Waiting for Creative Director".
**States.** Empty: "Nothing to certify yet. Finish a run first." Pending: outline seal, "Waiting for Rana Ortega". Running (signing): button disabled 300ms, no spinner. Error: "Couldn't record the certificate. Nothing was signed. Try again." Done: filled seal, certificate line, "Download proofs". Revoked: seal turns to outline with "Revoked 22 Oct · reason", mirrors decertification [exists for BIO].
**Microcopy.** "Certify proof", "Certified by", "Certificate", "Revoke". Never "Approved! 🎉", "Looks great!".
**Motion.** One stamp: seal scales 1.08 → 1.0 with a 2° rotation settle, 480ms on the ceremony ease; ink fill wipes in from centre. Nothing else moves. Reduced motion: fade 200ms.
**Anti-slop specifics.** No confetti, no checkmark-in-circle success modal, no green banner, no badge with gradient or shine.

### D. "Learned a rule"
**Purpose.** Prove the brand brain learns: a designer's correction becomes a written rule in the brand profile, and the next run obeys it. This is the "unprecedented" moment, so the rule must read like a style-guide line a designer would write, not a model artefact.

**Layout** (see `wireframes/04-learned-a-rule.png`):
```
| Learned a rule                                                             |
| From your correction on Email, draft 2      | Next run · same brief        |
| Before  "…a cheap treat."     (muted serif) | ● Rule obeyed                |
| After   "…a small ritual."    (serif)       | ● Never-say passed 1st try   |
| ─────────────────────────────────────────── | ● Fix passes 0 (was 1)       |
| Proposed rule                               |                              |
| Never frame the coffee by price. (serif 40) |                              |
| Applies to: copy agents · Checked by: …     |                              |
| Adds to brand profile v8 · needs CD approval|                              |
| [ Approve rule ]  [ Edit wording ]          |                              |
```
**Components.** Before/after pair; proposed rule in large serif, editable inline; scope line (which agents get it in their context, which check enforces it); version line (v7 → v8, approval needed, because the BIO is the system of record); right column "Next run" comparison that fills in after the rerun. Rules list page (sidebar "Rules") shows each rule with its source correction, date, approver and times enforced.
**States.** Empty (rules page): "No rules yet. When a Creative Director corrects an output, Caastor proposes a rule here." Proposed: as drawn. Running (rerun): right column rows appear as the rerun checks land. Error: "This rule conflicts with 'Mention value packs in promos'. Pick which one wins." Done: "Rule 1 of 1 · added to brand profile v8 by Rana Ortega", rule count on cover increments.
**Microcopy.** "Learned a rule", "Proposed rule", "Approve rule", "Edit wording", "Obeyed". Never "AI learned!", "Memory updated ✨".
**Motion.** Rule sentence types nothing; it appears whole with a 200ms fade (typing effects are slop). On approve, the version line ticks v7 → v8 (number roll, 240ms).
**Anti-slop specifics.** No brain icon, no "memory" sparkles, no toast as the only evidence; the rule lives on a page you can open.

## 3. Reference dive
Searched Mobbin (web screens) and Refero (web screens) via the connectors. URLs are exactly as returned. Downloaded images are in `/workspace/brandos/refs/`. Note: several returned references are themselves AI-slop examples; they're listed under "avoid" on purpose.

### A. Plan view
| Reference | URL | Take | File |
|---|---|---|---|
| Microsoft Copilot, "Edit research plan" | https://mobbin.com/screens/5e05dc5f-b40b-4df7-8c69-c81e71d20fcf | Plan shown before work starts with estimated time and one dark primary ("Start research"); editable plan. Take: plan-then-run gate, time estimate in meta line. Leave the chat bubble and pastel chip | `refs/mobbin-copilot-edit-plan.jpg` |
| Descript Underlord, project plan | https://mobbin.com/screens/ee6bcb01-04ba-40f1-b108-4ad5f83adc62 | Plan as plain bold-led statements, then "proceed or adjust?". Take: plan steps written as sentences with the key noun bold. Avoid: lavender bubble, "Analyzing steps…" pill | `refs/mobbin-descript-plan.jpg` |
| Linear (Refero) | https://images.refero.design/screenshots/linear.app/desktop/8816af92-ed50-46c6-a7dc-ad17edea6aef_preview.jpg | Dense list rows, hairlines, quiet meta text. Take: row rhythm and meta typography for steps | `refs/refero-linear-1.jpg` |
| Linear (Refero) | https://images.refero.design/screenshots/linear.app/desktop/a0a3f2b5-4dec-4c14-8891-82783068e459_preview.jpg | Same, a second view for property column alignment | `refs/refero-linear-2.jpg` |
| Factory.ai session (Refero) | https://app.factory.ai/sessions/7C9dz5A8CVD1Xr44pbPJ | Agent session with plan and progress; take the step numbering and compact status, not the dark theme | `refs/refero-factory-session.jpg` |
| Avoid: Tana agent, Gumloop, Higgsfield | https://mobbin.com/screens/655ddfbf-d2cd-42dc-bc74-a259e64071c1 · https://mobbin.com/screens/d2bf4000-dac2-4700-acd4-4512d4e8e610 · https://mobbin.com/screens/79203651-6381-4d06-9b00-5075295ab903 | Gradient avatar orbs, mascot blob, holographic character, card grids of "get started" tiles. Exactly what Oscar calls slop | — |

### B. Live crew + checks
| Reference | URL | Take | File |
|---|---|---|---|
| Browserbase run timeline | https://mobbin.com/screens/38e3e1bc-2a5c-4f7b-aa64-00ab6f736224 | Left: ordered step list with type and mono timestamps; right: result pane. Take: rail + pane split, timers per step. Avoid: coloured type tags | `refs/mobbin-browserbase-run-timeline.jpg` |
| AirOps workflow logs | https://mobbin.com/screens/6dadd86c-1a15-47ea-b654-a45132bb45d1 | Steps with duration and status, expandable output. Take: per-step duration, expand to see output. Avoid: node canvas, raw JSON on stage | `refs/mobbin-airops-step-logs.jpg` |
| Mintlify previews table | https://mobbin.com/screens/31bc9279-f1e6-449c-9143-583e558609b4 | Status as a short word with small icon ("Failed", "Successful"), changes summary. Take: status-as-word. Ours drops the pill fill and keeps a dot | `refs/mobbin-mintlify-preview-status.jpg` |
| GitHub checks (Refero) | https://github.com/facebook/Ax/actions | The canonical CI check list: one line per check, pass/fail, details link. Take: "Checks on this draft" list and "failed → fixed" history | `refs/refero-github-checks.jpg` |
| Devin session insights | https://mobbin.com/screens/8cf78f5a-a3eb-44b5-991a-772b2d1e8e2e | Timeline of events with impact dots and plain-language summaries. Take: the dot legend and narrative event lines for the trace view (Nov) | `refs/mobbin-devin-session-insights.jpg` |
| Grammarly suggestion (web, not in connectors) | https://www.grammarly.com | Inline underline of the span + suggested replacement + one-line reason. Take: highlight, strike, replacement, reason | — |
| Avoid: Replit, v0 | https://mobbin.com/screens/463065cc-fddc-437c-bc42-fe5c6b8994eb · https://mobbin.com/screens/488f3078-fd7f-428f-a728-0b38934b1289 | Chat transcript beside a raw log wall; long chat summary with bullets. Not legible on a stage screen | — |

### C. Seal ceremony
| Reference | URL | Take | File |
|---|---|---|---|
| Zillow "Signing complete" | https://mobbin.com/screens/685ca696-851e-499d-aaa1-bc0e821ab630 | Timestamped completion line on the document itself ("You completed signing this document on May 22 2026 at 8:27 a.m."). Take: the specific signed-at line. Avoid: modal | `refs/mobbin-zillow-signing-complete.jpg` |
| Square contract signatures | https://mobbin.com/screens/48205967-5bfe-4654-81bc-cec3162e4ff8 | Signature block: name, signature, date as a formal record. Take: signer block structure | `refs/mobbin-square-signature.jpg` |
| HoneyBook contract | https://mobbin.com/screens/f42944cd-f9e2-44cf-ab90-f62651e59f71 | Document on paper with status text above. Take: proof-on-paper presentation. Avoid: the blue left-border notice (a pattern we ban) | — |
| Kitchen.co approval (Refero) | https://images.refero.design/screenshots/kitchen.co/desktop/90238802-db0b-412a-a1b7-9bfb88e5b92c_preview.jpg | Client approval of a deliverable with clear approved state. Take: approve as a recorded decision on the asset | `refs/refero-kitchen-approval.jpg` |
| Pastel review (Refero) | https://images.refero.design/screenshots/usepastel.com/desktop/dff89d24-9969-42dd-8dbe-946de6eb6159_preview.jpg | Review/approve over the actual rendered page. Take: certify the rendered proof, not text | `refs/refero-pastel-review.jpg` |
| Frame.io approve, DocuSign certificate of completion, printers' press-proof sign-off sheets (web) | https://frame.io · https://www.docusign.com | Frame.io: one "Approved" status per asset with the approver's name. DocuSign: a certificate with envelope ID, signer, timestamps. Press proof: crop marks, registration target, signature box. Take: certificate ID + audit line + crop marks | — |
| Avoid: Cofounder "Brand kit locked", Mercor success modal | https://mobbin.com/screens/d341dce6-3804-4e9d-a003-7b2786ae0deb · https://mobbin.com/screens/d041ca1c-864e-4aee-806c-5428aacc0ae1 | Glow, floating confetti squares, mono uppercase button, indigo progress bar, checkmark-in-circle modal | — |

### D. "Learned a rule"
| Reference | URL | Take | File |
|---|---|---|---|
| Greptile "Making a note of this!" | https://mobbin.com/screens/9f440521-afb9-458a-82e9-733eab2bf041 | The exact story: a human correction in review becomes a remembered rule. Take: show the source correction next to the rule. Avoid: chat bubble framing | `refs/mobbin-greptile-making-a-note.jpg` |
| Plain "Review suggested rules" | https://mobbin.com/screens/283cd8a6-bfdc-4036-a985-bbf78037eb13 | Proposed rules shown as editable text with "Apply suggestions" / "Discard all". Take: propose → human applies, editable wording. Avoid: blue-tinted card headers | `refs/mobbin-plain-suggested-rules.jpg` |
| Klaviyo agent guidance rules | https://mobbin.com/screens/f52a782b-e32c-4215-92f2-d4bfd18a8dce | Rules grouped by type (communication style, escalation), each with title + description + on/off. Take: the Rules page structure | `refs/mobbin-klaviyo-guidance-rules.jpg` |
| AirOps "Add global rule" | https://mobbin.com/screens/31d2e72c-9db2-40f7-a3b7-762fac27de30 | A rule written as a style-guide paragraph. Take: rules read like a designer's guideline | `refs/mobbin-airops-add-rule.jpg` |
| Google Ads value rule preview | https://mobbin.com/screens/28150794-5e86-4c0c-ba08-bfd377243b45 | Plain-language "If / And / Then" preview beside the editor. Take: the scope line ("Applies to / Checked by") | `refs/mobbin-googleads-rule-preview.jpg` |
| Playbook brand guidelines (Refero) | https://images.refero.design/screenshots/playbook.com/desktop/846e41a8-5f49-4618-895f-1e35d6f4a878_preview.jpg | Brand guideline page typography. Take: rule list as an editorial guideline page | `refs/refero-playbook-guidelines.jpg` |

Refero results were weaker than Mobbin for agent-specific screens (it returned generic task boards for the plan query). Worth a second pass in Refero with `refero_search_styles` for "editorial print proof" on Monday if Claude wants more visual direction.

## 4. Build notes for Kai
| Screen | Data needed | Real today | Fake-able for demo | Effort (my estimate) |
|---|---|---|---|---|
| A. Plan view | `run_plan` {id, version, brief_id, goal, steps[{n, deliverable, agent_role, model, checks[]}], fix_pass_cap, est_seconds, bio_version, context_slices per step} | Sharpener `deliveryPlan` (deliverables × crew) [exists]; BIO version hash [exists]; context slices via `getBioForAgent` [exists] | Checks per step can be a static map by deliverable type; estimate can be constant | 1.5-2 days (map Sharpener output → plan object, one screen) |
| B. Live crew + checks | SSE events: `step.started/finished`, `token`, `check.result {check_id, status, span[start,end], remediation}`, `fix.started {pass}`, `draft {n, text}` | SSE streaming [exists]; voice QA regex + Gemini drift check [exists] but only flags; 3-agent cap [exists] | Fix loop for one check type only (never-say, deterministic regex) with remediation text from a template; span positions from regex match. Replay = recorded event JSON played back at real timing behind a key (e.g. `?replay=hero1`) | 3-4 days: check registry v0 (never-say, claims keyword, CTA present) 1 d; loop in `runs.js` (max 2) 1 d; UI 1.5 d; replay recorder/player 0.5 d |
| C. Seal ceremony | `output_certificate` {id, run_id, outputs[], bio_version, plan_version, checks_passed, fixes, signer_id, role, signed_at, revoked_at} | BIO certification, four-eyes, `cert_decisions` audit [exists]; renders come from your demo preview [build] | Single insert with no rubric; four-eyes off for demo | 1 day (reuse cert tables pattern) + 0.5 day stamp animation |
| D. Learned a rule | `brand_rule` {id, text, scope_agents[], enforced_by_check, source_output_id, before, after, status proposed/approved, approver, bio_version_from/to}; rule injection into prompt composition; never-say list update | `brand_signals` records edits [exists]; prompt composition (`compose-specialist-prompt.js`) [exists] as the place to inject rules | Rule text can be pre-written for the seeded correction ("Never frame the coffee by price") and the rerun replayed; the real piece worth building is: approved rule → appended to never-say/voice slice → used next run | 2 days (store + inject + page); model-proposed wording is November |

Critical path before the Fri 16 freeze: merge `rc/caa-44-rc1` (CD rename), plan object, never-say fix loop, replay mode, output certificate insert, rule store + injection, demo preview of the three formats. Total about 8-10 dev days across you and Claude/Codex, so it's tight: if something has to give, fake D's proposal wording and B's checks beyond never-say, but keep the fix loop and the rule injection real, because those are the claims Oscar makes on stage.

Risks:
- The seeded catch must trip reliably. Ada should run the golden brief 10× and log the trip rate; if it's under 70%, seed the first draft instead and say so internally.
- Every live step is a paid call over a hotspot. Keep beat 7's rerun on replay.
- Demo brand certification TTL must cover 21 Oct.
- Public endpoints had no rate limits (August memo). The QR flow must not hit run endpoints.
- The pixel-art Agency Office and the node canvas should not appear in the pitch; they contradict Press Proof.

## Files
- `/workspace/brandos/harness-hero-flow-and-ux.md` (this file)
- `/workspace/brandos/wireframes/01-plan-view.png`, `02-live-crew-checks.png`, `03-seal-ceremony.png`, `04-learned-a-rule.png`
- `/workspace/brandos/refs/` (20 reference images from Mobbin and Refero)
