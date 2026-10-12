// Email sequence code checks (CREWS §2 step 4).
import { result, bannedCheck, linksCheck, altCheck, htmlSizeCheck, contrastCheck, isHttpsUrl, wordCount } from "./common.js";

export const EMAIL_LIMITS = Object.freeze({ subjectSoft: 50, subjectHard: 70, preheaderMin: 40, preheaderMax: 100, headline: 60, bodyWords: 200, htmlBytes: 80 * 1024 });

export function checkEmailCopy(email, { banned = [] } = {}) {
  const subject = String(email?.subject || "");
  const pre = String(email?.preheader || "");
  const words = wordCount((email?.body_blocks || []).join(" "));
  const subjectOk = subject.length > 0 && subject.length <= EMAIL_LIMITS.subjectSoft;
  return [
    result("LEN_SUBJECT", subjectOk, `Subject ${subject.length}/${EMAIL_LIMITS.subjectSoft} chars${subject.length > EMAIL_LIMITS.subjectHard ? " (over hard limit 70)" : ""}`),
    result("LEN_PREHEADER", pre.length >= EMAIL_LIMITS.preheaderMin && pre.length <= EMAIL_LIMITS.preheaderMax, `Preheader ${pre.length} chars (40–100)`),
    result("LEN_HEADLINE", String(email?.headline || "").length <= EMAIL_LIMITS.headline, `Headline ${String(email?.headline || "").length}/${EMAIL_LIMITS.headline} chars`),
    result("LEN_BODY", words > 0 && words <= EMAIL_LIMITS.bodyWords, `Body ${words}/${EMAIL_LIMITS.bodyWords} words`),
    result("CTA", !!email?.cta?.label && isHttpsUrl(email?.cta?.url), email?.cta?.label ? `CTA "${email.cta.label}" → ${email.cta.url}` : "No primary CTA"),
    result("SUBJECT_PREHEADER_DISTINCT", subject.trim().toLowerCase() !== pre.trim().toLowerCase() && !pre.toLowerCase().startsWith(subject.toLowerCase()), "Subject and preheader differ"),
    bannedCheck("BANNED", [subject, pre, email?.headline, ...(email?.body_blocks || []), email?.cta?.label].join("\n"), banned),
  ];
}

export function checkEmailHtml({ html, mjmlErrors = [], tokens }) {
  const ctas = (String(html).match(/class="cta-primary"/g) || []).length;
  return [
    result("MJML", mjmlErrors.length === 0 && !!html, mjmlErrors.length ? `MJML errors: ${mjmlErrors.length}` : "MJML compiled with 0 errors", "hard", "none"),
    htmlSizeCheck(html, EMAIL_LIMITS.htmlBytes),
    altCheck(html),
    linksCheck(html),
    result("ONE_PRIMARY_CTA", ctas === 1, `${ctas} primary CTA(s)`, "hard", "none"),
    contrastCheck([[tokens.ink, "#ffffff", "body text/card"]]),
    // CTA label is 19px bold = WCAG large text, so the AA threshold is 3:1.
    { ...contrastCheck([[tokens.cta_text, tokens.primary, "CTA label (19px bold)"]], 3), id: "CONTRAST_CTA" },
  ];
}
