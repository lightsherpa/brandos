import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_RUBRIC } from "./evaluate-certification.js";
import { SCORED_PATHS } from "./bio-schema.js";
import { scoreBio } from "./score-bio.js";
import { selfCertifyBio } from "./self-certify.js";
import {
  SELF_CERT_MIN_SCORE,
  SELF_CERT_MIN_SCORE_RANGE,
  resolveSelfCertMinScore,
  selfCertScoreReport,
} from "./self-cert-floor.js";

const REVIEW = {
  reviewedSections: ["identity", "audience", "positioning", "voice", "visual", "goals", "strategic"],
  statements: { authority: true, reflects: true, aspirationalMarked: true },
};
const STATEMENTS = { authority: true, reflects: true, aspirationalMarked: true };

function filled(conf = 100) {
  const payload = { confidence: {} };
  for (const [section, key] of SCORED_PATHS) {
    payload[section] = payload[section] || {};
    payload[section][key] = "recorded";
    payload.confidence[`${section}.${key}`] = { conf, source: `src-${section}-${key}` };
  }
  payload.visual={logo:{sourceId:"logo",conf:100},palette:[{role:"primary",hex:"#ffd115"}],type:[{kind:"Display",family:"Inter",provider:"google"}]};
  return payload;
}

test("self-cert floor defaults to 80 and stays inside 80–85", () => {
  assert.equal(SELF_CERT_MIN_SCORE, 80);
  assert.deepEqual(SELF_CERT_MIN_SCORE_RANGE, { min: 80, max: 85 });
  assert.equal(resolveSelfCertMinScore(undefined), 80);
  assert.equal(resolveSelfCertMinScore(58), 80);
  assert.equal(resolveSelfCertMinScore(79), 80);
  assert.equal(resolveSelfCertMinScore(80), 80);
  assert.equal(resolveSelfCertMinScore(83), 83);
  assert.equal(resolveSelfCertMinScore(85), 85);
  assert.equal(resolveSelfCertMinScore(96), 85);
});

test("Creative Director rubric is unchanged", () => {
  assert.equal(DEFAULT_RUBRIC.selfCertMinScore, 58);
  assert.deepEqual(DEFAULT_RUBRIC.bands, { approve: 80, approve_with_conditions: 68, return_changes: 50 });
  assert.deepEqual(DEFAULT_RUBRIC.criteria.map((c) => c.id), ["C1", "C2", "C3", "C4", "C5", "C6", "C7"]);
});

test("report names the sections, answers, and sources that raise the score", () => {
  const payload = {
    identity: { positioning: "A coastal roaster.", category: "Coffee", founded: "2014", pillars: ["Origin"] },
    confidence: {
      "identity.positioning": { conf: 100, source: "homepage" },
      "identity.category": { conf: 50, source: "" },
      "identity.founded": { conf: 90, source: "about" },
      "identity.pillars": { conf: 70, source: "about" },
    },
  };
  const report = selfCertScoreReport(payload);
  assert.equal(report.meetsFloor, false);
  assert.equal(report.minScore, 80);
  assert.equal(report.score, scoreBio(payload));
  assert.ok(report.score < 80);
  const identity = report.sections.find((s) => s.section === "identity");
  const audience = report.sections.find((s) => s.section === "audience");
  assert.deepEqual(identity.answers, []);
  assert.deepEqual(identity.sources.map((f) => f.key).sort(), ["category", "pillars"]);
  assert.ok(audience.answers.some((f) => f.key === "primary"));
  assert.ok(identity.points > 0);
  assert.ok(audience.points > 0);
  assert.ok(report.sections.every((s, i, all) => i === 0 || all[i - 1].points >= s.points));
});

const R = { logoRights: ["logo"] };
test("a fully sourced BIO clears the floor and has nothing left to add", () => {
  const report = selfCertScoreReport(filled(100), undefined, R);
  assert.equal(report.score, 100);
  assert.equal(report.meetsFloor, true);
  assert.deepEqual(report.sections, []);
  assert.equal(selfCertScoreReport(filled(100), 85, R).meetsFloor, true);
  assert.equal(selfCertScoreReport(filled(100), 85, R).minScore, 85);
});

test("self-certification rejects a score under the floor, including a stale lower override", async () => {
  const rejected = await selfCertifyBio({
    brandId: "brand", bioId: "bio", payload: {visual:filled().visual}, userId: "user",
    statements: STATEMENTS, statementVersion: "2", review: REVIEW, logoRights: ["logo"], minScore: 58,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "BELOW_MIN_SCORE");
  assert.equal(rejected.score, 0);
  assert.equal(rejected.minScore, 80);
  assert.ok(rejected.sections.some((s) => s.answers.length > 0));

  const stricter = await selfCertifyBio({
    brandId: "brand", bioId: "bio", payload: filled(50), userId: "user",
    statements: STATEMENTS, statementVersion: "2", review: REVIEW, logoRights: ["logo"], minScore: 85,
  });
  assert.equal(stricter.code, "BELOW_MIN_SCORE");
  assert.equal(stricter.minScore, 85);
  assert.ok(stricter.score < 85);
  assert.ok(stricter.sections.some((s) => s.sources.length > 0));
});

test("the review modal renders the floor and refuses to continue below it", () => {
  const ui = readFileSync(new URL("../../../src/bio-self-certification.jsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("./self-certify.js", import.meta.url), "utf8");
  assert.match(ui, /selfCertScoreReport/);
  assert.match(ui, /data-floor=\{gate\.minScore\}/);
  assert.match(ui, /blocking\.length>0\|\|below/);
  assert.match(gate, /selfCertScoreReport/);
  assert.doesNotMatch(gate, /DEFAULT_RUBRIC/);
  assert.doesNotMatch(gate, /cert_rubric_versions/);
});
