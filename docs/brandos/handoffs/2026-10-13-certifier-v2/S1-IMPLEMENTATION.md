# Certifier S1

Branch: `feat/certifier-s1`, based on `origin/dev` at `8f938b4` (includes S3).

Enable `CERTIFIER_V2_S1=true` on the API, then open a Creative Director job and choose **Open in Certify**, or use `#/certify/<jobId>`. The runtime flag is returned by the authenticated job read. With the flag off, the entry point is absent, direct navigation returns to the existing job, and legacy human submissions retain their existing behavior. `CERTIFIER_V2_S3=true` independently enables the client thread; otherwise Ask copies the question to the clipboard.

The intro uses the actual logo upload, four colour roles, brand font specimen, positioning and available source previews. The queue groups Foundation / Guidelines / Strategy and ranks missing, conflicting, guessed, low, medium, high claims within each section. The card shows the value beside recorded excerpts, source links, signed upload previews, PDF pages and stored screenshots. Missing source evidence is explicit; screenshots and quotes are never invented. The queue scrolls independently on laptops.

Claims use exactly S3's SHA-256 identity `[brand_id, bio_version, field_path]`. Confirm and Fix resolve a claim; Skip does not. Ask opens a pre-filled question and queues an S3 draft. Open questions and new evidence keep the claim unresolved until the CD reviews it. Refresh evidence reloads both the job ledger and thread. Evidence fingerprints exclude expiring signed URLs and are independent of query order.

Fix builds a minimal `bioPatch` with array replacement and existing recursive merge semantics. The seal requires logo rights, a primary colour, a usable display font and every claim resolved. C1/C2 are computed by the existing rubric; the human chooses C3–C7. Bulk confirmation touches only medium/high claims and does not override Asked/Fixed decisions or open questions. Enter/F/A and J/K/arrows/S work outside form controls, and section bulk confirmation requires a second click. Optional evidence expansion/tab shortcuts and assistant suggestions are deferred.

The server enforces the same resolution gate, exact version, current evidence tokens and reviewed patch values before an approval. Lead approval also requires a current complete review; the Lead reviews the pending candidate in Certify, and the existing four-eyes check still rejects the submitting reviewer. Pending non-Lead reviews show as waiting for a second human reviewer. Existing rubric bands, calibration, foundation asset validation and separation of duties remain authoritative.

`assertHumanActor` guards certification and Lead approval using the authenticated caller context. Agent actors cannot certify even with a steward role. Per-claim decisions are captured in the existing append-only audit narrative alongside reviewer notes. No schema change or production migration is required. Review drafts are local React state; final submitted decisions are audited.

Validation:

```sh
npm run test:units
npm run build
# Install Playwright locally, or point at the bundled module:
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright/index.mjs \
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=test \
node scripts/test-certifier-s1-viewport.mjs
```

The viewport check mounts the real component at 1440, 1280 and 1180px with the actual 248px dock allowance. It verifies side-by-side evidence, no horizontal overflow, keyboard Confirm/Fix/Ask, S3 field prefill, a disabled incomplete seal, preserved fix patches, and submission of a fully resolved human review. API tests exercise calibration, a Lead certification with a patch, append-only audit capture, own-brand separation of duties and four-eyes Lead approval.
