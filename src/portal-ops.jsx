import React from "react";
import {Dialog,ActionButton} from "./design-system/primitives.jsx";
import { apiFetch } from "./lib/supabase-browser.js";

const { Icon, PageHeader } = window;
const { useCallback, useEffect, useState } = React;

const pretty = (value) => ({ user: "Member", workspace_admin: "Workspace Admin", platform_admin: "Admin", super_admin: "Super Admin", creative_director: "Creative Director", designer: "Designer" }[value] || String(value || "—").replaceAll("_", " "));
const money = value => value==null||!Number.isFinite(Number(value)) ? "Unknown" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function request(path, options = {}) {
  const response = await apiFetch(path, {
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function Tabs({ value, onChange, items }) {
  const moveFocus = (event, index) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const last = items.length - 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[next][0]);
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className="ops-tabs" role="tablist" aria-label="Page sections">
    {items.map(([id, label, count], index) => <button key={id} id={`ops-tab-${id}`} type="button" role="tab" aria-selected={value === id} aria-controls={`ops-panel-${id}`} tabIndex={value === id ? 0 : -1} className={value === id ? "is-active" : ""} onClick={() => onChange(id)} onKeyDown={(event) => moveFocus(event, index)}>
      {label}{count != null && <span>{count}</span>}
    </button>)}
  </div>;
}

function Notice({ value, clear }) {
  if (!value) return null;
  return <div className={`ops-notice ops-notice--${value.kind || "info"}`} role={value.kind === "error" ? "alert" : "status"} aria-live={value.kind === "error" ? "assertive" : "polite"}>
    <span>{value.text}</span><button type="button" onClick={clear} aria-label="Dismiss notification"><Icon name="close" size={12} /></button>
  </div>;
}

function AdminAccess() {
  const session = window.useSession?.();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [tab, setTab] = useState("internal");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [audit, setAudit] = useState([]);
  const [invite, setInvite] = useState({ email: "", scope: "platform", platformRole: "designer", workspaceId: "", workspaceRole: "user" });
  const canRoles = session?.permissions?.includes("platform.roles.manage");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await request("/api/access/directory");
      setState({ loading: false, error: null, data });
      setInvite((current) => current.workspaceId || !data.workspaces?.[0] ? current : { ...current, workspaceId: data.workspaces[0].id });
    } catch (error) { setState({ loading: false, error: error.message, data: null }); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab !== "audit" || !session?.permissions?.includes("audit.read")) return;
    request("/api/access/audit").then((data) => setAudit(data.events || [])).catch((error) => setNotice({ kind: "error", text: error.message }));
  }, [tab, session?.permissions]);

  const perform = async (key, action, success) => {
    setBusy(key); setNotice(null);
    try { await action(); setNotice({ kind: "success", text: success }); await load(); return true; }
    catch (error) { setNotice({ kind: "error", text: error.message }); return false; }
    finally { setBusy(null); }
  };

  const data = state.data;
  const assigned = (userId, workspaceId) => data?.assignments?.some((item) => item.user_id === userId && item.workspace_id === workspaceId);
  const changeRole = (person, role, active = person.active) => perform(
    `role:${person.user_id}`,
    () => request(`/api/access/platform-members/${person.user_id}`, { method: "PATCH", body: { role, active } }),
    "Internal profile updated.",
  );
  const toggleAssignment = (userId, workspaceId, on) => perform(
    `assignment:${userId}:${workspaceId}`,
    () => request(on ? "/api/access/assignments" : `/api/access/assignments/${workspaceId}/${userId}`, on ? { method: "POST", body: { userId, workspaceId } } : { method: "DELETE" }),
    on ? "Workspace assigned." : "Assignment removed.",
  );
  const submitInvite = (event) => {
    event.preventDefault();
    const body = invite.scope === "platform"
      ? { email: invite.email, platformRole: invite.platformRole }
      : { email: invite.email, workspaceId: invite.workspaceId, workspaceRole: invite.workspaceRole };
    perform("invite", () => request("/api/access/invitations", { method: "POST", body }), "Invitation sent or existing account added.")
      .then((ok) => { if (ok) setInvite((current) => ({ ...current, email: "" })); });
  };

  return <section className="ops-page">
    <PageHeader eyebrow="Governance · People & access" title="People and access" sub="Change personas, assign portfolios, invite collaborators, and review every privileged action." right={<button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={state.loading} aria-busy={state.loading}><Icon name="refresh" size={12} /> {state.loading ? "Refreshing…" : "Refresh"}</button>} />
    <Notice value={notice} clear={() => setNotice(null)} />
    {state.error && <div className="ops-alert" role="alert"><strong>Access directory unavailable.</strong><span>{state.error}</span><button type="button" className="btn btn--ghost btn--sm" onClick={load}>Try again</button></div>}
    {state.loading && !data && <div className="ops-empty ops-empty--loading" role="status"><span className="ops-spinner" aria-hidden="true" />Loading access directory…</div>}
    {data && <>
      <div className="ops-summary">
        <div><b>{data.people.length}</b><span>internal people</span></div>
        <div><b>{data.workspaces.length}</b><span>client workspaces</span></div>
        <div><b>{data.assignments.length}</b><span>portfolio assignments</span></div>
        <div><b>{data.invitations.filter((item) => item.status === "pending").length}</b><span>pending invitations</span></div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[
        ["internal", "Internal team", data.people.length], ["workspaces", "Client access", data.workspaces.length],
        ["invitations", "Invitations", data.invitations.filter((item) => item.status === "pending").length],
        ...(session?.permissions?.includes("audit.read") ? [["audit", "Audit history", null]] : []),
      ]} />

      {tab === "internal" && <div className="ops-panel" id="ops-panel-internal" role="tabpanel" aria-labelledby="ops-tab-internal">
        <div className="ops-panel__head"><div><h2>Internal team</h2><p>Personas control authority. Assignments constrain Creative Directors and Designers to named clients.</p></div></div>
        <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Person</th><th>Persona</th><th>Account</th><th>Assigned clients</th></tr></thead><tbody>
          {data.people.map((person) => <tr key={person.user_id}>
            <td><strong>{person.user?.email || person.user_id}</strong><small>{person.user_id === session?.id ? "You" : "Internal account"}</small></td>
            <td>{canRoles && person.role !== "super_admin" ? <select className="ops-select" value={person.role} disabled={busy === `role:${person.user_id}`} onChange={(event) => changeRole(person, event.target.value)}><option value="platform_admin">Admin</option><option value="creative_director">Creative Director</option><option value="designer">Designer</option></select> : <span className="ops-role">{pretty(person.role)}</span>}</td>
            <td>{canRoles && person.role !== "super_admin" ? <button type="button" className={`ops-state ${person.active ? "is-on" : "is-off"}`} aria-pressed={person.active} disabled={busy === `role:${person.user_id}`} onClick={() => changeRole(person, person.role, !person.active)}>{person.active ? "Active" : "Suspended"}</button> : person.active ? "Active" : "Suspended"}</td>
            <td><div className="ops-assignment-list">{["creative_director", "designer"].includes(person.role) ? data.workspaces.map((workspace) => {
              const on = assigned(person.user_id, workspace.id);
              return <button type="button" key={workspace.id} className={`ops-assignment ${on ? "is-on" : ""}`} aria-pressed={on} disabled={busy === `assignment:${person.user_id}:${workspace.id}`} onClick={() => toggleAssignment(person.user_id, workspace.id, !on)}>{on ? "✓ " : "+ "}{workspace.name}</button>;
            }) : <span className="ops-muted">Global operational scope</span>}</div></td>
          </tr>)}
        </tbody></table></div>
      </div>}

      {tab === "workspaces" && <div className="ops-stack" id="ops-panel-workspaces" role="tabpanel" aria-labelledby="ops-tab-workspaces">{data.workspaces.map((workspace) => <article key={workspace.id} className="ops-panel ops-workspace-card">
        <div className="ops-panel__head"><div><h2>{workspace.name}</h2><p>Tier {workspace.tier} · {workspace.workspace_memberships?.length || 0} members</p></div><button type="button" className="btn btn--ghost btn--sm" onClick={() => { setInvite((current) => ({ ...current, scope: "workspace", workspaceId: workspace.id })); setTab("invitations"); }}>Invite here</button></div>
        <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Ownership</th></tr></thead><tbody>{(workspace.workspace_memberships || []).map((member) => <tr key={member.user_id}><td>{member.user?.email || member.user_id}</td><td><span className="ops-role">{pretty(member.role)}</span></td><td>{member.status}</td><td>{member.is_owner ? <span className="pill pill--yellow">Owner</span> : "—"}</td></tr>)}</tbody></table></div>
      </article>)}</div>}

      {tab === "invitations" && <div className="ops-grid" id="ops-panel-invitations" role="tabpanel" aria-labelledby="ops-tab-invitations">
        <form className="ops-panel ops-form" onSubmit={submitInvite}>
          <div className="ops-panel__head"><div><h2>Invite someone</h2><p>Existing accounts are added immediately. New accounts receive a secure invitation email.</p></div></div>
          <label>Email<input className="input" type="email" required value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} placeholder="name@company.com" /></label>
          <label>Access scope<select className="input" value={invite.scope} onChange={(event) => setInvite((current) => ({ ...current, scope: event.target.value }))}><option value="platform">Internal team</option><option value="workspace">Client workspace</option></select></label>
          {invite.scope === "platform" ? <label>Persona<select className="input" value={invite.platformRole} onChange={(event) => setInvite((current) => ({ ...current, platformRole: event.target.value }))}><option value="super_admin">Super Admin</option><option value="platform_admin">Admin</option><option value="creative_director">Creative Director</option><option value="designer">Designer</option></select></label> : <>
            <label>Workspace<select className="input" value={invite.workspaceId} onChange={(event) => setInvite((current) => ({ ...current, workspaceId: event.target.value }))}>{data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
            <label>Client role<select className="input" value={invite.workspaceRole} onChange={(event) => setInvite((current) => ({ ...current, workspaceRole: event.target.value }))}><option value="user">Member</option><option value="workspace_admin">Workspace Admin</option></select></label>
          </>}
          <button className="btn btn--primary" disabled={busy === "invite"}>{busy === "invite" ? "Sending…" : "Send invitation"}</button>
        </form>
        <div className="ops-panel"><h2>Invitation ledger</h2>{data.invitations.length ? <div className="ops-stack">{data.invitations.map((item) => <div className="ops-invite" key={item.id}><div><strong>{item.email}</strong><small>{pretty(item.platform_role || item.workspace_role)} · {item.workspace_id ? data.workspaces.find((workspace) => workspace.id === item.workspace_id)?.name : "Internal"}</small></div><span className={`pill ${item.status === "pending" ? "pill--yellow" : item.status === "accepted" ? "pill--green" : ""}`}>{item.status}</span>{item.status === "pending" && <button type="button" className="btn btn--ghost btn--sm" disabled={busy === `revoke:${item.id}`} onClick={() => perform(`revoke:${item.id}`, () => request(`/api/access/invitations/${item.id}/revoke`, { method: "POST" }), "Invitation revoked.")}>{busy === `revoke:${item.id}` ? "Revoking…" : "Revoke"}</button>}</div>)}</div> : <div className="ops-empty">No invitations have been created yet.</div>}</div>
      </div>}

      {tab === "audit" && <div className="ops-panel" id="ops-panel-audit" role="tabpanel" aria-labelledby="ops-tab-audit"><div className="ops-panel__head"><div><h2>Authorization audit</h2><p>Append-only privileged actions and denied access attempts.</p></div></div>{audit.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Time</th><th>Action</th><th>Permission</th><th>Target</th><th>Outcome</th></tr></thead><tbody>{audit.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td>{pretty(event.action)}</td><td>{event.permission}</td><td>{event.target_type || "—"}</td><td><span className={`pill ${event.outcome === "allowed" ? "pill--green" : event.outcome === "denied" ? "pill--pink" : ""}`}>{event.outcome}</span></td></tr>)}</tbody></table></div> : <div className="ops-empty">No privileged actions have been recorded yet.</div>}</div>}
    </>}
  </section>;
}

