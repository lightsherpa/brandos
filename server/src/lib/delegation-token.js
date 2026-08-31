// Discovery delegation magic-link credentials — mint, digest, and bound what a
// delegate is allowed to write. Pure apart from the crypto RNG: no DB, no
// network, so every rule below is testable with a case table.
//
// SECURITY (CAA-51, remediating CAA-49 §S2): a pending delegation link is a
// standing bearer credential for one BIO chapter. Before this module the raw
// token sat in `discovery_delegations.token` AND in the request path (and so in
// the request log), which meant read access to either recovered a usable link.
//
// The rules now:
//   • the raw token exists only in the POST response and the invite email —
//     it is never persisted and never logged (see lib/log-redact.js);
//   • the database stores only a one-way digest, so table/backup/log access
//     cannot reconstruct a link;
//   • lookups are by digest, so a tampered token simply misses.
//
// Digest choice: HMAC-SHA-256 under DELEGATION_TOKEN_PEPPER when configured,
// otherwise a domain-separated plain SHA-256. The token is 256 bits of CSPRNG
// output, so the pepper is defence-in-depth against precomputation rather than
// the load-bearing control (unlike a password digest, there is no low-entropy
// input to grind). Rotating the pepper invalidates every pending link by
// design — that is the revocation lever.

import { createHash, createHmac, randomBytes } from "node:crypto";

import { BIO_FIELDS } from "./bio-schema.js";

// Domain separator: keeps these digests from ever colliding with another
// SHA-256 use in the codebase (e.g. the BIO payload hash).
const DIGEST_DOMAIN = "caastoros:discovery-delegation:v1:";

// 32 bytes → 43 base64url chars. URL-safe, so it drops into the handoff link
// with no escaping.
const TOKEN_BYTES = 32;

// Shape gate for an inbound token. Cheap rejection before any DB round-trip,
// and it also bounds what can reach the digest function. Wide enough to cover
// the pre-CAA-51 UUID shape (those all fail the lookup — the migration expired
// them and dropped the plaintext column).
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{22,128}$/;

let warnedAboutMissingPepper = false;

function pepper() {
  const value = process.env.DELEGATION_TOKEN_PEPPER || "";
  if (!value && !warnedAboutMissingPepper) {
    warnedAboutMissingPepper = true;
    console.warn(
      "[delegation-token] DELEGATION_TOKEN_PEPPER is not set — falling back to an unpeppered SHA-256 digest. " +
        "Tokens stay unrecoverable from the database (256-bit CSPRNG input), but set the pepper to get " +
        "rotation-based revocation.",
    );
  }
  return value;
}

/** True when `token` could be one of ours. Never throws. */
export function isWellFormedToken(token) {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

/**
 * One-way digest of a delegation token, as stored in
 * `discovery_delegations.token_hash` and used as the lookup key.
 * @returns {string|null} lowercase hex digest, or null for a malformed token.
 */
export function hashDelegationToken(token) {
  if (!isWellFormedToken(token)) return null;
  const key = pepper();
  const input = DIGEST_DOMAIN + token;
  return key
    ? createHmac("sha256", key).update(input).digest("hex")
    : createHash("sha256").update(input).digest("hex");
}

/**
 * Mint a fresh credential. The caller persists `tokenHash` and hands `token`
 * back to the creator exactly once.
 * @returns {{ token: string, tokenHash: string }}
 */
export function mintDelegationToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashDelegationToken(token) };
}

/* ─────────────────────────────────────────────────────────────────────
   Bounded, schema-checked chapter payloads

   The PATCH endpoint is unauthenticated — the token is the only credential —
   so the body it accepts must be bounded in every dimension a delegate could
   inflate: key set, key count, value type, item count, string length, and
   total encoded size. Without this an otherwise-valid link is an open door to
   writing megabytes of arbitrary JSON into the brand's draft.

   The allowed keys per chapter come from the BIO field registry, so this stays
   in lockstep with the schema instead of drifting into a second source of
   truth. Values are checked against the registry `kind`.
   ───────────────────────────────────────────────────────────────────── */

export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const MAX_SCALAR_CHARS = 4000;
export const MAX_LIST_ITEMS = 40;
export const MAX_LIST_ITEM_CHARS = 400;
export const MAX_OBJLIST_ITEMS = 40;
export const MAX_OBJLIST_KEYS = 12;
export const MAX_OBJLIST_KEY_CHARS = 40;
export const MAX_OBJLIST_VALUE_CHARS = 400;

