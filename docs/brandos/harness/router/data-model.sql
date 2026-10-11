-- Router data model (proposal; Postgres/Supabase). No migration applied.
create table model_catalog (
  id text primary key,                 -- route form: 'anthropic/claude-sonnet-5-5', 'openrouter/google/gemini-3.8-flash', 'vendor/fal/nano-banana-2'
  provider text not null,              -- anthropic | openrouter | fal
  provider_model_id text not null,     -- slug/endpoint at the provider
  modalities_in text[] not null, modalities_out text[] not null,
  price_in_per_mtok numeric, price_out_per_mtok numeric, price_per_unit numeric, price_unit text, -- image|second|megapixel
  context_length int, status text not null default 'active', -- active|deprecated|missing
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  raw jsonb not null
);
create table route_versions (
  id bigserial primary key,
  output_type text not null, difficulty text not null,
  primary_route text not null references model_catalog(id),
  fallback_route text references model_catalog(id),
  judge_route text references model_catalog(id),
  scope jsonb not null default '{}'::jsonb,  -- e.g. {"agents":["a02","a16"]} for hero-only
  effective_at timestamptz not null, approved_by text not null, proposal_id bigint,
  active boolean not null default true
);
create unique index on route_versions(output_type, difficulty, (scope::text)) where active;
create table triage_decisions (
  id bigserial primary key, run_id text not null, task_id text not null, agent_id text not null,
  output_type text not null, difficulty text not null, signals jsonb, confidence numeric,
  source text not null,                 -- contract|model
  route_version_id bigint references route_versions(id), created_at timestamptz default now()
);
create table eval_runs (
  id bigserial primary key, kind text not null,        -- scout|manual|ab
  output_type text not null, candidate_route text not null, baseline_route text not null,
  golden_set_version text not null, started_at timestamptz default now(), finished_at timestamptz,
  cost_usd numeric, status text not null default 'running'
);
create table eval_results (
  id bigserial primary key, eval_run_id bigint references eval_runs(id), brief_id text not null, run_no int,
  route text not null, output_ref text, passes_used int, hard_fails int, soft_fails int,
  judge_score numeric, judge_win boolean, latency_ms int, cost_usd numeric
);
create table route_proposals (
  id bigserial primary key, output_type text not null, difficulty text not null,
  current_route text not null, candidate_route text not null, eval_run_id bigint references eval_runs(id),
  metrics jsonb not null,   -- {quality:{cur,cand}, value:{cur,cand}, first_pass:{..}, p95_ms:{..}, cost_per_output:{..}, monthly_delta_usd}
  samples jsonb not null, status text not null default 'open', -- open|approved|rejected|superseded
  decided_by text, decided_at timestamptz, note text, created_at timestamptz default now()
);
