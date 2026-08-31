import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAPTER_FIELD_KINDS,
  DELEGABLE_CHAPTERS,
  MAX_LIST_ITEMS,
  MAX_OBJLIST_KEYS,
  MAX_PAYLOAD_BYTES,
  MAX_SCALAR_CHARS,
  hashDelegationToken,
  isWellFormedToken,
  mintDelegationToken,
  validateChapterFields,
} from "./delegation-token.js";

/* ── minting + digesting ─────────────────────────────────────────────── */

test("minted tokens are high-entropy, URL-safe, and unique", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const { token, tokenHash } = mintDelegationToken();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/, "43 base64url chars = 32 random bytes");
    assert.equal(token, encodeURIComponent(token), "must survive a URL path unescaped");
    assert.match(tokenHash, /^[0-9a-f]{64}$/);
    assert.ok(!seen.has(token), "no collisions");
    seen.add(token);
  }
});

test("the digest is deterministic and one-way — the token is not recoverable from it", () => {
  const { token, tokenHash } = mintDelegationToken();
  assert.equal(hashDelegationToken(token), tokenHash, "same token → same digest (lookup works)");
  assert.ok(!tokenHash.includes(token), "digest does not embed the token");
  // A digest is exactly 64 hex chars; the token is base64url. No overlap of
  // alphabets beyond hex, so a leaked digest is not usable as a token either.
  assert.equal(isWellFormedToken(tokenHash), true, "shape-valid…");
  assert.notEqual(hashDelegationToken(tokenHash), tokenHash, "…but it hashes to something else, so replaying a stolen digest as a token misses");
});

test("a single-character change produces a completely different digest", () => {
  const { token, tokenHash } = mintDelegationToken();
  const tampered = (token[0] === "A" ? "B" : "A") + token.slice(1);
  assert.notEqual(hashDelegationToken(tampered), tokenHash);
});

test("the pepper is honoured and rotating it invalidates every existing digest", () => {
  const previous = process.env.DELEGATION_TOKEN_PEPPER;
  try {
    const token = mintDelegationToken().token;

    process.env.DELEGATION_TOKEN_PEPPER = "";
    const unpeppered = hashDelegationToken(token);

    process.env.DELEGATION_TOKEN_PEPPER = "pepper-one";
    const pepperOne = hashDelegationToken(token);

    process.env.DELEGATION_TOKEN_PEPPER = "pepper-two";
    const pepperTwo = hashDelegationToken(token);

    assert.notEqual(pepperOne, unpeppered, "HMAC under a pepper ≠ plain SHA-256");
    assert.notEqual(pepperOne, pepperTwo, "rotating the pepper revokes every pending link");

    process.env.DELEGATION_TOKEN_PEPPER = "pepper-one";
    assert.equal(hashDelegationToken(token), pepperOne, "stable while the pepper is stable");
  } finally {
    if (previous === undefined) delete process.env.DELEGATION_TOKEN_PEPPER;
    else process.env.DELEGATION_TOKEN_PEPPER = previous;
  }
});

test("malformed tokens fail closed — no digest, so no lookup key", () => {
  for (const bad of [null, undefined, "", 42, {}, [], "short", "has spaces in it", "has/slash/segments", "a".repeat(200), "tok+en=", "../../etc/passwd"]) {
    assert.equal(isWellFormedToken(bad), false, `${JSON.stringify(bad)} must not be well-formed`);
    assert.equal(hashDelegationToken(bad), null, `${JSON.stringify(bad)} must not produce a digest`);
  }
});

/* ── chapter payload bounds ──────────────────────────────────────────── */

test("the delegable chapters are exactly the BIO registry sections", () => {
  // Same six sections the route accepted before CAA-51 — sourced from the
  // registry now, so the route and this guard cannot drift apart. Only the
  // listing order differs (registry order), which membership checks ignore.
  assert.deepEqual([...DELEGABLE_CHAPTERS].sort(), ["audience", "goals", "identity", "strategic", "visual", "voice"]);
});

test("a normal chapter submission is accepted", () => {
  const result = validateChapterFields("voice", {
    register: "Warm, direct, never precious.",
    rhythm: "Short sentences.",
    forbidden: ["synergy", "leverage"],
    signatures: ["We build it, then we say it."],
  });
  assert.equal(result.ok, true);
});

test("objlist chapters accept palette and type entries", () => {
  assert.equal(validateChapterFields("visual", {
    palette: [{ hex: "#F8C036", name: "Signal", conf: 90, wcag: "AA" }],
    type: [{ kind: "Body", family: "Inter" }],
    imagery: ["documentary"],
  }).ok, true);
});

