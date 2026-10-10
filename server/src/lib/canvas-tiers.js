import { isImageRoute } from './models/fal-image.js';
import { routeCreditMultiplier } from './models/router.js';
import { estimateRunCredits } from './credits.js';
import { TIERS } from '../../../src/canvas/document.js';
const ROUTES = {
  text: {premium: 'anthropic/claude-opus-4-7', balanced: 'anthropic/claude-sonnet-4-6', fast: 'openrouter/google/gemini-2.5-flash'},
  image: {premium: 'vendor/fal/recraft-v3', balanced: 'vendor/fal/flux-1.1-pro', fast: 'vendor/fal/flux-schnell'},
};
export function quoteSpecialist(spec, settings = {}) {
  const tier = settings.tier || 'auto';
  if (!TIERS.includes(tier)) throw new Error('Unknown quality tier.');
  const primary = spec.payload?.modelRouting?.primary;
  const kind = isImageRoute(primary) ? 'image' : 'text';
  if (!primary || (!isImageRoute(primary) && !/^(anthropic|openrouter)\//.test(primary))) throw new Error('This specialist is not available for canvas runs.');
  const route = tier === 'auto' ? primary : ROUTES[kind][tier];
  const deliverableSpec = settings.deliverableSpec || null;
  if (deliverableSpec && (typeof deliverableSpec !== 'object' || !Number.isInteger(deliverableSpec.count) || deliverableSpec.count < 1 || deliverableSpec.count > 30)) throw new Error('Deliverable count must be between 1 and 30.');
  if (kind === 'image' && deliverableSpec && deliverableSpec.count !== 1) throw new Error('Image nodes generate one image per run.');
  if(deliverableSpec?.type==='email_html'&&(kind!=='text'||deliverableSpec.count!==1))throw new Error('HTML email uses one text output per run.');
  const base = estimateRunCredits({specPayload: spec.payload, deliverableSpec, isDeliverableText: kind === 'text' && !!deliverableSpec && deliverableSpec.type!=='email_html'});
  return {tier, route, kind, credits: Math.max(1, Math.ceil(base * routeCreditMultiplier(route))), deliverableSpec};
}
