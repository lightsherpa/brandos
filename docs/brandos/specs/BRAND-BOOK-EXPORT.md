# Brand Book export — user-designated guideline reference

16 October 2026. Oscar rejected the current Brand Book summary design and directed BrandOS to use the existing “Build Design Guideline” development as the export reference.

## Located development

The exact matching chat is **Build design guideline website**, in the **Cake-me** project. Its source is `/Users/oscarmottaquintana/Documents/Claudio/CakeMe/cakeme-guidelines/`; the published reference is https://cakeme-guidelines.vercel.app. The Koini/Coiny folder also contains a separate four-system brand site, but it is not the project attached to that matching chat. This distinction was stated to Oscar during the inspection.

Checked the local README, homepage, site stylesheet, export implementation, verification notes and development history, then inspected the published homepage and Export page read-only. No reference source, published content, credentials, cloud storage or production data was changed. Source code changes to BrandOS are not part of this inspection record.

## What exists today

- A branded standalone homepage: actual wordmark, brand colour sidebar, expressive display font, large real photography, campaign copy and chapter cards. It presents the brand in its own identity rather than as a BrandOS dashboard report.
- Fifteen pages: Home; Strategy; Foundations; Logo; Colour; Typography; Imagery; Voice; Expressions; Applications; Learned rules; Resources; Tokens; Export; For agents.
- Search, mobile navigation, logo/background previews, live typography controls, colour copying and voice checks.
- A working export selector covering logo variants, palettes/tokens, font references, voice, photos and optional strategy.
- An actual ZIP builder in `export.mjs`: selected original asset bytes, CSS/JSON tokens, localized voice rules and HTML references, manifest, README and published guideline updates. It is a selected brand-kit export; it does not currently assemble the entire fifteen-page website into its ZIP.
- Meaty Nineties is used for the website preview but explicitly excluded from downloadable public kits. Open font references remain available.
- Password-protected editing, publishing, image galleries, nested content, history, backup/import and conflict recovery. The implementation supports local storage and private cloud storage. Publishing fixes and checks are documented in the reference project's development record.
- Spanish, English and Portuguese in the reference. BrandOS still requires English, Spanish and Arabic, including RTL; Brand Core must remain English in every locale.

The reference's verification record reports server, publishing, locale and browser checks. This inspection did not rerun its test suite or perform production editing.

## Required BrandOS export experience

The exported Brand Book should follow this website's design and organization. It should be a usable brand guideline destination, with a separate downloadable kit. The existing BrandOS three-section summary is not the target export layout.

1. **Branded landing.** Use the selected brand's real approved logo, primary/secondary colours, display/body font roles, photography and approved positioning/copy. Preserve the reference's hierarchy and navigation pattern. Do not apply Cake-me's palette or marketing language to other brands.
2. **Dedicated guideline chapters.** Provide strategy, visual foundations, voice, applications and resources with their relevant subpages. Missing material is marked clearly or omitted; no invented brand rules, example claims or generated filler.
3. **Interactive inspection.** Keep logo lockup/background examples, type specimens, reference grids, swatches and practical do/don't guidance. Show meaningful source labels and version/certification information without exposing implementation metadata.
4. **Export selector.** Preselect essential approved assets. Permit individual logo variants, palette/token files, voice rules, reference images and strategy material. Distinguish downloadable resources from preview-only or licensed materials.
5. **Website and kit are distinct outputs.** A standalone guideline website/HTML package needs its navigation, styles and allowed assets. The selected-assets ZIP contains the chosen originals plus README, versioned manifest and useful machine-readable files. The reference's current selected-kit builder is not yet a complete website exporter.
6. **Durable assets.** Pack actual approved asset bytes and use package-relative references. Never ship expiring signed URLs, auth tokens, private storage paths, editor sessions or raw internal identifiers in reader-facing output.
7. **Certified snapshot.** Bind each exported version to a specific certified Brand Core and its approved sources. Owner edits continue through BrandOS versioning; they must not silently change an earlier certified export. Draft previews are visibly drafts.
8. **Existing roles.** Brand owners/users read Brand Book and request changes. Certify remains CD/certifier-only. Reuse BrandOS account permissions and the existing local Supabase stack; do not transplant a parallel password-based CMS, cloud store or Supabase project.
9. **Languages and rights.** Supply en/es/ar navigation, captions, export messages, README and RTL layout. Preserve brand/font names and literal Brand Core. Font upload rights do not automatically grant redistribution rights; include commercial font binaries only with explicit redistribution permission.

## Data mapping

| Reference area | BrandOS source / constraint |
| --- | --- |
| Cover and strategy | Certified `identity`, `audience`, `positioning`, `goals`, `strategic` content |
| Logo | All approved `visual.logo` variants and use tags; original source assets |
| Colour | All palette groups, names and approved usage notes; derived token downloads |
| Typography | Font family/usage/weight/style metadata, live preview assets, licence and redistribution policy |
| Imagery | Approved reference assets/tags and imagery/avoid guidance |
| Voice | Register, rhythm, signatures, forbidden words and recorded examples |
| Applications / learned rules | Existing approved examples and recorded learning only; absent content remains absent |
| Resources / Export | Brand-scoped asset selection and version-bound downloadable files |
| For agents | Deliberate downloadable machine data; no raw JSON dumped into ordinary reader or reviewer screens |

## Remaining integration gap

The reference export maps human selection labels to fixed Cake-me file paths. BrandOS currently renders a generic three-chapter view and has no matching Brand Book website/kit exporter. Adapting the reference requires a generic certified-data adapter, branded guideline renderer, authenticated asset packaging and export/version tests. These are application changes, not a CSS reskin or a link to the existing Cake-me site.

Acceptance: compare Cake Me against the designated reference at desktop/mobile sizes; inspect another brand to rule out hardcoded Cake-me styling; exercise en/es/ar including RTL; open the packaged website with local assets; verify ZIP contents/rights and absence of tokens; preserve Certify role restrictions and certified-version integrity.