function ExecutionSpend({workspaceId}) {
 const spendMoney=value=>value==null?'Unknown':`$${Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8})}`;
 const [rows,setRows]=useState([]),[error,setError]=useState(null),[resolution,setResolution]=useState(null),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),trigger=React.useRef(null);
 const load=useCallback(async()=>{try{const data=await request(`/api/execution-spend?${new URLSearchParams({workspaceId})}`);setRows(data.holds);setError(null);}catch(e){setError(e.message);}},[workspaceId]);useEffect(()=>{load();},[load]);
 const resolve=async()=>{setBusy(true);try{await request(`/api/execution-spend/${resolution.run_id}/reconcile`,{method:'POST',body:JSON.stringify({amountUsd:Number(amount),reference,reason})});setResolution(null);await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section style={{marginTop:24}}><h3>Execution dollar commitments</h3><p>Text and media share workspace limits. Unknown billing retains the quoted bound, including across months. A completed output does not release unknown charges. An amount above the reserved bound is a billing discrepancy; it cannot prove that the provider respected the ceiling.</p><ActionButton onClick={load}>Refresh dollar commitments</ActionButton>{error&&<p role="alert">{error}</p>}{rows.length>0&&<div className="ops-table-wrap"><table className="ops-table"><caption>Execution spend evidence</caption><thead><tr><th>Run</th><th>State</th><th>Reserved / known / actual</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.run_id}><td>{row.run_id}<small>{row.kind}</small></td><td>{row.state}{row.breached?' · bound exceeded':''}</td><td>{spendMoney(row.max_cost_usd)} / {spendMoney(row.known_subtotal_usd)} / {spendMoney(row.actual_cost_usd)}</td><td><ActionButton disabled={!!row.reconciliation&&row.state!=='discrepancy'||!['completed','failed'].includes(row.run?.status)} onClick={e=>{trigger.current=e.currentTarget;setResolution(row);setAmount('');setReason('');setReference('');setConfirmed(false);}}>Reconcile billing</ActionButton></td></tr>)}</tbody></table></div>}
 {resolution&&<Dialog label="Reconcile execution billing" restoreFocusTo={trigger.current} onClose={()=>{if(!busy)setResolution(null);}}><div style={{padding:24,overflow:'auto'}}><p>{resolution.run_id}</p><p>Enter the verified total for generation, QA, routing and all fees. This records a billing correction; it makes no provider call and does not refund execution credits.</p><label className="ds-field">Verified total USD<input type="number" min="0" step="0.00000001" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="ds-field">Billing evidence reference<input value={reference} onChange={e=>setReference(e.target.value)}/></label><label className="ds-field">Billing reconciliation reason<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I verified the complete bill, including all execution operations and fees.</label><div className="ds-action-row"><ActionButton variant="primary" disabled={busy||!confirmed||amount.trim()===''||!Number.isFinite(Number(amount))||Number(amount)<0||reference.trim().length<8||reason.trim().length<20} onClick={resolve}>Record verified billing</ActionButton><ActionButton disabled={busy} onClick={()=>setResolution(null)}>Cancel</ActionButton></div></div></Dialog>}
 </section>;
}

