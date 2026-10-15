// Human labels for the 31 Brand Core paths. Raw paths and model field names
// never reach the UI. Iris's names win where she supplied them. The rest are
// the existing product labels, not new copy.
import { KNOWN_FIELD_PATHS } from "./source-kind.js";

export const FIELD_LABELS_EN = {
  "identity.positioning": "What makes you different",
  "identity.category": "What you do",
  "identity.founded": "Founded",
  "identity.pillars": "What you stand for",
  "audience.primary": "Main customers",
  "audience.secondary": "Other customers",
  "audience.tertiary": "Other customers",
  "audience.jtbd": "What customers need",
  "voice.register": "How you sound",
  "voice.forbidden": "Words to avoid",
  "voice.rhythm": "Sentence rhythm",
  "voice.signatures": "Phrases that sound like you",
  "goals.northStar": "What drives you",
  "goals.q2": "This quarter",
  "goals.q3": "Next quarter",
  "strategic.watchouts": "Things to watch",
  "strategic.notList": "What you're not",
  "aspirations.direction": "Direction you want",
  "aspirations.notYetTrue": "Not true yet",
  "aspirations.references": "References",
  "positioning.frameOfReference": "Who you're compared with",
  "positioning.competitors": "Competitors and alternatives",
  "positioning.pointsOfDifference": "Why choose you",
  "positioning.pointsOfParity": "What you match them on",
  "positioning.researchGaps": "Questions to research",
  "visual.logo": "Logo",
  "visual.typeScale": "Font samples",
  "visual.palette": "Palette",
  "visual.type": "Typography",
  "visual.imagery": "Imagery",
  "visual.avoid": "Never this",
};

// Model names that are not Brand Core paths. Map them or drop them.
const SYNONYMS = {
  target_audience: "audience.primary",
  primary_audience: "audience.primary",
  secondary_audience: "audience.secondary",
  tone_attributes: "voice.register",
  tone: "voice.register",
  voice_register: "voice.register",
  forbidden_words: "voice.forbidden",
  north_star: "goals.northStar",
  northstar: "goals.northStar",
  points_of_parity: "positioning.pointsOfParity",
  points_of_difference: "positioning.pointsOfDifference",
  frame_of_reference: "positioning.frameOfReference",
};

const KNOWN = new Set(KNOWN_FIELD_PATHS);

export function canonicalFieldPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (KNOWN.has(trimmed)) return trimmed;
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  if (SYNONYMS[key]) return SYNONYMS[key];
  if (KNOWN.has(key)) return key;
  return null;
}

/** English label, or null when the name is unknown and must be hidden. */
export function fieldLabelEn(raw, log = () => {}) {
  const path = canonicalFieldPath(raw);
  if (!path) {
    if (raw) log(raw);
    return null;
  }
  return FIELD_LABELS_EN[path] || null;
}
