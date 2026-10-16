import {canInspectDelivery,combinedDeliveryStatus,deliveryDocument} from '../shared/grouped-deliverables.js';
import {deliveryCopy} from './locales/grouped-deliverables-copy.js';
import { useLocale } from "./lib/i18n.js";
import { taskMetricsLabel, loadSavedTasks, statusLabel } from "./lib/task-output.js";
import React from "react";
import { apiFetch } from "./lib/supabase-browser.js";

// Task pipeline run board (feat/task-pipeline). One card per deliverable,
// stage progress as verbs, skeletons + ETA, progressive results, and the
// task keeps running server-side if the user leaves (resumed from storage).
const { useState, useEffect, useRef } = React;

const STAGES = ["Planning", "Writing", "Imaging", "Checking", "Fixing", "Ready"];
const TYPES = {
  social_post: { label: "Social post", hint: "3 Instagram posts, 1 image each", writer: "Social Captions", skills: "Headlines", reviewer: "Voice QA + Brand Consistency" },
  email_sequence: { label: "Email sequence", hint: "3 branded HTML emails", writer: "Email Sequence", skills: "Subject Lines, Conversion Copy", reviewer: "Voice QA" },
};
const STATUS_DOT = { queued: "#a8a29e", writing: "#a16207", imaging: "#a16207", checking: "#a16207", fixing: "#b45309", ready: "#15803d", flagged: "#b91c1c" };
const STATUS_WORD = { queued: "Queued", writing: "Writing", imaging: "Designing", checking: "Checking", fixing: "Fixing", ready: "Needs review", flagged: "Needs review", approved: "Approved", needs_review: "Needs review", failed: "Failed" };
const storageKey = (brandId) => `brandos.task.${brandId}`;
const RULE_CHECKS = new Set(["BANNED", "BRIEF_BANNED", "voice_on_brand", "no_unsupported_claim"]);

const css = {
  page: { maxWidth: 1180, margin: "0 auto", padding: "28px 24px 80px", fontFamily: "'Instrument Sans', system-ui, sans-serif", color: "var(--c-ink, #1c1917)" },
  h1: { fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 34, margin: "0 0 4px" },
  card: { background: "var(--c-card, #fff)", border: "1px solid var(--c-line, #e7e5e4)", borderRadius: 8, overflow: "hidden" },
  primary: { background: "#1c1917", color: "#fff", border: 0, borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  secondary: { background: "transparent", color: "#1c1917", border: "1px solid #d6d3d1", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer" },
  dim: { color: "var(--c-dim, #78716c)", fontSize: 12 },
};

function Status({ status, item }) {
  const {locale}=useLocale(),c=deliveryCopy(locale);
  const state=combinedDeliveryStatus({runs:[{status:status==='approved'?'completed':status}],parts:[{status,approved:status==='approved',qa:item?.qa,quarantined:item?.quality_gated&&!['ready','approved'].includes(item.status)}],complete:!!item?.html,finished:!['queued','running','writing','imaging','checking','fixing'].includes(status)});
  return <span className={'gd-status gd-status--'+state}>{c[state]}</span>;
}

function Stepper({ stage, status }) {
  const at = stage === "Flagged" ? 5 : Math.max(0, STAGES.indexOf(stage));
  return (
    <ol style={{ display: "flex", gap: 6, listStyle: "none", padding: 0, margin: "16px 0", flexWrap: "wrap" }}>
      {STAGES.map((s, i) => {
        const done = i < at || (i === at && (status === "ready" || status === "flagged" || status === "approved"));
        const live = i === at && !done;
        return <li key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: done || live ? "#1c1917" : "#a8a29e" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: done ? "#15803d" : live ? "#a16207" : "#d6d3d1" }} />
          {s === "Ready" && status !== "approved" ? "Needs review" : s === "Imaging" ? "Designing" : s}{i < STAGES.length - 1 && <span style={{ color: "#d6d3d1", marginLeft: 6 }}>—</span>}
        </li>;
      })}
    </ol>
  );
}

