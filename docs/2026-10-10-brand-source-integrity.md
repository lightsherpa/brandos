# Brand and source isolation correction

The 5184 local test stored Cake-me content under the selected Geoking brand. `POST /api/discovery/start` accepted a different primary website, silently replaced the existing brand URL, and reused that record's uploaded sources. This was a source-assignment bug, not a delayed browser refresh.

Discovery now checks the selected brand website before uploads and again at the API before queuing. A different primary hostname returns `BRAND_SOURCE_MISMATCH`; the caller must select or add the correct brand. `www` and paths on the same host are allowed. Establishing the first website uses a conditional update so concurrent submissions cannot overwrite each other. Reference links still support other brands, with their explicit purpose; they never redefine the primary website.

The worker validates brand/workspace/website before gathering and again before persistence. It supplies primary brand identity to interpretation and saves `sourceIdentity` with brand id, name, primary URL and discovery id. The viewer rejects a response whose brand id differs, never falls back from an unavailable selected brand to the first record, and clears content on load errors. Both client and director patches preserve server-owned lineage and quarantine flags.

Quarantined BIOs are withheld from the viewer, session read, self-certification, latest-record loading, briefing, production and subsequent extraction. The error surface omits misleading scores and certification controls. Quarantine is an integrity hold, not a certification decision. Recovery requires checking the source assignments and a clean source set; renaming the record or blindly regenerating does not resolve it.

## Local repair

Only the isolated 57321 database serving 5184 was changed. Geoking's website was restored to `https://geoking.com`. Original BIO v1 (`2109b674-d77c-4569-bda2-e4a2cb9b705f`) and all source rows were retained. A new uncertified v2 preserves that payload with a quarantine marker and original record reference. No content was reassigned to Cake-me, no uploads deleted and no new provider calls made. The 5184 API was restarted without provider credentials. Hosted data was not changed.

## Validation

- 342 unit tests pass, including different-domain rejection, wrong-brand/wrong-domain BIO lineage, and quarantine preservation through edits.
- `node scripts/test-bio-source-integrity-local.mjs` exercises the real 8792 API/database: mismatch returns 409, URL stays unchanged, no discovery run queued, quarantined reads/retries and all three loading modes are blocked. It uses a disposable synthetic record and no providers.
- Both focused 5185 and original 5184 production builds pass; `git diff --check` passes.
- Browser confirmation at 5184 shows Geoking with a clear BIO unavailable message and no Cake-me payload.

The guard checks recorded identity and source assignment; it does not claim to infer legal brand ownership from arbitrary names, or perfectly detect mislabeled reference documents. The quarantined source set requires review before recovery.
