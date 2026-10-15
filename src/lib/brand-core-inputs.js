export const brandCoreInputsEnabled = import.meta.env?.VITE_BRAND_CORE_INPUTS === '1';
export const LOGO_USES = ['primary','secondary','mark','small','light','dark','monochrome'];
export const REFERENCE_TAGS = ['product','lifestyle','usage'];
export const PALETTE_GROUPS = ['primary','secondary','tertiary','neutral','accent'];
export const MAX_REFERENCE_BATCH = 10;
export const MAX_ASSET_BYTES = 15 * 1024 * 1024;
export const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;
export function assetByteLimit(kind) {
  return kind === 'reference' ? MAX_REFERENCE_BYTES : MAX_ASSET_BYTES;
}
export function fileIssue(file, kind) {
  if (!file?.size) return 'empty';
  if (file.size > assetByteLimit(kind)) return 'size';
  const extension = file.name.split('.').pop().toLowerCase();
  const allowed = kind === 'font' ? ['woff2','woff','otf','ttf'] : kind === 'logo' ? ['png'] : ['png','jpg','jpeg','webp'];
  return allowed.includes(extension) ? null : 'format';
}
export function fontDescriptors(name) {
  const weight = /black|heavy/i.test(name) ? '900' : /extrabold|ultrabold/i.test(name) ? '800' : /semibold|demibold/i.test(name) ? '600' : /bold/i.test(name) ? '700' : /medium/i.test(name) ? '500' : /extralight|ultralight/i.test(name) ? '200' : /light/i.test(name) ? '300' : /thin/i.test(name) ? '100' : '400';
  return {weight,style:/italic|oblique/i.test(name)?'italic':'normal'};
}
export function appendUploadedAsset(current, item, source, previewUrl) {
  const entry={sourceId:source.id,name:item.file.name,...(previewUrl?{previewUrl}:{})};
  if(item.kind==='logo') {
    const logo={...entry,source:item.file.name,conf:100,use:item.tag};
    return {...current,logo:{...current.logo,...(!current.logo?.sourceId?logo:{}),variants:{...current.logo?.variants,[source.id]:logo}}};
  }
  if(item.kind==='font') return {...current,type:[...(current.type||[]),{...entry,family:item.family,kind:item.usage,license:'commercial',...item.descriptors}]};
  return {...current,references:[...(current.references||[]),{...entry,role:'canonical',tag:item.tag,pendingRights:true}]};
}
const UPLOAD_CODE_KEYS = {
  EMPTY:'empty', EXT:'format', MIME:'format', SVG_UNSUPPORTED:'format', LOGO_EXT:'format',
  FONT_INVALID:'invalidFont', LOGO_INVALID:'invalidLogo', STALE_BIO_VERSION:'stale', STORAGE_REJECTED:'format',
};
/** Copy key for a failed Brand Core upload. Size failures (413 / TOO_LARGE / PAYLOAD_TOO_LARGE) never fall through to a generic message. */
export function uploadErrorCopyKey(json = {}, status = 0) {
  if (json?.code === 'TOO_LARGE' || json?.code === 'PAYLOAD_TOO_LARGE' || Number(status) === 413) return 'size';
  if (UPLOAD_CODE_KEYS[json?.code]) return UPLOAD_CODE_KEYS[json.code];
  if (status === 401) return 'auth';
  if (status === 403) return 'permission';
  if (status >= 500) return 'service';
  return null;
}
export function uploadMetadata(item) {
  if(item.kind==='font')return {fontFamily:item.family,fontUsage:item.usage,licenseType:'commercial',rightsConfirmed:true,fontWeight:item.descriptors.weight,fontStyle:item.descriptors.style};
  if(item.kind==='logo')return {assetRole:'logo',logoVariant:item.tag==='dark'?'light':'dark',logoUse:item.tag,rightsConfirmed:true};
  return {assetRole:'canonical',referenceIntake:true,referenceTag:item.tag,referenceAppend:true,rightsConfirmed:false};
}
