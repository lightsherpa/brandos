import {boundedProviderOptions,aggregateQaUsage} from '../lib/text-spend.js';
// ─────────────────────────────────────────────────────────────────────
// P3 — first production specialist run + QA gate.
//
// POST /api/runs/stream
//   Body: { specialistId, briefText, brandId? }
//   Auth: required.
//   SSE response with normalized events:
//     event: token    data: { text }
//     event: qa       data: { passed, voice_match, violations }
//                     deliverable runs also carry: { malformed, deliverable_count }
//     event: done     data: { runId, outputId, usage, qa, output, brand }
//                     output for deliverable runs: { kind:"deliverables", type, part,
//                       platform, deliverables:[{ title, body, platform, qa, status }], status }
//     event: error    data: { message }
//
// Side effects (in order):
//   1. Inserts a `briefs` row (one-off type) capturing the request text.
//   2. Inserts a `runs` row in `running` state (pins spec_version + bio_version).
//   3. Calls the specialist via the router; streams tokens to the client.
//   4. Runs a18 Voice QA on the full output text.
//   5. Atomically finalizes `runs`, `outputs`, `qa_results`, and the reserved debit.
// ─────────────────────────────────────────────────────────────────────

import { recordUsage } from "../lib/creative/usage.js";
import { creativeConfig } from "./creative.js";
import { catalogModel } from "../lib/models/catalog.js";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { loadBioForRun } from "../lib/load-brand-bio.js";
import { streamCompletion, textProviderAvailable, isAllowedModelOverride, routeCreditMultiplier } from "../lib/models/router.js";
import { composeSpecialistPrompt } from "../lib/compose-specialist-prompt.js";
import { composeImagePrompt } from "../lib/compose-image-prompt.js";
import { voiceQa } from "../lib/qa-voice.js";
import { visionQa } from "../lib/qa-vision.js";
import { recordSignal } from "../lib/brandolph-memory.js";
import { generate as generateImage, isImageRoute } from "../lib/models/fal-image.js";
import { maxTokensForDeliverables, parseDeliverables, buildDeliverableContract, falSizeForPlatform } from "../lib/deliverables.js";
import { assertCreditsAvailable, creditErrorResponse, estimateRunCredits, reserveCredits, failRunAndReleaseCredits } from "../lib/credits.js";

import { quoteSpecialist } from '../lib/canvas-tiers.js';
import { hasPermission } from '../lib/permissions.js';
import { inspectCanvasQuote } from '../lib/canvas-service.js';

import { EMAIL_CONTRACT, parseEmail, renderEmail } from "../lib/creative/email-html.js";

import {textExecutionLease} from "../lib/text-execution.js";

const app = new Hono();

app.get('/estimate', requireAuth, async c => {
  if(!hasPermission(c.get('auth'),'brief.run'))return c.json({error:'Forbidden'},403);
  const {data:spec}=await supabaseAdmin.from('specs').select('payload').eq('specialist_id',c.req.query('specialistId')).eq('active',true).maybeSingle();
  if(!spec)return c.json({error:'Specialist unavailable'},400);
  try {const quote=quoteSpecialist(spec,{tier:c.req.query('tier')||'auto'});return c.json({credits:quote.credits,tier:quote.tier});}
  catch {return c.json({error:'This quality tier is unavailable'},400);}
});

