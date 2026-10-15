# Review desk and queue preview

The fourth slice is off by default. Enable `VITE_REVIEW_DESK_UX=1` for the browser and `REVIEW_DESK_UX=1` for the local API. Brand Core queue navigation follows `VITE_CERTIFY_UX=1` and opens Certify using the same job ID. Use the existing CaastorOS local Supabase at port 54321; no production writes are needed.

The review desk renders saved specialist deliverables and task envelopes as separate copy, image and email components. Email previews use a sandboxed iframe without scripts, forms or same-origin access. Internal checks, costs, IDs and JSON envelopes are omitted. Each component can be replaced inline when `output.write` and the existing revision state permit it. Image replacement accepts an HTTP(S) URL; copy and email replacement accept finished text or HTML respectively. This slice uses replacement rather than a paid model rerun.

Replacements call the existing output PATCH endpoint with `{component:{path,value}}`. The API resolves the path against its own displayable component allowlist, enforces permissions and workflow locks, preserves sibling components and records the original value, replacement, human identity and timestamp in `component_edits`. Submitted and approved outputs remain locked: request changes first to return them for revision. Independent human approval remains required.

Queue entries have localized names, icons and short explanations in English, Spanish and Arabic. Unknown internal codes receive a safe generic label rather than being displayed directly.

Focused tests: `node --experimental-test-module-mocks --test src/lib/review-output.test.mjs server/src/lib/output-component.test.mjs server/src/routes/output-component.test.mjs server/src/routes/output-human-approval.test.mjs`.