function TextReconciliation({workspaceId}) {
  const [rows,setRows]=useState([]),[error,setError]=useState(null),[resolution,setResolution]=useState(null),[reason,setReason]=useState(""),[reference,setReference]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
  const trigger=React.useRef(null);
  const load=useCallback(async()=>{try{const data=await request(`/api/text-reconciliation?${new URLSearchParams({workspaceId})}`);setRows(data.executions);setError(null);}catch(error){setError(error.message);}},[workspaceId]);
  useEffect(()=>{load();},[load]);
  const open=(event,row,action)=>{trigger.current=event.currentTarget;setReason("");setReference("");setConfirmed(false);setResolution({row,action});};
  const resolve=async()=>{setBusy(true);try{await request(`/api/text-reconciliation/${resolution.row.run_id}`,{method:'POST',body:JSON.stringify({action:resolution.action,reason,evidence:resolution.action==='confirm_not_billed'?{status:'not_billed_confirmed',reference}:{}})});setResolution(null);await load();}catch(error){setError(error.message);}finally{setBusy(false);}};
  return <section style={{marginTop:24}}><h3>Interrupted text executions</h3><p>Expired heartbeats require reconciliation. Keep uncertain charges and credits held. Recovery uses stored completed output and makes no new generation or QA call.</p>
    <ActionButton onClick={load}>Refresh executions</ActionButton>{error&&<p role="alert">{error}</p>}
    {!rows.length?<p>No interrupted text executions in this workspace.</p>:<div className="ops-table-wrap"><table className="ops-table"><caption>Text execution reconciliation</caption><thead><tr><th>Run / provider receipt</th><th>State</th><th>Evidence</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.run_id}><td>{row.run_id}<small>{row.route}</small><small>{row.provider_receipt_id||'No provider receipt recorded'}</small></td><td>{row.phase}{row.stale?' · heartbeat expired':''}<small>{row.error}</small></td><td>{row.generation_complete?'Completed generation stored':'Complete output unavailable'}<small>{row.provider_possible?'Provider may have billed':'No submission boundary recorded'}</small></td><td><ActionButton disabled={!(row.phase==='reconcile'||row.stale)||!row.generation_complete} onClick={e=>open(e,row,'recover_output')}>Recover stored output</ActionButton><ActionButton disabled={!(row.phase==='reconcile'||row.stale)} onClick={e=>open(e,row,'confirm_not_billed')}>Confirm no provider charge</ActionButton></td></tr>)}</tbody></table></div>}
    {resolution&&<Dialog label="Reconcile text execution" restoreFocusTo={trigger.current} onClose={()=>{if(!busy)setResolution(null);}}><div style={{padding:24,overflow:'auto'}}><p>{resolution.row.run_id}</p><p>{resolution.action==='recover_output'?'Recover the stored generation. Interrupted QA remains flagged for human review.':'Only release credits after verifying that the provider did not accept or bill this task. Unknown charges remain held.'}</p><label className="ds-field">Operator reason<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={20} maxLength={2000}/></label>{resolution.action==='confirm_not_billed'&&<><label className="ds-field">Provider evidence reference<input value={reference} onChange={e=>setReference(e.target.value)} minLength={8}/></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I verified no accepted or billable provider task.</label></>}<div className="ds-action-row"><ActionButton variant="primary" disabled={busy||reason.trim().length<20||resolution.action==='confirm_not_billed'&&(!confirmed||reference.trim().length<8)} onClick={resolve}>{busy?'Reconciling…':resolution.action==='recover_output'?'Recover output':'Confirm and release credits'}</ActionButton><ActionButton disabled={busy} onClick={()=>setResolution(null)}>Cancel</ActionButton></div></div></Dialog>}
  </section>;
}

