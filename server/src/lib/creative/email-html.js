const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeEmailUrl(value) {
  try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|0\.|\[|.*\.local$)/i.test(u.hostname); } catch{return false;}
}
export function durablePublicUrl(value) {
  if(!safeEmailUrl(value))return false;
  const u=new URL(value);
  return !/\/object\/sign\/|\/authenticated\//i.test(u.pathname)&&![...u.searchParams.keys()].some(k=>/token|signature|expires|x-amz-|x-goog-/i.test(k));
}
export const EMAIL_CONTRACT = `Return only a JSON object with subject, preheader and blocks. Each block is one of:
{"type":"heading","text":"..."}, {"type":"text","text":"..."}, {"type":"image","assetId":"approved asset ID","alt":"descriptive alt text"}, {"type":"button","text":"...","url":"https://..."}, {"type":"divider"}, {"type":"footer","text":"brand name and required footer content"}.
Choose copy and layout order for this brief. Use no HTML, CSS, scripts, invented assets, or unresolved placeholders. Only use asset IDs and URLs explicitly supplied. Include a footer. This is preview/export only.`;
export function parseEmail(text) {
  const value=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  if(!value||!Array.isArray(value.blocks))throw new Error('Email content must contain structured blocks');return value;
}
export function validateEmail(content,{assets=[],requiredContent=[],forExport=false}={}) {
  const errors=[];
  if(typeof content?.subject!=='string'||!content.subject.trim()||content.subject.length>200)errors.push('Subject required (maximum 200 characters)');
  if(typeof content?.preheader!=='string'||!content.preheader.trim()||content.preheader.length>300)errors.push('Preheader required (maximum 300 characters)');
  if(!Array.isArray(content?.blocks)||content.blocks.length<1||content.blocks.length>60)errors.push('1–60 content blocks required');
  const blocks=Array.isArray(content?.blocks)?content.blocks:[];
  if(!blocks.some(b=>b?.type==='footer'))errors.push('Brand footer required');
  for(const b of blocks){
    if(!b||!['heading','text','image','button','divider','footer'].includes(b.type)){errors.push('Unsupported email component');continue;}
    if(['heading','text','button','footer'].includes(b.type)&&(typeof b.text!=='string'||!b.text.trim()||b.text.length>10000))errors.push(`${b.type} text required`);
    if(b.type==='button'&&!safeEmailUrl(b.url))errors.push('Button requires a valid HTTPS URL');
    if(b.type==='image'){
      const a=assets.find(a=>a.id===b.assetId);
      if(typeof b.alt!=='string'||!b.alt.trim())errors.push('Image alt text required');
      if(!a)errors.push('Image asset reference not found');
      if(a&&forExport&&(!a.publishable||!durablePublicUrl(a.url)))errors.push('Export requires explicitly publishable durable image URLs');
    }
  }
  const text=[content?.subject,content?.preheader,...blocks.map(b=>b?.text)].join('\n');
  if(/\{\{|\}\}|\[\s*(insert|placeholder|brand|url)|\b(TODO|TBD)\b/i.test(JSON.stringify(content)))errors.push('Unresolved placeholder');
  for(const required of requiredContent)if(!text.toLowerCase().includes(String(required).toLowerCase()))errors.push(`Required brand content missing: ${required}`);
  return {passed:errors.length===0,violations:errors};
}
export function renderEmail(content,{assets=[],requiredContent=[],forExport=false}={}) {
  const qa=validateEmail(content,{assets,requiredContent,forExport});
  if(!qa.passed)throw Object.assign(new Error(qa.violations.join('; ')),{qa});
  const rows=content.blocks.map(b=>{
    let inner='';
    if(b.type==='heading')inner=`<h1 style="margin:0;font:700 28px/1.2 Arial,sans-serif;color:#18212b">${esc(b.text)}</h1>`;
    if(b.type==='text'||b.type==='footer')inner=`<p style="margin:0;font:${b.type==='footer'?12:16}px/1.6 Arial,sans-serif;color:#364152">${esc(b.text).replace(/\n/g,'<br>')}</p>`;
    if(b.type==='divider')inner='<hr style="border:0;border-top:1px solid #dce1e6;margin:0">';
    if(b.type==='button')inner=`<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#18212b" style="padding:14px 24px"><a href="${esc(b.url)}" style="font:bold 16px Arial,sans-serif;color:#ffffff;text-decoration:none">${esc(b.text)}</a></td></tr></table>`;
    if(b.type==='image'){const a=assets.find(a=>a.id===b.assetId);inner=safeEmailUrl(a.url)?`<img src="${esc(a.url)}" alt="${esc(b.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0">`:`<p>${esc(b.alt)} (asset preview unavailable)</p>`;}
    return `<tr><td style="padding:12px 24px">${inner}</td></tr>`;
  }).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(content.subject)}</title></head><body style="margin:0;padding:0;background:#f3f4f6"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(content.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 0"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff">${rows}</table></td></tr></table></body></html>`;
  const plainText=[content.subject,content.preheader,...content.blocks.map(b=>b.type==='button'?`${b.text}: ${b.url}`:b.type==='image'?b.alt:b.text||'')].filter(Boolean).join('\n\n');
  const used=new Set(content.blocks.filter(b=>b.type==='image').map(b=>b.assetId));
  return {kind:'email_html',subject:content.subject,preheader:content.preheader,content,html,plainText,assets:assets.filter(a=>used.has(a.id)),qa};
}
