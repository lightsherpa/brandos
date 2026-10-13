import {reconcileDiscoveryReview,reconcileLatestDiscoveryReview} from '../lib/discovery-review.js';
import {foundationStatus,foundationError} from "../lib/brand-foundation.js";
import {validateFoundationAssets, loadLogoRights} from "../lib/foundation-assets.js";
import {writeAuthorizationAudit} from "../lib/audit.js";
import {foundationUploadError} from "../lib/foundation-upload.js";
import {bioIntegrityError} from "../lib/brand-source-integrity.js";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { assignSteward } from "../lib/assign-steward.js";
import { scoreBio } from "../lib/score-bio.js";
import { validateUpload, isStorageRejection, contentTypeForExt, validateVisualAssetMetadata, assertPublicUrl, MAX_UPLOAD_BYTES, FONT_UPLOAD_EXTS } from "../lib/ingest-guards.js";
import { computeFocus } from "../lib/bio-focus.js";
import {validateCertificationReview} from "../lib/certification-review.js";
import { isWorkspaceOwner, hasPermission } from "../lib/permissions.js";
import { selfCertifyBio } from "../lib/self-certify.js";
import { diffBio } from "../lib/bio-diff.js";
import { loadBioForRun } from "../lib/load-brand-bio.js";
import { certifiedVisualSourceIds } from "../lib/visual-assets.js";
import { prepareClientBioEditPayload } from "../lib/bio-evidence.js";

const app = new Hono();

/* POST /api/bios/:brandId/sources
   Body: { sources: [{ kind, bucket, src, signals? }, ...] }
   Auth: required. Caller must own the brand (workspace check).
   Writes one bio_sources row per source. `bucket` matches the QW-003
   three-bucket UI ("foundations" | "visual" | "voice"). URL-derived
   sources (scrape results) can leave bucket null.

   File uploads land via Supabase Storage in a separate flow (P1-003
   follow-up); this endpoint accepts URL/text references only.        */
app.post("/:brandId/sources", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");

  // Ownership check
  const { data: brand, error: brandErr } = await supabaseAdmin
    .from("brands")
    .select("id, workspace_id")
    .eq("id", brandId)
    .maybeSingle();
  if (brandErr) return c.json({ error: brandErr.message }, 500);
  if (!brand || brand.workspace_id !== workspaceId) return c.json({ error: "Brand not in workspace" }, 403);

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
  const sources = Array.isArray(body?.sources) ? body.sources : [];
  if (sources.length === 0) return c.json({ error: "sources[] required" }, 400);
  if (sources.some(source=>source.kind === "file_upload")) return c.json({error:"File sources must use the upload endpoint",code:"UPLOAD_REQUIRED"},400);

  // SECURITY (P3 H-2): a client-supplied raw_ref is later fetched by the
  // compiler — validate any URL against the SSRF guard before storing it.
  for (const s of sources) {
    if (s?.raw_ref && /^https?:\/\//i.test(String(s.raw_ref))) {
      try { assertPublicUrl(String(s.raw_ref)); }
      catch (e) { return c.json({ error: `Blocked source URL (${e.code || "URL"})`, code: e.code || "BAD_URL" }, 400); }
    }
  }

  const rows = sources.map((s) => ({
    brand_id: brandId,
    kind:     s.kind || "reference",
    bucket:   ["foundations", "visual", "voice"].includes(s.bucket) ? s.bucket : null,
    src:      String(s.src ?? ""),
    signals:  s.signals ?? null,
    raw_ref:  s.raw_ref ?? null,
  }));

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("bio_sources")
    .insert(rows)
    .select("id, bucket, src");
  if (insertErr) return c.json({ error: insertErr.message }, 500);

  return c.json({ inserted: inserted.length, sources: inserted });
});

/* POST /api/bios/:brandId/sources/upload
   Multipart: file + bucket (foundations|visual|voice).
   Stores the file in Supabase Storage (private `bio-sources` bucket),
   writes uploads + bio_sources rows. Returns the new source + signed URL. */