function ExecutionMeasurements() {
  const [workspaceId,setWorkspaceId]=useState("");
  const [state,setState]=useState({loading:false,data:null,error:null});
  const load=async event=>{
    event.preventDefault();setState({loading:true,data:null,error:null});
    try{setState({loading:false,error:null,data:await request(`/api/opex/measurements?${new URLSearchParams({workspaceId})}`)});}
    catch(error){setState({loading:false,data:null,error:error.message});}
  };
  return <div id="ops-panel-measurements" role="tabpanel" aria-labelledby="ops-tab-measurements" className="ops-panel">
    <h2>Execution outcomes</h2><p>Runs started this month, with their subsequent client reviews and usage. Unknown charges stay unknown. Shadow comparisons are observational.</p>
    <form onSubmit={load} style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}><label>Workspace ID<input className="input" required value={workspaceId} onChange={e=>setWorkspaceId(e.target.value)} /></label><button className="btn btn--ghost" disabled={state.loading}>{state.loading?"Loading…":"Load outcomes"}</button></form>
    {state.error&&<p role="alert">{state.error}</p>}
    {state.data&&<><p>{state.data.coverage.runsWithEvents} of {state.data.coverage.runs} runs have review or execution events. {state.data.coverage.costUnknownRuns} runs have unknown costs.</p>
    <div className="ops-table-wrap"><table className="ops-table"><caption>Platform execution evidence</caption><thead><tr><th>Run</th><th>Cohort / route</th><th>Client accepted</th><th>Revisions / errors</th><th>Time to accepted</th><th>Cost evidence</th></tr></thead><tbody>{state.data.records.map(r=><tr key={r.runId}><td>{r.runId}</td><td>{r.cohort} · {r.routing?.chosenRoute||r.model}{r.routing?.recommendation&&<small>Shadow recommendation: {r.routing.recommendation} · {r.routing.fallback||"chosen"}</small>}</td><td>{r.accepted?"Yes":"Pending"}</td><td>{r.revisions} / {r.errorEvents}</td><td>{r.timeToAcceptedMs==null?"—":`${Math.round(r.timeToAcceptedMs/1000)}s`}</td><td>{r.totalCostUsd==null?`Unknown total; ${money(r.knownCostUsd)} known`:money(r.totalCostUsd)}{r.costs.map((c,i)=><small key={i}>{c.operation}: {c.source} {c.value==null?"—":money(c.value)}</small>)}{r.missingCostOperations.length>0&&<small>Missing: {r.missingCostOperations.join(", ")}</small>}</td></tr>)}</tbody></table></div>
    {!state.data.records.length&&<p>No executions in this period.</p>}<TextReconciliation workspaceId={workspaceId}/><ExecutionSpend workspaceId={workspaceId}/></>}
  </div>;
}

