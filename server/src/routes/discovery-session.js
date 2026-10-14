import { requireHumanActor } from "../middleware/human-actor.js";
import {bioIntegrityError} from "../lib/brand-source-integrity.js";
// discovery-session.js — M3 draft lane.
//
// Mounted at /api/discovery. Backs the resumable discovery experience with a
// server-authoritative DRAFT that is edited via autosave WITHOUT creating bios
// versions or steward jobs. Promotion to a real (candidate) bios version
// happens only on attest — which then runs the shared self-cert gate. This is
// what gives save/resume and keeps the certified BIO the agents read untouched
// by in-progress drafts.
//
//   GET   /session/:brandId          → load (or open) the brand's draft session
//   PATCH /session/:brandId          → autosave provided fields onto the draft
//   POST  /session/:brandId/attest   → promote draft → bios version + self-cert

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { normalizeBio } from "../lib/bio-schema.js";
import { scoreBio } from "../lib/score-bio.js";
import { loadLogoRights } from "../lib/foundation-assets.js";
import { payloadHash } from "../lib/bio-hash.js";
import { validateCertificationReview } from "../lib/certification-review.js";
import { isWorkspaceOwner } from "../lib/permissions.js";
import { selfCertifyBio } from "../lib/self-certify.js";
import { prepareClientBioEditPayload } from "../lib/bio-evidence.js";

const app = new Hono();

const SESSION_COLS = "draft_payload, cursor, chapter_status, attested, status";

// Ownership check: return the brand row only when it lives in the caller's
// workspace, else null (the route turns null into a 403).
async function ownedBrand(brandId, workspaceId) {
  const { data: brand } = await supabaseAdmin
    .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  return brand && brand.workspace_id === workspaceId ? brand : null;
}

// Order-insensitive deep compare of two BIO payloads (reuses the cert hash).
const sameJson = (a, b) => payloadHash(a) === payloadHash(b);

/* GET /session/:brandId
   Returns the brand's draft session, creating one seeded from the latest bios
   payload (or an empty canonical BIO) if none exists yet. */
app.get("/session/:brandId", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");
  if (!(await ownedBrand(brandId, workspaceId))) return c.json({ error: "Brand not in workspace" }, 403);

  // Latest bios row — the seed for a fresh draft and the reported bioVersion.
  const { data: latestBio } = await supabaseAdmin
    .from("bios").select("version, payload").eq("brand_id", brandId)
    .order("version", { ascending: false }).limit(1).maybeSingle();

  const integrity=latestBio&&bioIntegrityError(latestBio,{id:brandId});
  if(integrity)return c.json(integrity,409);

  let { data: session } = await supabaseAdmin
    .from("discovery_sessions").select(SESSION_COLS).eq("brand_id", brandId).maybeSingle();

  if (!session) {
    const draft = normalizeBio(latestBio?.payload || {});
    const { data: created, error } = await supabaseAdmin
      .from("discovery_sessions")
      .insert({ brand_id: brandId, workspace_id: workspaceId, draft_payload: draft, status: "active" })
      .select(SESSION_COLS).single();
    if (error) return c.json({ error: error.message }, 500);
    session = created;
  }

  return c.json({ session, bioVersion: latestBio?.version ?? null });
});

/* PATCH /session/:brandId
   Autosave. Updates ONLY the provided fields (+ updated_at) on the brand's
   session; creates the session if a client autosaves before GET. No bios
   version, no steward job. */
app.patch("/session/:brandId", requireAuth, async (c) => {
  const { workspaceId } = c.get("auth");
  const brandId = c.req.param("brandId");
  if (!(await ownedBrand(brandId, workspaceId))) return c.json({ error: "Brand not in workspace" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const patch = { updated_at: new Date().toISOString() };
  if (body.draft_payload !== undefined) patch.draft_payload = body.draft_payload;
  if (body.cursor !== undefined) patch.cursor = body.cursor;
  if (body.chapter_status !== undefined) patch.chapter_status = body.chapter_status;
  if (body.attested !== undefined) patch.attested = body.attested;

  const { data: existing } = await supabaseAdmin
    .from("discovery_sessions").select("id").eq("brand_id", brandId).maybeSingle();

  let row, error;
  if (existing) {
    ({ data: row, error } = await supabaseAdmin
      .from("discovery_sessions").update(patch).eq("brand_id", brandId)
      .select("updated_at").single());
  } else {
    ({ data: row, error } = await supabaseAdmin
      .from("discovery_sessions")
      .insert({ brand_id: brandId, workspace_id: workspaceId, status: "active", ...patch })
      .select("updated_at").single());
  }
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, updated_at: row.updated_at });
});

