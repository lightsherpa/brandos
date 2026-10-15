// Firecrawl thin wrapper. v1/scrape returns clean markdown + metadata
// per URL. Used by the Discovery Inngest function (a31 Site Scanner).
//
// Returns: { markdown, html?, metadata: { title, description, language, ... } }

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v1/map";
import crypto from "node:crypto";
import {reserveDiscoveryTestSpend} from "./discovery-test-budget.js";
import { recordApiUsage } from "./api-usage.js";
import { canonicalSourceUrl, sameBrandHost } from "./bio-source-policy.js";

// Pages worth pulling for brand synthesis (homepage is always included first).
export function isReadableSource(row){
 const status=Number(row?.metadata?.statusCode||row?.statusCode||200);
 return status<400&&!!row?.markdown?.trim()&&!/^\s*(?:404|page not found|not found)\b/i.test(row?.metadata?.title||row?.title||'')&&!/^\s*#?\s*404\b/i.test(row?.markdown||'');
}
const HIGH_SIGNAL = /(about|story|manifesto|mission|values|product|press|brand)/i;

export async function scrape(url, opts = {}) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

  const started = Date.now();
  const requestId = crypto.randomUUID();
  reserveDiscoveryTestSpend(.10, /^https?:\/\/(?:www\.)?instagram\.com\//i.test(url)?"firecrawl:instagram":"firecrawl:scrape");
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
      ...(opts.actions ? { actions: opts.actions } : {}),
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
    reserveDiscoveryTestSpend(.25,"firecrawl:map");
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
    const raw = typeof link === "string" ? link : link?.url;
    const href = canonicalSourceUrl(raw);
    if (!href || seen.has(href) || !sameBrandHost(url, href)) return;
    seen.add(href);
    picked.push(href);
  };
  add(url);
  for (const link of links) {
    if (picked.length >= max) break;
    const raw = typeof link === "string" ? link : link?.url;
    if (HIGH_SIGNAL.test(String(raw || ""))) add(link);
  }
  const pages = picked.slice(0, max);

  // 3. Scrape each picked page. One dead page must not kill the crawl.
  const out = [];
  const failures=[];
  for (const link of pages) {
    try {
      const result = await scrape(link, { formats, onlyMainContent: true, telemetry });
      if(!isReadableSource(result))throw new Error("No readable page content");
      out.push({
        url: link,
        markdown: result.markdown,
        title: result.metadata?.title,
        rawHtml: result.rawHtml,
        metadata: result.metadata,
      });
    } catch(error) {
      failures.push(error.message);
    }
  }
  // One bounded homepage fallback when every mapped page failed.
  if(!out.length){
    try{
      const result=await scrape(url,{formats,onlyMainContent:true,telemetry});
      if(!isReadableSource(result))throw new Error("No readable homepage content");
      out.push({url,markdown:result.markdown,title:result.metadata?.title,rawHtml:result.rawHtml,metadata:result.metadata});
    }catch(error){throw new Error(`Brand retrieval failed: ${error.message}; ${failures.length} initial page failures`);}
  }
  return out;
}

// Bounded competitive discovery; search snippets alone are never evidence.
export async function searchCompetitiveSources(query,{limit=4,country,city,countryName,language}={}){
 const key=process.env.FIRECRAWL_API_KEY;
 if(!key)throw new Error("FIRECRAWL_API_KEY not set");
 reserveDiscoveryTestSpend(.10,"firecrawl:search");
 const res=await fetch("https://api.firecrawl.dev/v2/search",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({query,limit:Math.min(limit,4),...(country?{country}:{}),...((city||countryName)?{location:[city,countryName||country].filter(Boolean).join(",")}:{}),...(language?{lang:language}:{}),scrapeOptions:{formats:["markdown"]}})});
 if(!res.ok)throw new Error(`Competitive search HTTP ${res.status}`);
 const json=await res.json();
 if(!json.success)throw new Error("Competitive search failed");
 return (json.data?.web || []).filter(row=>row.url&&isReadableSource(row)).slice(0,4);
}
