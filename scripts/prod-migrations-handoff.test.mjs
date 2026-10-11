import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const MAIN_APPLIED = [
  "20260524183348_init.sql",
  "20260524185323_grants_and_admin_rls.sql",
  "20260527000000_brandolph_memory.sql",
  "20260708120000_notifications.sql",
  "20260805000000_new_workspace_credit_grant.sql",
  "20260815000000_m1_gate_and_hardening.sql",
  "20260815000000_platform_integrity.sql",
  "20260815010000_m2_certification.sql",
  "20260815020000_m3_discovery.sql",
  "20260815030000_m5_locale.sql",
  "20260815040000_p3_hardening.sql",
  "20260815050000_lang_management.sql",
  "20260816000000_scoped_access_and_opex.sql",
  "20260816010000_atomic_workspace_ownership.sql",
  "20260817000000_invitation_role_policy.sql",
];

test("the production handoff lists every dev migration missing from main, in order", () => {
  const devFiles = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const pending = devFiles.filter((name) => !MAIN_APPLIED.includes(name));
  const doc = readFileSync(new URL("../docs/brandos/handoffs/2026-10-11-prod-migrations/MIGRATIONS.md", import.meta.url), "utf8");
  assert.match(doc, /20260815005000_platform_integrity`? was renamed/);
  assert.match(doc, /20260815000000_platform_integrity\.sql/);
  assert.match(doc, /Do not apply this list from the handoff/);
  let cursor = 0;
  for (const file of pending) {
    const at = doc.indexOf(file, cursor);
    assert.ok(at > cursor, file);
    const next = pending[pending.indexOf(file) + 1];
    const end = next ? doc.indexOf(next, at + file.length) : doc.length;
    const section = doc.slice(at, end === -1 ? doc.length : end);
    assert.match(section, new RegExp(`psql "\\$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'begin' -f supabase/migrations/${file.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}`));
    assert.match(section, /```sql\nselect\b/);
    cursor = at + file.length;
  }
  assert.deepEqual(pending, [
    "20260815005000_platform_integrity.sql",
    "20260901000000_delegation_token_hash.sql",
    "20260910000000_brief_drafts.sql",
    "20261010010000_bio_review_attestation.sql",
    "20261010020000_bio_client_acceptance.sql",
    "20261010030000_bio_client_acceptance_receipt.sql",
    "20261010040000_discovery_run_progress.sql",
    "20261011000000_output_needs_review.sql",
    "20261011010000_hero_model_rate_cards.sql",
  ]);
});
