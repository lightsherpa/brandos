# Context allow-list
Built by `buildCertifierContext()` in code. The model sees nothing else.

## Loaded
| Item | Source in code | Notes |
|---|---|---|
| Brand header | `brands` (id, name, url, industry) | no owner/contact data |
| Brand Core version under review | `bios` row (id, version, payload, score, certified, self_certified) → `normalizeBio()` (`server/src/lib/bio-schema.js`) | all `BIO_FIELDS`, Layers 1–3 |
| Per-claim provenance | statuses from `bio-evidence.js` / `steward-copilot.js` `groupClaims` (source-backed, client-stated, inferred, conflicting, missing…) | becomes `claim.provenance` |
| Foundation gate | logo, primary colour role, display font present? (F6 gate / `visual-assets.js`) | drives `blocks_certification` |
| Source manifest | `bio_sources` for this brand_id (id, kind, bucket, src, signals, raw_ref) | text extracts, PDF pages, image records with `asset_role` |
| Client chat evidence (S3) | uploads/answers attached to a claim | each becomes a source with `kind:"client_answer"` |
| Previous CD notes | latest `cert_decisions.narrative` for this brand | as a source, `derived_from_model:false` |

## Serialization
Claim ledger (one line per claim, ids stable = field path):
```
<claim id="visual.palette[0]" layer="1" section="visual" provenance="inferred" gate="primary_colour">{"hex":"#f40041","role":null}</claim>
```
Sources (each id = `bio_sources.id`; PDFs split per page; long text chunked ≤2k tokens as `<id>#c3`):
```
<source id="9f2…" kind="pdf" page="4" first_party="true" derived_from_model="false">…verbatim text…</source>
<source id="a71…" kind="image" image="a71…" asset_role="logo" first_party="true">caption: …</source>
```
Text is escaped (`<` → `&lt;`) so a source cannot close its own tag. `first_party` = brand site, brand book, client upload. `derived_from_model` = discovery/compile output (`compile-bio.js`).

Order: claim ledger → Layer 1 sources → others. Over 60k → keep ledger + first-party sources inline, rest retrievable via `search_sources`.

## Excluded
Other brands' data; client PII beyond contact name/role; generated deliverables/outputs; credits/billing; internet access; the existing Copilot `certificationRecommendation` (an approve/return verdict — must not prime the agent); steward identities.
