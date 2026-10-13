// Social post code checks (CREWS §1 step 3).
import { result, bannedCheck, aspectCheck } from "./common.js";

export const SOCIAL_LIMITS = Object.freeze({ caption: 2200, firstLine: 125, hashtags: 5 });

export function checkSocialCopy(post, { banned = [] } = {}) {
  const caption = String(post?.caption || "");
  const firstLine = caption.split(/\r?\n/)[0] || "";
  const tags = Array.isArray(post?.hashtags) ? post.hashtags : [];
  const inlineTags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  return [
    result("LEN_CAPTION", caption.length > 0 && caption.length <= SOCIAL_LIMITS.caption, `Caption ${caption.length}/${SOCIAL_LIMITS.caption} chars`),
    result("LEN_FIRST_LINE", firstLine.length <= SOCIAL_LIMITS.firstLine, `First line ${firstLine.length}/${SOCIAL_LIMITS.firstLine} chars`),
    result("HASHTAGS", tags.length + inlineTags <= SOCIAL_LIMITS.hashtags, `${tags.length + inlineTags}/${SOCIAL_LIMITS.hashtags} hashtags`),
    result("CTA", !!String(post?.cta || "").trim(), post?.cta ? "CTA present" : "No CTA"),
    bannedCheck("BANNED", [caption, post?.overlay_line, tags.join(" "), post?.cta].join("\n"), banned),
  ];
}

export function checkSocialImage(image, { aspect }) {
  if (!image?.asset_url) return [result("IMAGE", false, image?.error || "No image produced", "hard", "image")];
  return [
    aspectCheck(image.width, image.height, aspect),
    result("OCR_NOTEXT", image.ocr?.pass === true, image.ocr?.reason || "OCR not run", "hard", "image"),
  ];
}