app.post("/stream", requireAuth, requirePermission("brief.run"), async (c) => {
  let { workspaceId } = c.get("auth");
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
  let canvasRequest = null;
  if (body?.canvasId) {
    const {data:canvasNode}=await supabaseAdmin.from('canvas_layouts').select('document').eq('id',body.canvasId).maybeSingle();
    if(['image','video'].includes(canvasNode?.document?.nodes?.find(n=>n.id===body.nodeId)?.outputType))return c.json({error:'Media nodes use durable creative jobs.',code:'USE_MEDIA_JOB'},409);
    try { canvasRequest = await inspectCanvasQuote(c.get('auth'), body); }
    catch (err) { return c.json({error:err.status ? err.message : err.code==='BIO_NOT_CERTIFIED'?'Certify the BIO before running work.':err.code==='NO_BIO'?'Create this brand’s BIO first.':'Could not approve this canvas run.',code:err.code || 'CANVAS_RUN_ERROR'},err.status || 400); }
    workspaceId = canvasRequest.canvas.workspace_id;
    body = {
      canvasId: canvasRequest.canvas.id,
      specialistId: canvasRequest.node.specialistId,
      briefText: canvasRequest.snapshot.briefText,
      briefId: canvasRequest.canvas.brief_id,
      brandId: canvasRequest.canvas.brand_id,
      modelOverride: canvasRequest.quote.route,
      revisionFeedback: canvasRequest.node.settings?.revisionFeedback,
      deliverableSpec: canvasRequest.quote.deliverableSpec,
    };
  }
  let { specialistId, briefText, brandId, briefId: existingBriefId, briefMeta, modelOverride, revisionFeedback, deliverableSpec } = body || {};
  if (!specialistId || !briefText) return c.json({ error: "specialistId and briefText required" }, 400);

  /* Re-run / revise — caller can override which model handles this
     run (curated per-spec dropdown in the SPA), and/or append revision
     feedback that gets threaded into the brief context.
     modelOverride is a full route string ("anthropic/...", "openrouter/...",
     "vendor/fal/..."). Validated downstream by the model router. */
  const effectiveBriefText = revisionFeedback?.trim()
    ? `${briefText}\n\nOperator's revision note: ${revisionFeedback.trim()}`
    : briefText;

  /* Spec lookup — must be active and exist. */
  const { data: spec, error: specErr } = canvasRequest ? {data:canvasRequest.spec,error:null} : await supabaseAdmin
    .from("specs")
    .select("id, specialist_id, version, payload")
    .eq("specialist_id", specialistId)
    .eq("active", true)
    .maybeSingle();
  if (specErr || !spec) return c.json({ error: `Spec ${specialistId} not active or not found` }, 400);

  /* Brand + BIO — PRODUCTION gate. A specialist run may only read a
     human-certified BIO; loadBioForRun throws BIO_NOT_CERTIFIED otherwise.
     This is the data-layer gate (the assembly runner is a client-side loop,
     so there is no server orchestrator to gate — every run re-checks here). */
  let brandBio;
  try {
    brandBio = canvasRequest?.bio || await loadBioForRun({ workspaceId, brandId });
  } catch (err) {
    if (err.code === "BIO_NOT_CERTIFIED") {
      return c.json({ error: "This brand's BIO must be certified by a Brand Steward before it can produce work.", code: err.code }, 409);
    }
    if (err.code === "NO_BIO") {
      return c.json({ error: "This brand has no BIO yet — run Discovery first.", code: err.code }, 409);
    }
    return c.json({ error: err.message || String(err) }, 400);
  }

  if (!canvasRequest && body.qualityTier) {
    if(!hasPermission(c.get('auth'),'brief.run',workspaceId))return c.json({error:'Forbidden'},403);
    try {modelOverride = quoteSpecialist(spec,{tier:body.qualityTier,deliverableSpec}).route;}
    catch {return c.json({error:'This quality tier is unavailable'},400);}
  }
  /* Effective route: caller override → spec default. The spec row in
     the DB is unchanged; the override applies to THIS run only. */
  if (!canvasRequest && !body.qualityTier && modelOverride != null && !isAllowedModelOverride(modelOverride)) {
    return c.json({ error: "Model override is not permitted for client requests", code: "MODEL_OVERRIDE_NOT_ALLOWED" }, 400);
  }
  const route = modelOverride
    ? modelOverride
    : (spec.payload?.modelRouting?.primary || "");
  const isImage = isImageRoute(route);
  const creative = await creativeConfig(workspaceId);
  if (modelOverride && (creative.policy.deniedRoutes?.includes(route) || (creative.policy.allowedRoutes && !creative.policy.allowedRoutes.includes(route)))) return c.json({error:"Model is not permitted in this workspace"},403);
  const baselineModality = catalogModel(spec.payload?.modelRouting?.primary)?.modality;
  if (modelOverride && baselineModality && catalogModel(route)?.modality !== baselineModality) return c.json({error:"Model modality does not match this specialist"},400);
  if (creative.enabled && isImage) return c.json({error:"Use durable media submission",code:"USE_DURABLE_MEDIA"},409);

  /* Deliverable mode: when the caller passes a deliverableSpec, a TEXT run
     returns N structured items (one LLM call) and an IMAGE run is sized to
     the platform. No deliverableSpec → legacy single-output behavior. */
  const dlv = (deliverableSpec && typeof deliverableSpec === "object") ? deliverableSpec : null;
  const isEmail = dlv?.type === "email_html";
  if (isEmail && (!creative.policy.emailHtml || process.env.CREATIVE_ROLLBACK === '1')) return c.json({error:'HTML email rollout is disabled'},409);
  const emailRequiredContent = [brandBio.brand.name, ...(Array.isArray(creative.policy.emailRequiredContent) ? creative.policy.emailRequiredContent : [])];
  const emailAssets = [];
  if (isEmail) {
    for (const assetId of [...new Set(Array.isArray(dlv.assetIds) ? dlv.assetIds : [])].slice(0,20)) {
      const {data:a} = await supabaseAdmin.from('outputs').select('id,status,body,brief:briefs(brand:brands(workspace_id))').eq('id',assetId).maybeSingle();
      if (a?.brief?.brand?.workspace_id !== workspaceId || a.status !== 'approved' || a.body?.kind !== 'image') return c.json({error:'Email images must be approved workspace assets'},400);
      emailAssets.push({id:a.id,url:null,publishable:false});
    }
  }
  const isDeliverableText = !isEmail && !isImage && !!dlv && Number(dlv.count) >= 1;
  const baseCredits = estimateRunCredits({ specPayload: spec.payload, deliverableSpec: dlv, isDeliverableText });
  const creditsDebited = Math.max(1, Math.ceil(baseCredits * routeCreditMultiplier(route)));
  const creditCheck = await assertCreditsAvailable(workspaceId, creditsDebited);
  if (!creditCheck.ok) {
    return creditErrorResponse(c, creditCheck);
  }

  /* Clone the spec so we don't mutate the cached payload — downstream
     adapters read modelRouting.primary off this object. */
  const effectiveSpec = modelOverride && modelOverride !== spec.payload?.modelRouting?.primary
    ? { ...spec, payload: { ...spec.payload, modelRouting: { ...(spec.payload?.modelRouting || {}), primary: route, reason: `re-run override · ${modelOverride}` } } }
    : spec;

  /* Prior outputs on this brief — when an assembly fires N specialists
     sequentially under one brief, every specialist after the first sees
     what its teammates already shipped. Skips the spec's own previous
     run (don't ask the same specialist to ape itself). */
  let priorOutputs = [];
  if (canvasRequest) {
    priorOutputs = canvasRequest.snapshot.priorOutputs;
  } else if (existingBriefId) {
    const {data:ownedBrief}=await supabaseAdmin.from("briefs").select("id,brand_id").eq("id",existingBriefId).eq("brand_id",brandBio.brand.id).maybeSingle();
    if(!ownedBrief)return c.json({error:"briefId not found in this brand"},404);
    const { data: priorRuns } = await supabaseAdmin
      .from("runs")
      .select("specialist_id, outputs ( body, kind, status )")
      .eq("brief_id", existingBriefId)
      .neq("specialist_id", specialistId)
      .order("started_at", { ascending: true });
    priorOutputs = (priorRuns || []).flatMap((r) =>
      (r.outputs || [])
        .filter((o) => o.status !== "failed")
        .map((o) => ({ ...o, specialist_id: r.specialist_id }))
    );
  }

  /* Text specialists get the four-layer message structure (cached PLATFORM
     + BIO). Image specialists get a single flattened prompt string —
     Flux/Recraft etc. take one text input, not chat messages. */
  const system = isImage
    ? null
    : composeSpecialistPrompt({
        spec: effectiveSpec,
        brand: brandBio.brand,
        bio: brandBio.bio,
        refusals: brandBio.refusals,
        brief: effectiveBriefText,
        priorOutputs,
        deliverableContract: isEmail ? `${EMAIL_CONTRACT}\nRequired brand content: ${JSON.stringify(emailRequiredContent)}\nAllowed asset IDs: ${JSON.stringify(emailAssets.map(a=>a.id))}` : isDeliverableText
          ? buildDeliverableContract({ type: dlv.type, part: dlv.part, count: Number(dlv.count), platform: dlv.platform, withVisualDirection: !!dlv.withVisualDirection })
          : null,
      });

  const imagePrompt = isImage
    ? composeImagePrompt({
        spec: effectiveSpec,
        brand: brandBio.brand,
        bio: brandBio.bio,
        refusals: brandBio.refusals,
        brief: effectiveBriefText,
        sourceText: canvasRequest ? priorOutputs.map(o => o.body?.edited_text || o.body?.text || JSON.stringify(o.body?.deliverables || [])).join("\n").slice(0,8000) : (dlv?.sourceText || null),
        artDirection: dlv?.artDirection || null,
      })
    : null;

  return streamSSE(c, async (stream) => {
    const originalWrite = stream.writeSSE.bind(stream);
    if (canvasRequest) stream.writeSSE = async message => {
      if (message.event === 'error') {
        const data = JSON.parse(message.data);
        message = {...message,data:JSON.stringify({message:data.code ? data.message : 'The run failed. Check the run status before retrying.',code:data.code})};
      }
      if (message.event === 'done') {
        const data = JSON.parse(message.data);
        delete data.usage;
        message = {...message,data:JSON.stringify(data)};
      }
      return originalWrite(message);
    };
    const startedIso = new Date().toISOString();

    /* 1. Brief row — every specialist run pins to a brief. When the
       caller already created a brief earlier (e.g. assembly orchestration
       firing N specialists under the same intent), reuse it. Otherwise
       create a fresh one. Ownership check applies either way. */
    let briefId;
    if (existingBriefId) {
      const { data: existing } = await supabaseAdmin
        .from("briefs").select("id, brand_id").eq("id", existingBriefId).maybeSingle();
      if (!existing || existing.brand_id !== brandBio.brand.id) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "briefId not found or not in brand" }) });
        return;
      }
      briefId = existing.id;
    } else {
      /* Brief title prefers the Sharpener's editorial title (4–6 words,
         not a slice of raw text). Falls back to the first sharpened
         sentence, then to a truncated raw request. The payload stores
         the full Sharpener context so the Library can re-render the
         brief panel later without another model call. */
      const title =
        (briefMeta?.title && String(briefMeta.title).trim()) ||
        (briefMeta?.sharpenedBrief && String(briefMeta.sharpenedBrief).split(/[.!?]/)[0].trim().slice(0, 80)) ||
        (briefMeta?.rawBrief && String(briefMeta.rawBrief).trim().slice(0, 60)) ||
        briefText.slice(0, 60);

      const { data: briefRow, error: briefErr } = await supabaseAdmin
        .from("briefs")
        .insert({
          brand_id: brandBio.brand.id,
          title,
          type: "one_off",
          payload: {
            request:        briefMeta?.rawBrief || briefText,
            title,
            sharpenedBrief: briefMeta?.sharpenedBrief || "",
            tension:        briefMeta?.tension || "",
            refusals:       briefMeta?.refusals || [],
          },
          mode: "auto",
          status: "active",
        })
        .select("id")
        .single();
      if (briefErr || !briefRow) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: `brief insert failed: ${briefErr?.message}` }) });
        return;
      }
      briefId = briefRow.id;
    }

    /* 2. Runs row — pins spec_version + bio_version for reproducibility. */
    const { data: runRow, error: runErr } = canvasRequest ? await (async()=>{
      const {data,error}=await supabaseAdmin.rpc("create_canvas_text_run",{p_workspace_id:workspaceId,p_actor_id:c.get("auth").userId,p_canvas_id:canvasRequest.canvas.id,p_node_id:canvasRequest.node.id,p_quote_id:canvasRequest.requestId,p_fingerprint:canvasRequest.fingerprint,p_snapshot:{...canvasRequest.snapshot,credits:creditsDebited},p_spec_id:spec.specialist_id,p_spec_version:spec.version,p_bio_version:brandBio.bio.version,p_credits:creditsDebited});
      return {data:data?{id:data}:null,error};
    })() : await supabaseAdmin
      .from("runs")
      .insert({
        ...(canvasRequest ? {id:canvasRequest.requestId,canvas_id:canvasRequest.canvas.id,canvas_node_id:canvasRequest.node.id,canvas_snapshot:{...canvasRequest.snapshot,credits:creditsDebited}} : {}),
        brief_id: briefId,
        specialist_id: spec.specialist_id,
        spec_version: spec.version,
        bio_version: brandBio.bio.version,
        status: "running",
        started_at: startedIso,
      })
      .select("id")
      .single();
    const runId = runRow?.id;
    if (runErr || !runId) {
      if(canvasRequest){const budgetFailure=/EXECUTION_.*(BUDGET|CEILING)|UNRESOLVED_SPEND|UNBOUNDED_LEGACY/.test(runErr?.message||'');await stream.writeSSE({event:'error',data:JSON.stringify({message:budgetFailure?'Review workspace execution limits and unresolved billing before starting more work.':'This run could not be started or was already submitted. Check its status before approving again.',code:budgetFailure?'EXECUTION_SPEND_REVIEW_REQUIRED':'CANVAS_RUN_CONFLICT'})});return;}
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: `run insert failed: ${runErr?.message || "unknown"}` }) });
      return;
    }

    if (canvasRequest) await stream.writeSSE({event:'started',data:JSON.stringify({runId})});
    const reservationKey = `run:${runId}:credits`;
    const reservation = canvasRequest ? {ok:true} : await reserveCredits({
      workspaceId,
      amount: creditsDebited,
      key: reservationKey,
      kind: "run_reserved",
      runId,
    });
    if (!reservation.ok) {
      await supabaseAdmin.from("runs").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", runId);
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: reservation.message, code: reservation.code }) });
      return;
    }
    let creditsSettled = false;
    const textLease=canvasRequest ? await textExecutionLease(runId) : null;
    const failRun = async (message) => {
      try {
        if (creditsSettled) {
          if (message) await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) });
          return;
        }
        if(textLease?.mustHold){
          await textLease.hold(message);
          if(message)await stream.writeSSE({event:'error',data:JSON.stringify({message:'This run needs operator reconciliation. Credits remain held.',code:'TEXT_RECONCILIATION_REQUIRED'})});
          return;
        }
        if(textLease){
          const {error}=await supabaseAdmin.rpc('fail_unsubmitted_text_run',{p_workspace_id:workspaceId,p_run_id:runId});if(error)throw error;
        }else await failRunAndReleaseCredits({
          workspaceId,
          runId,
          reservationKey,
          releaseKey: `${reservationKey}:refund`,
          reason: "run_refund",
        });
      } catch (e) {
        console.error("[runs] failed to release reserved credits", runId, e?.message || e);
      }
      if (message) await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) });
    };

    /* 3. Stream the specialist response.
          Branch: text specialists stream tokens (router → Anthropic / OR);
          image specialists submit to fal, poll, download asset, upload
          to Supabase Storage, emit a single done event. */
    let output = "";
    let usage = null;
    let modelUsed = null;
    let emailResult = null;
    let imageResult = null;          /* { asset_url, model, cost_usd, prompt_used, ... } */

    try {
      if (isImage) {
        /* Image pipeline — single asset, no token streaming */
        for await (const ev of generateImage({
          route,
          prompt: imagePrompt,
          size: dlv?.platform ? falSizeForPlatform(dlv.platform) : (spec.payload?.image_size || "landscape_16_9"),
        })) {
          if (ev.type === "progress") {
            await stream.writeSSE({ event: "progress", data: JSON.stringify({ stage: ev.stage, pct: ev.pct }) });
          } else if (ev.type === "done") {
            imageResult = ev;
            /* Download from fal CDN and persist in Supabase Storage so the
               URL doesn't expire (fal links typically expire in days). */
            try {
              const imgRes = await fetch(ev.asset_url);
              const buf = new Uint8Array(await imgRes.arrayBuffer());
              const ext = (ev.content_type || "").includes("png") ? "png"
                       : (ev.content_type || "").includes("jpeg") ? "jpg"
                       : (ev.content_type || "").includes("webp") ? "webp" : "png";
              const objPath = `${workspaceId}/${brandBio.brand.id}/outputs/${runId}.${ext}`;
              const { error: upErr } = await supabaseAdmin.storage.from("bio-sources")
                .upload(objPath, buf, { contentType: ev.content_type || "image/png", upsert: true });
              if (!upErr) {
                const { data: signed } = await supabaseAdmin.storage.from("bio-sources")
                  .createSignedUrl(objPath, 60 * 60 * 24 * 365);
                if (signed?.signedUrl) imageResult.asset_url = signed.signedUrl;
              }
            } catch (e) {
              /* Non-fatal — fall back to fal's URL */
              console.warn("[runs] image upload to Storage failed:", e?.message || e);
            }
            usage = { provider: "fal", model: ev.model, cost_usd: ev.cost_usd, estimated_cost_usd: ev.estimated_cost_usd, prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0 };
            modelUsed = ev.model;
          } else if (ev.type === "error") {
            await failRun(ev.message);
            return;
          }
        }
      } else {
        /* Persist the uncertain submission boundary before any paid request. */
        if(textLease){
          if(!textProviderAvailable(route)){await failRun('The configured text provider is unavailable.');return;}
          await textLease.step('submitting',{provider_possible:true});
        }
        for await (const ev of streamCompletion({
          spec: effectiveSpec,
          system,
          messages: [{ role: "user", content: effectiveBriefText }],
          spendOptions:canvasRequest?boundedProviderOptions(canvasRequest.snapshot.textSpend.generation):undefined,
          maxTokens: canvasRequest?canvasRequest.snapshot.textSpend.generation.maxTokens:isEmail ? 4000 : isDeliverableText
            ? maxTokensForDeliverables({ count: Number(dlv.count), baseCr: effectiveSpec.payload?.cr_estimate ?? 8 })
            : (effectiveSpec.payload?.cr_estimate ?? 8) * 100,
        })) {
          if(ev.type==='receipt'){
            if(textLease)await textLease.step('generating',{provider_receipt_id:String(ev.id).slice(0,200)});
          }else if (ev.type === "token") {
            output += ev.text;
            await stream.writeSSE({ event: "token", data: JSON.stringify({ text: ev.text }) });
          } else if (ev.type === "done") {
            usage = ev.usage;
            modelUsed = ev.usage?.model;
            if(textLease)await textLease.step('generation_complete',{generation_complete:true,raw_output:output.slice(0,200000),usage:ev.usage||null});
          } else if (ev.type === "error") {
            await failRun(ev.message);
            return;
          }
        }
      }

      /* 4. QA pass.
            Text → a18 Voice QA (regex + Gemini Flash voice-drift).
            Image → a24 Brand Consistency QA (Gemini Flash vision) —
                    scores the rendered image against the BIO visual
                    rules. Verdict {passed, brand_match, violations}. */
      if(textLease)await textLease.step('qa_running');
      let qa;
      let deliverables = null;        /* set on the deliverable-text path */
      if (isImage) {
        const v = await visionQa({ assetUrl: imageResult?.asset_url, bio: brandBio.bio });
        qa = { ...v, kind: "image_a24" };
      } else if (isEmail) {
        const content = parseEmail(output);
        // Asset IDs are resolved by export/preview endpoints; never trust model URLs.
        emailResult = renderEmail(content, { requiredContent: emailRequiredContent, assets: emailAssets });
        emailResult.requiredContent = emailRequiredContent;
        qa = emailResult.qa;
      } else if (isDeliverableText) {
        /* One LLM call produced N items; QA each so a single weak post is
           flagged individually instead of passing the whole batch. The QA
           calls are independent (cheap tier) → run them concurrently so the
           output card isn't stalled by N serial round-trips. (If a provider
           rate limit ever bites at high count, cap concurrency here.) */
        const parsed = parseDeliverables(output);
        const dqResults = await Promise.all(
          (canvasRequest?parsed.deliverables.slice(0,canvasRequest.snapshot.textSpend.qaCalls):parsed.deliverables).map((d) => voiceQa({ body: d.body, bio: brandBio.bio, refusals: brandBio.refusals,spendOptions:canvasRequest?boundedProviderOptions(canvasRequest.snapshot.textSpend.qa):undefined }))
        );
        deliverables = [];
        let passedAll = !canvasRequest||(parsed.deliverables.length===Number(dlv.count)&&!parsed.malformed);
        const qaUsage = canvasRequest?aggregateQaUsage(dqResults):{ cost_usd: 0 };
        parsed.deliverables.forEach((d, i) => {
          const dq = dqResults[i]||{passed:false,violations:["Unquoted extra deliverable requires human review"],usage:null};
          if (!dq.passed) passedAll = false;
          if (!canvasRequest&&typeof dq.usage?.cost_usd === "number") qaUsage.cost_usd += dq.usage.cost_usd;
          deliverables.push({ ...d, platform: dlv.platform || "generic", qa: dq, status: dq.passed ? "approved" : "flagged" });
        });
        qa = { passed: passedAll, voice_match: null, violations: [], usage: qaUsage, malformed: parsed.malformed, deliverable_count: deliverables.length };
      } else {
        qa = await voiceQa({ body: output, bio: brandBio.bio, refusals: brandBio.refusals,spendOptions:canvasRequest?boundedProviderOptions(canvasRequest.snapshot.textSpend.qa):undefined });
      }
      if(textLease)await textLease.step('qa_running',{qa_usage:isEmail?{cost_usd:0}:qa.usage});
      await stream.writeSSE({ event: "qa", data: JSON.stringify(qa) });

      /* 5. Prepare completion stats. Persistence is committed atomically below. */
      const endedIso = new Date().toISOString();
      const latencyMs = Date.parse(endedIso) - Date.parse(startedIso);
      const baseCost = usage?.cost_usd ?? null;
      const qaCost = isEmail ? 0 : qa.usage?.cost_usd ?? null;
      const totalCost = baseCost != null && qaCost != null ? baseCost + qaCost : null;
      const meteredJob = {id:runId,run_id:runId,workspace_id:workspaceId,brand_id:brandBio.brand.id,actor_user_id:c.get('auth').userId,specialist_id:specialistId,
        model:catalogModel(route)||{route,model:route,gateway:route.split('/')[0],modality:isImage?'image':'text'},input:{},catalog_version:'legacy-preserved'};
      await recordUsage(supabaseAdmin,meteredJob,'generation',usage,'succeeded');
      if (!isEmail) await recordUsage(supabaseAdmin,meteredJob,'qa',qa.usage,'succeeded');

      /* 6. Output payload. Image runs carry asset_url + prompt_used in the
            body; text runs carry text + rationale. */
      const outputKind = isImage
        ? (spec.payload?.code === "L2-19" ? "identity_drafts"
        :  spec.payload?.code === "L2-20" ? "hero_kv"
        :  spec.payload?.code === "L2-21" ? "editorial_image"
        :  "image")
        : isEmail ? "email_html" : (spec.payload?.kind || "copy");
      const outputBody = isImage
        ? {
            kind: "image",
            asset_url:   imageResult?.asset_url,
            width:       imageResult?.width,
            height:      imageResult?.height,
            seed:        imageResult?.seed,
            prompt_used: imageResult?.prompt_used,
          }
        : isEmail ? emailResult : isDeliverableText
        ? { kind: "deliverables", type: dlv.type, part: dlv.part, platform: dlv.platform || "generic", deliverables }
        : { text: output, rationale: null };
      const qaEvidence = qa.violations?.length ? qa.violations.join("; ") : null;
      const finalization = {
        p_workspace_id: workspaceId,
        p_run_id: runId,
        p_reservation_key: reservationKey,
        p_model_used: modelUsed || route,
        p_prompt_tokens: usage?.prompt_tokens ?? 0,
        p_completion_tokens: usage?.completion_tokens ?? 0,
        p_cached_tokens: usage?.cached_tokens ?? 0,
        p_cost_usd: totalCost,
        p_latency_ms: latencyMs,
        p_output_kind: outputKind,
        p_output_body: outputBody,
        p_asset_url: isImage ? imageResult?.asset_url : null,
        p_output_status: qa.passed ? "approved" : "flagged",
        p_rationale: qaEvidence,
        p_qa_passed: !!qa.passed,
        p_qa_evidence: qaEvidence,
        p_ledger_kind: qa.passed ? "run" : "run_flagged",
      };
      if(textLease)await textLease.step('settling',{finalization});
      const {data:finalized,error:finalizeErr}=canvasRequest ? await supabaseAdmin.rpc("settle_canvas_text_run",{p_workspace_id:workspaceId,p_run_id:runId,p_finalization:finalization}) : await supabaseAdmin.rpc("finalize_run_atomic",finalization);
      if (finalizeErr || !finalized?.output_id) {
        throw new Error(`run finalization failed: ${finalizeErr?.message || "output missing"}`);
      }
      const outputRow = { id: finalized.output_id };
      creditsSettled = true;

      /* Brandolph memory · signal this run + any re-run/revision context. */
      const memoryKind = qa.passed ? "run.approved" : "run.flagged";
      recordSignal({
        brandId:      brandBio.brand.id,
        kind:         memoryKind,
        specialistId: spec.specialist_id,
        runId,
        outputId:     outputRow?.id,
        createdBy:    c.get("auth")?.userId,
        payload: {
          voice_match: typeof qa.voice_match === "number" ? qa.voice_match : undefined,
          brand_match: typeof qa.brand_match === "number" ? qa.brand_match : undefined,
          model_used:  modelUsed || route,
          model_override: modelOverride || null,
          had_revision: !!revisionFeedback,
        },
      });
      if (modelOverride) {
        /* Classify the re-run direction so the admin dashboard can see
           "this brand keeps escalating to Opus on a12 — promote it" or
           "this brand can drop to Flash on a16 — accept the saving". */
        const opusOrPro = /opus|gemini-2\.5-pro|flux-1\.1-pro/i.test(modelOverride);
        recordSignal({
          brandId:      brandBio.brand.id,
          kind:         opusOrPro ? "spec.rerun_with_premium" : "spec.rerun_with_cheap",
          specialistId: spec.specialist_id,
          runId,
          outputId:     outputRow?.id,
          createdBy:    c.get("auth")?.userId,
          payload: { from: spec.payload?.modelRouting?.primary, to: modelOverride },
        });
      }
      if (revisionFeedback) {
        recordSignal({
          brandId:      brandBio.brand.id,
          kind:         "spec.revision",
          specialistId: spec.specialist_id,
          runId,
          outputId:     outputRow?.id,
          createdBy:    c.get("auth")?.userId,
          payload: { feedback_preview: revisionFeedback.slice(0, 200) },
        });
      }

      /* Final done event with everything the client needs to render the
         output card with the moat-defining attribution footer. */
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          runId,
          briefId,
          outputId: outputRow?.id,
          usage: usage ? {
            provider: usage.provider,
            model: usage.model,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            cached_tokens: usage.cached_tokens,
          } : null,
          qa,
          output: isImage
            ? { kind: outputKind, asset_url: imageResult?.asset_url, width: imageResult?.width, height: imageResult?.height, status: qa.passed ? "approved" : "flagged",
                bio_visual: {
                  palette: brandBio.bio?.visual?.palette || [],
                  type:    brandBio.bio?.visual?.type || null,
                  imagery: brandBio.bio?.visual?.imagery || [],
                } }
            : isEmail ? emailResult : isDeliverableText
            ? { kind: "deliverables", type: dlv.type, part: dlv.part, platform: dlv.platform || "generic", deliverables, status: qa.passed ? "approved" : "flagged" }
            : { text: output, status: qa.passed ? "approved" : "flagged" },
          brand: {
            id: brandBio.brand.id,
            name: brandBio.brand.name,
            bioVersion: brandBio.bio.version,
            certifiedBy: brandBio.bio.certified_by || null,
          },
          spec: {
            id: spec.specialist_id,
            name: spec.payload?.name,
            version: spec.version,
          },
          credits_debited: creditsDebited,
        }),
      });
    } catch (err) {
      await failRun(err?.message || String(err));
      if (!creditsSettled) {
        recordSignal({
          brandId:      brandBio.brand.id,
          kind:         "run.failed",
          specialistId: spec.specialist_id,
          runId,
          createdBy:    c.get("auth")?.userId,
          payload:      { error: String(err?.message || err).slice(0, 240) },
        });
      }
    } finally {textLease?.stop();}
  });
});