app.post("/:brandId/sources/upload", requireAuth, async (c) => {
  let { workspaceId, userId } = c.get("auth");
  const brandId = c.req.param("brandId");

  const { data: brand } = await supabaseAdmin
    .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || !hasPermission(c.get("auth"), "bio.propose", brand.workspace_id)) return c.json({ error: "Brand not in workspace" }, 403);
  workspaceId = brand.workspace_id;

  // SECURITY (P3 M-1): reject an oversized upload by declared length BEFORE
  // buffering the whole multipart body into memory.
  const declaredLen = Number(c.req.header("content-length") || 0);
  if (declaredLen && declaredLen > MAX_UPLOAD_BYTES + 8192) {
    return c.json({ error: "File too large", code: "TOO_LARGE" }, 413);
  }

  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "multipart/form-data required" }, 400);
  const file = form.get("file");
  const bucket = String(form.get("bucket") || "").trim();
  const purpose=form.get("purpose") || "current";
  if(!["current","aspiration"].includes(purpose))return c.json({error:"Invalid source purpose"},400);
  if (!file || typeof file === "string") return c.json({ error: "file required" }, 400);
  if (!["foundations","visual","voice"].includes(bucket)) return c.json({ error: "bucket must be foundations|visual|voice" }, 400);
  const filename = file.name || "upload.bin";
  // Untrusted upload — validate type + size BEFORE buffering the whole file
  // into memory (evidence is parsed by an LLM, so it is an injection surface).
  const vUp = validateUpload({ mime: file.type, size: file.size, filename });
  if (!vUp.ok) return c.json({ error: vUp.message, code: vUp.code }, vUp.code === "TOO_LARGE" ? 413 : 400);
  const ext = vUp.ext || "bin";
  const mime = contentTypeForExt(ext);   // from the validated extension, never the browser
  if (!mime) return c.json({ error: `Unsupported file type .${ext}`, code: "EXT" }, 400);
  if (FONT_UPLOAD_EXTS.has(ext) && bucket !== "visual") {
    return c.json({ error: "Font assets belong in Visual references", code: "FONT_BUCKET" }, 400);
  }
  let visualMetadata = {};
  if (bucket === "visual") {
    const metadata = validateVisualAssetMetadata({
      ext,
      assetRole: form.get("assetRole") || "inspiration",
      logoVariant: form.get("logoVariant") || "light",
      rightsConfirmed: String(form.get("rightsConfirmed") || "") === "true",
      fontFamily: form.get("fontFamily"),
      fontUsage: form.get("fontUsage"),
      licenseType: form.get("licenseType"),
      licenseReference: form.get("licenseReference"),
    });
    if (!metadata.ok) return c.json({ error: metadata.message, code: metadata.code }, 400);
    visualMetadata = metadata.metadata;
  }
  const safeName = filename.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80);
  const objectPath = `${workspaceId}/${brandId}/${crypto.randomUUID()}-${safeName}`;

  const buf = new Uint8Array(await file.arrayBuffer());
  const invalidFoundationUpload=await foundationUploadError(Buffer.from(buf),ext,visualMetadata);
  if(invalidFoundationUpload)return c.json(invalidFoundationUpload,400);
  const { data: uploadData, error: uploadErr } = await supabaseAdmin
    .storage.from("bio-sources")
    .upload(objectPath, buf, { contentType: mime, upsert: false });
  if (uploadErr) {
    // Storage rejects types/sizes outside the bucket policy: that's the client's file, not a server fault.
    if (isStorageRejection(uploadErr)) return c.json({ error: "This file type or size isn't accepted for Brand Core sources", code: "STORAGE_REJECTED" }, 400);
    return c.json({ error: `Storage upload failed: ${uploadErr.message}` }, 500);
  }

  /* Store the durable object path, not an expiring signed URL. */
  const { data: signed } = await supabaseAdmin
    .storage.from("bio-sources")
    .createSignedUrl(objectPath, 60 * 60);

  const { data: uploadRow, error: uploadRowErr } = await supabaseAdmin
    .from("uploads")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      brand_id: brandId,
      url: objectPath,
      mime,
      bucket_hint: bucket,
    })
    .select("id, url")
    .single();
  if (uploadRowErr) {
    await supabaseAdmin.storage.from("bio-sources").remove([objectPath]);
    return c.json({ error: `Upload metadata failed: ${uploadRowErr.message}` }, 500);
  }

  const { data: sourceRow, error: sourceErr } = await supabaseAdmin
    .from("bio_sources")
    .insert({
      brand_id: brandId,
      kind: "file_upload",
      bucket,
      src: filename,
      signals: {
        size: file.size,
        mime,
        upload_id: uploadRow?.id,
        ext, purpose,
        ...visualMetadata,
        ...(bucket === "visual" ? { rights_confirmed_by:userId, rights_confirmed_at:new Date().toISOString() } : {}),
      },
      raw_ref: objectPath,
    })
    .select("id, bucket, src, signals, raw_ref")
    .single();
  if (sourceErr) {
    await Promise.all([
      supabaseAdmin.from("uploads").delete().eq("id", uploadRow.id),
      supabaseAdmin.storage.from("bio-sources").remove([objectPath]),
    ]);
    return c.json({ error: sourceErr.message }, 500);
  }

  return c.json({ source: sourceRow, signedUrl: signed?.signedUrl || null });
});

