import test from "node:test";
import assert from "node:assert/strict";
import { parseCompiledBio } from "./parse-compiled-bio.js";

test("accepts plain and fenced BIO objects", () => {
  for (const text of ['{"identity":{"category":"Local marketing"}}', '```json\n{"identity":{"category":"Local marketing"}}\n```']) {
    assert.equal(parseCompiledBio(text).identity.category, "Local marketing");
  }
});
test("output-limit finish reason is distinct from malformed JSON", () => {
  for (const stopReason of ["length", "max_tokens"]) {
    assert.throws(() => parseCompiledBio('{"identity":', { stopReason }), { code: "BIO_TRUNCATED" });
  }
  assert.throws(() => parseCompiledBio('{"private-source":', { stopReason: "stop" }), error => error.code === "BIO_INVALID_JSON" && !error.message.includes("private-source"));
});
test("rejects non-object JSON candidates", () => {
  for (const text of ["null", "[]", '"brand"', "4"]) assert.throws(() => parseCompiledBio(text), { code: "BIO_INVALID_SHAPE" });
});
