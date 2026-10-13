import { BIO_FIELDS, normalizeBio } from "./bio-schema.js";
import { computeFocus } from "./bio-focus.js";
import { diffBio } from "./bio-diff.js";
import { scoreBioBreakdown } from "./score-bio.js";

const STATUS_LABELS = {
  supported: "source-backed",
  "source-backed": "source-backed",
  "client-confirmed": "client-confirmed",
  "client-stated": "client-stated",
  inferred: "inferred",
  aspirational: "aspirational",
  conflicting: "conflicting",
  missing: "missing",
  unsupported: "unsupported",
  "steward-certified": "steward-certified",
};

const HIGH_IMPACT = new Set([
  "identity.positioning",
  "voice.forbidden",
  "audience.primary",
  "identity.category",
  "identity.pillars",
  "voice.register",
  "audience.jtbd",
  "goals.northStar",
]);

const get = (payload, dotted) => dotted.split(".").reduce((obj, key) => obj?.[key], payload);
const filled = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "");

function labelFor(field) {
  return field.split(".").map((part) => part.replace(/([A-Z])/g, " $1")).join(" / ");
}

function normalizeStatus(status, conf, source) {
  const known = STATUS_LABELS[status];
  if (known) return known;
  if (typeof conf === "number" && conf >= 85 && source) return "source-backed";
  if (typeof conf === "number" && conf < 70) return "inferred";
  return source ? "source-backed" : "client-stated";
}

function groupClaims(payload) {
  const bio = normalizeBio(payload);
  const groups = {
    sourceBacked: [],
    clientConfirmed: [],
    clientStated: [],
    inferred: [],
    aspirational: [],
    conflicting: [],
    missing: [],
    unsupported: [],
    stewardCertified: [],
  };

  for (const fieldDef of BIO_FIELDS) {
    const field = fieldDef.path.join(".");
    const value = get(bio, field);
    const conf = bio.confidence?.[field]?.conf;
    const source = bio.confidence?.[field]?.source || bio.evidence?.[field] || null;
    const status = filled(value)
      ? normalizeStatus(bio.fieldStatus?.[field], conf, source)
      : "missing";
    const item = { field, label: labelFor(field), value: value ?? null, conf: conf ?? null, source, status };
    if (status === "source-backed") groups.sourceBacked.push(item);
    else if (status === "client-confirmed") groups.clientConfirmed.push(item);
    else if (status === "client-stated") groups.clientStated.push(item);
    else if (status === "aspirational") groups.aspirational.push(item);
    else if (status === "conflicting") groups.conflicting.push(item);
    else if (status === "unsupported") groups.unsupported.push(item);
    else if (status === "steward-certified") groups.stewardCertified.push(item);
    else if (status === "missing") groups.missing.push(item);
    else groups.inferred.push(item);
  }

  for (const conflict of bio.conflicts || []) {
    const field = conflict.field_path || conflict.field;
    if (!field) continue;
    if (!groups.conflicting.some((item) => item.field === field)) {
      groups.conflicting.push({ field, label: labelFor(field), value: get(bio, field) ?? null, conf: null, source: null, status: "conflicting" });
    }
  }

  return groups;
}

