import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { applySharedHeadline, deriveMessageSpec } from "./derive.js";
import { buildFormatPreview, shapeCertificationTrail } from "./preview.js";
import { brandCheckFormats } from "./brand-check.js";

const BIO = {
  identity: {
    positioning: "A quiet studio for brands that mean what they say.",
    pillars: ["Say less", "Show the work", "Stay specific"],
  },
  audience: { primary: "Founders who still write their own site" },
  voice: { register: "calm and exact", forbidden: ["synergy"] },
  strategic: { notList: ["limited time"] },
  goals: { northStar: "Become the brand people quote back" },
  visual: {
    palette: [
      { hex: "#102030", name: "Ink" },
      { hex: "#E7E1D6", name: "Paper" },
      { hex: "#8C3A2F", name: "Seal" },
    ],
    type: [
      { kind: "Display", family: "Newsreader" },
      { kind: "Body", family: "IBM Plex Sans" },
    ],
  },
};

const BRIEF = {
  id: "brief_1",
  title: "Spring note to founders",
  payload: {
    tension: "The work is specific. The site is not.",
    sharpenedBrief: "Write one page that sounds like the studio.",
    request: "A short note for the people who already care.",
    language: "en",
  },
};

function preview(headline) {
  return buildFormatPreview({
    brief: BRIEF,
    brand: { name: "Northroom", url: "https://northroom.example" },
    bio: BIO,
    bioVersion: 4,
    outputs: [{ body: { text: "Say less, then show the work." } }],
    headline,
  });
}

test("the deck is three slides and the spec uses the brand BIO, not a sample campaign", async () => {
  const built = await preview();
  assert.equal(built.slides, 3);
  assert.deepEqual(built.spec.blocks.deck.slides.map((slide) => slide.layout), ["title", "points", "closing"]);
  assert.equal((built.deckHtml.match(/class="slide /g) || []).length, 3);
  const blob = `${built.emailHtml}\n${built.landingHtml}\n${built.deckHtml}`;
  assert.match(blob, /Northroom/);
  assert.match(blob, /#102030/i);
  assert.doesNotMatch(blob, /Vinilo|martes|c8492b/i);
  assert.equal(built.spec.brand.tokens.font_display.includes("Newsreader"), true);
});

test("one headline change is rendered into email, landing, and the title slide together", async () => {
  const before = await preview();
  const after = await preview("A quieter homepage");
  assert.equal(after.spec.blocks.email.headline, "A quieter homepage");
  assert.equal(after.spec.blocks.landing.hero.headline, "A quieter homepage");
  assert.equal(after.spec.blocks.deck.slides[0].title, "A quieter homepage");
  assert.match(after.emailHtml, /A quieter homepage/);
  assert.match(after.landingHtml, /A quieter homepage/);
  assert.match(after.deckHtml, /A quieter homepage/);
  assert.doesNotMatch(after.emailHtml, new RegExp(before.spec.blocks.email.headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(after.slides, 3);
  assert.equal(after.checks.email.status, "pass");
  assert.equal(after.checks.landing.status, "pass");
  assert.equal(after.checks.deck.status, "pass");
});

test("a forbidden headline flags all three formats and a clean one passes", async () => {
  const flagged = await preview("Please no synergy here");
  assert.equal(flagged.checks.email.status, "flag");
  assert.equal(flagged.checks.landing.status, "flag");
  assert.equal(flagged.checks.deck.status, "flag");
  assert.match(flagged.checks.email.violations.join(" "), /synergy/);
  const clean = brandCheckFormats(await preview("A quieter homepage"), BIO, []);
  assert.equal(clean.email.status, "pass");
});

test("applySharedHeadline leaves the other two slides in place", () => {
  const spec = deriveMessageSpec({
    brief: BRIEF,
    brand: { name: "Northroom", url: "https://northroom.example" },
    bio: BIO,
    bioVersion: 4,
  });
  const next = applySharedHeadline(spec, "Only the headline moves");
  assert.equal(next.blocks.deck.slides.length, 3);
  assert.equal(next.blocks.deck.slides[1].layout, "points");
  assert.equal(next.blocks.deck.slides[2].layout, "closing");
  assert.notEqual(next.blocks.deck.slides[1].title, "Only the headline moves");
});

test("the certification trail is the brand's decisions, newest first", () => {
  const trail = shapeCertificationTrail({
    bio: { version: 4, score: 81, certified: true, certified_at: "2026-09-01T00:00:00Z", self_certified: true },
    decisions: [
      { id: "d1", decision: "approve", composite_score: 81, band: "approve", actor_role: "lead_steward", narrative: "Ready.", created_at: "2026-09-01T00:00:00Z" },
      { id: "d2", decision: "return_changes", composite_score: 60, actor_role: "steward", narrative: "Voice.", created_at: "2026-08-01T00:00:00Z" },
    ],
    attestations: [
      { id: "a1", statement_version: "v1", self_score: 70, created_at: "2026-07-01T00:00:00Z" },
    ],
  });
  assert.equal(trail.bio.certified, true);
  assert.equal(trail.bio.version, 4);
  assert.deepEqual(trail.events.map((event) => event.id), ["d1", "d2", "a1"]);
  assert.equal(trail.events[2].kind, "self");
});

test("the preview does not add or relabel a roster specialist", () => {
  const roster = fs.readFileSync(new URL("../../../../src/portal-data.js", import.meta.url), "utf8");
  assert.match(roster, /name:"Email Build"/);
  assert.doesNotMatch(roster, /Deck Narrator|Landing Section Composer|Format Preview/);
});