/* GET /api/runs/:id — read a finished run (for the SPA to load output
   cards on brief detail pages later). */
app.get("/:id", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const runId = c.req.param("id");
  const { data: run } = await supabaseAdmin
    .from("runs")
    .select(`
      id, brief_id, specialist_id, spec_version, bio_version, model_used,
      status, prompt_tokens, completion_tokens, cached_tokens,
      latency_ms, started_at, ended_at,
      brief:briefs ( id, title, brand_id, payload )
    `)
    .eq("id", runId)
    .maybeSingle();
  if (!run || run.brief?.brand_id == null) return c.json({ error: "Not found" }, 404);

  /* Workspace check via the brief's brand */
  const { data: brand } = await supabaseAdmin
    .from("brands")
    .select("workspace_id")
    .eq("id", run.brief.brand_id)
    .maybeSingle();
  if (!brand || brand.workspace_id !== workspaceId) return c.json({ error: "Forbidden" }, 403);

  const { data: outputs } = await supabaseAdmin
    .from("outputs")
    .select("id, kind, body, status, rationale")
    .eq("run_id", runId);
  const { data: qaResults } = await supabaseAdmin
    .from("qa_results")
    .select("*")
    .in("output_id", (outputs || []).map((o) => o.id));

  return c.json({ run, outputs: outputs || [], qa: qaResults || [] });
});

export default app;