function sourceSummary(sources = [], payload = {}) {
  const buckets = {};
  const sourceKinds = {};
  for (const source of sources || []) {
    const bucket = source.bucket || "unbucketed";
    buckets[bucket] = (buckets[bucket] || 0) + 1;
    const kind = source.kind || "unknown";
    sourceKinds[kind] = (sourceKinds[kind] || 0) + 1;
  }
  const uniqueEvidence = new Set(
    Object.values(normalizeBio(payload).confidence || {})
      .map((meta) => String(meta?.source || "").trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    count: (sources || []).length,
    buckets,
    sourceKinds,
    hasUpload: (sources || []).some((source) => source.kind === "file_upload"),
    hasUrlEvidence: (sources || []).some((source) => /^https?:\/\//i.test(source.evidence_url || source.src || "")),
    diversity: uniqueEvidence.size,
  };
}

function isExpired(iso) {
  return Boolean(iso && new Date(iso).getTime() < Date.now());
}

function readinessFor({ bio, focus, scoreBreakdown, groups }) {
  if (!bio?.id) return { level: "draft", reasons: ["No Brand Core version exists yet."] };
  const reasons = [];
  if (groups.conflicting.length) reasons.push(`${groups.conflicting.length} conflicting claim(s) need resolution.`);
  if (groups.unsupported.length) reasons.push(`${groups.unsupported.length} unsupported claim(s) need removal or evidence.`);
  const highMissing = groups.missing.filter((claim) => HIGH_IMPACT.has(claim.field));
  if (highMissing.length) reasons.push(`${highMissing.length} high-impact field(s) are missing.`);
  if (bio.certified && !isExpired(bio.cert_valid_until)) return { level: "production-certified", reasons: ["A Steward certified this Brand Core for production."] };
  if (bio.certified && isExpired(bio.cert_valid_until)) reasons.push("The prior production certification has expired.");
  if (bio.self_certified) {
    if (!reasons.length && scoreBreakdown.score >= 80) return { level: "steward-ready", reasons: ["Client signed off and major gaps are clear."] };
    return { level: "usable-for-briefing", reasons: reasons.length ? reasons : ["Client signed off; Steward review still pending."] };
  }
  if (scoreBreakdown.score >= 75 && !highMissing.length) return { level: "strong-draft", reasons: ["Good coverage, but client sign-off is still needed."] };
  return { level: "draft", reasons: reasons.length ? reasons : ["Needs client confirmation before briefing."] };
}

function riskFromClaim(claim, severity, reason, action) {
  return { field: claim.field, label: claim.label, severity, reason, action };
}

export function buildStewardCaseFile({ job, bio, brand, sources = [], previousBio = null, latestDecision = null, logoRights = [] } = {}) {
  const payload = normalizeBio(bio?.payload || {});
  const focus = computeFocus(payload);
  const scoreBreakdown = scoreBioBreakdown(payload, { logoRights });
  const groups = groupClaims(payload);
  const risks = [
    ...groups.conflicting.map((claim) => riskFromClaim(claim, "high", "Conflicting evidence or values exist for this claim.", "Resolve before certification.")),
    ...groups.unsupported.map((claim) => riskFromClaim(claim, "high", "This claim is marked unsupported.", "Remove it or request evidence.")),
    ...groups.missing.filter((claim) => HIGH_IMPACT.has(claim.field)).map((claim) => riskFromClaim(claim, "medium", "High-impact field is empty.", "Ask the client or fill from source evidence.")),
    ...groups.clientStated.filter((claim) => HIGH_IMPACT.has(claim.field)).map((claim) => riskFromClaim(claim, "medium", "Client-stated high-impact claim needs Steward judgment.", "Confirm, edit, or ask for source support.")),
    ...groups.inferred.filter((claim) => HIGH_IMPACT.has(claim.field)).map((claim) => riskFromClaim(claim, "low", "High-impact claim is inferred.", "Confirm source support or mark as aspirational.")),
  ];
  const readiness = readinessFor({ bio, focus, scoreBreakdown, groups });
  const approveReady = !risks.some((risk) => risk.severity === "high") && groups.missing.filter((claim) => HIGH_IMPACT.has(claim.field)).length === 0;

  return {
    job: job ? { id: job.id, status: job.status, kind: job.kind } : null,
    brand: brand ? { id: brand.id, name: brand.name, url: brand.url, industry: brand.industry || null } : null,
    bio: bio ? { id: bio.id, version: bio.version, score: bio.score, certified: !!bio.certified, self_certified: !!bio.self_certified, cert_valid_until: bio.cert_valid_until || null } : null,
    readiness,
    scoreBreakdown,
    changes: previousBio ? diffBio(previousBio.payload || {}, payload) : [],
    risks,
    claims: groups,
    sourceSummary: sourceSummary(sources, payload),
    focus,
    latestDecision: latestDecision || null,
    certificationRecommendation: {
      decision: approveReady ? "approve" : "return_changes",
      rationale: approveReady
        ? "No high-severity Copilot risks or high-impact missing fields detected."
        : "Resolve high-severity risks and high-impact gaps before certification.",
      requiredChanges: approveReady ? [] : risks.filter((risk) => risk.severity !== "low").map((risk) => risk.action),
      conditions: approveReady && risks.length ? risks.map((risk) => risk.action) : [],
    },
  };
}

export function buildStewardSuggestions({ caseFile } = {}) {
  const suggestions = [];
  const add = (suggestion) => suggestions.push({
    confidence: "deterministic",
    sourceRefs: [],
    actions: ["accept", "edit", "reject", "ask_client"],
    ...suggestion,
  });

  for (const claim of caseFile?.claims?.missing || []) {
    if (!HIGH_IMPACT.has(claim.field)) continue;
    add({
      id: `ask.${claim.field}`,
      type: "ask_client",
      field: claim.field,
      title: `Ask client for ${claim.label}`,
      reason: "This high-impact Brand Core field is empty and should not be invented.",
      patch: { requiredChangesPatch: [`Please provide ${claim.label.toLowerCase()}.`] },
    });
  }

  for (const claim of caseFile?.claims?.clientStated || []) {
    add({
      id: `review.${claim.field}`,
      type: HIGH_IMPACT.has(claim.field) ? "ask_client" : "review_client_stated",
      field: claim.field,
      title: `Review client-stated ${claim.label}`,
      reason: "The client changed this claim; source-backed provenance should not be assumed.",
      patch: { payloadPatch: { fieldStatus: { [claim.field]: "client-stated" } } },
    });
  }

  for (const claim of caseFile?.claims?.inferred || []) {
    if (!HIGH_IMPACT.has(claim.field)) continue;
    add({
      id: `confirm.${claim.field}`,
      type: "mark_aspirational",
      field: claim.field,
      title: `Confirm or mark ${claim.label}`,
      reason: "This high-impact claim is inferred, not directly source-backed.",
      patch: {
        payloadPatch: {
          fieldStatus: { [claim.field]: "aspirational" },
          confidence: { [claim.field]: { conf: Math.min(claim.conf ?? 70, 70), source: claim.source || "steward marked aspirational" } },
        },
      },
    });
  }

  const blockedCertFields = new Set([
    ...(caseFile?.claims?.conflicting || []).map((claim) => claim.field),
    ...(caseFile?.claims?.unsupported || []).map((claim) => claim.field),
  ]);
  for (const claim of caseFile?.claims?.sourceBacked || []) {
    if (!HIGH_IMPACT.has(claim.field)) continue;
    if (blockedCertFields.has(claim.field)) continue;
    add({
      id: `certify.${claim.field}`,
      type: "certify_field",
      field: claim.field,
      title: `Certify ${claim.label}`,
      reason: "This high-impact claim has source-backed provenance and no detected conflict.",
      patch: { payloadPatch: { fieldStatus: { [claim.field]: "steward-certified" } } },
      actions: ["accept", "reject"],
    });
  }

  return { suggestions };
}

export function buildStewardCopilot({ job, bio, brand, sources = [], previousBio = null, latestDecision = null, logoRights = [] } = {}) {
  const caseFile = buildStewardCaseFile({ job, bio, brand, sources, previousBio, latestDecision, logoRights });
  return { caseFile, ...buildStewardSuggestions({ caseFile }) };
}
