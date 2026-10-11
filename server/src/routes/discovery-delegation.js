// /api/discovery/delegation — section-scoped magic links (M3).
//
// Lets a brand owner hand ONE chapter of the working BIO draft to a colleague
// who has no workspace membership. The colleague opens an emailed tokened link
// and can read + fill only that chapter's fields; saving merges into the
// brand's discovery-session draft and notifies the owner.
//
// Security model: the token is the ONLY credential for the two open endpoints.
// Every tokened call re-validates status='pending', and the endpoints are
// strictly chapter-scoped — they never expose or accept fields outside the
// delegated chapter, so a leaked link cannot read or overwrite the rest of the
// BIO. This app is mounted at /api/discovery by the integrator.
//
// CAA-51 (remediating CAA-49 §S2) hardened that model on four axes, without
// changing the flow the user sees:
//   • the raw token is returned ONCE (POST response + invite email) and is
//     never persisted — only `token_hash`, a one-way digest, is stored, and
//     lookups go through that digest;
//   • token-bearing paths are redacted before they reach any log sink;
//   • both open endpoints are rate limited per client IP, with a tighter
//     limiter on lookups that miss (token spraying);
//   • the PATCH body is bounded and schema-checked against the BIO field
//     registry for the delegated chapter.
// The seven-day TTL and the chapter isolation are unchanged.

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { sendEmail } from "../lib/email.js";
import { notify, brandOwnerUserId } from "../lib/notify.js";
import {
  DELEGABLE_CHAPTERS,
  MAX_PAYLOAD_BYTES,
  hashDelegationToken,
  mintDelegationToken,
  validateChapterFields,
} from "../lib/delegation-token.js";
import { createRateLimiter, rateLimitedResponse } from "../lib/rate-limit.js";
// Reuse the perimeter's IP resolver so this route buckets on the same value as
// the app-wide limits — two different trust-proxy policies would be a bug.
import { requestIp } from "../lib/http-policy.js";

const app = new Hono();

// SECURITY (P3 M3): a pending magic-link is a standing read/write credential —
// give it a TTL so a leaked link doesn't live forever.
const DELEGATION_TTL_MS = Number(process.env.DELEGATION_TTL_DAYS || 7) * 86400000;

// The six BIO section names. A delegation is scoped to exactly one of these,
// and it is also the key under discovery_sessions.draft_payload we touch.
// Sourced from the BIO field registry so the route and the payload guard can
// never disagree about what a chapter is.
const SECTIONS = DELEGABLE_CHAPTERS;

/* Rate limits, on top of whatever app-wide perimeter policy CAA-50 applies.
   These are the route-specific budgets: generous enough that a colleague
   filling in a chapter (open the link, read, maybe reload, submit once) never
   sees a 429; tight enough that spraying or replay is uneconomic. In-process —
   see lib/rate-limit.js for the single-instance caveat. */
const createLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60_000 }); // per owner, per hour
const readLimiter = createRateLimiter({ max: 60, windowMs: 10 * 60_000 });   // per IP
const writeLimiter = createRateLimiter({ max: 20, windowMs: 10 * 60_000 });  // per IP
const missLimiter = createRateLimiter({ max: 10, windowMs: 10 * 60_000 });   // per IP, unknown/tampered tokens

/** Apply a limiter; returns a 429 Response when the caller is over budget. */
function throttle(c, limiter, key) {
  const result = limiter.hit(key);
  return result.allowed ? null : rateLimitedResponse(c, result);
}

/* Token endpoints must never be cached — the URL *is* the credential, so a
   shared cache holding the response is a second place it leaks from. */
function noStore(c) {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
}

/* Uniform miss response. Unknown and malformed tokens answer identically so a
   prober can't use the status code to tell "wrong shape" from "no such link". */
function notFound(c) {
  return c.json({ error: "Delegation not found" }, 404);
}

/* The two tokened routes are UNAUTHENTICATED, so they must not hand a database
   error string to an anonymous caller — that is free schema reconnaissance.
   The detail goes to the log (never with the token, which the path redactor
   masks); the caller gets a stable code. */
function internalError(c, where, err) {
  console.error(`[discovery-delegation] ${where}:`, err?.message || err);
  return c.json({ error: "Delegation lookup failed", code: "INTERNAL" }, 500);
}

/**
 * Resolve a tokened request to its delegation row, enforcing shape, existence,
 * status, and TTL. Returns a Response on any failure (fail closed) so callers
 * can `if (lookup.response) return lookup.response`.
 */
