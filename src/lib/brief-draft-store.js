import { emptyDraft, isDraftPayload, isUuid, isRevision, isObject } from "../../shared/brief-draft-payload.js";
export { emptyDraft };


// One controller per user/brand. Writes are serialized; every retry reuses its
// mutation ID. Recovery entries are per editor, so two tabs cannot erase each
// other's unsaved text. Server revisions arbitrate concurrent saves.
export function createBriefDraftStore({ userId, brandId, request, storage, uuid = () => crypto.randomUUID(), delay = 600 }) {
  const prefix = `ci_brief_draft:v1:${userId}:${brandId}:`;
  let state = { payload: emptyDraft(), id: null, revision: 0, drafts: [], status: "loading", error: null, ready: false, workspaceId: null, localError: false };
  let timer, flight, pending = null, dirty = false, recoveryKey = prefix + uuid(), sourceKey = null, sourceValue = null;
  let generation = 0, loadSequence = 0, disposed = false, initialized = false;
  const listeners = new Set();
  const emit = (patch = {}) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
  const localEntries = () => {
    const rows = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          const raw = storage.getItem(key), record = JSON.parse(raw);
          const validPending = record?.pending == null || (isObject(record.pending)
            && record.pending.ownerUserId === userId && record.pending.brandId === brandId
            && record.pending.workspaceId === record.workspaceId
            && isRevision(record.pending.revision) && record.pending.revision === record.revision
            && isUuid(record.pending.mutationId) && isDraftPayload(record.pending.payload, false));
          if (isObject(record) && isUuid(record.id) && isRevision(record.revision)
            && isDraftPayload(record.payload, false) && validPending
            && (record.workspaceId == null || typeof record.workspaceId === "string")
            && record.userId === userId && record.brandId === brandId) rows.push({ ...record, recoveryKey: key, raw });
        } catch { /* Ignore an invalid recovery record, never another scope. */ }
      }
    } catch { emit({ localError: true }); }
    return rows.sort((a, b) => b.at - a.at);
  };
  const persist = () => {
    if (!state.id || !dirty) return;
    try {
      storage.setItem(recoveryKey, JSON.stringify({ id: state.id, revision: state.revision, workspaceId: state.workspaceId, userId, brandId, payload: state.payload, pending, at: Date.now() }));
      emit({ localError: false });
    } catch { emit({ localError: true }); }
  };
  const removeRecovery = () => {
    try {
      storage.removeItem(recoveryKey);
      // Don't erase a recovery copy another editor has since changed.
      if (sourceKey && storage.getItem(sourceKey) === sourceValue) storage.removeItem(sourceKey);
      sourceKey = null;
    } catch { /* Server has acknowledged the save. */ }
  };
  async function json(path, init) {
    const response = await request(path, init);
    const data = await response.json();
    if (!response.ok) { const e = new Error(data.error || "Draft request failed"); e.code = data.code; e.status = response.status; throw e; }
    return data;
  }
  function adopt(row) {
    generation++;
    pending = row?.pending || null;
    dirty = !!row?.recoveryKey;
    sourceKey = row?.recoveryKey || null;
    sourceValue = row?.raw || null;
    recoveryKey = prefix + uuid();
    emit({ id: row?.id || null, revision: row?.revision || 0, payload: row?.payload || emptyDraft(), status: dirty ? "unsaved" : row ? "saved" : "idle", error: null });
  }
  async function load() {
    disposed = false;
    const sequence = ++loadSequence;
    emit({ status: "loading", error: null });
    try {
      const result = await json(`/api/briefs/drafts?brandId=${encodeURIComponent(brandId)}&ownerUserId=${encodeURIComponent(userId)}`);
      if (disposed || sequence !== loadSequence) return;
      if (result.ownerUserId !== userId) throw new Error("Session changed");
      const local = localEntries().filter((r) => (!r.workspaceId || r.workspaceId === result.workspaceId));
      // A list request can finish after a newer save. Merge acknowledgements
      // by revision so navigating through that list never restores stale text.
      const saved = new Map(result.drafts.map((row) => [row.id, row]));
      if (state.workspaceId === result.workspaceId) {
        for (const row of state.drafts.filter((entry) => !entry.recoveryKey)) {
          if (!saved.has(row.id) || row.revision > saved.get(row.id).revision) saved.set(row.id, row);
        }
      }
      emit({ workspaceId: result.workspaceId, drafts: [...local, ...saved.values()], ready: true });
      if (!initialized) { adopt(local[0] || null); initialized = true; }
      else emit({ status: dirty ? "unsaved" : state.id ? "saved" : "idle" });
      // Recovery never starts or analyses a brief. Only pending storage writes retry.
      if (dirty) await flush();
    } catch (e) {
      if (disposed || sequence !== loadSequence) return;
      const local = localEntries();
      if (!initialized && local[0]) {
        emit({ workspaceId: local[0].workspaceId, drafts: local, ready: true });
        adopt(local[0]); initialized = true;
      }
      initialized = true;
      emit({ status: "error", error: e.message, ready: true });
    }
  }
  function update(patch) {
    if (!state.ready || disposed) return;
    const next = typeof patch === "function" ? patch(state.payload) : patch;
    dirty = true; generation++;
    emit({ id: state.id || uuid(), payload: { ...state.payload, ...next }, status: "unsaved", error: null });
    persist();
    clearTimeout(timer); timer = setTimeout(() => { void flush(); }, delay);
  }
  async function flush() {
    clearTimeout(timer);
    if (flight) { await flight; return dirty && state.status !== "error" && state.status !== "conflict" ? flush() : !dirty; }
    if (!dirty) return true;
    if (!state.workspaceId) { emit({ status: "error", error: "Connect to load this brand before saving." }); return false; }
    flight = (async () => {
      try {
        while (dirty) {
          const atGeneration = generation;
          pending ||= { brandId, workspaceId: state.workspaceId, ownerUserId: userId, revision: state.revision, mutationId: uuid(), payload: state.payload };
          const sent = pending;
          persist(); emit({ status: "saving", error: null });
          const { draft } = await json(`/api/briefs/drafts/${state.id}`, { method: "PUT", body: JSON.stringify(sent) });
          pending = null;
          // An acknowledgement updates metadata only, never overwrites current text.
          dirty = generation !== atGeneration || JSON.stringify(state.payload) !== JSON.stringify(sent.payload);
          emit({ revision: draft.revision, status: dirty ? "unsaved" : "saved" });
          if (dirty) persist(); else removeRecovery();
          const recoveries = localEntries().filter((r) => !r.workspaceId || r.workspaceId === state.workspaceId);
          emit({ drafts: [...recoveries, draft, ...state.drafts.filter((d) => !d.recoveryKey && d.id !== draft.id)] });
        }
        return true;
      } catch (e) {
        // Validation/body-limit failures definitively did not commit. Let a
        // corrected payload replace that rejected request; uncertain failures
        // keep the original mutation for safe idempotent retry.
        if (e.status === 400 || e.status === 413) pending = null;
        emit({ status: e.code === "DRAFT_CONFLICT" ? "conflict" : "error", error: e.message });
        persist(); return false;
      }
    })();
    try { return await flight; } finally { flight = null; }
  }
  async function select(row) {
    // Do not abandon a failed save when choosing another draft.
    if (!await flush()) return false;
    if (row && !row.recoveryKey) row = state.drafts.find((d) => d.id === row.id && !d.recoveryKey) || row;
    adopt(row);
    if (dirty) void flush();
    return true;
  }
  async function discard(row = state) {
    if (!await flush()) return false;
    if (row.id === state.id) row = state;
    try {
      await json(`/api/briefs/drafts/${row.id}`, {method:'DELETE',body:JSON.stringify({brandId,ownerUserId:userId,revision:row.revision})});
      for (const entry of localEntries().filter(entry=>entry.id===row.id)) storage.removeItem(entry.recoveryKey);
      emit({drafts:state.drafts.filter(entry=>entry.id!==row.id)});
      if (state.id===row.id) { removeRecovery(); adopt(null); }
      return true;
    } catch(e) { emit({status:'error',error:e.message}); return false; }
  }
  async function saveCopy() {
    if (flight) await flight;
    // A conflict can be resolved without overwriting either version.
    pending = null; dirty = true; generation++;
    emit({ id: uuid(), revision: 0, status: "unsaved", error: null });
    persist(); return flush();
  }
  return {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    load, update, flush, select, saveCopy, discard,
    dispose() { disposed = true; loadSequence++; clearTimeout(timer); void flush(); },
  };
}
