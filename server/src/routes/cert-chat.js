// ─────────────────────────────────────────────────────────────────────
// Certifier v2 S3 — Creative Director ↔ client questions (flag CERTIFIER_V2_S3).
//
// CD side (steward role, same job-assignment rule as /api/steward/jobs/:id):
//   GET    /api/cert-chat/jobs/:jobId              → whole thread incl. drafts
//   POST   /api/cert-chat/jobs/:jobId/questions    → draft { claim_ids, body }
//   PATCH  /api/cert-chat/questions/:id            → edit a draft { body }
//   DELETE /api/cert-chat/questions/:id            → drop a draft
//   POST   /api/cert-chat/jobs/:jobId/send         → batch-send { ids } (1 email + badge)
// Client side (workspace member of the brand):
//   GET    /api/cert-chat/brands/:brandId          → sent questions + answers
//   POST   /api/cert-chat/brands/:brandId/answers  → { question_id, idempotency_key, body?, source_id? }
//
// An answer becomes evidence: text → bio_sources kind 'client_answer'; a file
// is first uploaded through POST /api/bios/:brandId/sources/upload and its
// source_id attached. Answers never write bios — only a CD Fix does.
// author_role is derived from the caller, never the body, so nothing else
// (e.g. the certifier agent) can post.
// ─────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import { BIO_FIELDS } from "../lib/bio-schema.js";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { hasPermission } from "../lib/permissions.js";
import { notify, brandOwnerUserId } from "../lib/notify.js";
import { requireSteward } from "./steward.js";

const app = new Hono();
export const certChatEnabled = () => String(process.env.CERTIFIER_V2_S3 || "").toLowerCase() === "true";
const FIELD_PATHS = new Set(BIO_FIELDS.map((f) => f.path.join(".")));
export const claimId = (brandId, version, path) => createHash("sha256")
  .update(JSON.stringify([brandId, version, path])).digest("hex");
const CLOSED = new Set(["completed", "cancelled", "rejected", "decertified", "closed", "certified"]);
const MSG_COLS = "id, job_id, bio_version, claim_ids, field_paths, author_role, reply_to, body, source_id, sent_at, created_at";

app.use("*", async (c, next) => (certChatEnabled() ? next() : c.json({ error: "Not found", code: "FLAG_OFF" }, 404)));

const cleanBody = (v) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= 4000 ? s : null;
};

/* Steward may act on a job when it's unassigned, theirs, or they're a Lead. */
async function loadJob(c, jobId) {
  const steward = c.get("steward");
  const { data: job } = await supabaseAdmin
    .from("steward_jobs").select("id, brand_id, bio_id, status, assigned_to").eq("id", jobId).maybeSingle();
  if (!job) return { error: c.json({ error: "Job not found" }, 404) };
  const isLead = (steward.roles || []).includes("lead_steward");
  if (job.assigned_to && job.assigned_to !== steward.id && !isLead) {
    return { error: c.json({ error: "Job assigned to another Creative Director" }, 403) };
  }
  const { data: bio, error: bioErr } = await supabaseAdmin
    .from("bios").select("version, certified").eq("id", job.bio_id).maybeSingle();
  if (bioErr || !bio) return { error: c.json({ error: "Brand Core not found" }, 404) };
  if (CLOSED.has(job.status) || bio.certified) {
    return { error: c.json({ error: "Job is closed or certified", code: "JOB_CLOSED" }, 409) };
  }
  return { job: { ...job, bio_version: bio.version } };
}

async function loadDraft(c, id) {
  const { data: msg } = await supabaseAdmin
    .from("cert_messages").select("id, job_id, author_role, sent_at").eq("id", id).maybeSingle();
  if (!msg || msg.author_role !== "cd") return { error: c.json({ error: "Question not found" }, 404) };
  if (msg.sent_at) return { error: c.json({ error: "Question already sent", code: "ALREADY_SENT" }, 409) };
  const { error } = await loadJob(c, msg.job_id);
  return error ? { error } : { msg };
}

app.get("/jobs/:jobId", requireAuth, requireSteward, async (c) => {
  const { job, error } = await loadJob(c, c.req.param("jobId"));
  if (error) return error;
  const { data, error: dbErr } = await supabaseAdmin
    .from("cert_messages").select(MSG_COLS).eq("job_id", job.id).order("created_at", { ascending: true });
  if (dbErr) return c.json({ error: dbErr.message }, 500);
  return c.json({ messages: data || [], bio_version: job.bio_version });
});

