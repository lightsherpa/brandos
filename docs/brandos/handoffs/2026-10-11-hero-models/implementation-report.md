# Hero model upgrade — implementation and verification

Implemented on `feat/hero-models`, based on PR #4 (`cursor/demo-baseline-c1e1`, `2951af5`). PR #4 was open and unmerged when checked.

Exactly eight directory agents upgrade. Pipeline Sharpener, Voice QA and Vision QA use the matching primary/fallback routes. All other directory routes and all image models remain unchanged. New model labels are registered; the runnable filter accepts the new keys and `.slice(0, 3)` remains in place.

Fallback waits for the first nonempty text token, cancels the primary request on timeout, supports 404/429/all 5xx and transient network failures, never retries 400/auth errors or after text starts, and performs one hop. Fallback provenance appears in completion usage and persisted API usage metadata.

Two response limits needed adjustment after real-key failures: Sharpener 1600 → 3200 tokens (truncated multi-deliverable JSON), Vision QA 300 → 1000 tokens (truncated verdict JSON). The broad brief then completed successfully. Voice QA remains at 400. Anthropic usage normalization now retains final input/cache counters and reports total prompt tokens, matching the cost calculator.

## Checks

```text
node --check: all changed server JS and seed/smoke scripts passed
npm run build: passed (existing bundle-size warning)
npm run test:units:
  tests 345
  pass 345
  fail 0
  cancelled 0
  skipped 0
```

Real keys: all eight upgraded primary routes completed without fallback; samples all ended normally. Local synthetic-BIO flow: Sharpener → three specialists (`a12, a17, a16`) → Voice QA / Vision QA. Voice match 70; brand match 70. The three-agent cap applies to the specialist assembly; Sharpener and QA are supporting calls. This exercises the local model pipeline; browser authentication and persisted brief/output UI flows were not exercised.

`MODEL_FIRST_TOKEN_TIMEOUT_MS=1`: a16 completed on `claude-sonnet-4-6` with `fallback_from=anthropic/claude-sonnet-5-5`.

## Database

Ran only `--only a02,a12,a13,a14,a16,a18,a24,a37`. The command saved all 55 spec rows before writing, changed only modelRouting on the selected rows, preserved their other payload fields and live status, and verified the other 47 rows were byte-for-byte unchanged. The backup is local and excluded from the commit:

`/Users/oscarmottaquintana/.codex/worktrees/hero-models/CaastorOS/.work/hero-models/specs-1791712887029.json`

The live pre-upgrade routes differed from the source handoff for a14/a24 (Gemini 3.5 Flash Lite) and a37 (Gemini 3.6 Flash). These live routes are the before arm below; the requested fallback routes remain exactly as specified.

## Cost per sample run