// { identity: { positioning: "scalar", pillars: "list", … }, … }
export const CHAPTER_FIELD_KINDS = BIO_FIELDS.reduce((acc, f) => {
  const [section, key] = f.path;
  (acc[section] ||= {})[key] = f.kind;
  return acc;
}, {});

/** The chapters a delegation may be scoped to — registry sections, in order. */
export const DELEGABLE_CHAPTERS = Object.keys(CHAPTER_FIELD_KINDS);

const fail = (code, message) => ({ ok: false, code, message });
const isPlainObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);

function checkObjListItem(item, key) {
  if (!isPlainObject(item)) return fail("BAD_FIELD_VALUE", `${key} entries must be objects`);
  const entryKeys = Object.keys(item);
  if (entryKeys.length > MAX_OBJLIST_KEYS) {
    return fail("FIELD_TOO_LARGE", `${key} entries allow at most ${MAX_OBJLIST_KEYS} properties`);
  }
  for (const entryKey of entryKeys) {
    if (entryKey.length > MAX_OBJLIST_KEY_CHARS) {
      return fail("FIELD_TOO_LARGE", `${key} property names are limited to ${MAX_OBJLIST_KEY_CHARS} characters`);
    }
    const value = item[entryKey];
    if (value === null || typeof value === "number" || typeof value === "boolean") continue;
    if (typeof value !== "string") {
      return fail("BAD_FIELD_VALUE", `${key}.${entryKey} must be a string, number, boolean, or null`);
    }
    if (value.length > MAX_OBJLIST_VALUE_CHARS) {
      return fail("FIELD_TOO_LARGE", `${key}.${entryKey} is limited to ${MAX_OBJLIST_VALUE_CHARS} characters`);
    }
  }
  return null;
}

/**
 * Validate the `fields` object a delegate submits for one chapter.
 *
 * @param {string} chapter - the delegated BIO section.
 * @param {unknown} fields - the raw client value.
 * @returns {{ ok: true, fields: object } | { ok: false, code: string, message: string }}
 */
export function validateChapterFields(chapter, fields) {
  const kinds = CHAPTER_FIELD_KINDS[chapter];
  if (!kinds) return fail("BAD_CHAPTER", "Unknown chapter");
  if (!isPlainObject(fields)) return fail("BAD_FIELDS", "fields object required");

  const keys = Object.keys(fields);
  if (keys.length === 0) return fail("BAD_FIELDS", "fields object required");

  // Total size first — cheapest way to reject an inflated body before walking it.
  let encoded;
  try {
    encoded = JSON.stringify(fields);
  } catch {
    return fail("BAD_FIELDS", "fields must be JSON-serialisable");
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_PAYLOAD_BYTES) {
    return fail("PAYLOAD_TOO_LARGE", `fields exceed ${Math.round(MAX_PAYLOAD_BYTES / 1024)}KB`);
  }

  for (const key of keys) {
    const kind = kinds[key];
    // Allow-list: a delegate writes registry fields of THIS chapter, nothing
    // else. Rejecting unknown keys is what keeps a leaked link from smuggling
    // extra state (confidence, evidence, schema_version…) into the draft.
    if (!kind) return fail("UNKNOWN_FIELD", `${key} is not a field of the ${chapter} chapter`);

    const value = fields[key];

    if (kind === "scalar") {
      if (typeof value !== "string") return fail("BAD_FIELD_VALUE", `${key} must be a string`);
      if (value.length > MAX_SCALAR_CHARS) {
        return fail("FIELD_TOO_LARGE", `${key} is limited to ${MAX_SCALAR_CHARS} characters`);
      }
      continue;
    }

    if (!Array.isArray(value)) return fail("BAD_FIELD_VALUE", `${key} must be an array`);

    if (kind === "list") {
      if (value.length > MAX_LIST_ITEMS) {
        return fail("FIELD_TOO_LARGE", `${key} allows at most ${MAX_LIST_ITEMS} entries`);
      }
      for (const item of value) {
        if (typeof item !== "string") return fail("BAD_FIELD_VALUE", `${key} entries must be strings`);
        if (item.length > MAX_LIST_ITEM_CHARS) {
          return fail("FIELD_TOO_LARGE", `${key} entries are limited to ${MAX_LIST_ITEM_CHARS} characters`);
        }
      }
      continue;
    }

    // objlist — palette / type entries: flat objects of primitives.
    if (value.length > MAX_OBJLIST_ITEMS) {
      return fail("FIELD_TOO_LARGE", `${key} allows at most ${MAX_OBJLIST_ITEMS} entries`);
    }
    for (const item of value) {
      const problem = checkObjListItem(item, key);
      if (problem) return problem;
    }
  }

  return { ok: true, fields };
}