/* Remove a durable upload from evidence and storage. Deleting bio_sources
   first makes the asset ineligible for future compilation even if best-effort
   storage cleanup later fails. */
app.delete("/:brandId/sources/:sourceId", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");
  const sourceId = c.req.param("sourceId");
  const { data:brand } = await supabaseAdmin.from("brands").select("workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || brand.workspace_id !== workspaceId) return c.json({ error:"Brand not in workspace" }, 403);
  const { data:source } = await supabaseAdmin
    .from("bio_sources")
    .select("id, kind, raw_ref, signals")
    .eq("id", sourceId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (!source) return c.json({ deleted:true });
  if (source.kind !== "file_upload") return c.json({ error:"Only uploaded sources can be removed here" }, 409);
  let activeBio = null;
  try {
    activeBio = (await loadBioForRun({ workspaceId, brandId })).bio;
  } catch (error) {
    if (error?.code !== "BIO_NOT_CERTIFIED") return c.json({ error:"Could not verify certified source usage" }, 500);
  }
  if (certifiedVisualSourceIds(activeBio?.visual).has(sourceId)) {
    return c.json({ error:"This source is pinned to the active certified Brand Core and cannot be removed", code:"CERTIFIED_SOURCE" }, 409);
  }
  const { error:deleteError } = await supabaseAdmin.from("bio_sources").delete().eq("id", sourceId).eq("brand_id", brandId);
  if (deleteError) return c.json({ error:deleteError.message }, 500);
  const cleanup = [];
  if (source.signals?.upload_id) cleanup.push(supabaseAdmin.from("uploads").delete().eq("id", source.signals.upload_id));
  if (source.raw_ref && !/^https?:\/\//i.test(source.raw_ref)) cleanup.push(supabaseAdmin.storage.from("bio-sources").remove([source.raw_ref]));
  await Promise.allSettled(cleanup);
  return c.json({ deleted:true });
});

/* Confirm the brand has rights to use an uploaded logo (e.g. a PNG rasterized
   from the site's inline SVG during Discovery, stored with rights unconfirmed).
   Same permission as uploading with rights. Only flips the signal; the Brand
   Core version is unchanged, and foundationStatus reads rights live. */
app.post("/:brandId/sources/:sourceId/confirm-rights", requireAuth, async (c) => {
  const { userId } = c.get("auth");
  const brandId = c.req.param("brandId");
  const sourceId = c.req.param("sourceId");
  const { data: brand } = await supabaseAdmin.from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || !hasPermission(c.get("auth"), "bio.propose", brand.workspace_id)) return c.json({ error:"Brand not in workspace" }, 403);
  const body = await c.req.json().catch(() => ({}));
  if (body.rightsConfirmed !== true) return c.json({ error:"Confirm that the brand has rights to use this logo", code:"RIGHTS_REQUIRED" }, 400);
  const { data: source, error: findErr } = await supabaseAdmin.from("bio_sources").select("id, kind, bucket, raw_ref, signals")
    .eq("id", sourceId).eq("brand_id", brandId).maybeSingle();
  if (findErr) return c.json({ error:"Could not load source" }, 500);
  if (!source || source.kind !== "file_upload" || source.bucket !== "visual" || !source.raw_ref) return c.json({ error:"Source not found" }, 404);
  if (source.signals?.asset_role !== "logo" || source.signals?.ext !== "png") return c.json({ error:"Only PNG logos can be confirmed here", code:"NOT_A_LOGO" }, 400);
  if (source.signals?.rights_confirmed === true) {
    const reviewGate=await reconcileLatestDiscoveryReview(brandId);
    return c.json({ok:true,sourceId,rightsConfirmed:true,unchanged:true,reviewGate});
  }
  const signals = { ...source.signals, rights_confirmed:true, rights_confirmed_by:userId, rights_confirmed_at:new Date().toISOString() };
  const { error } = await supabaseAdmin.from("bio_sources").update({ signals }).eq("id", sourceId).eq("brand_id", brandId);
  if (error) return c.json({ error:"Could not confirm rights" }, 500);
  await writeAuthorizationAudit(c,{permission:"bio.propose",action:"brand.logo.confirm_rights",targetType:"bio_source",targetId:sourceId,workspaceId:brand.workspace_id,priorState:{rights_confirmed:source.signals?.rights_confirmed ?? false},newState:{rights_confirmed:true}});
  const reviewGate=await reconcileLatestDiscoveryReview(brandId);
  return c.json({ok:true,sourceId,rightsConfirmed:true,reviewGate});
});

/* Fresh private URL for an approved visual/font source. BIO payloads store a
   stable source id, never an expiring signed URL. */
app.get("/:brandId/sources/:sourceId/url", requireAuth, async (c) => {
  let { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");
  const sourceId = c.req.param("sourceId");
  const { data: brand } = await supabaseAdmin.from("brands").select("workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || !hasPermission(c.get("auth"), "bio.read", brand.workspace_id)) return c.json({ error:"Brand not in workspace" }, 403);
  workspaceId = brand.workspace_id;
  const { data: source } = await supabaseAdmin
    .from("bio_sources")
    .select("id, raw_ref, signals")
    .eq("id", sourceId)
    .eq("brand_id", brandId)
    .eq("bucket", "visual")
    .maybeSingle();
  // A PNG logo awaiting rights confirmation may be previewed (so the owner sees what they confirm); nothing else unconfirmed is served.
  const pendingLogo = source?.signals?.asset_role === "logo" && source?.signals?.ext === "png" && source?.signals?.rights_confirmed !== true;
  if (!source?.raw_ref || (source.signals?.rights_confirmed !== true && !pendingLogo)) return c.json({ error:"Approved source not found" }, 404);
  const { data, error } = await supabaseAdmin.storage.from("bio-sources").createSignedUrl(source.raw_ref, 60 * 60);
  if (error || !data?.signedUrl) return c.json({ error:"Could not sign source" }, 500);
  return c.json({ url:data.signedUrl, family:source.signals?.font_family || null, mime:source.signals?.mime || null, rightsConfirmed:source.signals?.rights_confirmed === true });
});

/* PATCH /api/bios/:brandId
   Body: { payload }
   Creates a NEW bios row (append-only versioned per rev-2 §5.5) with
   certified=false. Re-evaluates the review gate for this version. */
app.patch("/:brandId", requireAuth, async (c) => {
  let { workspaceId, userId } = c.get("auth");
  const brandId = c.req.param("brandId");

  const { data: brand } = await supabaseAdmin
    .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || !hasPermission(c.get("auth"), "bio.propose", brand.workspace_id)) return c.json({ error: "Brand not in workspace" }, 403);
  workspaceId = brand.workspace_id;

  const body = await c.req.json().catch(() => ({}));
  if (!body.payload || typeof body.payload !== "object") return c.json({ error: "payload required" }, 400);
  const { data: previousBio } = await supabaseAdmin
    .from("bios")
    .select("payload")
    .eq("brand_id", brandId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const logoUnchanged = JSON.stringify(body.payload.visual?.logo ?? null) === JSON.stringify(previousBio?.payload?.visual?.logo ?? null);
  const foundationAssetError = await validateFoundationAssets(brandId, body.payload.visual || {}, previousBio?.payload?.visual || {}, { allowUnconfirmedLogos: logoUnchanged });
  if (foundationAssetError) return c.json({error:foundationAssetError,code:"FOUNDATION_ASSET"},400);
  const cleanPayload = prepareClientBioEditPayload(body.payload, previousBio?.payload || {});

  const { data: newRow, error } = await supabaseAdmin
    .rpc("append_bio_version", {
      p_brand_id: brandId,
      p_payload: cleanPayload,
      p_score: scoreBio(cleanPayload, { logoRights: await loadLogoRights(brandId, cleanPayload).catch(() => []) }),
      p_created_by: userId,
      p_discovery_id: null,
    });
  if (error) return c.json({ error: error.message }, 500);

  if (JSON.stringify(previousBio?.payload?.visual) !== JSON.stringify(cleanPayload.visual)) await writeAuthorizationAudit(c,{permission:"brand.update",action:"brand.foundation.edit",targetType:"bio",targetId:newRow.id,workspaceId,priorState:previousBio?.payload?.visual || null,newState:cleanPayload.visual});

  const reviewGate=await reconcileDiscoveryReview({brandId,bioId:newRow.id,payload:cleanPayload,kind:"drift_check"});

  return c.json({bio:{...newRow,reviewGate}});
});

/* GET /api/bios/:brandId
   Returns latest BIO version + cert state. Used by the BIO viewer. */
app.get("/:brandId", requireAuth, async (c) => {
  let { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");

  const { data: brand } = await supabaseAdmin
    .from("brands")
    .select("id, name, url, workspace_id")
    .eq("id", brandId)
    .maybeSingle();
  if (!brand || !hasPermission(c.get("auth"), "bio.read", brand.workspace_id)) return c.json({ error: "Brand not in workspace" }, 403);
  workspaceId = brand.workspace_id;

  const { data: bio } = await supabaseAdmin
    .from("bios")
    .select("id, brand_id, version, payload, score, certified, certified_by, certified_at, cert_kind, steward_notes, self_certified, self_certified_at, discovery_id, created_at, created_by, cert_valid_until, client_acceptance_required, client_accepted_at, client_accepted_by")
    .eq("brand_id", brandId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const integrity = bio && bioIntegrityError(bio, brand);
  if(integrity)return c.json(integrity,409);

  /* Surface whether a human review is already in flight for this BIO so
     the client can show "review requested" instead of offering the button
     again. Open = queued | in_review | pending_lead_review. */
  let reviewPending = false;
  if (bio?.id) {
    const { data: openJob } = await supabaseAdmin
      .from("steward_jobs")
      .select("id")
      .eq("bio_id", bio.id)
      .in("status", ["queued", "in_review", "pending_lead_review"])
      .limit(1)
      .maybeSingle();
    reviewPending = !!openJob;
  }

  /* Softened client-side signal: how many fields the Steward would still
     focus on for this BIO's payload. Count only — the full focus list is
     served by the Steward route, not here. */
  const focusCount = bio?.payload ? computeFocus(bio.payload).length : 0;

  /* Steward ↔ client review loop. `review` surfaces the latest reviewer verdict
     ("From your Steward"); `diff` shows what the Steward changed when THEY
     authored the latest version. Both null/[] when there's nothing to show. */
  let review = null;
  let diff = [];
  if (bio?.id) {
    // Most recent decision recorded against THIS (latest) BIO version.
    const { data: job } = await supabaseAdmin
      .from("steward_jobs")
      .select("decision, required_changes, conditions, reject_reason_code, completed_at, assigned_to, lead_reviewed_by")
      .eq("bio_id", bio.id)
      .not("decision", "is", null)
      .order("queued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (job) {
      // Reviewer's given name: the scoring Steward, else the finalizing Lead.
      let stewardFirstName = null;
      const reviewerId = job.assigned_to || job.lead_reviewed_by;
      if (reviewerId) {
        const { data: tm } = await supabaseAdmin
          .from("team_members").select("first_name").eq("id", reviewerId).maybeSingle();
        stewardFirstName = tm?.first_name || null;
      }
      review = {
        decision: job.decision,
        required_changes: job.required_changes ?? null,
        conditions: job.conditions ?? null,
        reject_reason_code: job.reject_reason_code ?? null,
        steward_notes: bio.steward_notes ?? null,
        decided_at: job.completed_at ?? null,
        steward_first_name: stewardFirstName,
      };
    }

    /* Diff only when the Steward AUTHORED the latest version. A client edit
       stamps created_by; the Steward's in-review bioPatch leaves it null, so
       a null author + a recorded review = a Steward edit. Needs a prior
       version to compare against. */
    if (review && bio.created_by == null) {
      const { data: versions } = await supabaseAdmin
        .from("bios")
        .select("payload")
        .eq("brand_id", brandId)
        .order("version", { ascending: false })
        .limit(2);
      if (Array.isArray(versions) && versions.length === 2) {
        diff = diffBio(versions[1].payload, versions[0].payload);
      }
    }
  }

  let logoRights = [];
  if (bio) { try { logoRights = await loadLogoRights(brandId, bio.payload); } catch { return c.json({ error:"Could not verify logo rights", code:"RIGHTS_LOOKUP_FAILED" }, 503); } }
  const {data:reviewGate,error:gateError}=bio?await supabaseAdmin.from('bio_review_gates').select('status,score,min_score,reasons,job_id,updated_at').eq('bio_id',bio.id).maybeSingle():{data:null};
  if(gateError)return c.json({error:'Could not load review status'},503);
  return c.json({ brand, bio:bio ? {...bio,reviewGate,score:scoreBio(bio.payload,{logoRights}),...foundationStatus(bio.payload,{logoRights}),logoRights} : null, reviewPending, focusCount, review, diff });
});

/* POST /api/bios/:brandId/self-certify
   Stage-1 client attestation. Binds an immutable bio_attestations record to
   the exact BIO version and flips bios.self_certified — which UNLOCKS
   briefing. Editing the BIO creates a new (self_certified=false) version, so
   the attestation auto-lapses. Preconditions are pure: three affirmed
   statements, no missing high-importance field, minimum score. */
app.post("/:brandId/self-certify", requireAuth, async (c) => {
  const { workspaceId, userId } = c.get("auth");
  const brandId = c.req.param("brandId");

  const { data: brand } = await supabaseAdmin
    .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || brand.workspace_id !== workspaceId) return c.json({ error: "Brand not in workspace" }, 403);

  if (!isWorkspaceOwner(c.get("auth"), workspaceId)) return c.json({error:"Only the workspace Owner can confirm the Brand Core",code:"OWNER_REQUIRED"},403);

  const body = await c.req.json().catch(() => ({}));

  const { data: bio } = await supabaseAdmin
    .from("bios").select("id, version, payload").eq("brand_id", brandId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (!bio) return c.json({ error: "No Brand Core to certify yet", code: "NO_BIO" }, 400);
  const review = validateCertificationReview({body,bio});
  if(!review.ok)return c.json(review,review.code==="STALE_BIO"?409:400);

  // Shared gate: statements + field marks + high-importance gaps + min score,
  // then the attestation write + self_certified flip (see lib/self-certify.js).
  const result = await selfCertifyBio({
    brandId, bioId: bio.id, payload: bio.payload || {}, userId,
    statements: body.statements, fieldMarks: body.fieldMarks, statementVersion: body.statementVersion,
    review: review.review,
  });
  if (!result.ok) { const { ok, ...err } = result; return c.json(err, ["STALE_BIO","FOUNDATION_INCOMPLETE"].includes(result.code)?409:result.code==="ATTESTATION_FAILED"?500:400); }

  return c.json({ ok: true, self_certified: true, version: bio.version, score: result.score, attestationId:result.attestationId, attestedAt:result.attestedAt,reviewQueued:result.reviewQueued });
});

/* Owner acceptance of a CD-edited version uses the same deliberate v2 review. */
app.post("/:brandId/accept-changes",requireAuth,async c=>{
 const {workspaceId,userId}=c.get("auth"),brandId=c.req.param("brandId");
 const {data:brand}=await supabaseAdmin.from("brands").select("workspace_id").eq("id",brandId).maybeSingle();
 if(!brand||brand.workspace_id!==workspaceId)return c.json({error:"Brand not in workspace"},403);
 if(!isWorkspaceOwner(c.get("auth"),workspaceId))return c.json({error:"Only the workspace Owner can accept Brand Core changes",code:"OWNER_REQUIRED"},403);
 const body=await c.req.json().catch(()=>({}));
 const {data:bio}=await supabaseAdmin.from("bios").select("id,version,payload,certified,client_acceptance_required,client_accepted_at").eq("brand_id",brandId).order("version",{ascending:false}).limit(1).maybeSingle();
 if(!bio)return c.json({error:"No Brand Core to accept",code:"NO_BIO"},400);
 let logoRights;try{logoRights=await loadLogoRights(brandId,bio.payload);}catch{return c.json({error:"Could not verify logo rights",code:"RIGHTS_LOOKUP_FAILED"},503);}
 const foundation=foundationError(bio.payload,{logoRights});if(foundation)return c.json(foundation,409);
 const invalidAssets=await validateFoundationAssets(brandId,bio.payload?.visual,bio.payload?.visual);
 if(invalidAssets)return c.json({error:invalidAssets,code:"FOUNDATION_INCOMPLETE",state:"foundation_incomplete",credits:0},409);
 const review=validateCertificationReview({body,bio});if(!review.ok)return c.json(review,review.code==="STALE_BIO"?409:400);
 const {data:result,error}=await supabaseAdmin.rpc("accept_bio_client_changes",{p_brand_id:brandId,p_bio_id:bio.id,p_version:body.version,p_user_id:userId,p_review:review.review});
 if(error)return c.json({error:"Could not record acceptance"},500);
 if(!result?.ok)return c.json(result||{error:"Acceptance was not recorded"},409);
 return c.json({...result,version:bio.version});
});

/* POST /api/bios/:brandId/request-review
   Client-initiated: enqueue a Steward re-review of the CURRENT BIO without
   editing it. Idempotent — if an open job already exists for this BIO it
   returns that one instead of stacking duplicates. */
app.post("/:brandId/request-review", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");

  const { data: brand } = await supabaseAdmin
    .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || brand.workspace_id !== workspaceId) return c.json({ error: "Brand not in workspace" }, 403);

  const { data: bio } = await supabaseAdmin
    .from("bios").select("id, version").eq("brand_id", brandId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (!bio) return c.json({ error: "No Brand Core to review yet" }, 400);

  // Idempotency: reuse an existing open job for this BIO.
  const { data: existing } = await supabaseAdmin
    .from("steward_jobs").select("id, status")
    .eq("bio_id", bio.id)
    .in("status", ["queued", "in_review", "pending_lead_review"])
    .limit(1).maybeSingle();
  if (existing) return c.json({ ok: true, jobId: existing.id, status: existing.status, reused: true });

  const { data: job, error } = await supabaseAdmin
    .from("steward_jobs")
    .insert({ bio_id: bio.id, brand_id: brandId, kind: "drift_check", status: "queued" })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabaseAdmin.from("steward_jobs")
        .select("id, status").eq("bio_id", bio.id)
        .in("status", ["queued", "in_review", "pending_lead_review"])
        .limit(1).maybeSingle();
      if (raced) return c.json({ ok: true, jobId: raced.id, status: raced.status, reused: true });
    }
    return c.json({ error: error.message }, 500);
  }

  try { await assignSteward(job.id); } catch (e) { console.warn("[request-review] assignSteward failed:", e?.message || e); }

  return c.json({ ok: true, jobId: job.id, status: "queued", reused: false });
});

export default app;
