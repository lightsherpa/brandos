import { FAL_ROUTES } from '../models/fal-image.js';
export class SubmissionError extends Error {
  constructor(message, definite = false) { super(message); this.definite = definite; }
}
const keys = { openrouter: 'OPENROUTER_API_KEY', fal: 'FAL_API_KEY', apimart: 'APIMART_API_KEY' };
export const providerAvailable = m => Boolean(process.env[keys[m.gateway] || 'ANTHROPIC_API_KEY']);
async function json(fetchImpl, url, init, submitting = false) {
  let r;
  try { r = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(submitting ? 180000 : 30000), redirect: 'error' }); }
  catch (e) { throw submitting ? new SubmissionError(e.message) : e; }
  // Timeout/5xx/malformed success may have accepted billable work. Never retry POST.
  if (!r.ok) throw new SubmissionError(`Provider HTTP ${r.status}`, submitting && [400,401,403,404,422,429].includes(r.status));
  try { return await r.json(); } catch { throw new SubmissionError('Invalid provider response'); }
}
export function mediaAdapter(model, { fetchImpl = fetch } = {}) {
  const gateway = model.gateway;
  const key = process.env[keys[gateway]];
  const headers = { Authorization: `${gateway === 'fal' ? 'Key' : 'Bearer'} ${key}`, 'Content-Type': 'application/json' };
  const get = url => json(fetchImpl, url, { headers });
  const post = (url, body) => json(fetchImpl, url, { method: 'POST', headers, body: JSON.stringify(body) }, true);
  function falUrl(url) { const u = new URL(url); if (u.origin !== 'https://queue.fal.run') throw new Error('Invalid fal queue URL'); return u.href; }
  return {
    capabilities: { cancel: gateway === 'fal', asynchronous: gateway !== 'openrouter' || model.modality === 'video' },
    async submit({ prompt, settings = {}, reference }) {
      if (!key) throw new SubmissionError('Provider credentials missing', true);
      if (gateway === 'fal') {
        const cfg = FAL_ROUTES[model.route];
        if (!cfg) throw new SubmissionError('Unsupported fal route', true);
        const r = await post(`https://queue.fal.run${cfg.endpoint}`, cfg.payload({ prompt, size: settings.size }));
        if (!r.request_id || !r.status_url || !r.response_url) throw new SubmissionError('Missing fal task identity');
        return { taskId: r.request_id, statusUrl: falUrl(r.status_url), resultUrl: falUrl(r.response_url), cancelUrl: r.cancel_url ? falUrl(r.cancel_url) : null };
      }
      if (gateway === 'openrouter') {
        const body = { model: model.model, prompt, ...settings };
        if (model.endpoint) body.provider = { only: [model.endpoint], allow_fallbacks: false };
        if (reference) {
          const ref = { type: 'image_url', image_url: { url: reference.url } };
          if (model.modality === 'video') body.frame_images = [{ ...ref, frame_type: 'first_frame' }];
          else body.input_references = [ref];
        }
        const r = await post(`https://openrouter.ai/api/v1/${model.modality === 'video' ? 'videos' : 'images'}`, body);
        if (model.modality === 'image') {
          if (!r.data?.[0]?.b64_json) throw new SubmissionError('Missing generated image');
          return { taskId: null, result: { state: 'generated', base64: r.data[0].b64_json, contentType: r.data[0].media_type || 'image/png', usage: r.usage || null } };
        }
        if (!r.id) throw new SubmissionError('Missing OpenRouter task identity');
        return { taskId: r.id };
      }
      if (gateway === 'apimart' && ['pixverse-v6','flux-2-pro'].includes(model.model)) {
        const { aspect_ratio, ...rest } = settings;
        const r = await post(`https://api.apimart.ai/v1/${model.modality === 'image' ? 'images' : 'videos'}/generations`, { model: model.model, prompt, ...rest, ...(aspect_ratio ? { size: aspect_ratio } : {}), ...(reference && model.modality === 'image' ? {image_urls:[reference.url]} : {}) });
        if (!r.data?.[0]?.task_id) throw new SubmissionError('Missing APImart task identity');
        return { taskId: r.data[0].task_id };
      }
      throw new SubmissionError('Unsupported adapter contract', true);
    },
    async status(task) {
      if (task.result) return task.result;
      if (gateway === 'fal') {
        const s = await get(falUrl(task.statusUrl));
        if (s.status === 'COMPLETED') return { state: 'ready' };
        if (s.status === 'FAILED') return { state: 'failed' };
        return { state: 'polling', progress: s.status === 'IN_PROGRESS' ? 50 : 10 };
      }
      if (gateway === 'openrouter') {
        const s = await get(`https://openrouter.ai/api/v1/videos/${encodeURIComponent(task.taskId)}`);
        if (s.status === 'completed') return { state: 'generated', assetUrl: `https://openrouter.ai/api/v1/videos/${encodeURIComponent(task.taskId)}/content?index=0`, contentType: 'video/mp4', usage: s.usage || null };
        return { state: ['failed','cancelled','expired'].includes(s.status) ? 'failed' : 'polling', usage: s.usage || null };
      }
      const s = (await get(`https://api.apimart.ai/v1/tasks/${encodeURIComponent(task.taskId)}`)).data;
      if (s?.status === 'completed') {
        const url = model.modality === 'image' ? s.result?.images?.[0]?.url : s.result?.videos?.[0]?.url;
        if (!url) throw new Error('Result retrieval missing video');
        return { state: 'generated', assetUrl: Array.isArray(url) ? url[0] : url, contentType: model.modality === 'image' ? 'image/jpeg' : 'video/mp4', usage: null };
      }
      return { state: s?.status === 'failed' ? 'failed' : 'polling', progress: s?.progress || 0 };
    },
    async result(task) {
      if (gateway !== 'fal') return this.status(task);
      const r = await get(falUrl(task.resultUrl));
      if (!r.images?.[0]?.url) throw new Error('Result retrieval missing image');
      return { state: 'generated', assetUrl: r.images[0].url, contentType: r.images[0].content_type || 'image/png', width: r.images[0].width, height: r.images[0].height,
        usage: { cost: null, estimated_cost_usd: FAL_ROUTES[model.route]?.cost_estimate_usd ?? null } };
    },
    async cancel(task) {
      if (gateway !== 'fal' || !task.cancelUrl) return { supported: false };
      await json(fetchImpl, falUrl(task.cancelUrl), { method: 'PUT', headers });
      // A cancel request does not prove that a running request wasn't billed.
      return { supported: true, reconcile: true };
    },
    downloadHeaders(url) {
      return gateway === 'openrouter' && new URL(url).origin === 'https://openrouter.ai' ? { Authorization: headers.Authorization } : {};
    },
  };
}
