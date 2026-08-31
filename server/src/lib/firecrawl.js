// Firecrawl thin wrapper. v1/scrape returns clean markdown + metadata
// per URL. Used by the Discovery Inngest function (a31 Site Scanner).
//
// Returns: { markdown, html?, metadata: { title, description, language, ... } }

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v1/map";
import crypto from "node:crypto";
import { recordApiUsage } from "./api-usage.js";

// Pages worth pulling for brand synthesis (homepage is always included first).
const HIGH_SIGNAL = /(about|story|manifesto|mission|values|product|press|brand)/i;

export async function scrape(url, opts = {}) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

  const started = Date.now();
  const requestId = crypto.randomUUID();
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: opts.formats || ["markdown"],
      onlyMainContent: opts.onlyMainContent ?? true,
      timeout: opts.timeoutMs || 30000,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    await recordApiUsage({ ...opts.telemetry, requestId, provider: "firecrawl", service: "scrape", operation: "scrape", feature: opts.telemetry?.feature || "discovery.scrape", status: "failed", latencyMs: Date.now() - started, costSource: "unpriced", errorCode: `HTTP_${res.status}` });
    throw new Error(`Firecrawl HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.success) {
    await recordApiUsage({ ...opts.telemetry, requestId, provider: "firecrawl", service: "scrape", operation: "scrape", feature: opts.telemetry?.feature || "discovery.scrape", status: "failed", latencyMs: Date.now() - started, costSource: "unpriced", errorCode: "PROVIDER_ERROR" });
    throw new Error(`Firecrawl error: ${json.error || "unknown"}`);
  }
  await recordApiUsage({ ...opts.telemetry, requestId, provider: "firecrawl", service: "scrape", operation: "scrape", feature: opts.telemetry?.feature || "discovery.scrape", status: "succeeded", latencyMs: Date.now() - started, pages: 1, costSource: "unpriced" });
  return json.data;
}

// Multi-page crawl: /map to discover internal links, then scrape the homepage
// + a handful of high-signal pages (about/story/values/...). Sequential scrapes
// to fit the Inngest step model. Tolerant — never throws on map/page failures.
//
// Returns: Array<{ url, markdown, title }>
export async function mapAndScrape(url, { max = 6, formats = ["markdown"], telemetry = {} } = {}) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

  // 1. Discover internal links via /map. Never throw — fall back to homepage-only.
  let links = [];
  try {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const res = await fetch(FIRECRAWL_MAP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, limit: 50 }),
    });
    if (res.ok) {
      const json = await res.json();
      links = json.links || json.data?.links || [];
      await recordApiUsage({ ...telemetry, requestId, provider: "firecrawl", service: "map", operation: "map", feature: telemetry.feature || "discovery.map", status: "succeeded", latencyMs: Date.now() - started, costSource: "unpriced" });
    } else {
      await recordApiUsage({ ...telemetry, requestId, provider: "firecrawl", service: "map", operation: "map", feature: telemetry.feature || "discovery.map", status: "failed", latencyMs: Date.now() - started, costSource: "unpriced", errorCode: `HTTP_${res.status}` });
    }
  } catch {
    links = [];
  }

  // 2. Pick pages: homepage first, then high-signal links, deduped, capped.
  const picked = [];
  const seen = new Set();
  const add = (link) => {
    if (typeof link !== "string" || seen.has(link)) return;
    seen.add(link);
    picked.push(link);
  };
  add(url);
  for (const link of links) {
    if (picked.length >= max) break;
    if (HIGH_SIGNAL.test(link)) add(link);
  }
  const pages = picked.slice(0, max);

  // 3. Scrape each picked page. One dead page must not kill the crawl.
  const out = [];
  for (const link of pages) {
    try {
      const result = await scrape(link, { formats, onlyMainContent: true, telemetry });
      out.push({
        url: link,
        markdown: result.markdown,
        title: result.metadata?.title,
      });
    } catch {
      // skip dead/blocked page
    }
  }
  return out;
}
