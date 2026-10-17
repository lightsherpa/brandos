// Recovery is based on persisted outputs, never client-supplied tenant metadata.
const parse = (body) => { try { return typeof body === 'string' ? JSON.parse(body) : body; } catch { return null; } };
const statusOf = (items) => items.length && items.every(it => it?.status === 'approved') ? 'approved' : items.length && items.every(it => ['ready','approved'].includes(it?.status)) ? 'ready' : 'flagged';
const humanApproved = row => row.status === 'approved' && ((['internally_approved','client_review','client_approved'].includes(row.workflow_status) && row.internal_reviewed_by && row.internal_reviewed_at) || (row.workflow_status === 'client_approved' && row.client_reviewed_by && row.client_reviewed_at));
const reviewedItem = (row,item) => humanApproved(row) ? {...item,status:'approved'} : item.status === 'approved' ? {...item,status:'ready'} : item;
const metricOf = (row) => ({ total_ms: row.run?.latency_ms ?? null, cost: { total_usd: row.run?.cost_usd ?? null }, recovered: true });
// Browser-readable bodies omit cost. Service-role recovery fills it back from runs.cost_usd.
const recoveredMetrics = (stored, row) => {
  const fallback = metricOf(row);
  if (!stored || typeof stored !== "object") return fallback;
  return { ...fallback, ...stored, total_ms: stored.total_ms ?? fallback.total_ms, cost: stored.cost ?? fallback.cost };
};
export function reconstructTasks(rows, authorized) {
  const jobs = new Map();
  const ordered = [...rows].sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
  for (const row of ordered) {
    const workspaceId = row.brief?.brand?.workspace_id;
    if (!workspaceId || !authorized(workspaceId)) continue;
    const body = parse(row.body);
    if (row.kind !== 'task' || !body?.task_id || !Array.isArray(body.items)) continue;
    const meta = body.snapshot || {};
    const job = {
      id: body.task_id, type: body.type, brandId: row.brief.brand_id, workspaceId,
      brief: meta.brief ?? row.brief.payload?.request ?? '', heroes: meta.heroes ?? null,
      created_at: meta.created_at ?? row.run?.started_at ?? row.created_at, finished_at: meta.finished_at ?? row.run?.ended_at ?? row.created_at,
      created_by: meta.created_by ?? null, run_id: row.run_id, credits: meta.credits ?? null,
      brand_core: meta.brand_core ?? { version: row.run?.bio_version ?? null },
      generation_brand_core: meta.generation_brand_core ?? null,
      briefId:meta.briefId||row.brief_id,
      provenance: meta.provenance ?? { bioVersion: row.run?.bio_version ?? null, recovered: true },
      items: body.items.map(item => reviewedItem(row,item)), result: { spec: body.spec, metrics: recoveredMetrics(meta.metrics, row) },
      notices: meta.notices ?? [], error: null, recovered: true, reruns: [], rerun_counts: {},
    };
    job.status = statusOf(job.items); job.stage = ['ready','approved'].includes(job.status) ? 'Ready' : 'Flagged';
    jobs.set(job.id, job);
  }
  for (const row of ordered) {
    if (row.kind !== 'task_rerun') continue;
    const workspaceId = row.brief?.brand?.workspace_id;
    if (!workspaceId || !authorized(workspaceId)) continue;
    const body = parse(row.body); const job = jobs.get(body?.task_id);
    if (!job || row.brief.brand_id !== job.brandId || workspaceId !== job.workspaceId || !Number.isInteger(body.index) || body.index < 0 || !job.items[body.index] || !body.item) continue;
    job.items[body.index] = reviewedItem(row,body.item);
    job.rerun_counts[body.index] = (job.rerun_counts[body.index] || 0) + 1;
    job.reruns.push({ index: body.index, run_id: row.run_id, ...recoveredMetrics(body.metrics, row), provenance: body.provenance ?? {bioVersion:row.run?.bio_version ?? null} });
    job.finished_at = body.finished_at ?? row.run?.ended_at ?? row.created_at;
    job.status = statusOf(job.items); job.stage = ['ready','approved'].includes(job.status) ? 'Ready' : 'Flagged';
  }
  return [...jobs.values()];
}
export async function recoverTasks(db, authorized, brandId = null) {
  const rows = [];
  // Paginate so older completed task IDs are recoverable too. Never silently
  // return a truncated history or treat a DB failure as an absent task.
  for (let offset = 0;; offset += 500) {
    let q = db.from('outputs').select('id,brief_id,kind,status,workflow_status,internal_reviewed_by,internal_reviewed_at,client_reviewed_by,client_reviewed_at,body,created_at,run_id,run:runs(bio_version,started_at,ended_at,cost_usd,latency_ms),brief:briefs!inner(brand_id,payload,brand:brands!inner(workspace_id))').in('kind',['task','task_rerun']).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+499);
    if (brandId) q = q.eq('brief.brand_id',brandId);
    const { data, error } = await q;
    if (error) throw Object.assign(new Error('Task recovery unavailable'), {status:503,code:'TASK_RECOVERY_UNAVAILABLE'});
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return reconstructTasks(rows, authorized);
}
