# Slice 1: Brand Core inputs

Flag: `VITE_BRAND_CORE_INPUTS=1`; default off. The existing editor remains available when disabled.

Completed: unlimited tagged PNG logo variants; reference selection up to ten images with per-image product/lifestyle/usage tags and visible formats/15 MB limit; unlimited primary, secondary, tertiary, neutral and accent colours; commercial font family uploads retaining weights/styles and rights confirmations; live previews; per-upload nonblocking localized error toasts and Retry. Uploads can continue while another item has failed. Unsaved or failed selections must be uploaded or removed before Save. Existing logo rights can still be confirmed.

Durable ingest metadata retains logo uses, reference tags and font descriptors. Migration `20261015150000_brand_core_input_tags.sql` copies reference tags into the version and appends new batches when uploaded through this editor. Legacy reference replacement behavior remains unchanged. Reference retries reuse their exact version and request UUID.

Validation: 46 targeted unit/SSR/route tests passed. Production build passed (existing large-chunk advisory). Browser proof `scripts/test-brand-core-inputs-ui.mjs` passed: 11-image rejection; ten tagged images; eight logo variants; seven colours; three font weights/styles loaded by FontFace; failed SVG recovery through a new PNG upload; rights and save; no browser errors or horizontal overflow in en/es/ar at 1280 and 1440 px.

Screenshots: `slice1-inputs-editor-{en,es,ar}-{1280,1440}.png`, `slice1-inputs-saved-en-{1280,1440}.png` in this directory. These are explicitly labelled UI test fixtures using generated test tiles, not brand evidence or the real certification walkthrough.

No Supabase stack was started, no production writes were made. The parent integration owns running the additive migration and its database regression against the existing local CaastorOS stack at port 54321.