Each row is one independently generated output using the same task and production token cap. Token counts, response lengths and cache hits vary, so this is a smoke comparison rather than a controlled quality benchmark. Claude costs use measured tokens and [published Anthropic rates](https://platform.claude.com/docs/en/about-claude/pricing); Gemini costs are provider-reported. New Claude rate cards are absent in the live database, so the router still labels those calls `unpriced`; this report prices them separately. No rate-card or budget rows were changed.

| Agent | Before (USD) | After (USD) |
|---|---:|---:|
| a02 | $0.006663 | $0.012440 |
| a12 | $0.005445 | $0.012922 |
| a13 | $0.007254 | $0.014922 |
| a14 | $0.001873 | $0.005143 |
| a16 | $0.008385 | $0.015032 |
| a18 | $0.003244 | $0.000881 |
| a24 | $0.001445 | $0.006882 |
| a37 | $0.007478 | $0.012364 |

All eight sample calls: $0.041787 before, $0.080585 after (+92.8%). Local three-agent pipeline including Sharpener and both QA calls: $0.068258 estimated.

## Sample outputs

### a02

*A quiet studio that designs the site around the words you already wrote.*

That's the proposition, and it's a hypothesis. It follows from the audience (founders who write their own website), but the BIO doesn't say what the service actually includes or what category it sits in. The Brand Steward should confirm it before anything ships.

The tension: a launch wants volume, and this brand's position is saying less. Every piece has to announce the service without raising its voice, for readers who spot padding instantly.

Refusals: no prices, results, countdowns or "limited time." One CTA, book a studio consultation.

### a12

Your words. A quieter page.

Fieldnotes Studio is a quiet design studio for independent founders. Our new website service is for the person who already writes their own site. You keep the voice. We design the page around it, and we leave out whatever it doesn't need.

CTA: Book a studio consultation

visualDirection: A founder's desk seen from slightly above, with a laptop open to a single clean page of text and a notebook beside it, shot in soft north-facing daylight with plenty of empty surface, so the mood reads calm and unhurried.

### a13

**Email 1**

Subject: Welcome to Fieldnotes Studio

Hi {first name},

Thanks for joining us. We're a quiet design studio for independent founders.

You write your own website. That's a good place to start, and we'd rather build around your words than over them.

We'll keep these emails few and plain. When you're ready to talk about your site, book a studio consultation.

Fieldnotes Studio

**Email 2**

Subject: Say less. Show the work.

Hi {first name},

A website usually says too much. Three sentences where one would do. A claim with nothing behind it.

We work the other way. Say less. Show the work. Stay specific.

Our new website service is built on that. If it sounds like what your site needs, book a studio consultation and we'll talk through what you have.

Fieldnotes Studio

### a14

Subject: A quieter way to build your site
Preview: Most studio websites say too much. Here is how we work instead.

Subject: Making a site you can write yourself
Preview: Clear design for independent founders who prefer plain language.

Subject: Fewer words, clearer intent
Preview: Three decisions we make before we draw a single page.

Subject: Showing the work
Preview: Recent sites from the studio and why we kept them simple.

Subject: Talking through your next site
Preview: What we cover in a studio consultation, and what you can leave behind.

Subject: Book a studio consultation
Preview: Thirty minutes on what your site needs to say, and what it can drop.

### a16

You wrote your own website. Good. You know the work better than anyone. Now it needs a page that holds still and lets your words do the talking. Fieldnotes Studio now designs websites for independent founders. Book a consultation.

Say less. Show the work. Stay specific. That's how we design, and it's how we think your site should read. A new website service from Fieldnotes Studio, for founders who write their own copy. Book a studio consultation.

Your words, set properly. Fieldnotes Studio is a quiet design studio, and we've started building websites for independent founders. Talk to us about yours. Book a consultation through the link in bio.

### a18

```json
{
  "passed": true,
  "voice_match": {
    "score": "partial",
    "notes": "Plain and short, which fits the calm, plain register and the 'Say less' pillar. 'Sounds like you' is abstract, though. It doesn't show the work or anything specific to the studio, so it misses 'Stay specific' and 'Show the work'. The BIO does not specify rhythm or signatures, so those can't be checked."
  },
  "violations": [
    {
      "type": "pillar_gap",
      "pillar": "Stay specific",
      "severity": "low",
      "detail": "'A website that sounds like you' could be said by any agency. Nothing names the studio, the service, or what the founder gets."
    },
    {
      "type": "audience_gap",
      "severity": "low",
      "detail": "Primary audience is independent founders who write their own website. The line doesn't speak to that person's situation (writing it themselves, wanting it to sound like them)."
    },
    {
      "type": "cta_drift",
      "severity": "low",
      "detail": "North star is 'Book a studio consultation'. Copy says 'Book a consultation' and drops 'studio'. Either is usable, but the north star wording is the one to keep."
    }
  ],
  "forbidden_words_found": [],
  "invented_claims_found": [],
  "urgency_found": false
}
```

### a24

{
  "passed": false,
  "brand_match": false,
  "violations": [
    "Palette specifies Roast #2B1D14 and Crema #F1E6D3 instead of Ink #102030 and Paper #E7E1D6.",
    "Voice register listed as warm, exact, unhurried instead of calm, plain and specific.",
    "Subject matter targets a spring blend coffee launch rather than studio website design for independent founders."
  ]
}

### a37

Declarative

1. A website for founders who write their own words.
2. Your words, given a proper page.
3. Say less. Let the site show the work.

Question

4. You wrote the copy. Who designs the page around it?
5. What does your homepage say before anyone scrolls?

Fragment

6. Quiet design. Specific words.
7. Fewer words. The right page.
8. Fieldnotes Studio: websites, made quietly.

Anti-headline

9. We won't make your website louder.
10. No buzzwords. Just your site, built to be read.

Full outputs, usage counters and cost sources: [smoke-results.json](smoke-results.json). Forced timeout evidence: [forced-fallback.json](forced-fallback.json). Database comparison: [database-verification.json](database-verification.json).

Reproduce from a checkout with both root and server dependencies installed, using the existing server environment file:

```sh
node --env-file=/absolute/path/to/server/.env scripts/smoke-hero-models.mjs
MODEL_FIRST_TOKEN_TIMEOUT_MS=1 node --env-file=/absolute/path/to/server/.env scripts/smoke-hero-models.mjs --force-fallback
```

The ordinary smoke compares against the database routes present when started. To reproduce the original before arm after this upgrade, use the saved pre-upgrade backup; rerunning against the upgraded DB compares against its current routes.
