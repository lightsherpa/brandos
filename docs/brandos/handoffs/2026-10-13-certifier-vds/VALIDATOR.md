# Citation validator + repair pass (code, `server/src/lib/certifier/validate.js`)

```js
const norm = s => s.normalize("NFKC").toLowerCase()
  .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\s+/g," ").trim();

// manifest: Map<source_id, {text, pages?: string[], kind, first_party, derived_from_model}>
export function validateBrief(out, manifest, ledger) {
  const errors = [];
  if (!ajv.validate(MODEL_OUTPUT_SCHEMA, out))
    errors.push(...ajv.errors.map(e => ({ path: e.instancePath, code: "schema" })));

  forEachStatement(out, (st, path) => {             // brand_in_60s[], claims[].rationale[], questions[].why
    if (st.unknown === true) {
      if (st.citations?.length) errors.push({ path, code: "unknown_with_citations" });
      return;
    }
    if (!st.citations?.length) return errors.push({ path, code: "missing_citation" });
    st.citations.forEach((c, i) => {
      const p = `${path}/citations/${i}`;
      const src = manifest.get(c.source_id);
      if (!src) return errors.push({ path: p, code: "unknown_source" });
      if (src.derived_from_model) return errors.push({ path: p, code: "circular_source" });
      const hay = c.page ? src.pages?.[c.page - 1] : src.text;
      if (c.page && hay == null) return errors.push({ path: p, code: "bad_page" });
      if (c.image && c.image !== c.source_id && !manifest.get(c.image)) return errors.push({ path: p, code: "bad_image" });
      const hit = locate(norm(hay), norm(c.span));    // exact, else fuzzy
      if (!hit) return errors.push({ path: p, code: "span_not_found" });
      c.char_start = hit.start; c.char_end = hit.end; // locator for side-by-side highlight
      if (!c.page && src.pages) c.page = pageOf(src, hit.start);
    });
  });
  for (const cl of out.claims ?? [])
    if (!ledger.has(cl.claim_id)) errors.push({ path: `/claims/${cl.claim_id}`, code: "unknown_claim" });
  for (const q of out.questions ?? []) {
    if (q.claim_ids.some(id => !ledger.has(id))) errors.push({ path: q.text, code: "unknown_claim" });
    if (/^(is|are|do|does|you're|isn't|right\?)|, right\?$/i.test(q.text.trim()))
      errors.push({ path: q.text, code: "leading_question", soft: true });
  }
  return { valid: errors.filter(e => !e.soft).length === 0, errors };
}

function locate(hay, needle) {
  const i = hay.indexOf(needle);
  if (i >= 0) return { start: i, end: i + needle.length };
  // sliding window, token-level similarity ≥ 0.9 (Dice on word bigrams)
  return bestWindow(hay, needle, 0.9);              // null if below threshold
}

export async function runWithRepair(callModel, ctx) {
  let out = await callModel(ctx.messages);
  let res = validateBrief(out, ctx.manifest, ctx.ledger);
  let repairPasses = 0;
  if (!res.valid && ctx.costSoFar() < 0.26) {       // keep under $0.30 cap
    repairPasses = 1;
    out = await callModel([...ctx.messages,
      { role: "user", content: "Your brief failed validation. Fix ONLY these items; " +
        "copy spans verbatim or set unknown:true:\n" + JSON.stringify(res.errors) }]);
    res = validateBrief(out, ctx.manifest, ctx.ledger);
  }
  let replaced = 0;
  if (!res.valid) {                                  // fail-safe: degrade, never block the CD
    for (const e of res.errors.filter(e => !e.soft)) {
      const st = statementAt(out, e.path);
      if (st) { st.text = "Unknown — not supported by sources."; st.citations = []; st.unknown = true; replaced++; }
      if (e.code === "unknown_claim") dropAt(out, e.path);
    }
    if (!ajv.validate(MODEL_OUTPUT_SCHEMA, out)) out = emptyBriefFrom(ctx.ledger); // all "To confirm"
  }
  return enrich(out, ctx, { repairPasses, replaced });
}

// enrich(): CODE ONLY — confidence, rank, status, gate, grouping
function confidenceFor(claim, cites, manifest) {
  if (claim.provenance === "conflicting" || distinctValues(claim) > 1) return "conflicting";
  if (claim.provenance === "missing" || claim.value == null || isEmpty(claim.value)) return "to_confirm";
  const ev = cites.filter(c => !manifest.get(c.source_id).derived_from_model);
  if (isFrameworkDefault(claim) || ev.length === 0) return "guessed";   // e.g. #000/#fff, provenance inferred
  const fp = ev.filter(c => manifest.get(c.source_id).first_party);
  const indep = new Set(ev.map(c => manifest.get(c.source_id).src_domain ?? c.source_id)).size;
  let level = indep >= 2 && fp.length ? "high" : fp.length ? "medium" : "low";
  if (claim.suggested_concern === "weak") level = lower(level);        // model can only LOWER
  if (claim.suggested_concern === "conflict") level = "conflicting";
  return level;
}
// rank: to_confirm > conflicting > guessed > low > medium > high;
//   tie-break: blocks_certification first, then layer 1 > 2 > 3, then HIGH_IMPACT (steward-copilot.js).
// status_label: to_confirm → "To confirm" (actions ask_client, add; neutral style; top);
//   has client evidence newer than brief → "New evidence"; low/guessed/conflicting → "Needs review"; else "Evidence ok".
// blocks_certification: claim is logo | primary colour role | display font and confidence ∉ {medium, high}.
// question_groups: group questions by section; draft each via draft_client_question (status 'draft').
```