function Skeleton({ type }) {
  return <div style={{ ...css.card, padding: 14 }}>
    <div style={{ background: "#f5f5f4", borderRadius: 4, aspectRatio: type === "social_post" ? "4 / 5" : "3 / 4", animation: "tpPulse 1.6s ease-in-out infinite" }} />
    <div style={{ height: 10, background: "#f5f5f4", borderRadius: 4, marginTop: 12, width: "80%" }} />
    <div style={{ height: 10, background: "#f5f5f4", borderRadius: 4, marginTop: 8, width: "55%" }} />
  </div>;
}

function Preview({ type, html, scale }) {
  if (!html) return null;
  if (type === "social_post") {
    return <div style={{ width: "100%", aspectRatio: "4 / 5", overflow: "hidden", position: "relative", background: "#f5f5f4" }}>
      <iframe title="post" srcDoc={html} sandbox="" style={{ border: 0, width: 1080, height: 1350, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }} />
    </div>;
  }
  return <iframe title="email" srcDoc={html} sandbox="" style={{ border: 0, width: "100%", height: 560, background: "#fff" }} />;
}

function CheckPanel({ checks = [], review = [], onSaveRule }) {
  const all = [...checks, ...review];
  const failed = all.filter((c) => !c.pass);
  return <details open={failed.length > 0} style={{ borderTop: "1px solid #e7e5e4", padding: "8px 14px" }}>
    <summary style={{ cursor: "pointer", fontSize: 12 }}>{failed.length ? `${failed.length} issue${failed.length > 1 ? "s" : ""}` : "All checks passed"} · {all.length} checks</summary>
    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
      {all.map((c, i) => <li key={c.id + i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, padding: "3px 0" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 4, flex: "none", background: c.pass ? "#15803d" : c.severity === "soft" ? "#b45309" : "#b91c1c" }} />
        <span style={{ flex: 1 }}><strong style={{ fontWeight: 600 }}>{c.id.replace(/_/g, " ").toLowerCase()}</strong> <span style={css.dim}>{c.reason}</span></span>
        {!c.pass && RULE_CHECKS.has(c.id) && onSaveRule && <button style={css.secondary} onClick={() => onSaveRule(c)}>Save as rule</button>}
      </li>)}
    </ul>
  </details>;
}

