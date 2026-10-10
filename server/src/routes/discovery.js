// Discovery route — fires the compile-bio Inngest event.
// SPA hits POST /api/discovery/start with { url, brandId? }.

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { inngest } from "../lib/inngest.js";
import { assertPublicUrl } from "../lib/ingest-guards.js";
import { recordApiUsage } from "../lib/api-usage.js";
import { hasPermission } from "../lib/permissions.js";
import { verifyOpexOverride } from "../lib/opex-override.js";
import { writeAuthorizationAudit } from "../lib/audit.js";

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
  const auth = c.get("auth");
  const { userId } = auth;
  let workspaceId = auth.workspaceId || auth.memberships?.[0]?.workspace_id || null;
  const body = await c.req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const instagram = typeof body.instagram === "string" ? body.instagram.trim() : undefined;

  if(process.env.DISCOVERY_PAID_TEST==='1'){
    let host;try{host=new URL(/^https?:\/\//i.test(url)?url:`https://${url}`).hostname.replace(/^www\./,'');}catch{}
    if(!['geoking.com','thecake-me.com'].includes(host))return c.json({error:'The approved local paid test is limited to Geoking and Cake-me'},403);
    if(body.references?.length)return c.json({error:'Paid test references must be reviewed within the approved budget first'},400);
  }

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
  if (brandId) {
    const { data: brand } = await supabaseAdmin
      .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
    if (!brand) return c.json({ error: "Brand not found" }, 404);
    workspaceId = brand.workspace_id;
    if (!hasPermission(auth, "bio.propose", workspaceId)) return c.json({ error: "Brand not in an accessible workspace" }, 403);
  } else {
    if (auth.scope === "platform") return c.json({ error: "Internal users must select an assigned brand" }, 400);
    if (!workspaceId || !hasPermission(auth, "bio.propose", workspaceId)) return c.json({ error: "Forbidden" }, 403);
    const { data: brand } = await supabaseAdmin
      .from("brands").select("id").eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!brand) return c.json({ error: "No brand in workspace yet" }, 400);
    brandId = brand.id;
  }

  const overrideToken = body.guardrailOverrideToken;
  const override = overrideToken && hasPermission(auth, "opex.override") && auth.aal === "aal2"
    ? verifyOpexOverride(overrideToken, { userId, operationKey: "discovery.compile" })
    : null;
  if (overrideToken && !override) return c.json({ error: "Guardrail override is invalid, expired, or not permitted", code: "INVALID_GUARDRAIL_OVERRIDE" }, 403);
  if (override) await writeAuthorizationAudit(c, {
    permission: "opex.override", action: "guardrail.override.consume", targetType: "api_operation",
    targetId: "discovery.compile", workspaceId, outcome: "success", reason: override.reason,
    metadata: { nonce: override.nonce, expiresAt: new Date(override.expiresAt).toISOString() },
  });

  // Update brand.url if it differs (so future discoveries can default to it)
  if(url) await supabaseAdmin.from("brands").update({ url }).eq("id", brandId);
  if(!url && !references.length){
    const {data:sources,error}=await supabaseAdmin.from("bio_sources").select("id").eq("brand_id",brandId).eq("kind","file_upload").limit(1);
    if(error)return c.json({error:error.message},500);
    if(!sources?.length)return c.json({error:"Add a brand source or reference before generating the BIO"},400);
  }

  // Fire the event — compile-bio function picks it up asynchronously.
  // If the queue is unreachable (e.g. Inngest dev server not running in
  // local dev), surface a clear 503 instead of a bare 500.
  let ids;
  const queueRequestId = crypto.randomUUID();
  const queueStarted = Date.now();
  try {
    ({ ids } = await inngest.send({
      name: "discovery/start",
      data: { brandId, url, workspaceId, instagram, discoveryId, references, actorUserId: userId, breakerOverride: !!override },
    }));
    await recordApiUsage({
      requestId: queueRequestId, workflowId: discoveryId, workspaceId, brandId, actorUserId: userId,
      feature: "discovery.queue", provider: "inngest", service: "events", operation: "send",
      status: "succeeded", latencyMs: Date.now() - queueStarted, costSource: "unpriced",
    });
  } catch (err) {
    await recordApiUsage({
      requestId: queueRequestId, workflowId: discoveryId, workspaceId, brandId, actorUserId: userId,
      feature: "discovery.queue", provider: "inngest", service: "events", operation: "send",
      status: "failed", latencyMs: Date.now() - queueStarted, costSource: "unpriced", errorCode: "QUEUE_UNAVAILABLE",
    });
    console.error("[discovery] inngest.send failed:", err?.message || err);
    return c.json({ error: "Discovery queue unavailable — try again shortly" }, 503);
  }

  return c.json({ eventId: ids?.[0] || null, discoveryId, brandId, url, status: "queued" });
});

export default app;
