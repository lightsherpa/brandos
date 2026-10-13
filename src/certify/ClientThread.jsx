import React from "react";
import { apiFetch } from "../lib/supabase-browser.js";
import { draftsBySection, claimThreadState } from "./cert-chat-model.js";

/* S3 — CD side of the client thread for one steward job. The API answers 404
   when CERTIFIER_V2_S3 is off; then `enabled` stays false and nothing renders. */
export function useCertThread(jobId) {
  const [state, setState] = React.useState({ enabled: false, messages: [] });
  const reload = React.useCallback(async () => {
    if (!jobId) return;
    const res = await apiFetch(`/api/cert-chat/jobs/${jobId}`).catch(() => null);
    if (!res?.ok) { setState({ enabled: false, messages: [] }); return; }
    const json = await res.json();
    setState({ enabled: true, messages: json.messages || [], bio_version: json.bio_version });
  }, [jobId]);
  React.useEffect(() => { reload(); }, [reload]);
  const claims = React.useMemo(() => claimThreadState(state.messages, state.bio_version), [state.messages, state.bio_version]);
  const call = async (path, method, body) => {
    const res = await apiFetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    await reload();
    return json;
  };
  return {
    ...state, claims, reload,
    addDraft: (claimIds, body) => call(`/api/cert-chat/jobs/${jobId}/questions`, "POST", { claim_ids: claimIds, body }),
    editDraft: (id, body) => call(`/api/cert-chat/questions/${id}`, "PATCH", { body }),
    dropDraft: (id) => call(`/api/cert-chat/questions/${id}`, "DELETE"),
    send: (ids) => call(`/api/cert-chat/jobs/${jobId}/send`, "POST", { ids }),
  };
}

/* Layer 1 fields aren't in the focus list, so the composer always offers them. */
export const FOUNDATION_FIELDS = [
  { field: "visual.logo", label: "Logo" }, { field: "visual.palette", label: "Colour roles" },
  { field: "visual.type", label: "Typefaces" }, { field: "visual.imagery", label: "Imagery" },
];
const SECTION_LABEL = { visual: "Foundation", identity: "Strategy", audience: "Strategy", goals: "Strategy", voice: "Guidelines" };
const dot = (color) => <span aria-hidden="true" style={{ color, marginRight: 4 }}>●</span>;

/* One client answer rendered as evidence: text quote and/or the uploaded file. */
export function AnswerEvidence({ answer, sources = [] }) {
  const file = answer.source_id && sources.find((s) => s.id === answer.source_id && s.kind === "file_upload");
  return (
    <div style={{ fontSize: 11.5, color: "var(--c-dim)", lineHeight: 1.4, marginTop: 4 }}>
      {dot("var(--green-600)")}<strong style={{ color: "var(--c-ink)", fontWeight: 600 }}>New evidence</strong> · client answer
      {answer.body && <div style={{ marginTop: 2, color: "var(--c-ink)" }}>“{answer.body}”</div>}
      {file && (
        <div style={{ marginTop: 2 }}>
          {file.evidence_url ? <a href={file.evidence_url} target="_blank" rel="noreferrer">{file.src} <span aria-hidden="true">↗</span></a> : file.src}
        </div>
      )}
    </div>
  );
}

function DraftRow({ draft, thread, setErr }) {
  const [text, setText] = React.useState(draft.body);
  React.useEffect(() => setText(draft.body), [draft.body]);
  const save = () => { if (text.trim() && text !== draft.body) thread.editDraft(draft.id, text).catch((e) => setErr(e.message)); };
  return (
    <div className="card card--inset" style={{ padding: "8px 10px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-faint)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>{(draft.field_paths || draft.claim_ids).join(", ")}</div>
      <textarea aria-label={`Question about ${(draft.field_paths || draft.claim_ids).join(", ")}`} value={text} onChange={(e) => setText(e.target.value)} onBlur={save}
        rows={2} maxLength={4000} style={{ width: "100%", fontSize: 12, resize: "vertical" }} />
      <button type="button" className="btn btn--link" style={{ fontSize: 11, padding: 0 }} onClick={() => thread.dropDraft(draft.id).catch((e) => setErr(e.message))}>Remove</button>
    </div>
  );
}

function Composer({ thread, fields, setErr }) {
  const [field, setField] = React.useState(fields[0]?.field || "");
  const [text, setText] = React.useState("");
  const add = () => thread.addDraft([field], text.trim()).then(() => setText("")).catch((e) => setErr(e.message));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <select aria-label="Field to ask about" value={field} onChange={(e) => setField(e.target.value)} style={{ fontSize: 12 }}>
        {fields.map((f) => <option key={f.field} value={f.field}>{f.label || f.field}</option>)}
      </select>
      <textarea aria-label="New question for the client" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
        placeholder="Ask the client…" style={{ width: "100%", fontSize: 12, resize: "vertical" }} />
      <button type="button" className="btn btn--link" style={{ fontSize: 11, padding: 0, alignSelf: "flex-start" }} disabled={!field || !text.trim()} onClick={add}>Add to drafts</button>
    </div>
  );
}

export function ClientThread({ thread, sources = [], fields = FOUNDATION_FIELDS }) {
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  if (!thread?.enabled) return null;
  const drafts = draftsBySection(thread.messages);
  const sent = thread.messages.filter((m) => m.author_role === "cd" && m.sent_at);
  const answersFor = (q) => thread.messages.filter((m) => m.author_role === "client" && m.reply_to === q.id);
  const sendSection = async (section) => {
    setBusy(section); setErr(null);
    try { await thread.send(drafts[section].map((d) => d.id)); } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };
  return (
    <div style={{ padding: 20, borderBottom: "1px solid var(--c-line)" }} aria-live="polite">
      <div className="eyebrow" style={{ marginBottom: 12 }}>Client questions · {sent.length}</div>
      <Composer thread={thread} fields={fields} setErr={setErr} />
      {Object.entries(drafts).map(([section, list]) => (
        <div key={section} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <div className="eyebrow" style={{ color: "var(--c-faint)", fontSize: 9.5 }}>{SECTION_LABEL[section] || section} · draft</div>
          {list.map((d) => <DraftRow key={d.id} draft={d} thread={thread} setErr={setErr} />)}
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy === section} onClick={() => sendSection(section)}>
            {busy === section ? "Sending…" : `Send ${list.length} question${list.length === 1 ? "" : "s"} to client`}
          </button>
        </div>
      ))}
      {sent.map((q) => {
        const answers = answersFor(q);
        return (
          <div key={q.id} className="card card--inset" style={{ padding: "8px 10px", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "var(--c-dim)" }}>
              {answers.length ? dot("var(--green-600)") : dot("var(--yellow-800)")}{answers.length ? "Answered" : "Asked"} · <span style={{ fontFamily: "var(--font-mono)" }}>{(q.field_paths || q.claim_ids).join(", ")}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--c-ink)", marginTop: 3 }}>{q.body}</div>
            {answers.map((a) => <AnswerEvidence key={a.id} answer={a} sources={sources} />)}
          </div>
        );
      })}
      {err && <div role="alert" style={{ fontSize: 11.5, color: "var(--pink-500)", marginTop: 6 }}>{err}</div>}
    </div>
  );
}
