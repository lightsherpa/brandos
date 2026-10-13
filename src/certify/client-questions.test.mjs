import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

/* AC3: the client's panel shows the CD's question and nothing assistant-made. */
// Placeholder env so the browser Supabase client can be constructed (no request is made).
process.env.VITE_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.VITE_SUPABASE_ANON_KEY ||= "test-anon-key";

test("client question panel renders the CD question with no agent content or label", async (t) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  t.after(() => vite.close());
  const { QuestionsPanel, ClientQuestions } = await vite.ssrLoadModule("/src/certify/ClientQuestions.jsx");

  const open = [{ id: "q1", author_role: "cd", claim_ids: ["visual.type"], body: "Which typeface is your display face?", sent_at: "2026-10-13T10:00:00Z" }];
  const html = renderToStaticMarkup(React.createElement(QuestionsPanel, { brandId: "brand-a", open, onDone() {} }));
  assert.match(html, /Your Creative Director has 1 question/);
  assert.match(html, /Which typeface is your display face\?/);
  assert.match(html, /type="file"/);
  assert.doesNotMatch(html, /assistant|agent|copilot|prepared by|confidence|BIO|Caastor/i);

  assert.equal(renderToStaticMarkup(React.createElement(QuestionsPanel, { brandId: "brand-a", open: [], onDone() {} })), "");
  // Before the API answers (and whenever the flag is off → 404) nothing renders.
  assert.equal(renderToStaticMarkup(React.createElement(ClientQuestions, { brandId: "brand-a" })), "");
});
