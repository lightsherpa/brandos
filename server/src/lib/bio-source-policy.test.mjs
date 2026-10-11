import test from "node:test";
import assert from "node:assert/strict";
import {
  assembleSourceText,
  canonicalSourceUrl,
  discoverySourceRow,
  isBrandEvidenceSource,
  sameBrandHost,
} from "./bio-source-policy.js";

test("brand pages and user links are kept; market search is not a bio source", () => {
  const brand = discoverySourceRow({
    brandUrl: "https://nomadcoffee.es",
    url: "https://nomadcoffee.es/cafe",
    origin: "crawl",
    signals: { title: "Cafe" },
  });
  assert.equal(brand.src, "https://nomadcoffee.es/cafe");
  assert.equal(brand.signals.evidence, "brand");
  assert.equal(isBrandEvidenceSource(brand), true);

  const user = discoverySourceRow({
    brandUrl: "https://nomadcoffee.es",
    url: "nomadcoffee.es/about",
    origin: "user",
    purpose: "current",
  });
  assert.equal(user.src, "https://nomadcoffee.es/about");

  const competitor = discoverySourceRow({
    brandUrl: "https://nomadcoffee.es",
    url: "https://beanbox.com/roasters",
    origin: "user",
    purpose: "competitive",
    signals: { note: "tagged by the client" },
  });
  assert.equal(competitor.signals.evidence, "competitor");
  assert.equal(competitor.signals.counts_as_brand_evidence, false);
  assert.equal(isBrandEvidenceSource(competitor), false);

  assert.equal(discoverySourceRow({
    brandUrl: "https://nomadcoffee.es",
    url: "https://www.bonappetit.com/story/coffee",
    origin: "market",
  }), null);
  assert.equal(discoverySourceRow({
    brandUrl: "https://nomadcoffee.es",
    url: "https://bonappetit.com/story/coffee",
    origin: "crawl",
  }), null);
});

test("a cut-off url is not stored", () => {
  assert.equal(canonicalSourceUrl("https://nomadcoffee.es/cafe/…"), "");
  assert.equal(canonicalSourceUrl("https://nomadcoffee.es/cafe..."), "");
  assert.equal(sameBrandHost("https://www.nomadcoffee.es", "https://shop.nomadcoffee.es/beans"), true);
});

test("evidence assembly keeps a later source url intact", () => {
  const first = `## SOURCE: https://nomadcoffee.es/\n${"a".repeat(40)}`;
  const second = `## SOURCE: https://nomadcoffee.es/a-very-long-brand-page\n${"b".repeat(40)}`;
  const joined = assembleSourceText([first, second], first.length + 8);
  assert.equal(joined.includes("https://nomadcoffee.es/a-very-long-brand-page"), false);
  assert.match(assembleSourceText([first, second], 200), /https:\/\/nomadcoffee\.es\/a-very-long-brand-page/);
  const tight = assembleSourceText([first, second], first.length + 20);
  assert.doesNotMatch(tight, /https:\/\/nomadcoffee\.es\/a-very-long-brand-pa[^g]/);
});
