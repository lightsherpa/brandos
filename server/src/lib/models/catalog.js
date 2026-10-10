// Versioned, server-owned routing policy. Discovery never changes this catalog.
export const CATALOG_VERSION = '2026-09-22.1';
const legacyKeys = {'claude-opus-4-7':'opus','claude-sonnet-4-6':'sonnet','claude-haiku-4-5-20251001':'haiku','gpt-5':'gpt5','gemini-2.5-pro':'gemPro','gemini-2.5-flash':'gemFlash','flux-1.1-pro':'flux','flux-schnell':'fluxSchnell','recraft-v3':'recraft','gpt-image-2':'gptimage'};
const baseline = (route, label, modality, credits, features = []) => ({ route, label, modality, credits, legacyKey: legacyKeys[route.split('/').at(-1)] || null,
  gateway: route.startsWith('vendor/fal/') ? 'fal' : route.split('/')[0],
  model: route.replace(/^(vendor\/fal|anthropic|openrouter)\//, ''), version: route.split('/').at(-1),
  features, parameters: {}, availability: 'configured', baseline: true, override: true,
  evaluation: null, rateCard: null });
export const MODEL_CATALOG = [
  baseline('anthropic/claude-opus-4-7', 'Opus 4.7', 'text', 2),
  baseline('anthropic/claude-sonnet-4-6', 'Sonnet 4.6', 'text', 1),
  baseline('anthropic/claude-haiku-4-5-20251001', 'Haiku 4.5', 'text', .75),
  baseline('openrouter/openai/gpt-5', 'GPT-5', 'text', 1),
  baseline('openrouter/google/gemini-2.5-pro', 'Gemini Pro', 'text', 2),
  baseline('openrouter/google/gemini-2.5-flash', 'Gemini Flash', 'text', .75, ['vision']),
  ...[['flux-1.1-pro', 'Flux 1.1 Pro', 2], ['flux-schnell', 'Flux Schnell', .75], ['recraft-v3', 'Recraft V3', 2], ['gpt-image-2', 'GPT Image 2 · fal', 1]].map(([id, label, credits]) => baseline(`vendor/fal/${id}`, label, 'image', credits)),
  ...[
    ['openrouter/openai/gpt-image-1', 'GPT Image 1 · OpenRouter', 'image', ['image_edit']],
    ['openrouter/google/veo-3.1', 'Veo 3.1 · OpenRouter', 'video', ['image_to_video']],
    ['apimart/flux-2-pro', 'Flux 2 Pro · APImart (experimental)', 'image', ['image_edit']],
    ['apimart/pixverse-v6', 'Pixverse v6 · APImart (experimental)', 'video', []],
  ].map(([route, label, modality, features]) => ({ ...baseline(route, label, modality, 1, features),
    baseline: false, experimental: route.startsWith('apimart/'), gateway: route.split('/')[0],
    model: route.slice(route.indexOf('/') + 1), availability: 'unqualified', override: false })),
];
export const catalogModel = (route, catalog = MODEL_CATALOG) => catalog.find(m => m.route === route);
export function configuredCatalog(qualifications = {}) {
  return MODEL_CATALOG.map(m => {
    const q = qualifications[m.route];
    if (!q) return m;
    // Qualification is service-owned; model identity and gateway cannot be relabelled.
    return { ...m, parameters: q.parameters || m.parameters, rateCard: q.rateCard || null,
      qualifiedSettings: q.settings || null,
      evaluation: q.evaluation ? {...q.evaluation, qualified: q.evaluation.qualified === true && q.evaluation.modelVersion === m.version && !!q.evaluation.artifact} : null, availability: q.available === true ? 'configured' : 'unavailable',
      maxCostUsd: q.maxCostUsd, endpoint: q.endpoint, features: m.features.filter(f => q.features?.includes(f)) };
  });
}
export function eligibleModels({ modality, features = [], settings = {}, policy = {}, budgetUsd, catalog = MODEL_CATALOG, available = () => true, benchmark = false }) {
  return catalog.filter(m => {
    if (m.modality !== modality || !features.every(f => m.features.includes(f)) || !available(m)) return false;
    if (m.availability !== 'configured' || policy.deniedRoutes?.includes(m.route)) return false;
    if (policy.allowedRoutes && !policy.allowedRoutes.includes(m.route)) return false;
    if (policy.providers?.[m.gateway] === false) return false;
    if (!m.baseline && (!policy.providers?.[m.gateway] || (!benchmark && (m.experimental || m.evaluation?.qualified !== true)))) return false;
    if (!m.baseline && (!m.rateCard?.sourceUrl || !m.rateCard?.verifiedAt || !m.endpoint || !m.qualifiedSettings || JSON.stringify(Object.entries(settings).sort()) !== JSON.stringify(Object.entries(m.qualifiedSettings).sort()))) return false;
    if (!m.baseline && (!Number.isFinite(m.maxCostUsd) || !Number.isFinite(budgetUsd) || m.maxCostUsd > budgetUsd)) return false;
    if (Number.isFinite(budgetUsd) && Number.isFinite(m.maxCostUsd) && m.maxCostUsd > budgetUsd) return false;
    return Object.entries(settings).every(([key, value]) => {
      const p = m.parameters[key];
      return p?.values ? p.values.includes(value) : p?.type === 'boolean' ? typeof value === 'boolean' : p?.type === 'range' && Number.isInteger(value) && value >= p.min && value <= p.max;
    });
  });
}
export function qualityFirst(candidates, configuredRoute) {
  // Keep old routes until replacements have actual qualification evidence.
  const ranked = candidates.filter(m => m.evaluation?.qualified && Number.isFinite(m.evaluation.quality));
  ranked.sort((a,b) => b.evaluation.quality - a.evaluation.quality || (a.evaluation.costUsd ?? Infinity) - (b.evaluation.costUsd ?? Infinity) || (a.evaluation.latencyMs ?? Infinity) - (b.evaluation.latencyMs ?? Infinity) || a.route.localeCompare(b.route));
  return ranked[0] || candidates.find(m => m.route === configuredRoute) || null;
}
export function publicCatalog(catalog, policy = {}, available = () => true) {
  return catalog.filter(m => (m.override || (!m.experimental && m.evaluation?.qualified && m.availability === 'configured' && policy.providers?.[m.gateway])) && m.availability === 'configured' && policy.providers?.[m.gateway] !== false && available(m) && !policy.deniedRoutes?.includes(m.route) && (!policy.allowedRoutes || policy.allowedRoutes.includes(m.route)))
    .map(({route,label,modality,features,credits,qualifiedSettings,legacyKey}) => ({route,label,modality,features,credits,settings:qualifiedSettings,legacyKey}));
}
