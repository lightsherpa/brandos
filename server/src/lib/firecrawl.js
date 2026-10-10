// Firecrawl thin wrapper. v1/scrape returns clean markdown + metadata
// per URL. Used by the Discovery Inngest function (a31 Site Scanner).
//
// Returns: { markdown, html?, metadata: { title, description, language, ... } }

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v1/map";

// Pages worth pulling for brand synthesis (homepage is always included first).
const HIGH_SIGNAL = /(about|story|manifesto|mission|values|product|press|brand)/i;

export async function scrape(url, opts = {}) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

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
    throw new Error(`Firecrawl HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(`Firecrawl error: ${json.error || "unknown"}`);
  return json.data;
}

// Multi-page crawl: /map to discover internal links, then scrape the homepage
// + a handful of high-signal pages (about/story/values/...). Sequential scrapes
// to fit the Inngest step model. Tolerant — never throws on map/page failures.
//
// Returns: Array<{ url, markdown, title }>
export async function mapAndScrape(url, { max = 6, formats = ["markdown"] } = {}) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

  // 1. Discover internal links via /map. Never throw — fall back to homepage-only.
  let links = [];
  try {
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
  const failures=[];
  for (const link of pages) {
    try {
      const result = await scrape(link, { formats, onlyMainContent: true });
      if(!result.markdown?.trim())throw new Error("No readable page content");
      out.push({
        url: link,
        markdown: result.markdown,
        title: result.metadata?.title,
      });
    } catch(error) {
      failures.push(error.message);
    }
  }
  // One bounded homepage fallback when every mapped page failed.
  if(!out.length){
    try{
      const result=await scrape(url,{formats,onlyMainContent:true});
      if(!result.markdown?.trim())throw new Error("No readable homepage content");
      out.push({url,markdown:result.markdown,title:result.metadata?.title});
    }catch(error){throw new Error(`Brand retrieval failed: ${error.message}; ${failures.length} initial page failures`);}
  }
  return out;
}

// Bounded competitive discovery; search snippets alone are never evidence.
export async function searchCompetitiveSources(query,{limit=4}={}){
 const key=process.env.FIRECRAWL_API_KEY;
 if(!key)throw new Error("FIRECRAWL_API_KEY not set");
 const res=await fetch("https://api.firecrawl.dev/v2/search",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({query,limit:Math.min(limit,4),scrapeOptions:{formats:["markdown"]}})});
 if(!res.ok)throw new Error(`Competitive search HTTP ${res.status}`);
 const json=await res.json();
 if(!json.success)throw new Error("Competitive search failed");
 return (json.data?.web || []).filter(row=>row.url&&row.markdown).slice(0,4);
}