/* Prepare the exact saved candidate for the shared v2 review modal. This
   publishes edits but never attests them; the Owner must review the returned row. */
app.post("/session/:brandId/prepare-review", requireAuth, async c=>{
 const {workspaceId,userId}=c.get("auth"), brandId=c.req.param("brandId");
 if(!(await ownedBrand(brandId,workspaceId)))return c.json({error:"Brand not in workspace"},403);
 if(!isWorkspaceOwner(c.get("auth"),workspaceId))return c.json({error:"Only the workspace Owner can confirm the Brand Core",code:"OWNER_REQUIRED"},403);
 const {data:session,error:sessionError}=await supabaseAdmin.from("discovery_sessions").select("draft_payload").eq("brand_id",brandId).maybeSingle();
 if(sessionError)return c.json({error:"Could not load the saved draft"},500);
 if(!session)return c.json({error:"No discovery session",code:"NO_SESSION"},400);
 const {data:latest,error:bioError}=await supabaseAdmin.from("bios").select("id,version,payload,self_certified").eq("brand_id",brandId).order("version",{ascending:false}).limit(1).maybeSingle();
 if(bioError)return c.json({error:"Could not load the current Brand Core"},500);
 if(!latest)return c.json({error:"Generate the Brand Core from sources first",code:"NO_BIO"},400);
 const draft=normalizeBio(session.draft_payload||{});
 if(sameJson(normalizeBio(latest.payload),draft))return c.json({bio:{...latest,logoRights:await loadLogoRights(brandId,latest.payload).catch(()=>[])}});
 const payload=prepareClientBioEditPayload(draft,latest.payload||{});
 const logoRights=await loadLogoRights(brandId,payload).catch(()=>[]);
 const {data:appended,error}=await supabaseAdmin.rpc("append_bio_version",{p_brand_id:brandId,p_payload:payload,p_score:scoreBio(payload,{logoRights}),p_created_by:userId,p_discovery_id:null});
 if(error||!appended)return c.json({error:"Could not save the review candidate"},500);
 return c.json({bio:{id:appended.id,version:appended.version,payload,self_certified:false,logoRights}});
});

/* Compatibility endpoint: same v2 contract, validator and atomic receipt as
   /bios/:brandId/self-certify. It never silently promotes an unreviewed draft. */
app.post("/session/:brandId/attest", requireHumanActor, requireAuth, requireHumanActor, async c=>{
 const {workspaceId,userId}=c.get("auth"),brandId=c.req.param("brandId");
 if(!(await ownedBrand(brandId,workspaceId)))return c.json({error:"Brand not in workspace"},403);
 if(!isWorkspaceOwner(c.get("auth"),workspaceId))return c.json({error:"Only the workspace Owner can confirm the Brand Core",code:"OWNER_REQUIRED"},403);
 const body=await c.req.json().catch(()=>({}));
 const {data:bio}=await supabaseAdmin.from("bios").select("id,version,payload").eq("brand_id",brandId).order("version",{ascending:false}).limit(1).maybeSingle();
 if(!bio)return c.json({error:"No Brand Core to review",code:"NO_BIO"},400);
 const review=validateCertificationReview({body,bio});
 if(!review.ok)return c.json(review,review.code==="STALE_BIO"?409:400);
 const {data:session}=await supabaseAdmin.from("discovery_sessions").select("draft_payload").eq("brand_id",brandId).maybeSingle();
 if(session&&!sameJson(normalizeBio(session.draft_payload),normalizeBio(bio.payload)))return c.json({error:"Save and review the updated Brand Core first",code:"STALE_BIO"},409);
 const result=await selfCertifyBio({brandId,bioId:bio.id,payload:bio.payload,userId,statements:body.statements,fieldMarks:body.fieldMarks,statementVersion:body.statementVersion,review:review.review});
 if(!result.ok)return c.json(result,result.code==="STALE_BIO"?409:result.code==="ATTESTATION_FAILED"?500:400);
 return c.json({...result,version:bio.version,self_certified:true});
});

export default app;
