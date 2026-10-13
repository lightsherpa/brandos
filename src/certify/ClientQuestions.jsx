import React from "react";
import { apiFetch } from "../lib/supabase-browser.js";
import { withUploadType } from "../lib/upload-type.js";
import { openQuestions } from "./cert-chat-model.js";

/* S3 — client side: "Your Creative Director has n questions" on the Brand Core
   page. Renders nothing when CERTIFIER_V2_S3 is off (API 404) or nothing is open.
   Only sent CD questions reach this component; the client never sees drafts or
   anything assistant-made. An answer is evidence for the CD — it never edits
   the Brand Core. */
const FONT_EXT = /\.(otf|ttf|woff2?)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

function AnswerForm({ brandId, question, onDone }) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [family, setFamily] = React.useState("");
  const [license, setLicense] = React.useState("commercial");
  const [rights, setRights] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const isFont = file && FONT_EXT.test(file.name);
  const isVisual = file && (isFont || IMAGE_EXT.test(file.name));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      let sourceId = null;
      if (file) {
        // Reuse the existing source upload; the answer only links the new row.
        const form = new FormData();
        form.set("file", withUploadType(file));
        form.set("bucket", isVisual ? "visual" : "foundations");
        if (isVisual) form.set("rightsConfirmed", String(rights));
        if (isFont) { form.set("assetRole", "font"); form.set("fontFamily", family); form.set("licenseType", license); }
        const up = await apiFetch(`/api/bios/${brandId}/sources/upload`, { method: "POST", body: form });
        const upJson = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upJson.error || "Upload failed");
        sourceId = upJson.source?.id;
      }
      const res = await apiFetch(`/api/cert-chat/brands/${brandId}/answers`, {
        method: "POST",
        body: JSON.stringify({ question_id: question.id, body: text.trim() || undefined, source_id: sourceId || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Answer failed");
      onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
      <textarea aria-label="Your answer" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder="Type your answer…" style={{ fontSize: 13 }} />
      <input type="file" aria-label="Attach a file" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.pptx,.txt,.md,.otf,.ttf,.woff,.woff2"
        onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {isFont && (
        <div style={{ display: "flex", gap: 6 }}>
          <input aria-label="Font family name" required value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Font family name" style={{ flex: 1 }} />
          <select aria-label="Font licence" value={license} onChange={(e) => setLicense(e.target.value)}>
            <option value="commercial">Commercial</option><option value="open_source">Open source</option>
            <option value="custom">Custom</option><option value="system">System</option>
          </select>
        </div>
      )}
      {isVisual && (
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} required /> We have the right to use this file for the brand</label>
      )}
      {err && <div role="alert" style={{ fontSize: 12, color: "var(--pink-500)" }}>{err}</div>}
      <button type="submit" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }} disabled={busy || (!text.trim() && !file)}>
        {busy ? "Sending…" : "Send answer"}
      </button>
    </form>
  );
}

export function ClientQuestions({ brandId }) {
  const [messages, setMessages] = React.useState(null);
  const load = React.useCallback(async () => {
    if (!brandId) return;
    const res = await apiFetch(`/api/cert-chat/brands/${brandId}`).catch(() => null);
    setMessages(res?.ok ? (await res.json()).messages || [] : null);
  }, [brandId]);
  React.useEffect(() => { load(); }, [load]);
  return messages ? <QuestionsPanel brandId={brandId} open={openQuestions(messages)} onDone={load} /> : null;
}

export function QuestionsPanel({ brandId, open, onDone }) {
  if (open.length === 0) return null;
  return (
    <section className="card" data-testid="cd-questions" aria-live="polite" style={{ padding: "14px 16px", marginBottom: 18 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>
        Your Creative Director has {open.length} question{open.length === 1 ? "" : "s"}
      </h2>
      <p style={{ fontSize: 12, color: "var(--c-dim)", margin: "0 0 8px" }}>Answers go to your Creative Director as evidence. Your Brand Core only changes when they update it.</p>
      {open.map((q) => (
        <div key={q.id} className="card card--inset" style={{ padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: "var(--c-ink)" }}>{q.body}</div>
          <AnswerForm brandId={brandId} question={q} onDone={onDone} />
        </div>
      ))}
    </section>
  );
}
