// Strip bearer-token material out of anything on its way to a log sink.
//
// SECURITY (CAA-51, remediating CAA-49 §S2): the discovery delegation token
// travels in the URL path, so Hono's request logger wrote a live, reusable
// magic link into stdout on every call — and application logs are typically
// retained longer, and read more widely, than the database. Hashing the token
// at rest is only half the fix; the log line has to stop carrying it too.
//
// Pure string transform, no I/O.

// /api/discovery/delegation/<token>  (also matches the un-prefixed mount form)
const DELEGATION_PATH = /(\/delegation\/)[A-Za-z0-9_-]{8,}/g;
// #/discovery/handoff/<token> — the shape of the emailed link, in case one is
// ever echoed into a log or an error message.
const HANDOFF_LINK = /(\/discovery\/handoff\/)[A-Za-z0-9_-]{8,}/g;
// ?token=… / &access_token=… style query material.
const TOKEN_QUERY = /([?&](?:[A-Za-z_]*_)?token=)[^&\s]+/gi;

const MASK = "[redacted]";

/**
 * @param {unknown} line
 * @returns {string} the input with any delegation token material masked.
 */
export function redactLogLine(line) {
  return String(line ?? "")
    .replace(DELEGATION_PATH, `$1${MASK}`)
    .replace(HANDOFF_LINK, `$1${MASK}`)
    .replace(TOKEN_QUERY, `$1${MASK}`);
}

/**
 * Drop-in print function for Hono's `logger()` middleware.
 * Usage: `app.use("*", logger(redactingLogPrinter))`
 */
export function redactingLogPrinter(message, ...rest) {
  console.log(redactLogLine(message), ...rest.map((v) => (typeof v === "string" ? redactLogLine(v) : v)));
}
