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
    assert.match(section, /on conflict do nothing/);
    cursor = at + file.length;
  }
  const sectionOf = (file) => {
    const at = doc.indexOf(file);
    const next = pending[pending.indexOf(file) + 1];
    const end = next ? doc.indexOf(next, at + file.length) : doc.length;
    return doc.slice(at, end === -1 ? doc.length : end);
  };
  assert.match(sectionOf("20260815005000_platform_integrity.sql"), /Safe before the merge/);
  assert.match(sectionOf("20260815005000_platform_integrity.sql"), /If it was never applied \(the verify query returns no row\), it needs separate review/);
  assert.match(sectionOf("20260815005000_platform_integrity.sql"), /insert into supabase_migrations\.schema_migrations \(version,name\) values \('20260815005000','platform_integrity'\) on conflict do nothing/);
  assert.equal(doc.match(/on conflict do nothing/g).length, pending.length + 1);
  assert.match(sectionOf("20260901000000_delegation_token_hash.sql"), /Apply together with or immediately after the main deploy/);
  assert.match(sectionOf("20260901000000_delegation_token_hash.sql"), /discovery-delegation\.js/);
  assert.doesNotMatch(sectionOf("20260901000000_delegation_token_hash.sql"), /Safe before the merge/);
  // Both need code that ships with the merge; applying them earlier breaks the live app.
  const DEPLOY_COUPLED = ["20260901000000_delegation_token_hash.sql", "20261016020000_client_safe_runs_outputs.sql"];
  assert.match(sectionOf("20261016020000_client_safe_runs_outputs.sql"), /SPA\/API deploy first, then apply this migration, only with Oscar\/Kai approval/);
  assert.match(sectionOf("20261016020000_client_safe_runs_outputs.sql"), /runs\.model_used/);
  assert.doesNotMatch(sectionOf("20261016020000_client_safe_runs_outputs.sql"), /Safe before the merge/);
  for (const file of pending.filter((name) => !DEPLOY_COUPLED.includes(name))) {
    assert.match(sectionOf(file), /Safe before the merge/, file);
  }
  assert.match(sectionOf("20260910000000_brief_drafts.sql"), /Run the verify query first and skip if a row comes back/);
  assert.match(sectionOf("20261010040000_discovery_run_progress.sql"), /Run the verify query first and skip if a row comes back/);
  assert.match(sectionOf("20260910000000_brief_drafts.sql"), /where to_regclass\('public\.brief_drafts'\) is not null/);
  assert.match(sectionOf("20261010040000_discovery_run_progress.sql"), /where to_regclass\('public\.discovery_runs'\) is not null/);
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
    "20261012000000_brand_rules.sql",
    "20261012010000_runs_release_failed.sql",
    "20261013000000_bio_sources_font_mime.sql",
    "20261013010000_append_bio_version_expected.sql",
    "20261013020000_cert_messages.sql",
    "20261013030000_discovery_review_gate.sql",
    "20261013040000_certifier_durable_state.sql",
    "20261014000000_reference_intake.sql",
    "20261014050000_output_qa_passed.sql",
    "20261016000000_brand_core_input_tags.sql",
    "20261016010000_certify_review_progress.sql",
    "20261016020000_client_safe_runs_outputs.sql",

    "20261016020000_brand_book_shares.sql",
  ]);
});
