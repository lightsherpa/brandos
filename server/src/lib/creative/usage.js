export function usageEvent(job, operation, usage, status = 'succeeded') {
  const reported = usage?.cost ?? usage?.cost_usd ?? null;
  const estimated = usage?.estimated_cost_usd ?? null;
  return { request_id: `${job.id}:${operation}`, idempotency_key: `creative:${job.id}:${operation}`,
    parent_run_id: job.run_id, workspace_id: job.workspace_id, brand_id: job.brand_id,
    actor_user_id: job.actor_user_id, specialist_id: job.specialist_id, feature: `creative.${operation}`,
    provider: operation === 'jev' ? 'typesafe' : operation === 'qa' ? 'openrouter' : job.model.gateway,
    service: operation === 'generation' ? job.model.modality : operation, operation, status,
    requested_model: operation === 'generation' ? job.model.model : null,
    resolved_model: usage?.model || (operation === 'generation' ? job.model.model : null),
    reported_cost_usd: reported, estimated_cost_usd: estimated,
    cost_source: reported != null ? 'provider_reported' : estimated != null ? 'rate_card_estimate' : 'unpriced',
    input_tokens: usage?.input_tokens ?? usage?.prompt_tokens ?? 0, output_tokens: usage?.output_tokens ?? usage?.completion_tokens ?? 0,
    cache_read_tokens: usage?.cached_tokens ?? 0, cache_write_tokens: usage?.cache_creation_tokens ?? 0,
    units: { video_seconds: operation === 'generation' && job.model.modality === 'video' ? job.input.settings?.duration ?? null : null,
      gateway_fee_usd: usage?.gateway_fee_usd ?? null, retries: 0 },
    rate_card_id: operation === 'generation' ? job.model.rateCard?.id || null : null,
    preflight_max_cost_usd: job.max_cost_usd, metadata: { catalog_version: job.catalog_version, known_subtotal_usd:usage?.known_subtotal_usd??null,cost_unknown: reported == null && estimated == null, fee_included_in_reported: usage?.cost != null ? 'provider_total' : null } };
}
export async function recordUsage(db, job, operation, usage, status) {
  const { error } = await db.from('api_usage_events').insert(usageEvent(job, operation, usage, status));
  if (error && error.code !== '23505') throw new Error(`Usage persistence failed: ${error.message}`);
}
