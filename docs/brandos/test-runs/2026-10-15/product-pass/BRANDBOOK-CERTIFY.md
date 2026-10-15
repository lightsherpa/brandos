# Brand book and Certify confirmation proof

15 October 2026. All browser access used the existing local web app at `127.0.0.1:5196`, API `8796` and CaastorOS Supabase `54321`. No data writes, seeding or certification submissions were performed by this proof.

- `VITE_BRAND_BOOK_V2=1` enables the editorial read view; absent/zero retains the previous view. Default is off in code. `VITE_CERTIFY_UX=1` gates the enhanced owner confirmation and existing Certify experience.
- The book is three editorial chapters: strategy, visual identity and voice. It reads the saved Brand Core without introducing findings. Logo previews and references use the existing signed source endpoint. Palette supports all saved colours, tagged roles and supplied usage notes, with explicit gaps when notes are absent. Commercial font families use the actual registered `FontFace` source name. The browser proof found **21 live H1–H6/body rows** across three loaded fonts. Unavailable fonts show an explicit source-review instruction.
- Owner section review is a large primary action above content, with progress and automatic advance. The primary final confirmation stays in a sticky footer. CD review likewise has a sticky, single review confirmation entry. Existing evidence drawer, Stewart, client chat and version creation remain in Certify.
- All added controls have en/es/ar copy; Brand Core retains its spelling. Arabic read view is RTL.
- 14 focused component tests passed; production build passed (existing chunk-size advisory only). New component tests are included automatically by the full-suite discovery.

## Browser proof

`brandbook-certify-proof.json` records the read-only run and **18 screenshots**, covering Brand book, owner section confirmation, and the final **Certify Brand Core** action in en/es/ar at 1280px and 1440px. No browser errors or horizontal overflow.

Reproduce using the existing `.mvp-local/certify-ux-session.json` (never committed; contains local auth):

```sh
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright/index.mjs \
BRAND_BOOK_PROOF_BRAND_ID=0b9560e9-684d-4fc4-bed4-fbced3c4f808 \
node scripts/capture-brandbook-product-pass.mjs
```

The script updates only client-side review state to expose the confirmation screen; it never clicks the certification submit button. The Brand book images show the previously certified local Cake Me v3 copy. Owner confirmation images show its separate pre-existing pending v4 copy. Root's final walkthrough covers actual certification separately.

No new role naming changes were made. `docs/brandos/specs/ROLES.md` remains proposed for Oscar's approval.
