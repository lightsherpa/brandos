-- Client-portal users only ever see credits: never internal API cost, model
-- routes, vendor names or token counts. The browser reads runs/outputs
-- directly under RLS, so close it at the column level. Team/admin still get
-- the full detail through the service-role API (forViewer in
-- server/src/lib/client-redact.js).

-- ── runs: column-level select ────────────────────────────────────────
-- Revoking the table-level grant also drops per-column grants; re-grant
-- only the presentation columns. Hidden: model_used, prompt_tokens,
-- completion_tokens, cached_tokens, cache_creation_tokens, cost_usd, latency_ms.
revoke select on table public.runs from anon, authenticated;
grant select (id, brief_id, specialist_id, spec_version, bio_version, status,
              output_locale, started_at, ended_at, created_at)
  on table public.runs to authenticated;

-- ── outputs.body: scrub model/vendor keys already persisted ──────────
-- New writes are already client-safe (tasks.js redacts, runs.js no longer
-- stores provider_endpoint). Same key list as INTERNAL_KEYS in client-redact.js.
create or replace function pg_temp.strip_internal(j jsonb) returns jsonb
language plpgsql immutable as $$
declare out jsonb; k text; v jsonb;
begin
  if jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, v in select * from jsonb_each(j) loop
      continue when k = any (array['model','models','model_used','fallback_from','attempts','route','ledger','cost',
        'provider','provider_endpoint','prompt_tokens','completion_tokens','cached_tokens','cache_creation_tokens'])
        or k like '%\_usd';
      out := out || jsonb_build_object(k, pg_temp.strip_internal(v));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    select coalesce(jsonb_agg(pg_temp.strip_internal(e) order by i), '[]'::jsonb) into out
      from jsonb_array_elements(j) with ordinality as a(e, i);
    return out;
  end if;
  return j;
end $$;

-- Task outputs store the body as a JSON-encoded string scalar.
update public.outputs
   set body = to_jsonb(pg_temp.strip_internal((body #>> '{}')::jsonb)::text)
 where kind in ('task', 'task_rerun') and jsonb_typeof(body) = 'string';

-- Specialist image outputs: only provider_endpoint ever leaked here.
update public.outputs
   set body = body - 'provider_endpoint'
 where jsonb_typeof(body) = 'object' and body ? 'provider_endpoint';
