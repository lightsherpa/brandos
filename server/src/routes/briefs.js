// POST /api/briefs/sharpen — fires a02 The Sharpener.
// Body: { briefText, brandId? }
// Returns: { tension, sharpenedBrief, questions, proposedSpecialists, refusals, usage }
//
// The SPA's HomeCreate flow calls this on `Start`, renders the real
// brand-aware questions, and (after user answers or skips) passes the
// sharpened context into each /api/runs/stream call.

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { loadBioForBriefing } from "../lib/load-brand-bio.js";
import { sharpenBrief,sharpenerFastEnabled } from "../lib/sharpener.js";
import { loadBrandMemorySummary } from "../lib/brandolph-memory.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { hasPermission } from "../lib/permissions.js";
import { verifyOpexOverride } from "../lib/opex-override.js";
import { writeAuthorizationAudit } from "../lib/audit.js";

import { createBriefDraftRoutes } from "./brief-drafts.js";
import formatPreview from "./format-preview.js";

const app = new Hono();
app.route("/drafts", createBriefDraftRoutes({ db: supabaseAdmin, authenticate: requireAuth }));
app.route("/", formatPreview);

app.post("/sharpen", requireAuth, async (c) => {
  const started=performance.now();
  const auth = c.get("auth");
  const { userId } = auth;
  let workspaceId = auth.workspaceId || auth.memberships?.[0]?.workspace_id || null;
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
  const { briefText, brandId, guardrailOverrideToken } = body || {};
  if (!briefText || typeof briefText !== "string") return c.json({ error: "briefText required" }, 400);
  if (brandId) {
    const { data: scopedBrand } = await supabaseAdmin.from("brands").select("workspace_id").eq("id", brandId).maybeSingle();
    if (!scopedBrand) return c.json({ error: "Brand not found" }, 404);
    workspaceId = scopedBrand.workspace_id;
  }
  if (!workspaceId || !hasPermission(auth, "brief.run", workspaceId)) return c.json({ error: "Forbidden" }, 403);
  if (auth.scope === "platform" && !brandId) return c.json({ error: "Internal users must select an assigned brand" }, 400);

  const override = guardrailOverrideToken && hasPermission(auth, "opex.override") && auth.aal === "aal2"
    ? verifyOpexOverride(guardrailOverrideToken, { userId, operationKey: "brief.sharpen" })
    : null;
  if (guardrailOverrideToken && !override) return c.json({ error: "Guardrail override is invalid, expired, or not permitted", code: "INVALID_GUARDRAIL_OVERRIDE" }, 403);
  if (override) await writeAuthorizationAudit(c, {
    permission: "opex.override", action: "guardrail.override.consume", targetType: "api_operation",
    targetId: "brief.sharpen", workspaceId, outcome: "success", reason: override.reason,
    metadata: { nonce: override.nonce, expiresAt: new Date(override.expiresAt).toISOString() },
  });

  /* BRIEFING gate — sharpening a brief requires the client to have
     self-certified the BIO. loadBioForBriefing throws NOT_SELF_CERTIFIED
     (or NO_BIO) otherwise. */
  const authorizedAt=performance.now();
  const loadMemory=async id=>{try{return await loadBrandMemorySummary(id);}catch(e){console.warn("[briefs] memory load failed:",e?.message||e);return "";}};
  let brandBio,memorySummary="";
  try {
    if(sharpenerFastEnabled()&&brandId){
      [brandBio,memorySummary]=await Promise.all([loadBioForBriefing({workspaceId,brandId}),loadMemory(brandId)]);
    }else{brandBio=await loadBioForBriefing({workspaceId,brandId});memorySummary=await loadMemory(brandBio.brand.id);}
  } catch (err) {
    if (err.code === "NOT_SELF_CERTIFIED") {
      return c.json({ error: "Confirm your Brand Core (self-certify) before briefing.", code: err.code }, 409);
    }
    if (err.code === "NO_BIO") {
      return c.json({ error: "This brand has no Brand Core yet — run Discovery first.", code: err.code }, 409);
    }
    return c.json({ error: err.message || String(err) }, 400);
  }

  const contextAt=performance.now();

  try {
    const result = await sharpenBrief({
      briefText,
      brand: brandBio.brand,
      bio: brandBio.bio,
      refusals: brandBio.refusals,
      memorySummary,
      telemetry: { workspaceId, brandId: brandBio.brand.id, actorUserId: userId, breakerOverride: !!override },
    });
    const { usage: _internalUsage, performance:metrics, ...clientResult } = result;
    c.header('Server-Timing',`authorization;dur=${(authorizedAt-started).toFixed(1)}, context;dur=${(contextAt-authorizedAt).toFixed(1)}, sharpen;dur=${(performance.now()-contextAt).toFixed(1)}, total;dur=${(performance.now()-started).toFixed(1)}`);
    if(metrics)c.header('X-Sharpener-Context-Cache',metrics.contextCacheHit?'hit':'miss');
    return c.json({
      ...clientResult,
      brand: { name: brandBio.brand.name, bioVersion: brandBio.bio?.version },
    });
  } catch (e) {
    if(e.qualityIssues)console.warn('[briefs] sharpener quality rejected',JSON.stringify({issues:e.qualityIssues,previousIssues:e.previousQualityIssues||[]}));
    return c.json({ error: e?.message || String(e) }, 500);
  }
});

export default app;