function RuleForm({ check, onCancel, onSave }) {
  const guess = (String(check.reason).match(/:\s*([^.(]+)/) || [])[1] || "";
  const [value, setValue] = useState(guess.split(",")[0].trim());
  const [reason, setReason] = useState(check.reason);
  const [kind, setKind] = useState(check.id.includes("BANNED") ? "banned_word" : "guideline");
  return <div style={{ padding: "10px 14px", borderTop: "1px solid #e7e5e4", background: "#fafaf9", fontSize: 12, display: "grid", gap: 6 }}>
    <label>Rule type <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="banned_word">Never use this word or phrase</option><option value="guideline">Guideline</option></select></label>
    <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Word, phrase or guideline" style={{ padding: 6, border: "1px solid #d6d3d1", borderRadius: 4 }} />
    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why" style={{ padding: 6, border: "1px solid #d6d3d1", borderRadius: 4 }} />
    <div style={{ display: "flex", gap: 8 }}><button style={css.primary} disabled={!value.trim()} onClick={() => onSave({ kind, value, reason, checkId: check.id })}>Save to Brand Core</button><button style={css.secondary} onClick={onCancel}>Cancel</button></div>
  </div>;
}

function ItemCard({ type, item, taskId, onItem }) {
  const {locale}=useLocale(),c=deliveryCopy(locale),actor=window.useSession?.(),inspect=canInspectDelivery(actor);
  const download=()=>{if(!item.html||item.quality_gated&&!['ready','approved'].includes(item.status))return;const url=URL.createObjectURL(new Blob([deliveryDocument({type:type==='email_sequence'?'email':type,html:item.html,text:item.copy?.caption||'',subject:item.copy?.subject||''},{lang:locale})],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download=`${type}-${item.index+1}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const mainAction=<button style={css.primary} disabled={!item.html||item.quality_gated&&!['ready','approved'].includes(item.status)} onClick={download}>{c.download}</button>;
  const [rule, setRule] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [err, setErr] = useState(null);
  const [rerunsLeft, setRerunsLeft] = useState(2);   // server enforces MAX_RERUNS_PER_ITEM = 2
  const box = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => { const w = box.current?.offsetWidth; if (w) setScale(w / 1080); });
  const copy = showBefore && item.before ? item.before.copy : item.copy;
  const save = async (body) => {
    setErr(null);
    const res = await apiFetch(`/api/tasks/${taskId}/rules`, { method: "POST", body: JSON.stringify({ ...body, index: item.index }) });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Could not save the rule");
    setSaved(j.rule); setRule(null);
  };
  const rerun = async () => {
    setBusy(true); setErr(null);
    const res = await apiFetch(`/api/tasks/${taskId}/items/${item.index}/rerun`, { method: "POST", body: JSON.stringify({ ruleIds: saved ? [saved.id] : undefined }) });
    const j = await res.json(); setBusy(false);
    if (!res.ok) { if (j.code === "RERUN_LIMIT") setRerunsLeft(0); return setErr(res.status === 402 ? `Not enough credits (needs ${j.credits_required ?? "?"}). Nothing was charged.` : (j.error || "Re-run failed")); }
    if (typeof j.reruns_left === "number") setRerunsLeft(j.reruns_left);
    onItem(j.item, j.metrics);
  };
  return <article ref={box} style={css.card}>
    <div style={{padding:14,display:"flex",justifyContent:"flex-end"}}>{mainAction}</div>
    {type === "social_post"
      ? (showBefore && item.before?.image_url ? <img alt="" src={item.before.image_url} style={{ width: "100%", display: "block" }} /> : <Preview type={type} html={item.html} scale={scale} />)
      : <div style={{ padding: "10px 14px", borderBottom: "1px solid #e7e5e4", fontSize: 13 }}><div><strong>{copy?.subject}</strong></div><div style={css.dim}>{copy?.preheader}</div></div>}
    {type === "email_sequence" && !showBefore && <Preview type={type} html={item.html} />}
    <div style={{ padding: "10px 14px", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Status status={busy ? "fixing" : item.status} item={item} />
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {item.rule_applied?.some((r) => r.applied) && <span style={{ fontSize: 11, border: "1px solid #15803d", color: "#15803d", borderRadius: 999, padding: "2px 8px" }}>Rule applied</span>}
          {item.before && <button style={css.secondary} onClick={() => setShowBefore(!showBefore)}>{showBefore ? "Show after" : "Show before"}</button>}
        </span>
      </div>
      {type === "social_post" && copy && <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{copy.caption}<br /><span style={css.dim}>{(copy.hashtags || []).join(" ")}</span></p>}
      {item.before && showBefore && <div style={{ fontSize: 12, color: "#b91c1c" }}>Before: {item.before.failed.map((f) => `${f.id}: ${f.reason}`).join(" · ")}</div>}
      {item.image && <span style={css.dim}>{item.image.reference_count || 0} Brand Core refs · {item.image.ocr?.pass ? "no text detected" : item.image.ocr?.reason || ""}</span>}
      {inspect&&<details><summary>{c.made}</summary><p>{TYPES[type].writer} · {TYPES[type].reviewer}</p></details>}
    </div>
    {inspect&&<CheckPanel checks={item.checks} review={item.review} onSaveRule={item.status === "ready" || item.status === "flagged" ? setRule : null} />}
    {rule && <RuleForm check={rule} onCancel={() => setRule(null)} onSave={save} />}
    {saved && <div style={{ padding: "10px 14px", borderTop: "1px solid #e7e5e4", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span><span style={{ color: "#15803d" }}>●</span> Saved to Brand Core: {saved.kind === "banned_word" ? `never use “${saved.value}”` : saved.value}</span>
      <button style={css.primary} disabled={busy || rerunsLeft <= 0} onClick={rerun}>{busy ? "Rewriting…" : rerunsLeft <= 0 ? "Re-run limit reached" : `Re-run this copy (${rerunsLeft} left)`}</button>
    </div>}
    {err && <div style={{ padding: "6px 14px", fontSize: 12, color: "#b91c1c" }}>{err}</div>}
    <div style={{padding:14,display:"flex",justifyContent:"flex-end"}}>{mainAction}</div>
  </article>;
}

export function TaskPipelineView({ go }) {
  const {t} = useLocale();
  const brandId = window.useCurrentBrandId ? window.useCurrentBrandId() : null;
  const [type, setType] = useState("social_post");
  const [brief, setBrief] = useState("");
  const [heroes, setHeroes] = useState(false);
  const [task, setTask] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [savedTasks, setSavedTasks] = useState([]);
  const selectionRevision = useRef(0);
  const currentBrand = useRef(brandId);
  currentBrand.current = brandId;
  const [error, setError] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const revision = ++selectionRevision.current;
    setTask(null); setTaskId(null); setStartedAt(null); setSavedTasks([]); setError(null);
    if (!brandId) return undefined;
    loadSavedTasks(apiFetch, brandId, localStorage.getItem(storageKey(brandId))).then(result => {
      if (cancelled || currentBrand.current !== brandId) return;
      setSavedTasks(result.tasks);
      if (selectionRevision.current !== revision) return;
      setTaskId(result.selectedId);
      if (result.selectedId) localStorage.setItem(storageKey(brandId), result.selectedId);
    }).catch(error => { if (!cancelled && currentBrand.current === brandId) setError(error.message); });
    return () => { cancelled = true; };
  }, [brandId]);
  useEffect(() => {
    if (!taskId) return undefined;
    let stop = false; let timer;
    const poll = async () => {
      const res = await apiFetch(`/api/tasks/${taskId}`);
      if (stop || currentBrand.current !== brandId) return;
      if (res.status === 404) { localStorage.removeItem(storageKey(brandId)); setTaskId(null); setTask(null); return; }
      const j = await res.json();
      if (stop || currentBrand.current !== brandId) return;
      if (!res.ok) { setError(j.error || "Could not load saved task"); return; }
      setTask(j); setType(j.type);
      setStartedAt(Date.parse(j.created_at));
      if (j.status === "running") timer = setTimeout(poll, 1500);
    };
    poll().catch(error => { if (!stop && currentBrand.current === brandId) setError(error.message); });
    return () => { stop = true; clearTimeout(timer); };
  }, [taskId, brandId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const run = async () => {
    selectionRevision.current += 1;
    const requestedBrand = brandId;
    setError(null); setTask(null);
    const res = await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify({ brandId, type, brief, heroes }) });
    const j = await res.json();
    if (currentBrand.current !== requestedBrand) return;
    if (!res.ok) return setError(res.status === 402 ? `Not enough credits (this task needs ${j.credits_required ?? "?"}, balance ${j.balance ?? "?"}). Nothing was charged.` : (j.error || "Could not start the task"));
    localStorage.setItem(storageKey(brandId), j.id);
    setStartedAt(Date.now()); setTaskId(j.id);
    setTask({ id: j.id, type, status: "running", stage: j.stage, eta_s: j.eta_s, items: [], notices: [] });
  };
  const onItem = (item, metrics) => setTask((t) => ({ ...t, result: metrics ? {...t.result, metrics} : t.result, items: t.items.map((it) => (it.index === item.index ? item : it)) }));

  const running = task?.status === "running";
  const elapsed = startedAt ? Math.round((now - startedAt) / 1000) : 0;
  const remaining = task?.eta_s ? Math.max(0, task.eta_s - elapsed) : null;
  const count = 3;
  const metrics = task?.result?.metrics;

  return <div style={css.page}>
    <style>{"@keyframes tpPulse{0%,100%{opacity:1}50%{opacity:.55}}"}</style>
    <h1 style={css.h1}>Tasks</h1>
    <p style={{ ...css.dim, fontSize: 14, marginTop: 0 }}>{t("taskOutput.taskIntro")}</p>
    {!brandId && <p>Select a brand first.</p>}
    <section style={{ ...css.card, padding: 16, display: "grid", gap: 12, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {Object.entries(TYPES).map(([id, t]) => <button key={id} onClick={() => setType(id)} disabled={running} style={{ flex: 1, textAlign: "left", padding: 12, borderRadius: 8, cursor: "pointer", background: type === id ? "#1c1917" : "#fff", color: type === id ? "#fff" : "#1c1917", border: "1px solid #d6d3d1" }}><div style={{ fontWeight: 600 }}>{t.label}</div><div style={{ fontSize: 12, opacity: 0.75 }}>{t.hint}</div></button>)}
      </div>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="What should this deliverable achieve? Audience, key message, call to action." style={{ padding: 10, border: "1px solid #d6d3d1", borderRadius: 8, font: "inherit" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {type === "email_sequence" ? <label style={{ fontSize: 13 }}><input type="checkbox" checked={heroes} onChange={(e) => setHeroes(e.target.checked)} /> Add a hero image to each email</label> : <span />}
        <button style={css.primary} disabled={!brandId || running || brief.trim().length < 10} onClick={run}>Run</button>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
    </section>

    {savedTasks.length > 0 && <section style={{...css.card,padding:14,marginTop:20}} aria-label={t("taskOutput.savedTasks")}>
      <h2 style={{margin:"0 0 10px",fontSize:18}}>{t("taskOutput.savedTasks")}</h2>
      <div style={{display:"grid",gap:8}}>{savedTasks.map(saved => <button key={saved.id} style={{...css.secondary,textAlign:"left",background:saved.id===taskId?"var(--c-bg, #f5f5f4)":"transparent"}} onClick={() => {if (saved.id === taskId) return; selectionRevision.current += 1; setTask(null);setStartedAt(null);setTaskId(saved.id);localStorage.setItem(storageKey(brandId),saved.id);}}>
        {saved.brief || TYPES[saved.type]?.label || saved.id} · {saved.status === "running" ? t("taskOutput.running") : statusLabel(saved.status,t)}
      </button>)}</div>
    </section>}
    {task && <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 24, margin: 0 }}>{TYPES[task.type]?.label}</h2>
        <span style={css.dim}>{running ? (remaining ? `About ${remaining}s left · you can leave this page, the task keeps running` : "Almost there…") : metrics ? taskMetricsLabel(metrics, t, task.credits) : task.status === "failed" ? task.error : ""}</span>
      </div>
      <p><Status status={task.status} item={{html:task.items?.every(item=>item.html)?"ready":""}} /></p>
      {!running && <p style={css.dim}>{task.status === "approved" ? statusLabel("approved", t) : task.status === "failed" ? t("taskOutput.generationFailed") : t("taskOutput.needsHumanReview")} · <button style={css.secondary} onClick={() => go("library")}>{t("taskOutput.openLibrary")}</button></p>}
      {(task.notices || []).map((n, i) => <div key={i} style={{ fontSize: 12, color: "#b45309", marginBottom: 4 }}>● {n}</div>)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginTop: 12 }}>
        {Array.from({ length: Math.max(count, task.items.length) }, (_, i) => task.items[i]).map((item, i) =>
          item && (item.html || item.status === "ready" || item.status === "flagged")
            ? <ItemCard key={i} type={task.type} item={item} taskId={task.id} onItem={onItem} />
            : <div key={i}><Skeleton type={task.type} /><div style={{ ...css.dim, marginTop: 6 }}><Status status={item?.status || "queued"} /></div></div>)}
      </div>
    </section>}
  </div>;
}

Object.assign(window, { TaskPipelineView });
