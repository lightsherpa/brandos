import {supabaseAdmin} from './supabase.js';
import {validateFoundationVisual} from './brand-foundation.js';
// Client edits may select their own approved durable uploads, not another brand's.
export async function validateFoundationAssets(brandId, visual = {}, previous = {}) {
  const malformed = validateFoundationVisual(visual);
  if (malformed) return malformed;
  const logos = [visual.logo,...Object.values(visual.logo?.variants || {})].filter(Boolean);
  if (visual.logo && JSON.stringify(visual.logo) !== JSON.stringify(previous.logo) && !logos.some(l=>l.sourceId)) return 'Upload a logo or keep the discovered logo';
  const fonts = (visual.type || []).filter(f=>f.sourceId);
  const ids = [...new Set([...logos,...fonts].map(item=>item.sourceId).filter(Boolean))];
  if (!ids.length) return null;
  const {data,error} = await supabaseAdmin.from('bio_sources').select('id,signals,raw_ref').eq('brand_id',brandId).eq('kind','file_upload').eq('bucket','visual').in('id',ids);
  if (error) return 'Could not verify foundation uploads';
  const rows = new Map((data || []).map(row=>[row.id,row]));
  for (const logo of logos) {
    if (!logo.sourceId) continue;
    const row=rows.get(logo.sourceId);
    if (!row?.raw_ref || row.signals?.rights_confirmed !== true || row.signals.asset_role !== 'logo' || row.signals.ext !== 'png' || row.signals.purpose === 'aspiration') return 'Choose an approved logo uploaded to this brand';
  }
  for (const font of fonts) {
    const row=rows.get(font.sourceId);
    if (!row?.raw_ref || row.signals?.rights_confirmed !== true || row.signals.asset_kind !== 'font' || row.signals.font_family !== font.family || row.signals.purpose === 'aspiration') return 'Choose a licensed font uploaded to this brand';
  }
  return null;
}
