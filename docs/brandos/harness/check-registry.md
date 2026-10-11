# Check registry v0.1
Rule: deterministic checks run first, in parallel, ~0 cost. Judges run only if no HARD deterministic fail remains (saves cost; judge never sees broken output). Each failure returns remediation text (templated with specifics) to the agent. Machine form: check-registry.json.

## Deterministic
| id | applies to | severity | pass condition | remediation (templated) |
|---|---|---|---|---|
| D-SCHEMA | all | hard | Output validates against contract.output_schema (ajv) | Your output failed schema validation: {errors}. Return the same content as valid JSON matching the schema; fix only the listed paths. |
| D-LEN | copy, web | hard | Every string ≤ its maxLength / field limit | '{field}' is {n} chars; limit {max}. Shorten to ≤{max} keeping the same message. |
| D-LEN-PLATFORM | a16 | hard | hook ≤125 (IG) / ≤210 (LinkedIn); total ≤2200 IG, ≤3000 LI, ≤150 rec TikTok, ≤280 X | {platform} {part} is {n} chars (limit {max}). Cut to fit; keep the hook first. |
| D-FORBID | all text | hard | No token/phrase from bio.voice.forbidden_words (case/accents-insensitive, word boundary, lemma list) | '{word}' is on the brand's never-say list (BIO rule {rule_id}). Replace it with a word that keeps the meaning; do not use synonyms listed in the same rule. |
| D-REFUSAL | all | hard | No content matching message_spec.refusals / bio.refusals patterns (regex + keyword list per refusal) | This output does what the brief refuses: '{refusal}'. Remove {evidence}. |
| D-URGENCY | copy | hard | No fake-urgency patterns (ES/EN list: 'solo hoy','última oportunidad','limited time','hurry','!!') unless brief has dated offer | Fake urgency '{match}' is not allowed (no dated offer in the brief). Remove it or replace with the real time cue from the Message Spec ({cta}). |
| D-SUPERLATIVE | copy | hard | No 'best/#1/only/mejor/único' claims without proof id | Unprovable superlative '{match}'. Remove it or replace with a specific fact from proof[]. |
| D-CLAIM | copy, strategy, concept | hard | Every number, date, place, price, named person/award in output appears in proof[] / bio.facts / brief (entity match) and proof_ids set | '{entity}' isn't in the brand facts or brief. Remove it or use a fact from: {available_facts}. |
| D-BAIT | a16 | hard | No engagement bait patterns ('tag a friend','comenta SÍ') unless bio.voice.do allows | Engagement bait '{match}' is off-policy. Replace with the CTA from the Message Spec. |
| D-EMOJI | a16 | soft | emoji count ≤ bio.voice.emoji_policy.max (default 0 if policy=none) | {n} emoji used; brand allows {max}. Remove extras. |
| D-HASHTAG | a16 | soft | hashtag count ≤ bio policy per platform; no banned tags | {n} hashtags; limit {max}. Keep the most specific. |
| D-ORTHO | text ES | hard | ES: LanguageTool/hunspell 0 errors on accents, ¿¡ pairing | Spelling/orthography: {errors}. Fix only these. |
| D-CAPS | a14 | soft | No word ≥4 letters in ALL CAPS (except acronyms in BIO) | Remove ALL CAPS from '{word}'. |
| D-PUNCT | a14, a16 | soft | No '!!', '??', or more than 1 '!' per item | Reduce exclamation marks to at most one. |
| D-DUP | a14, a37 | soft | preheader ≠ subject (token Jaccard <0.6); headline variants Jaccard <0.8 | '{a}' and '{b}' are near-duplicates. Rewrite '{b}' with a different angle. |
| D-COUNT | a02, a06, a37 | hard | Required counts (messages 1–3, territories =3, headlines ≤20 in 4 buckets) | Expected {expected} {item}; got {n}. |
| D-PALETTE | visual | hard | Top-5 dominant colours each within ΔE2000 ≤10 of a BIO palette colour or neutral (k-means) | Colour {hex} ({pct}% of image) is off-palette. Regenerate with palette {palette_hex} and 'no {colour_name}'. |
| D-OCR | visual with overlay_text | hard | OCR(text) == overlay_text (normalized; accents must match) | Rendered text reads '{ocr}', expected '{overlay_text}'. Regenerate with the exact string in quotes, or drop the overlay and let the renderer add it. |
| D-SIZE | visual | hard | width×height matches platform spec | Size {w}×{h}; required {spec}. Regenerate at {spec}. |
| D-NOLOGO | visual | hard | No logo/wordmark detected unless supplied asset (vision OCR + logo detector) | An invented logo/text mark appears. Regenerate with 'no logos, no text'. |
| D-ALT | visual, web | hard | Every image has alt 5–125 chars, not 'image of' | Add alt text describing the image content (≤125 chars). |
| D-RENDER | web, email, deck | hard | Renderer returns 0 errors (MJML strict), 0 unresolved tokens, screenshot non-blank, no horizontal overflow at 375px | Render failed: {error}. Fix the block field {path}. |
| D-CONTRAST | web, email | hard | WCAG AA: text/bg contrast ≥4.5 (≥3 for ≥24px) | Contrast {ratio} on '{selector}' < {min}. Use token {suggested}. |
| D-LINKS | web, email | soft | All hrefs absolute https, CTA url == message_spec.cta.url | Link '{href}' invalid; use {cta.url}. |
| D-SOURCE | research | hard | Every external claim has url+quote+fetched_at | Claim '{claim}' lacks a source. Add one from the provided pages or remove it. |
| D-FRESH | a54 | hard | Sources ≤30 days old | Source {url} is {age} days old; replace or drop. |
| D-DURATION | motion | hard | Total duration within spec ±0.5s | Duration {d}s; required {spec}s. |

