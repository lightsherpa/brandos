// Self-certification confidence floor. One config, used by the server gate
// and the review modal. The Creative Director rubric is a separate decision
// and does not set this number.
//
// Default is 80. A caller may pass a stricter or equal floor, but only inside
// 80–85. Anything outside that range is pulled back in, so a stale rubric
// value cannot reopen self-certification below 80.

import { BIO_FIELDS, SCORED_PATHS } from "./bio-schema.js";
import { scoreBio } from "./score-bio.js";

export const SELF_CERT_MIN_SCORE = 80;
export const SELF_CERT_MIN_SCORE_RANGE = Object.freeze({ min: 80, max: 85 });

const nonEmpty = (v) => Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim() !== "");

export function resolveSelfCertMinScore(configured) {
  const n = typeof configured === "number" ? configured : Number(configured);
  if (!Number.isFinite(n)) return SELF_CERT_MIN_SCORE;
  const rounded = Math.round(n);
  return Math.min(SELF_CERT_MIN_SCORE_RANGE.max, Math.max(SELF_CERT_MIN_SCORE_RANGE.min, rounded));
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload && typeof payload === "object" ? payload : {}));
}

// What the score would be if this section were fully answered and sourced.
function perfectSection(payload, section) {
  const next = clonePayload(payload);
  if (!next.confidence || typeof next.confidence !== "object") next.confidence = {};
  for (const field of BIO_FIELDS) {
    if (field.path[0] !== section || !field.scored) continue;
    const key = field.path[1];
    if (!next[section] || typeof next[section] !== "object" || Array.isArray(next[section])) next[section] = {};
    if (!nonEmpty(next[section][key])) next[section][key] = field.kind === "scalar" ? "answered" : ["answered"];
    const dotted = `${section}.${key}`;
    const prior = next.confidence[dotted] && typeof next.confidence[dotted] === "object" ? next.confidence[dotted] : {};
    const source = typeof prior.source === "string" && prior.source.trim() ? prior.source.trim() : `added:${dotted}`;
    next.confidence[dotted] = { ...prior, conf: 100, source };
  }
  return next;
}

/**
 * Score against the floor, plus the sections that are pulling it down and
 * the answers or sources that would raise them.
 * @returns {{ score:number, minScore:number, meetsFloor:boolean, shortfall:number,
 *   sections: Array<{ section:string, points:number, answers:Array<{section:string,key:string}>, sources:Array<{section:string,key:string}> }> }}
 */
export function selfCertScoreReport(payload = {}, configured) {
  const minScore = resolveSelfCertMinScore(configured);
  const score = scoreBio(payload);
  const seen = new Set();
  const sections = [];
  for (const [section] of SCORED_PATHS) {
    if (seen.has(section)) continue;
    seen.add(section);
    const answers = [];
    const sources = [];
    for (const field of BIO_FIELDS) {
      if (field.path[0] !== section || !field.scored) continue;
      const key = field.path[1];
      const meta = payload?.confidence?.[`${section}.${key}`];
      const conf = typeof meta?.conf === "number" ? meta.conf : null;
      const source = typeof meta?.source === "string" ? meta.source.trim() : "";
      if (!nonEmpty(payload?.[section]?.[key])) answers.push({ section, key });
      else if (!source || conf == null || conf < minScore) sources.push({ section, key });
    }
    if (!answers.length && !sources.length) continue;
    const points = Math.max(0, scoreBio(perfectSection(payload, section)) - score);
    sections.push({ section, points, answers, sources });
  }
  sections.sort((a, b) => b.points - a.points || a.section.localeCompare(b.section));
  return { score, minScore, meetsFloor: score >= minScore, shortfall: Math.max(0, minScore - score), sections };
}
