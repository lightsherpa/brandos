// Demo-only multi-format preview. Off unless FORMAT_PREVIEW=1.
// Not a specialist and not part of the production roster.
//
// GET  /api/briefs/:briefId/formats          deterministic render
// POST /api/briefs/:briefId/formats          { headline } re-renders all three
//                                            { compose: true } spends one model call

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { hasPermission } from "../lib/permissions.js";
import { normalizeBio } from "../lib/bio-schema.js";
import { enforceClassRateLimit } from "../lib/http-policy.js";
import { buildFormatPreview, shapeCertificationTrail } from "../lib/format-preview/preview.js";
import { applySharedHeadline } from "../lib/format-preview/derive.js";
import { renderFormats } from "../lib/format-preview/render.js";
import { brandCheckFormats } from "../lib/format-preview/brand-check.js";
import { composeMessageSpec } from "../lib/format-preview/compose.js";

const app = new Hono();

export function formatPreviewEnabled(env = process.env) {
  const raw = env.FORMAT_PREVIEW;
  return raw === "1" || String(raw || "").toLowerCase() === "true";
}

async function loadContext(c, briefId) {
  const auth = c.get("auth");
  const { data: brief } = await supabaseAdmin
    .from("briefs")
    .select("id, title, payload, brand_id")
    .eq("id", briefId)
    .maybeSingle();
  if (!brief) return { error: c.json({ error: "Brief not found" }, 404) };

  const { data: brand } = await supabaseAdmin
    .from("brands")
    .select("id, name, url, workspace_id, refusals")
    .eq("id", brief.brand_id)
    .maybeSingle();
  if (!brand || !hasPermission(auth, "brief.read", brand.workspace_id)) {
    return { error: c.json({ error: "Forbidden" }, 403) };
  }

  const { data: bioRow } = await supabaseAdmin
    .from("bios")
    .select("id, version, payload, score, certified, certified_at, self_certified, self_certified_at")
    .eq("brand_id", brand.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!bioRow) {
    return { error: c.json({ error: "This brand has no BIO yet.", code: "NO_BIO" }, 409) };
  }

  const { data: runs } = await supabaseAdmin
    .from("runs")
    .select("id, outputs ( id, kind, body, status )")
    .eq("brief_id", brief.id);
  const outputs = (runs || []).flatMap((run) => run.outputs || []);

  const { data: decisions } = await supabaseAdmin
    .from("cert_decisions")
    .select("id, decision, actor_role, composite_score, band, narrative, reject_reason_code, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: attestations } = await supabaseAdmin
    .from("bio_attestations")
    .select("id, statement_version, self_score, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    auth,
    brief,
    brand,
    bio: normalizeBio(bioRow.payload),
    bioVersion: bioRow.version,
    outputs,
    certification: shapeCertificationTrail({
      bio: bioRow,
      decisions: decisions || [],
      attestations: attestations || [],
    }),
  };
}

function previewPayload(built, certification) {
  return {
    spec: {
      headline: built.spec.blocks.email.headline,
      smp: built.spec.smp,
      audience: built.spec.audience,
      goal: built.spec.goal,
      messages: built.spec.messages,
      proof: built.spec.proof,
      cta: built.spec.cta,
      language: built.spec.language,
    },
    emailHtml: built.emailHtml,
    landingHtml: built.landingHtml,
    deckHtml: built.deckHtml,
    checks: built.checks,
    slides: built.slides,
    composed: !!built.composed,
    certification,
  };
}

async function renderFor(c, briefId, { headline, compose } = {}) {
  const loaded = await loadContext(c, briefId);
  if (loaded.error) return loaded.error;
  let built = await buildFormatPreview({
    brief: loaded.brief,
    brand: loaded.brand,
    bio: loaded.bio,
    bioVersion: loaded.bioVersion,
    outputs: loaded.outputs,
  });
  if (compose) {
    const limited = enforceClassRateLimit(c, "paid", { userId: loaded.auth.userId });
    if (limited) return limited;
    const composed = await composeMessageSpec({
      spec: built.spec,
      telemetry: {
        workspaceId: loaded.brand.workspace_id,
        brandId: loaded.brand.id,
        actorUserId: loaded.auth.userId,
      },
    });
    const spec = headline ? applySharedHeadline(composed.spec, headline) : composed.spec;
    const rendered = await renderFormats(spec);
    built = {
      spec,
      emailHtml: rendered.emailHtml,
      landingHtml: rendered.landingHtml,
      deckHtml: rendered.deckHtml,
      checks: brandCheckFormats(rendered, loaded.bio, spec.refusals),
      slides: spec.blocks.deck.slides.length,
      composed: composed.composed,
    };
  } else if (headline) {
    const spec = applySharedHeadline(built.spec, headline);
    const rendered = await renderFormats(spec);
    built = {
      ...built,
      spec,
      emailHtml: rendered.emailHtml,
      landingHtml: rendered.landingHtml,
      deckHtml: rendered.deckHtml,
      checks: brandCheckFormats(rendered, loaded.bio, spec.refusals),
      slides: spec.blocks.deck.slides.length,
    };
  }
  return c.json(previewPayload(built, loaded.certification));
}

app.use("/:briefId/formats", async (c, next) => {
  if (!formatPreviewEnabled()) return c.json({ error: "not_found" }, 404);
  return next();
});

app.get("/:briefId/formats", requireAuth, (c) => renderFor(c, c.req.param("briefId")));

app.post("/:briefId/formats", requireAuth, async (c) => {
  let body = {};
  try { body = await c.req.json(); } catch { body = {}; }
  const headline = typeof body.headline === "string" ? body.headline : "";
  return renderFor(c, c.req.param("briefId"), { headline, compose: body.compose === true });
});

export default app;
