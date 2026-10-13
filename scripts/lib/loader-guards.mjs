// Pure guards for scripts/load-cake-me-foundation.mjs (unit-tested in scripts/loader-guards.test.mjs).
export const isLocalUrl = (url) => {
  try { const h = new URL(url).hostname; return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]" || h === "host.docker.internal"; }
  catch { return false; }
};
// Argument-level checks that run before any DB access.
export function checkArgs({ only, expectedId, assets, actor, expectVersion, apply, iKnowProd, supabaseUrl }) {
  if (only !== expectedId) return `Refusing: --only=${expectedId} is required (got ${only || "none"})`;
  if (!assets || !actor) return "--assets and --actor are required";
  if (!/^\d+$/.test(String(expectVersion ?? ""))) return "Refusing: --expect-version=<current latest version> is required";
  if (!supabaseUrl) return "Refusing: SUPABASE_URL is not set";
  if (apply && !isLocalUrl(supabaseUrl) && !iKnowProd) return "Refusing: --apply against a non-local database also needs --i-know-this-is-prod";
  return null;
}
// State checks against the latest Brand Core version, before anything is written.
export function checkLatest({ latest, expectVersion, foundationComplete }) {
  if (!latest) return "Refusing: brand has no Brand Core version";
  if (latest.version !== Number(expectVersion)) return `Refusing: latest version is v${latest.version}, --expect-version=${expectVersion}`;
  if (foundationComplete) return `Refusing: v${latest.version} already has a complete foundation; nothing to load`;
  return null;
}
