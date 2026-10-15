// PATCH /api/outputs/:id — save the user's edited output body.
// Writes `edited_text` + `edited_at` + `edited_by` INSIDE the existing
// outputs.body JSONB so the original AI output stays intact for audit
// (apis-and-agents-plan §8 — "Per-run audit ... recoverable forever").
// The UI reads body.edited_text if present, else body.text.

import { replaceOutputComponent } from "../lib/output-component.js";
import { assertHumanActor } from "../lib/human-actor.js";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { recordSignal } from "../lib/brandolph-memory.js";
import { canAccessWorkspace, hasPermission } from "../lib/permissions.js";
import { writeAuthorizationAudit } from "../lib/audit.js";

const app = new Hono();

app.patch("/:id", requireAuth, async (c) => {
  const auth = c.get("auth");
  const { userId } = auth;
  const outputId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text : null;
  const component = body.component;
  if (component && !["1", "true"].includes(process.env.REVIEW_DESK_UX)) return c.json({error:"Component replacement is unavailable"}, 404);
  if (text == null && !component) return c.json({ error: "text required" }, 400);

  /* Ownership check via the output → brief → brand → workspace chain */
  const { data: output, error: outErr } = await supabaseAdmin
    .from("outputs")
    .select("id, body, run_id, workflow_status, brief:briefs ( brand_id, brand:brands ( workspace_id ) )")
    .eq("id", outputId)
    .maybeSingle();
  if (outErr || !output) return c.json({ error: "Output not found" }, 404);
  const workspaceId = output.brief?.brand?.workspace_id;
  if (!hasPermission(auth, "output.write", workspaceId)) return c.json({ error: "Forbidden" }, 403);
  if (!["draft", "changes_requested_internal", "changes_requested_client"].includes(output.workflow_status)) {
    return c.json({ error: "This output is locked while it is under review or approved", code: "OUTPUT_LOCKED" }, 409);
  }
  if (auth.scope !== "platform" && output.workflow_status !== "draft") {
    return c.json({ error: "Only the assigned internal team can revise returned work", code: "INTERNAL_REVISION_REQUIRED" }, 403);
  }

  const nowIso = new Date().toISOString();
  let newBody = {
    ...(output.body || {}),
    edited_text: text,
    edited_at:   nowIso,
    edited_by:   userId,
  };

  if (component) {
    try { newBody = replaceOutputComponent(output.body, component, {userId,now:nowIso}); }
    catch(error) { return c.json({error:error.message},400); }
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("outputs")
    .update({ body: newBody })
    .eq("id", outputId)
    .eq("workflow_status", output.workflow_status)
    .select("id, body, status")
    .single();
  if (updErr) return c.json({ error: updErr.message }, 500);

  /* Brandolph memory — every edit is a vote that the AI output wasn't
     quite right. We don't know which specialist ran this without
     joining; cheap to fetch separately, gated on success of update. */
  try {
    const { data: run } = await supabaseAdmin
      .from("runs").select("specialist_id").eq("id", output.run_id).maybeSingle();
    recordSignal({
      brandId:      output.brief?.brand_id,
      kind:         "run.edited",
      specialistId: run?.specialist_id,
      runId:        output.run_id,
      outputId,
      createdBy:    userId,
      payload:      { chars_edited: component ? component.value.length : text.length, ...(component ? {component_path:component.path} : {}) },
    });
  } catch {}

  return c.json({ output: updated });
});

app.delete("/:id", requireAuth, async (c) => {
  const auth = c.get("auth");
  const outputId = c.req.param("id");

  /* Ownership check via the output → brief → brand → workspace chain */
  const { data: output, error: outErr } = await supabaseAdmin
    .from("outputs")
    .select("id, workflow_status, brief:briefs ( brand:brands ( workspace_id ) )")
    .eq("id", outputId)
    .maybeSingle();
  if (outErr || !output) return c.json({ error: "Output not found" }, 404);
  const workspaceId = output.brief?.brand?.workspace_id;
  if (!hasPermission(auth, "output.write", workspaceId)) return c.json({ error: "Forbidden" }, 403);
  if (output.workflow_status !== "draft") return c.json({ error: "Only draft outputs can be deleted", code: "OUTPUT_LOCKED" }, 409);

  const { error: delErr } = await supabaseAdmin
    .from("outputs")
    .delete()
    .eq("id", outputId);
  if (delErr) return c.json({ error: delErr.message }, 500);

  return c.json({ ok: true, id: outputId });
});

app.post("/:id/workflow", requireAuth, async (c) => {
  const auth = c.get("auth");
  const outputId = c.req.param("id");
  const { action, reason = null } = await c.req.json().catch(() => ({}));
  if (["internal_approve", "client_approve"].includes(action)) {
    try { assertHumanActor(auth); } catch (error) { return c.json({error:error.message,code:error.code}, error.status || 403); }
  }
  const { data: output, error } = await supabaseAdmin.from("outputs")
    .select("id,kind,status,body,workflow_status,submitted_by,brief:briefs(brand:brands(workspace_id))")
    .eq("id", outputId).maybeSingle();
  if (error || !output) return c.json({ error: "Output not found" }, 404);
  const workspaceId = output.brief?.brand?.workspace_id;
  if (!canAccessWorkspace(auth, workspaceId)) return c.json({ error: "Forbidden" }, 403);
  const transitions = {
    submit_internal: { from:["draft","changes_requested_internal","changes_requested_client"], to:"submitted_internal", permission:"output.internal_submit", patch:{submitted_by:auth.userId,internal_reviewed_by:null,internal_reviewed_at:null,client_reviewed_by:null,client_reviewed_at:null} },
    internal_approve: { from:["submitted_internal"], to:"internally_approved", permission:"output.internal_approve", patch:{internal_reviewed_by:auth.userId,internal_reviewed_at:new Date().toISOString()} },
    internal_changes: { from:["submitted_internal"], to:"changes_requested_internal", permission:"output.internal_approve", patch:{internal_reviewed_by:auth.userId,internal_reviewed_at:new Date().toISOString()} },
    send_client: { from:["internally_approved"], to:"client_review", permission:"output.internal_approve", patch:{} },
    client_approve: { from:["client_review"], to:"client_approved", permission:"output.client_approve", patch:{client_reviewed_by:auth.userId,client_reviewed_at:new Date().toISOString()} },
    client_changes: { from:["client_review"], to:"changes_requested_client", permission:"output.client_approve", patch:{client_reviewed_by:auth.userId,client_reviewed_at:new Date().toISOString()} },
  };
  const transition = transitions[action];
  if (!transition) return c.json({ error: "Unknown workflow action" }, 400);
  if (["internal_changes", "client_changes"].includes(action) && (!reason || String(reason).trim().length < 3)) {
    return c.json({ error: "A clear change-request reason is required" }, 400);
  }
  if (!hasPermission(auth, transition.permission, workspaceId)) return c.json({ error: "Forbidden", permission: transition.permission }, 403);
  if (!transition.from.includes(output.workflow_status)) return c.json({ error: "Invalid workflow transition", from: output.workflow_status, action }, 409);
  if (action === "internal_approve" && output.submitted_by === auth.userId) return c.json({ error: "Designers cannot internally approve their own submission", code: "SEPARATION_OF_DUTY" }, 409);
  const next = { workflow_status: transition.to, ...transition.patch };
  if (["task", "task_rerun"].includes(output.kind)) {
    if (["internal_approve", "client_approve"].includes(action)) next.status = "approved";
    else if (action !== "send_client") next.status = "needs_review";
  }
  if (["internal_changes", "client_changes"].includes(action)) {
    let savedBody = output.body || {};
    if (["task", "task_rerun"].includes(output.kind) && typeof savedBody === "string") {
      try { savedBody = JSON.parse(savedBody); } catch { return c.json({error:"Task output cannot be decoded",code:"INVALID_TASK_OUTPUT"},409); }
    }
    const priorNotes = Array.isArray(savedBody?.workflow_notes) ? savedBody.workflow_notes : [];
    next.body = {
      ...savedBody,
      workflow_notes: [...priorNotes, {
        stage: action === "client_changes" ? "client" : "internal",
        reason: String(reason).trim(),
        by: auth.userId,
        at: new Date().toISOString(),
      }].slice(-20),
    };
  }
  const { data: updated, error: updateError } = await supabaseAdmin.from("outputs").update(next).eq("id", outputId).eq("workflow_status", output.workflow_status).select().single();
  await writeAuthorizationAudit(c, { permission: transition.permission, action, targetType:"output", targetId:outputId, workspaceId, priorState:{workflow_status:output.workflow_status}, newState:updated, outcome:updateError?"failure":"success", reason });
  return updateError ? c.json({ error:updateError.message },409) : c.json({ output:updated });
});

export default app;
