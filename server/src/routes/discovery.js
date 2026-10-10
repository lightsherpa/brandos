// Discovery route — fires the compile-bio Inngest event.
// SPA hits POST /api/discovery/start with { url, brandId? }.

import {discoveryWebsiteError, bioIntegrityError} from "../lib/brand-source-integrity.js";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { inngest } from "../lib/inngest.js";
import { assertPublicUrl } from "../lib/ingest-guards.js";

import {normalizeDiscoveryReferences} from "../lib/discovery-intelligence.js";

const app = new Hono();

/* POST /api/discovery/start
   Body: { url, brandId? }
   Returns: { eventId, brandId, url }
   The actual scrape + BIO synthesis runs async in the compile-bio
   Inngest function (server/src/inngest/functions/compile-bio.js).
   Poll GET /api/bios/:brandId or subscribe via Supabase Realtime to
   see the new BIO row land.                                            */
app.post("/start", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const body = await c.req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const instagram = typeof body.instagram === "string" ? body.instagram.trim() : undefined;

  const discoveryId = crypto.randomUUID();
  let references;
  try { references=normalizeDiscoveryReferences(body.references); }
  catch(e){return c.json({error:e.message},400);}

  // SSRF guard — the URL is scraped server-side. Block non-public targets
  // before it reaches the scrape pipeline.
  const probeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try { if(url) assertPublicUrl(probeUrl); }
  catch (e) { return c.json({ error: `Invalid or blocked URL (${e.code || "URL"})`, code: e.code || "BAD_URL" }, 400); }

  // Resolve brand — either the caller-supplied id (with workspace check)
  // or the workspace's default (first) brand.
  let brandId = body.brandId;
  let selectedBrand;
  if (brandId) {
    const { data: brand } = await supabaseAdmin
      .from("brands").select("id, name, url, workspace_id").eq("id", brandId).maybeSingle();
    if (!brand || brand.workspace_id !== workspaceId) return c.json({ error: "Brand not in workspace" }, 403);
    selectedBrand=brand;
  } else {
    const { data: brand } = await supabaseAdmin
      .from("brands").select("id, name, url, workspace_id").eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!brand) return c.json({ error: "No brand in workspace yet" }, 400);
    brandId = brand.id;
    selectedBrand = brand;
  }

  const {data: latestBio,error: integrityLookupError}=await supabaseAdmin.from("bios").select("payload").eq("brand_id",brandId).order("version",{ascending:false}).limit(1).maybeSingle();
  if(integrityLookupError)return c.json({error:"BIO integrity check unavailable"},503);
  const integrity=latestBio&&bioIntegrityError(latestBio,selectedBrand);
  if(integrity)return c.json(integrity,409);
  const mismatch = discoveryWebsiteError(selectedBrand, url);
  if (mismatch) return c.json(mismatch, 409);

  // Update brand.url if it differs (so future discoveries can default to it)
  if (url && !selectedBrand.url) {
    let claim = supabaseAdmin.from("brands").update({url}).eq("id",brandId);
    claim = selectedBrand.url == null ? claim.is("url",null) : claim.eq("url",selectedBrand.url);
    const {data: claimed,error}=await claim.select("id").maybeSingle();
    if(error || !claimed)return c.json({code:"BRAND_SOURCE_MISMATCH",error:"The brand website changed. Reload Discovery before continuing."},409);
  }
  if(!url && !references.length){
    const {data:sources,error}=await supabaseAdmin.from("bio_sources").select("id").eq("brand_id",brandId).eq("kind","file_upload").limit(1);
    if(error)return c.json({error:error.message},500);
    if(!sources?.length)return c.json({error:"Add a brand source or reference before generating the BIO"},400);
  }

  // Fire the event — compile-bio function picks it up asynchronously.
  // If the queue is unreachable (e.g. Inngest dev server not running in
  // local dev), surface a clear 503 instead of a bare 500.
  let ids;
  try {
    ({ ids } = await inngest.send({
      name: "discovery/start",
      data: { brandId, url, workspaceId, instagram, discoveryId, references },
    }));
  } catch (err) {
    console.error("[discovery] inngest.send failed:", err?.message || err);
    return c.json({ error: "Discovery queue unavailable — try again shortly" }, 503);
  }

  return c.json({ eventId: ids?.[0] || null, discoveryId, brandId, url, status: "queued" });
});

export default app;