async function resolveDelegation(c, token, ip) {
  const tokenHash = hashDelegationToken(token);
  if (!tokenHash) {
    // Malformed — count it against the miss budget and answer like a miss.
    const limited = throttle(c, missLimiter, ip);
    return { response: limited || notFound(c) };
  }

  const { data: del, error } = await supabaseAdmin
    .from("discovery_delegations")
    .select("id, brand_id, session_id, chapter, status, created_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) return { response: internalError(c, "lookup", error) };

  if (!del) {
    const limited = throttle(c, missLimiter, ip);
    return { response: limited || notFound(c) };
  }
  if (del.status !== "pending") {
    return { response: c.json({ error: "Delegation is no longer active", status: del.status }, 410) };
  }
  if (del.created_at && Date.now() - new Date(del.created_at).getTime() > DELEGATION_TTL_MS) {
    await supabaseAdmin.from("discovery_delegations").update({ status: "expired" }).eq("id", del.id);
    return { response: c.json({ error: "This delegation link has expired", status: "expired" }, 410) };
  }

  // Defensive: only ever key into a known section.
  if (!SECTIONS.includes(del.chapter)) {
    return { response: c.json({ error: "Delegation has an invalid chapter" }, 500) };
  }

  return { del };
}

// Minimal HTML escaping for values interpolated into the invite email.
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Build the handoff link. Absolute when APP_URL is configured (matches the
// convention in billing.js / send-notification-email.js), else a relative hash.
function handoffLink(token) {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return base ? `${base}/#/discovery/handoff/${token}` : `#/discovery/handoff/${token}`;
}

/* POST /api/discovery/delegation
   Auth: required. Caller must own the brand (workspace check).
   Body: { brandId, chapter, invitee_email, note? }
   Finds (or creates) the brand's discovery_sessions row, inserts a pending
   delegation storing ONLY the token digest, and emails the invitee a
   section-scoped link.
   Returns: { ok:true, token, link, chapter } — the one and only time the raw
   token is ever disclosed. */
app.post("/delegation", requireAuth, async (c) => {
  const { workspaceId, userId } = c.get("auth");

  // Minting a credential + sending mail is the expensive side of this route;
  // budget it per caller so a compromised session can't spray invites.
  const limited = throttle(c, createLimiter, `create:${userId || workspaceId || requestIp(c)}`);
  if (limited) return limited;

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const brandId = body?.brandId;
  const chapter = String(body?.chapter || "");
  const inviteeEmail = String(body?.invitee_email || "").trim().toLowerCase();
  const note = body?.note ? String(body.note) : null;

  if (!brandId) return c.json({ error: "brandId required" }, 400);
  if (!SECTIONS.includes(chapter)) {
    return c.json({ error: `chapter must be one of ${SECTIONS.join("|")}`, code: "BAD_CHAPTER" }, 400);
  }
  if (!inviteeEmail || !inviteeEmail.includes("@")) {
    return c.json({ error: "invitee_email required", code: "BAD_EMAIL" }, 400);
  }

  // Ownership check — brand must belong to the caller's workspace.
  const { data: brand, error: brandErr } = await supabaseAdmin
    .from("brands")
    .select("id, name, workspace_id")
    .eq("id", brandId)
    .maybeSingle();
  if (brandErr) return c.json({ error: brandErr.message }, 500);
  if (!brand || brand.workspace_id !== workspaceId) return c.json({ error: "Brand not in workspace" }, 403);

  // Find (or create) the brand's single discovery session — its id is the
  // session_id the delegation binds to. draft_payload starts as {}.
  let { data: session, error: sessErr } = await supabaseAdmin
    .from("discovery_sessions")
    .select("id")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (sessErr) return c.json({ error: sessErr.message }, 500);
  if (!session) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("discovery_sessions")
      .insert({ brand_id: brandId, workspace_id: workspaceId, draft_payload: {} })
      .select("id")
      .single();
    if (createErr) return c.json({ error: createErr.message }, 500);
    session = created;
  }

  // Mint once, persist only the digest. `token` stays in memory for the
  // response + the email and is deliberately never written anywhere else.
  const { token, tokenHash } = mintDelegationToken();
  const { error: insErr } = await supabaseAdmin
    .from("discovery_delegations")
    .insert({
      brand_id: brandId,
      session_id: session.id,
      chapter,
      invitee_email: inviteeEmail,
      token_hash: tokenHash,
      status: "pending",
      note,
    });
  if (insErr) return c.json({ error: insErr.message }, 500);

  const link = handoffLink(token);

  // Email the invitee. A send failure must not fail the request — the owner
  // still gets the link back to share manually.
  try {
    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px">
      <h2 style="margin:0 0 8px;color:#071437;font-size:18px">You've been asked to fill in a brand section</h2>
      <p style="margin:0 0 16px;color:#4B5675;line-height:1.5">
        You've been invited to complete the <strong>${esc(chapter)}</strong> section of
        <strong>${esc(brand.name || "a brand")}</strong>'s Brand Intelligence Object on BrandOS.
      </p>
      ${note ? `<p style="margin:0 0 16px;color:#4B5675;line-height:1.5">${esc(note)}</p>` : ""}
      <a href="${esc(link)}" style="display:inline-block;background:#F8C036;color:#071437;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open your section</a>
    </div>`;
    await sendEmail({
      to: inviteeEmail,
      subject: `Fill in the ${chapter} section for ${brand.name || "a brand"}`,
      html,
    });
  } catch (err) {
    console.warn("[discovery-delegation] invite email failed:", err?.message || err);
  }

  return c.json({ ok: true, token, link, chapter });
});

/* GET /api/discovery/delegation/:token
   No auth — the token is the credential. Returns ONLY the delegated chapter's
   current fields plus the brand name, never the whole BIO or other chapters.
   404 if the token is unknown or malformed; 410 if it is no longer pending. */
app.get("/delegation/:token", async (c) => {
  noStore(c);
  const ip = requestIp(c);
  const limited = throttle(c, readLimiter, `deleg-read:${ip}`);
  if (limited) return limited;

  const lookup = await resolveDelegation(c, c.req.param("token"), ip);
  if (lookup.response) return lookup.response;
  const del = lookup.del;
  const chapter = del.chapter;

  const { data: session } = await supabaseAdmin
    .from("discovery_sessions")
    .select("draft_payload")
    .eq("id", del.session_id)
    .maybeSingle();
  const { data: brand } = await supabaseAdmin
    .from("brands")
    .select("name")
    .eq("id", del.brand_id)
    .maybeSingle();

  // Scope: expose only this chapter's object, nothing else from the draft.
  const fields = (session?.draft_payload && session.draft_payload[chapter]) || {};

  return c.json({ chapter, brandName: brand?.name || null, fields });
});

/* PATCH /api/discovery/delegation/:token
   No auth — the token is the credential. Body: { fields } (the chapter object).
   Merges ONLY the delegated chapter into draft_payload, leaving every other
   section untouched, marks the delegation returned, and notifies the owner.
   404 if unknown or malformed; 410 if no longer pending; 413/400 if the body
   is oversized or off-schema. Returns: { ok:true } */
app.patch("/delegation/:token", async (c) => {
  noStore(c);
  const ip = requestIp(c);
  const limited = throttle(c, writeLimiter, `deleg-write:${ip}`);
  if (limited) return limited;

  // Reject an oversized body from the header before buffering and parsing it.
  const declaredLength = Number(c.req.header("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return c.json({ error: "Payload too large", code: "PAYLOAD_TOO_LARGE" }, 413);
  }

  // Resolve the credential BEFORE parsing the body: an unknown token should
  // never buy an attacker any parsing work.
  const lookup = await resolveDelegation(c, c.req.param("token"), ip);
  if (lookup.response) return lookup.response;
  const del = lookup.del;
  const chapter = del.chapter;

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  // Bounded + schema-checked against the BIO registry for THIS chapter.
  const checked = validateChapterFields(chapter, body?.fields);
  if (!checked.ok) {
    return c.json({ error: checked.message, code: checked.code }, checked.code === "PAYLOAD_TOO_LARGE" ? 413 : 400);
  }
  const fields = checked.fields;

  // Read-merge-write the draft. We only replace this chapter's key; all other
  // sections are copied through verbatim so a colleague can never clobber them.
  const { data: session, error: sessErr } = await supabaseAdmin
    .from("discovery_sessions")
    .select("draft_payload")
    .eq("id", del.session_id)
    .maybeSingle();
  if (sessErr) return internalError(c, "draft read", sessErr);

  const draft = (session?.draft_payload && typeof session.draft_payload === "object") ? session.draft_payload : {};
  const nextDraft = { ...draft, [chapter]: { ...(draft[chapter] || {}), ...fields } };

  const { error: updErr } = await supabaseAdmin
    .from("discovery_sessions")
    .update({ draft_payload: nextDraft, updated_at: new Date().toISOString() })
    .eq("id", del.session_id);
  if (updErr) return internalError(c, "draft write", updErr);

  const { error: delUpdErr } = await supabaseAdmin
    .from("discovery_delegations")
    .update({ status: "returned", returned_at: new Date().toISOString() })
    .eq("id", del.id);
  if (delUpdErr) return internalError(c, "delegation close", delUpdErr);

  // Notify the brand owner. Fire-and-forget — notify() swallows its own errors.
  await notify({
    recipientUserId: await brandOwnerUserId(del.brand_id),
    kind: "discovery.chapter_returned",
    title: "A colleague filled in a BIO section",
    body: `The ${chapter} section was returned.`,
    link: "#/bio",
    brandId: del.brand_id,
  });

  return c.json({ ok: true });
});

export default app;
