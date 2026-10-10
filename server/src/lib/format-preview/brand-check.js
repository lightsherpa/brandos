// Deterministic brand check for the demo preview. Forbidden words and
// refusals only — no model call. A format passes or is flagged.

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function visibleText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function brandCheckText(text, { forbidden = [], refusals = [] } = {}) {
  const body = String(text || "");
  const violations = [];
  const seen = new Set();
  const push = (item) => {
    if (!seen.has(item)) {
      seen.add(item);
      violations.push(item);
    }
  };
  for (const word of forbidden) {
    const phrase = String(word || "").trim();
    if (phrase.length < 2) continue;
    if (new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i").test(body)) push(`uses forbidden word "${phrase}"`);
  }
  for (const rule of refusals) {
    const phrase = String(rule || "").trim();
    if (phrase.length < 3) continue;
    if (body.toLowerCase().includes(phrase.toLowerCase())) push(`hits refusal "${phrase}"`);
  }
  return { status: violations.length ? "flag" : "pass", violations };
}

export function brandCheckFormats(rendered, bio = {}, refusals = []) {
  const forbidden = Array.isArray(bio?.voice?.forbidden) ? bio.voice.forbidden : [];
  const rules = [
    ...(Array.isArray(refusals) ? refusals : []),
    ...(Array.isArray(bio?.strategic?.notList) ? bio.strategic.notList : []),
  ];
  const check = (html) => brandCheckText(visibleText(html), { forbidden, refusals: rules });
  return {
    email: check(rendered?.emailHtml),
    landing: check(rendered?.landingHtml),
    deck: check(rendered?.deckHtml),
  };
}