## Model-judge
| id | applies to | severity | pass condition | remediation |
|---|---|---|---|---|
| J-VOICE | copy, concept, QA | soft→hard if ≤2 | Judge (Haiku 5.5) scores voice 1–5 vs 3 BIO examples; pass ≥4 (demo ≥3) | Voice drift: {evidence}. Match BIO example rhythm: {example_snippet}. Change {spans} only. |
| J-STRAT | strategy, copy | soft | Judge scores 'answers goal & SMP' 1–5; pass ≥3 | The output doesn't carry message {message_id} / goal '{goal}'. Make {span} do that. |
| J-DISTINCT | a06, variants | soft | Judge: variants differ on declared axis, not just wording; pass yes | Variants {a} and {b} are the same idea. Make {b} differ on {axis}. |
| J-VISION | visual, rendered web/email/deck | hard if brand-breaking | Vision judge (Gemini 3.8 Flash) on screenshot: imagery rules, logo clear space, hierarchy, no artefacts; 1–5 pass ≥3 | Visual issue: {issue} at {region}. {fix}. |
| J-VOICE-IMG | a41 | soft | Image mood matches visual.imagery do/don't (1–5 ≥3) | Image reads '{observed}', brand imagery is '{rule}'. Regenerate with {direction}. |
| J-GROUNDED | research | hard | Judge: every synthesized statement supported by quoted sources | Unsupported statement '{s}'. Remove or cite. |
| J-CLAIM-RISK | copy (prod) | escalate | Judge flags health/legal/comparative claims | Possible regulated claim '{s}' → escalate to human; don't auto-fix. |

## Implementation notes
- Inputs: output JSON + rendered artefact (HTML screenshot / image) + contract + BIO slices + message_spec.
- BIO rules learned via correction-to-rule (learning.md) are compiled into D-FORBID/D-REFUSAL lists or new `R-*` deterministic checks; they appear in the registry with `source:"bio_rule:<id>"`.
- Demo-critical (build first): D-SCHEMA, D-LEN(-PLATFORM), D-FORBID, D-URGENCY, D-SUPERLATIVE, D-CLAIM, D-PALETTE, D-ALT, D-RENDER, D-CONTRAST, J-VOICE, J-VISION.
- Judge prompt (shared): "You are a brand QA judge. Score only the named check using the rubric. Quote evidence. Return check_result JSON. Never rewrite the content."