test("keys outside the delegated chapter are rejected", () => {
  // The whole point of chapter isolation: a `voice` delegate cannot reach
  // another section's fields, nor smuggle in payload-level metadata.
  for (const [chapter, key] of [["voice", "positioning"], ["identity", "register"], ["goals", "palette"]]) {
    const r = validateChapterFields(chapter, { [key]: "x" });
    assert.equal(r.ok, false, `${chapter}.${key} must be rejected`);
    assert.equal(r.code, "UNKNOWN_FIELD");
  }
  for (const key of ["schema_version", "confidence", "evidence", "__proto__", "constructor"]) {
    assert.equal(validateChapterFields("voice", { [key]: "x" }).ok, false, `${key} must be rejected`);
  }
});

test("unknown chapters are rejected", () => {
  const r = validateChapterFields("nonsense", { anything: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "BAD_CHAPTER");
});

test("non-objects and empty objects are rejected", () => {
  for (const bad of [null, undefined, "string", 7, [], [{ register: "x" }], {}]) {
    const r = validateChapterFields("voice", bad);
    assert.equal(r.ok, false, `${JSON.stringify(bad)} must be rejected`);
    assert.equal(r.code, "BAD_FIELDS");
  }
});

test("value types are checked against the registry kind", () => {
  assert.equal(validateChapterFields("voice", { register: ["not", "a", "string"] }).code, "BAD_FIELD_VALUE");
  assert.equal(validateChapterFields("voice", { forbidden: "not an array" }).code, "BAD_FIELD_VALUE");
  assert.equal(validateChapterFields("voice", { forbidden: [{ nested: "object" }] }).code, "BAD_FIELD_VALUE");
  assert.equal(validateChapterFields("visual", { palette: ["#fff"] }).code, "BAD_FIELD_VALUE");
  assert.equal(validateChapterFields("visual", { palette: [{ nested: { deep: 1 } }] }).code, "BAD_FIELD_VALUE");
});

test("every size dimension is bounded", () => {
  // scalar length
  assert.equal(validateChapterFields("voice", { register: "a".repeat(MAX_SCALAR_CHARS) }).ok, true);
  assert.equal(validateChapterFields("voice", { register: "a".repeat(MAX_SCALAR_CHARS + 1) }).code, "FIELD_TOO_LARGE");

  // list item count
  assert.equal(validateChapterFields("voice", { forbidden: Array(MAX_LIST_ITEMS).fill("x") }).ok, true);
  assert.equal(validateChapterFields("voice", { forbidden: Array(MAX_LIST_ITEMS + 1).fill("x") }).code, "FIELD_TOO_LARGE");

  // list item length
  assert.equal(validateChapterFields("voice", { forbidden: ["x".repeat(401)] }).code, "FIELD_TOO_LARGE");

  // objlist entry count + property count + property length
  assert.equal(validateChapterFields("visual", { palette: Array(41).fill({ hex: "#fff" }) }).code, "FIELD_TOO_LARGE");
  const wideEntry = Object.fromEntries(Array.from({ length: MAX_OBJLIST_KEYS + 1 }, (_, i) => [`k${i}`, "v"]));
  assert.equal(validateChapterFields("visual", { palette: [wideEntry] }).code, "FIELD_TOO_LARGE");
  assert.equal(validateChapterFields("visual", { palette: [{ name: "x".repeat(401) }] }).code, "FIELD_TOO_LARGE");
});

test("total payload size is capped even when every individual field is legal", () => {
  // Per-field limits alone do not bound the whole body: 40 palette entries ×
  // 12 properties × 400 chars is legal field-by-field and still ~190KB. The
  // total-size check is what actually stops a delegate inflating the draft.
  const entry = Object.fromEntries(
    Array.from({ length: MAX_OBJLIST_KEYS }, (_, i) => [`k${i}`, "v".repeat(400)]),
  );
  const fields = { palette: Array(MAX_LIST_ITEMS).fill(entry) };
  assert.ok(
    Buffer.byteLength(JSON.stringify(fields), "utf8") > MAX_PAYLOAD_BYTES,
    "fixture must actually exceed the cap",
  );
  assert.equal(validateChapterFields("visual", fields).code, "PAYLOAD_TOO_LARGE");

  // …and the same content just under the cap is accepted.
  assert.equal(validateChapterFields("visual", { palette: [entry] }).ok, true);
  assert.ok(Object.keys(CHAPTER_FIELD_KINDS.visual).includes("palette"));
});

test("the accepted payload is returned unchanged — validation never mutates the draft", () => {
  const input = { register: "Warm.", forbidden: ["synergy"] };
  const result = validateChapterFields("voice", input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.fields, input);
});
