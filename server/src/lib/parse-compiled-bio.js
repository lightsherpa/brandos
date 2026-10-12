/** Reject incomplete output without exposing the brand's response in errors. */
export function parseCompiledBio(text, { stopReason } = {}) {
  const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
  if (stopReason === "length" || stopReason === "max_tokens") {
    fail("BIO_TRUNCATED", "Brand Core compiler reached its output limit; no candidate was saved");
  }
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let value;
  try { value = JSON.parse(stripped); }
  catch { fail("BIO_INVALID_JSON", `Brand Core compiler returned invalid JSON (${text.length} characters; stop reason: ${stopReason || "unknown"}); no candidate was saved`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("BIO_INVALID_SHAPE", "Brand Core compiler must return a JSON object; no candidate was saved");
  }
  return value;
}