## Added in v0.2 (all-agents upgrade)
| id | applies to | severity | pass condition | remediation |
|---|---|---|---|---|
| D-SAFEAREA | a41 | hard | Subject/key elements outside platform UI zones (IG story top/bottom 250px; reels right 120px), via saliency box | Key content sits under platform UI at {region}. Regenerate with the subject inside the central safe area. |
| D-HEADZONE | a20 | hard | Declared headline_zone has low detail (edge density < threshold) and contrast allows white or ink text ≥4.5 | The headline zone {zone} is busy or low-contrast. Regenerate with clear negative space in that zone. |
| D-SERIES | a21, a35, a44, a50, a23 | soft | Series consistency: palette ΔE between images ≤12, same aspect/stroke rules | Image {n} breaks the series ({diff}). Regenerate it with the series style: {style}. |
| D-MANDATORY | a22 | hard | All mandatory label fields present or explicitly [TO SUPPLY] | Mandatory field(s) {fields} missing. Add from facts or mark [TO SUPPLY]; never invent. |
| D-WORDCOUNT | a43 | hard | OOH headline ≤7 words | Headline has {n} words; OOH max 7. Cut to ≤7. |
| D-TEXTAREA | a42 | soft | Overlay text area ≤20% of image (OCR boxes) | Text covers {pct}% of the image. Reduce to ≤20% or drop the overlay. |
| J-FIDELITY | a46 | hard | Vision judge: product in output matches reference (shape, colour, label) ≥4/5 | Product differs from reference ({diff}). Regenerate in edit/reference mode keeping the product unchanged. |
| D-SVG-VALID | a19, a23 | hard | SVG parses; ≤ max paths; no raster <image>; colours ⊂ palette (+white/black) | SVG invalid or off-rules: {error}. Regenerate as flat vector using {palette_hex}. |
| D-VEGA | a45 | hard | Vega-Lite spec validates (v5 schema) and every data value traces to data_sources | Chart spec invalid or contains untraced values: {error}. Use only the supplied data. |
| D-EVIDENCE | a01, a04, a34 | hard | Every claim/tension/segment item has a non-empty evidence field pointing to bio path or source | '{item}' has no evidence. Add a BIO path or source, or remove it. |
| D-BIOREF | a05 | hard | Each refusal has a bio_ref that exists in the BIO | Refusal '{r}' cites no valid BIO field. Add one or drop it. |
| D-CHANNEL | a03 | soft | Channels ⊂ bio.channels unless flagged test:true | Channel '{c}' isn't one the brand uses. Mark it as a test or remove it. |
| D-WORDS | a15 | soft | word_count within requested range and equals actual count | Length {n} words; requested {range}. |
| D-QUOTE | a40 | hard | Every quote is supplied in brief or marked [QUOTE TO CONFIRM] | Quote '{q}' isn't supplied. Replace with [QUOTE TO CONFIRM]. |
| D-WPS | a51 | hard | Words per second ≤2.5 EN / ≤2.3 ES per cut | {cut}s cut runs {wps} words/s. Cut to fit. |
| D-MERGETAG | a26 | hard | Merge tags ⊂ whitelist | Unknown merge tag {tag}. Use only {whitelist}. |
| D-DTCG | a47 | hard | Tokens validate against W3C DTCG format; colours ⊂ palette or marked derived | Token {path} invalid or off-palette. Fix per DTCG / mark derived. |
| D-MERMAID | a49 | hard | Mermaid parses (mermaid-cli) | Flow diagram doesn't parse: {error}. |
| D-VERBATIM | a55 | hard | Each verbatim is an exact substring of the uploaded data | Verbatim '{v}' not found in the data. Use exact quotes only. |