function AdminOpex() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [tab, setTab] = useState("overview");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [dimension, setDimension] = useState("provider");
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState({});
  const [override, setOverride] = useState({ operationKey: "specialist.text", reason: "", ttlMinutes: 15, result: null });

  const load = useCallback(async () => {
    try { setState({ loading: true, error: null, data: null }); setState({ loading: false, error: null, data: await request("/api/opex/overview") }); }
    catch (error) { setState({ loading: false, error: error.message, data: null }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab !== "events") return;
    let active = true;
    setEventsLoading(true);
    request(`/api/opex/events?${new URLSearchParams(eventFilter)}`)
      .then((data) => { if (active) setEvents(data.events || []); })
      .catch((error) => { if (active) setNotice({ kind: "error", text: error.message }); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [tab, eventFilter]);

  const data = state.data, metrics = data?.metrics;
  const saveBudget = async (budget) => {
    setBusy(`budget:${budget.id}`); setNotice(null);
    try {
      const row = document.querySelector(`[data-budget-id="${budget.id}"]`);
      await request(`/api/opex/budgets/${budget.id}`, { method: "PUT", body: {
        monthlyBudgetUsd: row.querySelector("[name=monthly]").value,
        perRequestCeilingUsd: row.querySelector("[name=ceiling]").value,
        maxRequestsPerMinute: row.querySelector("[name=rpm]").value,
        active: row.querySelector("[name=active]").checked,
      } });
      setNotice({ kind: "success", text: `${budget.scope_key} policy saved.` }); await load();
    } catch (error) { setNotice({ kind: "error", text: error.message }); }
    finally { setBusy(null); }
  };
  const issueOverride = async (event) => {
    event.preventDefault(); setBusy("override"); setNotice(null);
    try {
      const data = await request("/api/opex/overrides", { method: "POST", body: override });
      sessionStorage.setItem("ci_opex_override", JSON.stringify(data.override));
      setOverride((current) => ({ ...current, reason: "", result: data.override }));
      setNotice({ kind: "success", text: "Override authorized for the next matching request in this browser session." });
    } catch (error) { setNotice({ kind: "error", text: error.message }); }
    finally { setBusy(null); }
  };
  const drill = (name) => {
    const key = { provider: "provider", model: "model", feature: "feature", specialist: "specialist", workspace: "workspaceId", brand: "brandId", environment: "environment", status: "status", costSource: "costSource" }[dimension];
    setEventFilter(name === "unallocated" ? {} : { [key]: name }); setTab("events");
  };
  const exportCsv = async () => {
    setBusy("export"); setNotice(null);
    try {
      const response = await apiFetch("/api/opex/export.csv");
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "The export could not be prepared.");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = "caastor-api-opex.csv"; link.click(); URL.revokeObjectURL(link.href);
      setNotice({ kind: "success", text: "OPEX export downloaded." });
    } catch (error) { setNotice({ kind: "error", text: error.message }); }
    finally { setBusy(null); }
  };

  return <section className="ops-page">
    <PageHeader eyebrow="Super Admin · FinOps" title="Usage & OPEX" sub="Metered external-service usage, budget policy, allocation coverage, and guarded request overrides." right={<div className="ops-header-actions"><button type="button" className="btn btn--ghost btn--sm" onClick={exportCsv} disabled={busy === "export"}>{busy === "export" ? "Preparing…" : "Export CSV"}</button><button type="button" className="btn btn--ghost btn--sm" onClick={load} disabled={state.loading} aria-busy={state.loading}><Icon name="refresh" size={12} /> {state.loading ? "Refreshing…" : "Refresh"}</button></div>} />
    <Notice value={notice} clear={() => setNotice(null)} />
    {state.error && <div className="ops-alert" role="alert"><strong>Usage data unavailable.</strong><span>{state.error}</span><button type="button" className="btn btn--ghost btn--sm" onClick={load}>Try again</button></div>}
    {state.loading && <div className="ops-empty ops-empty--loading" role="status"><span className="ops-spinner" aria-hidden="true" />Reconciling usage events…</div>}
    {data && <>
      <Tabs value={tab} onChange={setTab} items={[["overview", "Overview", null], ["budgets", "Budgets & breakers", data.budgets.length], ["events", "Request events", metrics.requestCount], ["override", "Override", null], ["measurements", "Execution outcomes", null]]} />
      {tab === "measurements" && <ExecutionMeasurements />}
      {tab === "overview" && <div id="ops-panel-overview" role="tabpanel" aria-labelledby="ops-tab-overview">
        {data.alerts?.map((alert, index) => <div className="ops-alert" role="status" key={index}><strong>Budget attention required.</strong><span>{alert.type === "forecast_exceeds_budget" ? "Forecast exceeds the configured monthly budget." : `Spend crossed the ${alert.threshold}% budget threshold.`}</span></div>)}
        <div className="ops-command"><div><span>Known MTD spend</span><b>{money(metrics.spend)}</b></div><div><span>Known-spend forecast</span><b>{money(metrics.forecast)}</b></div><div><span>Prior-period change</span><b>{metrics.priorPeriodChange == null ? "—" : `${metrics.priorPeriodChange >= 0 ? "+" : ""}${(metrics.priorPeriodChange * 100).toFixed(1)}%`}</b></div><div><span>Cost coverage</span><b>{(metrics.costCoverage * 100).toFixed(1)}%</b></div><div><span>Cost / approved</span><b>{money(metrics.costPerApprovedDeliverable)}</b></div></div>
        {metrics.costUnknownRequests>0&&<p role="status">{metrics.costUnknownRequests} requests have unknown charges. Spend and forecast show known amounts; total costs may be higher.</p>}
        <div className="ops-grid"><div className="ops-panel"><h2>Daily known spend</h2><div className="ops-trend">{data.trends.length ? data.trends.map((item) => <div key={item.name}><span>{item.name.slice(5)}</span><i style={{ height: `${Math.max(4, (item.cost / Math.max(...data.trends.map((row) => row.cost), 0.0001)) * 120)}px` }} /><small>{money(item.cost)}</small></div>) : <div className="ops-empty">No metered calls in this period.</div>}</div></div><div className="ops-panel"><h2>Operational health</h2><dl className="ops-facts"><div><dt>Requests</dt><dd>{metrics.requestCount}</dd></div><div><dt>Failures / retries</dt><dd>{metrics.failures} / {metrics.retries}</dd></div><div><dt>Average latency</dt><dd>{Math.round(metrics.averageLatencyMs)} ms</dd></div><div><dt>Tokens in / out</dt><dd>{metrics.inputTokens.toLocaleString()} / {metrics.outputTokens.toLocaleString()}</dd></div><div><dt>Images / pages</dt><dd>{metrics.imageGenerations} / {metrics.pages}</dd></div></dl></div></div>
        <div className="ops-panel"><div className="ops-panel__head"><div><h2>Allocation drilldown</h2><p>Select a row to inspect its sanitized request events.</p></div><label className="ops-inline-field"><span>Group by</span><select className="ops-select" value={dimension} onChange={(event) => setDimension(event.target.value)}>{Object.keys(data.breakdowns).map((key) => <option key={key} value={key}>{pretty(key)}</option>)}</select></label></div><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>{pretty(dimension)}</th><th>Requests</th><th>Failures</th><th>Cost</th></tr></thead><tbody>{data.breakdowns[dimension].map((item) => <tr key={item.name}><td><button type="button" className="ops-drill-link" onClick={() => drill(item.name)}>{item.name}</button></td><td>{item.requests}</td><td>{item.failures}</td><td>{money(item.cost)}</td></tr>)}</tbody></table></div></div>
      </div>}
      {tab === "budgets" && <div className="ops-panel" id="ops-panel-budgets" role="tabpanel" aria-labelledby="ops-tab-budgets"><div className="ops-panel__head"><div><h2>Budgets and request breakers</h2><p>Monthly budgets notify. Per-request ceilings and request rates hard-block runaway operations.</p></div></div><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Scope</th><th>Monthly USD</th><th>Request ceiling</th><th>Requests / min</th><th>Active</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.budgets.map((budget) => <tr key={budget.id} data-budget-id={budget.id}><td><strong>{budget.scope_key}</strong><small>{budget.scope_type}</small></td><td><input name="monthly" aria-label={`${budget.scope_key} monthly budget in US dollars`} className="ops-number" type="number" min="0" step="1" defaultValue={budget.monthly_budget_usd ?? ""} /></td><td><input name="ceiling" aria-label={`${budget.scope_key} per-request ceiling in US dollars`} className="ops-number" type="number" min="0" step="0.01" defaultValue={budget.per_request_ceiling_usd ?? ""} /></td><td><input name="rpm" aria-label={`${budget.scope_key} maximum requests per minute`} className="ops-number" type="number" min="1" step="1" defaultValue={budget.max_requests_per_minute ?? ""} /></td><td><input name="active" aria-label={`${budget.scope_key} policy active`} type="checkbox" defaultChecked={budget.active} /></td><td><button type="button" className="btn btn--primary btn--sm" disabled={busy === `budget:${budget.id}`} onClick={() => saveBudget(budget)}>{busy === `budget:${budget.id}` ? "Saving…" : "Save"}</button></td></tr>)}</tbody></table></div></div>}
      {tab === "events" && <div className="ops-panel" id="ops-panel-events" role="tabpanel" aria-labelledby="ops-tab-events" aria-busy={eventsLoading}><div className="ops-panel__head"><div><h2>Sanitized request events</h2><p>{Object.keys(eventFilter).length ? `Filtered by ${Object.entries(eventFilter).map(([key, value]) => `${pretty(key)}: ${value}`).join(", ")}` : "Latest metered requests across providers."}</p></div>{Object.keys(eventFilter).length > 0 && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEventFilter({})}>Clear filter</button>}</div>{eventsLoading ? <div className="ops-empty ops-empty--loading" role="status"><span className="ops-spinner" aria-hidden="true" />Loading request events…</div> : <><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Time</th><th>Provider / model</th><th>Feature</th><th>Source</th><th>Status</th><th>Latency</th><th>Cost</th></tr></thead><tbody>{events.map((item) => <tr key={item.id}><td>{new Date(item.occurred_at).toLocaleString()}</td><td>{item.provider} · {item.resolved_model || item.service}</td><td>{item.feature || "unallocated"}</td><td>{pretty(item.cost_source)}</td><td>{item.status}</td><td>{item.latency_ms == null ? "—" : `${item.latency_ms} ms`}</td><td>{item.reconciled_cost_usd == null && item.reported_cost_usd == null && item.estimated_cost_usd == null ? "Unknown" : money(item.reconciled_cost_usd ?? item.reported_cost_usd ?? item.estimated_cost_usd)}</td></tr>)}</tbody></table></div>{events.length === 0 && <div className="ops-empty">No events match this filter.</div>}</>}</div>}
      {tab === "override" && <form className="ops-panel ops-form ops-form--narrow" id="ops-panel-override" role="tabpanel" aria-labelledby="ops-tab-override" onSubmit={issueOverride}><div className="ops-panel__head"><div><h2>Authorize a guarded override</h2><p>Creates a short-lived authorization for the next matching request. The reason and expiry are permanently audited.</p></div></div><label>Operation<select className="input" value={override.operationKey} onChange={(event) => setOverride((current) => ({ ...current, operationKey: event.target.value, result: null }))}><option value="specialist.text">Specialist · text</option><option value="specialist.image">Specialist · image</option><option value="discovery.compile">Discovery compile</option><option value="brandolph.ask">Brandolph</option><option value="brief.sharpen">Brief sharpening</option></select></label><label>Reason<textarea className="input" required minLength="8" value={override.reason} onChange={(event) => setOverride((current) => ({ ...current, reason: event.target.value }))} placeholder="Why this request must exceed the configured breaker…" /></label><label>Expires after<select className="input" value={override.ttlMinutes} onChange={(event) => setOverride((current) => ({ ...current, ttlMinutes: Number(event.target.value) }))}><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label><button className="btn btn--danger" disabled={busy === "override"}>{busy === "override" ? "Authorizing…" : "Authorize next matching request"}</button>{override.result && <div className="ops-override-ticket" role="status"><span className="pulse-dot pulse-dot--green" /><div><strong>Override armed</strong><small>{pretty(override.result.operationKey)} · expires {new Date(override.result.expiresAt).toLocaleTimeString()}</small></div></div>}</form>}
    </>}
  </section>;
}

