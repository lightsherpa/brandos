# Discovery live-test results — October 10, 2026

Oscar approved geoking.com and thecake-me.com only, with a combined $5 ceiling. Tests used the isolated release stack (web 5185, API 8792, Supabase 57421, Inngest 8292); the existing 5184 stack and hosted services were not modified. Freeze: Friday October 16, 2026, 18:00 Europe/Madrid.

## Results

| Brand | Persisted BIO | Observed time | Reported model cost | Retrieval allowance retained | Result |
|---|---|---:|---:|---:|---|
| Cake-me, Spain | v1 live, then v2 unreviewed CSS follow-up | 113 seconds to original BIO | $0.1265862 | $1.05 | Saved candidate; human review required |
| Geoking | None | 121-second polling window; retrieval failed earlier | $0 | $0.45 | Retrieval failure; no fabricated fallback BIO |

Cake-me model usage: Gemini 3.8 Flash vision $0.002796; Haiku 5.5 evidence reader $0.0042042; Sonnet 5.5 synthesis $0.119586. The combined ledger contains $1.6265862 in reported charges plus conservative, unsettled retrieval reservations. This is below the authorized cap, **not an invoice total**: Firecrawl did not return per-call prices. No additional paid retry was made. The local API was restarted without paid-provider credentials afterward.

Raw provider results, usage records and source ledgers are preserved in ignored `output/bio-discovery/{cake-me,geoking}-live.json`. Original Cake-me v1 remains intact. `cake-me-refined.json` records the separate zero-provider-cost v2 candidate. Public replay records exclude IDs, credentials and signed screenshot URLs.

## Coverage and quality

| Check | Cake-me | Geoking |
|---|---|---|
| Retrieve brand sources | Pass, six brand pages | Fail, provider could not retrieve readable pages |
| Persist correlated, renderer-compatible BIO | Pass | No candidate saved |
| Explicit versus inferred claims | Confidence/source map and missing fields present | Not assessed |
| Aspirations kept separate | Schema present; no aspiration references supplied | Not assessed |
| Competitive landscape | Partial: direct and indirect candidates, evidence and research gaps | Not assessed |
| Visual extraction | Initial generic CSS pollution identified; fixed and v2 appended | Not assessed |
| Photograph description | Present from screenshot interpretation; pending human approval | Not assessed |
| Owner / Creative Director certification | Not performed on the real brand | Not performed |

Cake-me's interpretation covers cheesecake retail, Barcelona/Madrid locations, the advertised €0.99 slice/€13.99 whole-cake entry prices, customization and WhatsApp preorders. Founded date, tertiary audience and quarterly priorities remain explicit gaps. Those prices are publisher claims observed during the test, not independently verified current quotations.

Competitive suggestions include Jon Cake/Pasté BCN and indirect alternatives. Some evidence came from dated secondary articles, including 2022 material; current prices, locations and Madrid coverage need verification. One retrieved result was a 404 page with nonempty markdown. The retrieval filter now excludes error-status/404 pages; this correction has unit coverage but has **not** been rerun through paid competitive search. The generated landscape remains a bounded search and synthesis, not the full competitive agent.

## Visual follow-up

The first live result selected generic plugin styles. The extractor now prioritizes brand/page CSS before the six-sheet cap and gives literal content-font declarations priority over unused page-builder defaults. The separate follow-up reads public HTML/CSS without Firecrawl or model calls.

Cake-me's retained declared colors: `#ffffff`, `#f40041`, `#e50736`, `#ffd115`, `#86a8d6`. Browser computed-style spot checks confirmed white body background, Meaty Nineties headings and Lexend navigation. Outfit/Poppins also occur in selected CSS but remain **declared, not verified used**. Palette roles remain inferred; no authoritative primary color was invented. Pairwise contrast ratios describe those exact color pairs, not the actual foreground/background placement or an accessibility certification.

Website screenshots and rights-confirmed uploaded images can produce imagery observations. Uploaded images, file-only intake and aspiration references have unit/intake coverage but were **not exercised in these two paid tests**. PDF text is read; embedded PDF images are not rendered. A designer still needs to review photographic style, all active font usage, mobile presentation and references before certification.

## Review artifacts

- Local Brand Book: `http://127.0.0.1:5185/#/brand-book/replay/cake-me`
- Failure replay: `http://127.0.0.1:5185/#/brand-book/replay/geoking`
- Portable replay: `http://127.0.0.1:5185/demo/bio/replay.html` (also opens as a standalone file)
- Browser screenshots: ignored `output/bio-discovery/brand-book-cake-{desktop,mobile,es-mobile,ar-mobile}.png`.

Final browser checks used actual 390px and 1440px viewports (document width matched the viewport without horizontal overflow). English, Spanish and Arabic Brand Book navigation/status labels were inspected; Arabic uses RTL. The stored BIO content remains in its original generated language. Mobile fixes reduce header crowding, wrap provenance/pills, stack fields, and render long jobs-to-be-done/voice phrases as readable lists. No missing confidence is presented as a stray percentage. Earlier intake checks are separately recorded in `2026-10-10-discovery-intake-checks.md`.

This validates Brand Book presentation, not a complete mobile platform audit. A mobile Account navigation attempt opened the floating Brandolph panel; broader dock/overlay interaction needs follow-up. The account language surface still contains legacy untranslated copy and CaastorOS references outside this focused view.
