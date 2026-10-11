-- Hero-model list prices. Without a card, runs.cost_usd stayed null even
-- though token usage was logged. The router also keeps an in-code copy of
-- this table so a run is priced before the migration is applied.
insert into public.api_rate_cards
  (provider, service, model, operation, input_per_million_usd, output_per_million_usd,
   cache_read_per_million_usd, cache_write_per_million_usd, effective_from, source_url)
select * from (values
  ('anthropic','messages','claude-sonnet-5-5','completion',2::numeric,10::numeric,0.1::numeric,2.5::numeric,'2026-10-07T00:00:00Z'::timestamptz,'https://platform.claude.com/docs/en/about-claude/pricing'),
  ('anthropic','messages','claude-haiku-5-5','completion',0.1,0.5,0.005,0.125,'2026-10-07T00:00:00Z','https://platform.claude.com/docs/en/about-claude/pricing'),
  ('anthropic','messages','claude-opus-5-5','completion',4,20,0.2,5,'2026-10-07T00:00:00Z','https://platform.claude.com/docs/en/about-claude/pricing'),
  ('openrouter','messages','google/gemini-3.8-flash','completion',0.75,3.75,0,0,'2026-10-07T00:00:00Z','https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing')
) as cards(provider, service, model, operation, input_per_million_usd, output_per_million_usd, cache_read_per_million_usd, cache_write_per_million_usd, effective_from, source_url)
where not exists (
  select 1 from public.api_rate_cards existing
  where existing.provider = cards.provider
    and existing.model = cards.model
    and existing.operation = cards.operation
);
