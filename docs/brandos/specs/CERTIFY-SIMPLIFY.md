# Certify simplify: research and build contract

15 October 2026. Work only in Documents/Claudio/CaastorOS, branch feat/certify-simplify from origin/dev `44ce1f8` (includes PR #23). Research recorded before UI changes. Existing BrandOS neutral surfaces, black primary buttons, actual evidence and en/es/ar remain the visual direction.

## Five patterns checked

1. **Keep the asset visible and save a clear approval state.** [Hello Ivy asset approval, Refero](https://refero.design/flows/4526) is a three-step viewer/status flow: approved status replaces pending while the image and comments stay visible. Certify uses Review → Confirm → Done; Done never reopens claim 1.
2. **Keep proposed decisions beside the content.** [Lovable plan approval, Refero](https://refero.design/flows/12337) pairs discussion/proposal with the detailed plan and an explicit approve action. Stewart stays alongside evidence, supplies assessment and question, and leaves the final decision to the human.
3. **Make verification inspectable with a small action set.** [Parallel verification detail, Refero](https://refero.design/flows/9058) puts reasoning and numbered citations together with approval/flag feedback. Certify uses Accept / Ask / Flag, human source labels and big previews, without implementation metadata.
4. **Finish inside the useful context.** [Dropbox Dash, Mobbin public flow](https://mobbin.com/explore/flows/ceb0b491-c459-4ada-b5c9-ba8a713675e6) ends its 28-screen onboarding sequence with in-product guidance and suggested prompts. Checked its final carousel state directly. This is adjacent onboarding evidence, not an expert certification flow or proof of persistence. Use a stable certified record and a clear Brand Book exit.
5. **One explicit decision beats repeated rating work.** The short Hello Ivy and Lovable approval sequences use a direct approval action. Certify’s confirmation shows the two computed checks, optional notes and one black Certify Brand Core button. Remove five human rating dropdowns rather than silently filling them with invented scores.

## Implementation contract

- New simplify flags default off on both frontend and API. PR #23 role restrictions remain unconditional.
- Review has one left Focus first queue (visual, voice/production, collapsed strategy), large central evidence and an always-present Stewart panel labelled Review assistant.
- Confirm is a separate short step. Server records an explicit human approval with the existing claim/evidence/foundation/assignment gates. Automatic metrics remain read-only; do not synthesize five human rubric scores.
- Done is driven by the persisted job and certified version. Summaries are human descriptions, never serialized font objects, storage paths, signed URLs or tokens.
- A common display boundary cleans claim values, labels, citations, assistant text, chat, fixes, errors and change summaries. Asset URLs may remain in resource attributes needed for previews, never visible prose, tooltips or editable metadata fields.
- Local-only Cake Me walkthrough verifies resume, question handoff, single-action confirmation and durable Done. Capture Review, Confirm and Done in en/es/ar; run full tests and build. Use only existing CaastorOS Supabase 54321.

Validation report: `docs/brandos/test-runs/2026-10-15/certify-simplify/REPORT.md`.