function WorkspaceMembers() {
  const session = window.useSession?.();
  const workspace = session?.memberships?.[0];
  const canManage = session?.permissions?.includes("workspace.members.manage");
  const [members, setMembers] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(Boolean(canManage));
  const [email, setEmail] = useState("");
  const [transfer, setTransfer] = useState({ userId: "", reason: "" });
  const load = useCallback(async () => {
    if (!workspace?.id || !canManage) return;
    setLoading(true);
    try {
      const data = await request(`/api/access/workspace/${workspace.id}`);
      setMembers(data.members || []);
    } catch (error) { setNotice({ kind: "error", text: error.message }); }
    finally { setLoading(false); }
  }, [workspace?.id, canManage]);
  useEffect(() => { load(); }, [load]);
  const perform = async (key, action, success) => {
    setBusy(key); setNotice(null);
    try { await action(); setNotice({ kind: "success", text: success }); await load(); return true; }
    catch (error) { setNotice({ kind: "error", text: error.message }); return false; }
    finally { setBusy(null); }
  };
  if (!canManage) return <div className="ops-empty">Only Workspace Admins can manage members. Your current role can collaborate on briefs and reviews.</div>;
  const invite = (event) => {
    event.preventDefault();
    perform("invite", () => request("/api/access/invitations", { method: "POST", body: { email, workspaceId: workspace.id, workspaceRole: "user" } }), "Member invitation sent.").then((ok) => { if (ok) setEmail(""); });
  };
  const update = (member, patch) => perform(`member:${member.user_id}`, () => request(`/api/access/workspace/${workspace.id}/members/${member.user_id}`, { method: "PATCH", body: patch }), "Membership updated.");
  const transferOwnership = (event) => {
    event.preventDefault();
    perform("transfer", () => request(`/api/access/workspace/${workspace.id}/transfer-ownership`, { method: "POST", body: transfer }), "Workspace ownership transferred.").then((ok) => { if (ok) setTransfer({ userId: "", reason: "" }); });
  };
  return <div className="workspace-access" aria-busy={loading}>
    <Notice value={notice} clear={() => setNotice(null)} />
    <div className="ops-panel__head"><div><h3>Members · {members.length}</h3><p>{workspace?.name || "Workspace"} · roles and access update immediately.</p></div></div>
    <form className="workspace-access__invite" onSubmit={invite}>
      <label className="sr-only" htmlFor="workspace-invite-email">Email address</label><input id="workspace-invite-email" className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="colleague@company.com" />
      <span className="workspace-access__invite-role" aria-label="Role for this invitation">Member</span>
      <button className="btn btn--primary" disabled={busy === "invite"}>{busy === "invite" ? "Sending…" : "Invite member"}</button>
    </form>
    {loading ? <div className="ops-empty ops-empty--loading" role="status"><span className="ops-spinner" aria-hidden="true" />Loading workspace members…</div> : members.length ? <div className="workspace-access__list">{members.map((member) => <div className="workspace-access__member" key={member.user_id}>
      <div className="workspace-access__avatar" aria-hidden="true">{(member.user?.email || "?")[0].toUpperCase()}</div>
      <div><strong>{member.user?.email || member.user_id}</strong><small>{member.is_owner ? "Billing and workspace owner" : "Workspace collaborator"}</small></div>
      <select aria-label={`Role for ${member.user?.email || member.user_id}`} className="ops-select" value={member.role} disabled={member.is_owner || busy === `member:${member.user_id}`} onChange={(event) => update(member, { role: event.target.value })}><option value="workspace_admin">Workspace Admin</option><option value="user">Member</option></select>
      {member.is_owner ? <span className="pill pill--yellow">Owner</span> : <button type="button" className={`ops-state ${member.status === "active" ? "is-on" : "is-off"}`} aria-pressed={member.status === "active"} disabled={busy === `member:${member.user_id}`} onClick={() => update(member, { status: member.status === "active" ? "suspended" : "active" })}>{member.status === "active" ? "Active" : "Suspended"}</button>}
    </div>)}</div> : <div className="ops-empty">No workspace members were found.</div>}
    <form className="workspace-access__transfer" onSubmit={transferOwnership}>
      <div><h4>Transfer ownership</h4><p>Requires MFA and creates an audit event. The new owner becomes an active Workspace Admin.</p></div>
      <label className="sr-only" htmlFor="workspace-new-owner">New workspace owner</label><select id="workspace-new-owner" className="input" required value={transfer.userId} onChange={(event) => setTransfer((current) => ({ ...current, userId: event.target.value }))}><option value="">Choose a member…</option>{members.filter((member) => !member.is_owner && member.status === "active").map((member) => <option key={member.user_id} value={member.user_id}>{member.user?.email}</option>)}</select>
      <label className="sr-only" htmlFor="workspace-transfer-reason">Reason for ownership transfer</label><textarea id="workspace-transfer-reason" className="input" required minLength="8" value={transfer.reason} onChange={(event) => setTransfer((current) => ({ ...current, reason: event.target.value }))} placeholder="Reason for transferring ownership…" />
      <button className="btn btn--danger" disabled={busy === "transfer" || !members.some((member) => !member.is_owner && member.status === "active")}>{busy === "transfer" ? "Transferring…" : "Transfer ownership"}</button>
    </form>
  </div>;
}

function DesignerInvites() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const invite = async (event) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      await request("/api/access/invitations", { method: "POST", body: { email, platformRole: "designer" } });
      setEmail(""); setNotice({ kind: "success", text: "Designer invitation sent." });
    } catch (error) { setNotice({ kind: "error", text: error.message }); }
    finally { setBusy(false); }
  };
  return <section className="workspace-access"><Notice value={notice} clear={() => setNotice(null)} />
    <div className="ops-panel__head"><div><h3>Invite a designer</h3><p>Creative Directors can add Designers to the internal team. Designer access remains scoped to assigned clients.</p></div></div>
    <form className="workspace-access__invite" onSubmit={invite}><label className="sr-only" htmlFor="designer-invite-email">Designer email address</label><input id="designer-invite-email" className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="designer@company.com" /><span className="workspace-access__invite-role" aria-label="Role for this invitation">Designer</span><button className="btn btn--primary" disabled={busy}>{busy ? "Sending…" : "Invite designer"}</button></form>
  </section>;
}

Object.assign(window, { AdminAccess, AdminOpex, WorkspaceMembers, DesignerInvites });
