// Shared wire/recovery schema. Limits match the composer API, not production
// brief or output policy. Unknown sharpener fields remain round-trippable.
export const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isRevision = (v) => Number.isInteger(v) && v >= 0 && v < 2147483647;
export const emptyDraft = () => ({ input: "", mode: "flow", answers: {}, qStep: 0, sharpData: null, answerHistory: [] });
const optionalString = (v) => v === undefined || v === null || typeof v === "string";
const optionalStrings = (v) => v === undefined || (Array.isArray(v) && v.every((s) => typeof s === "string"));
export function isDraftPayload(p, enforceLimits = true) {
  if (!isObject(p) || typeof p.input !== "string" || (enforceLimits && p.input.length > 50000)
    || !["flow", "words", "visual", "polish"].includes(p.mode)
    || !isObject(p.answers) || !Object.entries(p.answers).every(([k, v]) => /^\d{1,3}$/.test(k) && typeof v === "string" && (!enforceLimits || v.length <= 10000))
    || !Number.isInteger(p.qStep) || p.qStep < 0 || p.qStep > 1000) return false;
  const sharp = p.sharpData;
  if (sharp !== null && (!isObject(sharp)
    || ![sharp.title, sharp.sharpenedBrief, sharp.tension].every(optionalString)
    || !optionalStrings(sharp.proposedSpecialists) || !optionalStrings(sharp.refusals)
    || (sharp.questions !== undefined && (!Array.isArray(sharp.questions) || !sharp.questions.every((q) => isObject(q) && typeof q.q === "string" && optionalString(q.solvingFor)))))) return false;
  return p.answerHistory === undefined || (Array.isArray(p.answerHistory) && p.answerHistory.every((entry) =>
    isObject(entry) && typeof entry.question === "string" && typeof entry.answer === "string"));
}
