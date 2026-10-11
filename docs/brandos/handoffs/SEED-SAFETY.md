# Seeding the `specs` table safely (applies to every handoff)

**Never run `node scripts/seed-specs.mjs` with no flags, and never run it with `--all`, on a shared or prod DB.** A full seed rewrites every row from `portal-data.js` and wipes the ~22 manual route downgrades that live only in the DB.

Starting with the Visual A diff, `seed-specs.mjs` **refuses to run without `--only=<ids>` or `--all`** (exit code 2). It also supports `--dry-run`, which prints `id  primary  fallback  bioSlices` without touching the DB. `scripts/test-seed-only.mjs` covers these flags. Slices 1-2 (hero) were merged before this flag existed. If you still need to seed them, apply Visual A first, or use the restore path below.

## 1. Back up the table (every time, before any seed)
```
mkdir -p backups && TS=$(date +%Y%m%d-%H%M%S) && \
curl -sf "$SUPABASE_URL/rest/v1/specs?select=*&order=specialist_id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  > backups/specs-$TS.json && jq length backups/specs-$TS.json && echo backups/specs-$TS.json
```
The output should be a non-zero row count. Keep the file and do not commit it.

## 2. Check for manual downgrades on the ids you are about to seed
```
IDS=a19,a20            # the slice step's list, from the table below
node scripts/seed-specs.mjs --dry-run --only=$IDS
jq -r --arg ids "$IDS" '.[] | select(.specialist_id as $s | ($ids|split(",")|index($s))) | [.specialist_id,.version,.payload.modelRouting.primary,(.payload.modelRouting.fallback//"-")]|@tsv' backups/specs-$TS.json
```
If the DB primary for an id differs from what `portal-data.js` held **before** this slice, that row has a manual downgrade. Seeding would overwrite it. **Drop that id from `IDS` and report it to Kai/Oscar.** Do not decide on your own.

## 3. Seed only the changed ids
```
node --env-file=server/.env scripts/seed-specs.mjs --only=$IDS
```
The script prints `Seeding N row(s): ...`. N must equal the number of ids.

## 4. Restore rows from the backup (rollback)
```
jq --arg ids "$IDS" '[.[] | select(.specialist_id as $s | ($ids|split(",")|index($s)))]' backups/specs-$TS.json > /tmp/specs-restore.json && \
curl -sf -X POST "$SUPABASE_URL/rest/v1/specs?on_conflict=specialist_id,version" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates,return=minimal" \
  --data @/tmp/specs-restore.json && echo restored
```

## Ids to seed per step (computed from `--dry-run --all` before/after each diff, plus changed overrides)
| step | `--only=` |
|---|---|
| hero routing (slice 1, merged) | `a02,a12,a13,a14,a16,a18,a24,a37` |
| hero prompts (slice 2, merged) | `a12,a13,a14,a16,a37` |
| Visual A | `a19,a20,a21,a22,a27,a28,a41,a42,a43,a44,a45,a46,a50,a51,a52` (a27, a28 and a50-52 because of the Motion dept bioSlices fix; a20-22, a42-44 and a50 because of the new image fallbacks). a24 also changes in theory (it drops the no-op `imagery` slice), but it is a hero row, so leave it out. |
| Visual B | `a19,a20,a21,a22,a41,a42,a43,a44,a45,a46` (minus declined rows, except that a20-22, a43 and a44 follow STEP-B row 36) |
| Strategy A / B | `a01,a03,a04,a05,a34` / only the approved ids among those |
| Concept/Copy A / B | `a06,a07,a08,a09,a10,a11,a15,a17,a35,a36,a38,a39,a40` / only the approved ids |
| Research A / B | `a30,a31,a32,a33,a53,a54,a55` / only the approved ids among `a30,a33,a53,a54,a55` |
| Web/Motion A / B | `a23,a25,a26,a27,a28,a29,a47,a48,a49,a50,a51,a52` / only the approved ids among `a23,a28,a47,a48,a49,a50,a51` |
If you apply several steps back to back, you can take one backup, then seed the union of their ids once at the end.
