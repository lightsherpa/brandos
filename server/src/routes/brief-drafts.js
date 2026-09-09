// Personal composer recovery records, separate from production brief sharing.
// Dependencies are injectable so route tests exercise the real HTTP contract.
import { Hono } from "hono";
import { hasPermission } from "../lib/permissions.js";

import { isDraftPayload, isObject, isUuid, isRevision } from "../../../shared/brief-draft-payload.js";
const MAX_BYTES = 128 * 1024;

export function createBriefDraftRoutes({ db, authenticate }) {
  const app = new Hono();
  app.use("*", authenticate);
  async function scope(c, brandId, ownerUserId, permission) {
    const auth = c.get("auth");
    if (ownerUserId !== auth.userId) return c.json({ error: "Session changed", code: "DRAFT_SESSION_CHANGED" }, 403);
    if (!isUuid(brandId)) return c.json({ error: "Valid brandId required" }, 400);
    const { data: brand, error } = await db.from("brands").select("id, workspace_id").eq("id", brandId).maybeSingle();
    if (error) return c.json({ error: "Draft storage unavailable" }, 503);
    if (!brand || !hasPermission(auth, permission, brand.workspace_id)) return c.json({ error: "Brand unavailable" }, 403);
    return { owner_user_id: auth.userId, workspace_id: brand.workspace_id, brand_id: brand.id };
  }
  function scoped(query, s) {
    return query.eq("owner_user_id", s.owner_user_id).eq("workspace_id", s.workspace_id).eq("brand_id", s.brand_id);
  }
  app.get("/", async (c) => {
    const s = await scope(c, c.req.query("brandId"), c.req.query("ownerUserId"), "brief.read");
    if (s instanceof Response) return s;
    const { data, error } = await scoped(db.from("brief_drafts").select("*"), s).order("updated_at", { ascending: false });
    if (error) return c.json({ error: "Draft storage unavailable" }, 503);
    return c.json({ drafts: data, workspaceId: s.workspace_id, ownerUserId: s.owner_user_id });
  });
  app.put("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.json({ error: "Invalid draft ID" }, 400);
    const raw = await c.req.text();
    if (new TextEncoder().encode(raw).length > MAX_BYTES) return c.json({ error: "Draft is too large" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    if (!isObject(body) || !isDraftPayload(body.payload) || !isRevision(body.revision) || !isUuid(body.mutationId)) {
      return c.json({ error: "Invalid draft content or revision" }, 400);
    }
    const s = await scope(c, body.brandId, body.ownerUserId, "brief.write");
    if (s instanceof Response) return s;
    if (body.workspaceId !== s.workspace_id) return c.json({ error: "Workspace changed" }, 409);
    const lookup = () => scoped(db.from("brief_drafts").select("*").eq("id", id), s).maybeSingle();
    const current = await lookup();
    if (current.error) return c.json({ error: "Draft storage unavailable" }, 503);
    if (current.data?.mutation_id === body.mutationId) return c.json({ draft: current.data });
    if ((current.data?.revision || 0) !== body.revision) return c.json({ error: "Draft changed in another tab. Your local copy is preserved.", code: "DRAFT_CONFLICT" }, 409);
    const patch = { payload: body.payload, revision: body.revision + 1, mutation_id: body.mutationId, updated_at: new Date().toISOString() };
    const result = current.data
      ? await scoped(db.from("brief_drafts").update(patch).eq("id", id).eq("revision", body.revision), s).select("*").maybeSingle()
      : await db.from("brief_drafts").insert({ id, ...s, ...patch }).select("*").single();
    if (result.error?.code === "23505" || (!result.error && !result.data)) return c.json({ error: "Draft changed. Your local copy is preserved.", code: "DRAFT_CONFLICT" }, 409);
    if (result.error) return c.json({ error: "Draft could not be saved" }, 503);
    return c.json({ draft: result.data });
  });
  return app;
}