app.post("/jobs/:jobId/questions", requireAuth, requireSteward, async (c) => {
  const { job, error } = await loadJob(c, c.req.param("jobId"));
  if (error) return error;
  const input = await c.req.json().catch(() => ({}));
  const body = cleanBody(input.body);
  const claimIds = Array.isArray(input.claim_ids) ? [...new Set(input.claim_ids.map(String))] : [];
  if (!body) return c.json({ error: "body required (≤ 4000 chars)" }, 400);
  if (claimIds.length === 0 || claimIds.length > 20 || !claimIds.every((id) => FIELD_PATHS.has(id))) {
    return c.json({ error: "claim_ids must be 1–20 Brand Core schema field paths" }, 400);
  }
  const { data, error: dbErr } = await supabaseAdmin.from("cert_messages").insert({
    brand_id: job.brand_id, job_id: job.id, bio_version: job.bio_version,
    field_paths: claimIds, claim_ids: claimIds.map((path) => claimId(job.brand_id, job.bio_version, path)), author_role: "cd",
    author_user_id: c.get("auth").userId, body,
  }).select(MSG_COLS).single();
  if (dbErr) return c.json({ error: dbErr.message }, 500);
  return c.json({ message: data });
});

app.patch("/questions/:id", requireAuth, requireSteward, async (c) => {
  const { msg, error } = await loadDraft(c, c.req.param("id"));
  if (error) return error;
  const body = cleanBody((await c.req.json().catch(() => ({}))).body);
  if (!body) return c.json({ error: "body required (≤ 4000 chars)" }, 400);
  const { data, error: dbErr } = await supabaseAdmin
    .from("cert_messages").update({ body }).eq("id", msg.id).is("sent_at", null).select(MSG_COLS).single();
  if (dbErr) return c.json({ error: dbErr.message }, 500);
  return c.json({ message: data });
});

app.delete("/questions/:id", requireAuth, requireSteward, async (c) => {
  const { msg, error } = await loadDraft(c, c.req.param("id"));
  if (error) return error;
  await supabaseAdmin.from("cert_messages").delete().eq("id", msg.id).is("sent_at", null);
  return c.json({ ok: true });
});

app.post("/jobs/:jobId/send", requireAuth, requireSteward, async (c) => {
  const { job, error } = await loadJob(c, c.req.param("jobId"));
  if (error) return error;
  const { ids } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return c.json({ error: "ids[] required" }, 400);
  const { data, error: dbErr } = await supabaseAdmin
    .from("cert_messages").update({ sent_at: new Date().toISOString() })
    .eq("job_id", job.id).eq("author_role", "cd").is("sent_at", null).in("id", ids.map(String))
    .select("id");
  if (dbErr) return c.json({ error: dbErr.message }, 500);
  const sent = data?.length || 0;
  if (sent > 0) {
    // One notification per batch → one in-app badge + one email to the Owner.
    await notify({
      recipientUserId: await brandOwnerUserId(job.brand_id),
      kind: "cert.questions",
      eventKey: `cert.questions:${job.id}:${data.map((m) => m.id).sort().join(",")}`,
      title: `Your Creative Director has ${sent} question${sent === 1 ? "" : "s"}`,
      body: "Open your Brand Core to answer. You can reply in text or attach a file.",
      link: "#/bio",
      brandId: job.brand_id,
    });
  }
  return c.json({ sent });
});

/* Client: a workspace-scoped member of the brand's workspace (platform staff
   can't answer as the client). */
async function loadClientBrand(c, brandId) {
  const auth = c.get("auth");
  const { data: brand } = await supabaseAdmin
    .from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
  if (!brand || auth?.scope !== "workspace" || !hasPermission(auth, "bio.propose", brand.workspace_id)) {
    return { error: c.json({ error: "Brand not in workspace" }, 403) };
  }
  return { brand };
}

app.get("/brands/:brandId", requireAuth, async (c) => {
  const { brand, error } = await loadClientBrand(c, c.req.param("brandId"));
  if (error) return error;
  const { data, error: dbErr } = await supabaseAdmin
    .from("cert_messages").select("id, bio_version, claim_ids, field_paths, author_role, reply_to, body, source_id, sent_at")
    .eq("brand_id", brand.id).not("sent_at", "is", null).order("sent_at", { ascending: true });
  if (dbErr) return c.json({ error: dbErr.message }, 500);
  return c.json({ messages: data || [] });
});

app.post("/brands/:brandId/answers", requireAuth, async (c) => {
  const { brand, error } = await loadClientBrand(c, c.req.param("brandId"));
  if (error) return error;
  const input = await c.req.json().catch(() => ({}));
  const body = cleanBody(input.body);
  const sourceId = input.source_id ? String(input.source_id) : null;
  if (!body && !sourceId) return c.json({ error: "body or source_id required" }, 400);

  const key = input.idempotency_key;
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    return c.json({ error: "idempotency_key required (8–128 letters, numbers, _ or -)" }, 400);
  }
  // Evidence and answer are committed together. The DB serializes retries and
  // rejects key reuse with a different question/body/upload.
  const { data, error: dbErr } = await supabaseAdmin.rpc("answer_cert_question", {
    p_brand_id: brand.id, p_user_id: c.get("auth").userId,
    p_question_id: String(input.question_id || ""), p_key: key,
    p_body: body, p_source_id: sourceId,
  });
  if (dbErr) return c.json({ error: dbErr.message }, 500);
  if (!data?.ok) return c.json({ error: data?.error || "Answer failed", code: data?.code }, data?.status || 500);
  return c.json({ message: data.message });
});

export default app;
