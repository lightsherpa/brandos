import { createHash } from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { fetchAsset as safeFetchAsset } from '../lib/reference-bridge.js';

export const EMAIL_ASSETS_BUCKET = 'email-assets';
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

// All replacements commit together. A partial upload leaves a retryable draft;
// immutable hashes let retries reuse objects without overwriting cached bytes.
export async function hostEmailAssets(html, { storage = supabaseAdmin.storage, fetchAsset = safeFetchAsset } = {}) {
  const assets = [];
  try {
    if (!html) throw new Error('Empty email');
    const sources = [...new Set([...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)].map(m => m[2]))];
    const replacements = new Map();
    for (const source of sources) {
      const asset = await fetchAsset(source.replaceAll('&amp;', '&'), { kind: 'logo' });
      const ext = extensions[asset.type];
      if (!ext || !asset.bytes?.length) throw new Error('Unsupported email image');
      const sha256 = createHash('sha256').update(asset.bytes).digest('hex');
      const path = `sha256/${sha256}.${ext}`;
      const bucket = storage.from(EMAIL_ASSETS_BUCKET);
      const { error } = await bucket.upload(path, asset.bytes, { contentType: asset.type, cacheControl: '31536000', upsert: false });
      if (error && String(error.statusCode) !== '409') throw error;
      const url = bucket.getPublicUrl(path).data?.publicUrl;
      if (!url || !/^https?:\/\//.test(url)) throw new Error('Public URL unavailable');
      replacements.set(source, url.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'));
      assets.push({ path, sha256, type: asset.type, bytes: asset.bytes.length, url });
    }
    html = html.replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi, (match, prefix, quote, source) => `${prefix}${quote}${replacements.get(source)}${quote}`);
    return { html, assets, delivery_ready: true, requires_asset_hosting: false, outbound_sending_enabled: false };
  } catch {
    return { html, assets: [], delivery_ready: false, requires_asset_hosting: true, outbound_sending_enabled: false, hosting_error: 'Email image hosting failed' };
  }
}
