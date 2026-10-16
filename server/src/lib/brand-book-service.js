import {createHash,randomBytes} from 'node:crypto';
import {hasPermission,isWorkspaceOwner} from './permissions.js';
import {bioIntegrityError} from './brand-source-integrity.js';
import {productionBlocker} from './bio-stage.js';
import {certifiedVisualSourceIds} from './visual-assets.js';

export const brandBookGuidelinesEnabled=()=>['1','true'].includes(String(process.env.BRAND_BOOK_GUIDELINES||'').toLowerCase());
export const BOOK_ITEMS=['logos','palette','typography','voice','imagery','strategy'];
const fail=(code,message,status=400)=>Object.assign(Error(message),{code,status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf'};
const MAX_BYTES=64*1024*1024;
const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/\/storage\/v1\/object\/sign\//.test(u.pathname)&&!['token','access_token','apikey','api_key','signature'].some(key=>u.searchParams.has(key))?u.href:null;}catch{return null;}};
const TOP_FIELDS=['identity','audience','positioning','goals','strategic','aspirations','visual','voice','applications','learnedRules','learned_rules','examples'];
const PRIVATE_KEYS=new Set(['raw_ref','rawRef','previewUrl','evidence_url','access_token','refresh_token','apiKey','token','confidence','evidence','fieldStatus','sourceIdentity','sourceIntegrity','owner_feedback','reference_intake','logoRights']);
function scrub(value){
 if(Array.isArray(value))return value.map(scrub);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!PRIVATE_KEYS.has(key)).map(([key,v])=>[key,/^(url|href|asset_url|screenshot)$/i.test(key)?safeUrl(v):scrub(v)]));
 if(typeof value==='string'&&(/\/storage\/v1\/object\/sign\/|[?&](?:token|access_token|apikey|signature)=/i.test(value)))return null;
 return value;
}
function cleanBio(row){return {id:row.id,version:row.version,certified:true,certified_at:row.certified_at||null,payload:scrub(Object.fromEntries(TOP_FIELDS.filter(key=>row.payload?.[key]!=null).map(key=>[key,row.payload[key]])))};}
export function exportOptions(input={}){
 const locale=input.locale||'en',format=input.format||'website';
 if(!['en','es','ar'].includes(locale))throw fail('LOCALE_INVALID','Choose en, es or ar.');
 if(!['website','kit'].includes(format))throw fail('FORMAT_INVALID','Choose website or kit.');
 const items=input.items==null?[...BOOK_ITEMS]:Array.isArray(input.items)?input.items:String(input.items).split(',');
 if(items.some(item=>!BOOK_ITEMS.includes(item))||!items.length)throw fail('ITEMS_INVALID','Choose approved export categories.');
 const sourceIds=input.sourceIds==null?null:Array.isArray(input.sourceIds)?input.sourceIds:String(input.sourceIds).split(',').filter(Boolean);
 if(sourceIds&&sourceIds.some(id=>typeof id!=='string'||id.length>80))throw fail('ASSETS_INVALID','Choose approved assets.');
 return {locale,format,items:[...new Set(items)],sourceIds:sourceIds?[...new Set(sourceIds)]:null};
}
function groupFor(source){return source.signals?.asset_kind==='font'?'typography':source.signals?.asset_role==='logo'?'logos':'imagery';}
function approvedSource(source,brand){
 const s=source.signals||{},ref=source.raw_ref,ext=String(s.ext||'').toLowerCase();
 return source.kind==='file_upload'&&source.bucket==='visual'&&s.rights_confirmed===true&&s.purpose!=='aspiration'&&MIME[ext]&&typeof ref==='string'&&!ref.includes('..')&&!/^\w+:/.test(ref)&&ref.startsWith(`${brand.workspace_id}/${brand.id}/`);
}
function publicSource(source){
 const s=source.signals||{};
 return {id:source.id,kind:source.kind,src:String(source.src||'').split(/[\\/]/).at(-1),signals:Object.fromEntries(['asset_kind','asset_role','font_family','font_usage','license_type','license_reference','rights_confirmed','redistribution_allowed','ext','mime','logo_use','reference_tag'].filter(key=>s[key]!=null).map(key=>[key,s[key]])),previewOnly:groupFor(source)==='typography'&&s.redistribution_allowed!==true};
}
function portable(value,assetMap={}){
 if(Array.isArray(value))return value.map(v=>portable(v,assetMap));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['id','source_id','source','sourceProperty','selector','pendingRights'].includes(key)&&!PRIVATE_KEYS.has(key)).flatMap(([key,v])=>key==='sourceId'?(assetMap[v]?[['file',assetMap[v]]]:[]):[[/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(key)?`variant-${Object.keys(value).indexOf(key)+1}`:key,portable(v,assetMap)]]));
 return scrub(value);
}
function selectSources(snapshot,options){
 const known=new Set(snapshot.assets.map(asset=>asset.id));
 if(options.sourceIds?.some(id=>!known.has(id)))throw fail('ASSETS_INVALID','An asset is not approved in this certified version.',409);
 return snapshot.assets.filter(asset=>options.items.includes(groupFor(asset))&&(!options.sourceIds||options.sourceIds.includes(asset.id))&&!publicSource(asset).previewOnly);
}
const strings={en:{readme:'Brand Core guideline export',edition:'Certified edition',rights:'Commercial fonts are preview-only unless redistribution is explicitly permitted. Font names and licence references are included; no font redistribution right is inferred.',open:'Open index.html to view the standalone guideline website. This package contains actual selected approved assets with relative paths.',kit:'This selected asset kit contains only the chosen categories and actual approved asset files.',missing:'Some recorded assets are preview-only or unavailable and are not included.'},es:{readme:'Exportación de la guía Brand Core',edition:'Edición certificada',rights:'Las tipografías comerciales solo se previsualizan salvo permiso explícito de redistribución. Se incluyen nombres y referencias de licencia; no se presupone permiso de redistribución.',open:'Abre index.html para ver la guía independiente. El paquete contiene los recursos aprobados seleccionados y rutas relativas.',kit:'Este kit contiene solo las categorías elegidas y los archivos de recursos aprobados.',missing:'Algunos recursos registrados son solo de vista previa o no están disponibles y no se incluyen.'},ar:{readme:'تصدير دليل Brand Core',edition:'الإصدار المعتمد',rights:'الخطوط التجارية للمعاينة فقط ما لم يسمح بإعادة توزيعها صراحة. تتضمن الحزمة أسماء الخطوط ومراجع الترخيص دون افتراض حق إعادة توزيعها.',open:'افتح index.html لعرض دليل العلامة المستقل. تحتوي الحزمة على الأصول المعتمدة المحددة بمسارات نسبية.',kit:'تحتوي حزمة الأصول هذه على الفئات المحددة والملفات المعتمدة الفعلية فقط.',missing:'بعض الأصول المسجلة للمعاينة فقط أو غير متاحة ولم تُضمّن.'}};

export function createBrandBookService({db,now=()=>Date.now(),tokenBytes=()=>randomBytes(32),renderGuidelines}={}){
 const queryError=result=>{if(result.error)throw fail('BOOK_UNAVAILABLE','Brand Book is temporarily unavailable.',503);return result.data;};
 async function access(auth,brandId,owner=false){const brand=queryError(await db.from('brands').select('id,name,url,workspace_id').eq('id',brandId).maybeSingle());if(!brand||!hasPermission(auth,'bio.read',brand.workspace_id))throw fail('BOOK_FORBIDDEN','Brand Book access is required.',403);if(owner&&!isWorkspaceOwner(auth,brand.workspace_id))throw fail('OWNER_REQUIRED','Only the workspace owner can share this Brand Book.',403);return brand;}
 async function load(auth,brandId,version){
  if(version!=null&&(!/^\d+$/.test(String(version))||Number(version)<1))throw fail('VERSION_INVALID','Choose a certified version.');
  const brand=await access(auth,brandId);
  const latest=queryError(await db.from('bios').select('*').eq('brand_id',brandId).order('version',{ascending:false}).limit(1).maybeSingle());
  const integrity=latest&&bioIntegrityError(latest,brand);if(integrity)throw fail(integrity.code,integrity.error,409);
  let q=db.from('bios').select('*').eq('brand_id',brandId).eq('certified',true);
  q=version!=null?q.eq('version',Number(version)):q.order('version',{ascending:false}).limit(1);
  const row=queryError(await q.maybeSingle());
  if(!row||row.certified!==true)throw fail('BOOK_NOT_CERTIFIED','Choose a certified Brand Core version.',409);
  const invalid=bioIntegrityError(row,brand)||productionBlocker(row,new Date(now()));if(invalid)throw fail(invalid.code,invalid.error||invalid.message,409);
  const ids=[...certifiedVisualSourceIds(row.payload?.visual||{})];
  const sources=ids.length?queryError(await db.from('bio_sources').select('id,kind,bucket,src,signals,raw_ref').eq('brand_id',brandId).in('id',ids)):[];
  return {brand:{id:brand.id,name:brand.name,url:safeUrl(brand.url)},bio:cleanBio(row),assets:(sources||[]).filter(source=>approvedSource(source,brand)).sort((a,b)=>String(a.id).localeCompare(String(b.id))),workspaceId:brand.workspace_id};
 }
 async function snapshot(auth,brandId,version){
  const value=await load(auth,brandId,version),assetMap={},sources=await Promise.all(value.assets.map(async source=>{const {data,error}=await db.storage.from('bio-sources').createSignedUrl(source.raw_ref,600);const url=!error?data?.signedUrl:null;if(url)assetMap[source.id]=url;return {...publicSource(source),evidence_url:url||null};}));
  return {brand:value.brand,bio:value.bio,sources,assetMap,mode:'certified',canShare:isWorkspaceOwner(auth,value.workspaceId),canExport:true};
 }
 async function bytesFor(asset){
  const {data,error}=await db.storage.from('bio-sources').download(asset.raw_ref);if(error||!data)throw fail('ASSET_UNAVAILABLE','An approved asset could not be read. Retry the export.',503);
  const buffer=Buffer.from(await data.arrayBuffer());if(buffer.length>15*1024*1024)throw fail('ASSET_TOO_LARGE','An approved asset exceeds the download limit.',413);return buffer;
 }
 async function packageExport(auth,brandId,version,input){
  const options=exportOptions(input),value=await load(auth,brandId,version),assets=selectSources(value,options),files=[],assetMap={},manifestAssets=[];let total=0;
  for(const [i,asset] of assets.entries()){
   const bytes=await bytesFor(asset);total+=bytes.length;if(total>MAX_BYTES)throw fail('EXPORT_TOO_LARGE','Select fewer assets for a package below 64 MB.',413);
   const file=`assets/${String(i+1).padStart(3,'0')}.${asset.signals.ext.toLowerCase()}`;assetMap[asset.id]=file;files.push({name:file,data:bytes});manifestAssets.push({file,label:publicSource(asset).src,category:groupFor(asset),bytes:bytes.length,sha256:hash(bytes)});
  }
  const c=strings[options.locale],p=value.bio.payload,metadata={brand:value.brand.name,version:value.bio.version,certifiedAt:value.bio.certified_at,locale:options.locale,format:options.format,items:options.items,assets:manifestAssets};
  files.push({name:'manifest.json',data:JSON.stringify(metadata,null,2)},{name:'README.txt',data:`${c.readme}\n${value.brand.name} · ${c.edition} ${value.bio.version}\n\n${options.format==='website'?c.open:c.kit}\n\n${c.rights}\n\n${c.missing}\n`});
  const addJSON=(name,data)=>files.push({name,data:JSON.stringify(portable(data,assetMap),null,2)});
  if(options.items.includes('palette')){addJSON('palette.json',p.visual?.palette||[]);files.push({name:'tokens.css',data:':root {\n'+(p.visual?.palette||[]).filter(v=>/^#[\da-f]{6}$/i.test(v.hex)).map((v,i)=>`  --brand-color-${i+1}: ${v.hex};`).join('\n')+'\n}\n'});}
  if(options.items.includes('typography'))addJSON('typography.json',(p.visual?.type||[]).map(font=>({family:font.family,kind:font.kind,weight:font.weight,style:font.style,license:font.license,licenseReference:safeUrl(value.assets.find(asset=>asset.id===font.sourceId)?.signals?.license_reference),provider:font.provider,...(assetMap[font.sourceId]?{file:assetMap[font.sourceId]}:{previewOnly:true})})));
  if(options.items.includes('voice'))addJSON('voice.json',p.voice||{});
  if(options.items.includes('strategy'))addJSON('strategy.json',Object.fromEntries(['identity','audience','positioning','goals','strategic','aspirations'].filter(key=>p[key]).map(key=>[key,p[key]])));
  if(options.items.includes('logos'))addJSON('logos.json',p.visual?.logo||{});
  if(options.items.includes('imagery'))addJSON('imagery.json',{references:p.visual?.references||[],imagery:p.visual?.imagery||[],avoid:p.visual?.avoid||[]});
  if(options.format==='website'){if(!renderGuidelines)throw fail('RENDERER_UNAVAILABLE','Guideline export is unavailable.',503);files.push({name:'index.html',data:await renderGuidelines({brand:value.brand,bio:value.bio,sources:value.assets.map(publicSource),locale:options.locale,assetMap,mode:'export',items:options.items})});}
  return {files,filename:`brand-core-v${value.bio.version}-${options.locale}-${options.format}.zip`};
 }
 async function ownerSnapshot(auth,brandId,version){const value=await load(auth,brandId,version);if(!isWorkspaceOwner(auth,value.workspaceId))throw fail('OWNER_REQUIRED','Only the workspace owner can share this Brand Book.',403);return value;}
 async function createShare(auth,brandId,body={}){
  if(body.version==null)throw fail('VERSION_REQUIRED','Choose the exact certified version.');
  const options=exportOptions(body),days=body.expiresInDays??7;if(!Number.isInteger(days)||days<1||days>90)throw fail('EXPIRY_INVALID','Choose an expiry from 1 to 90 days.');
  const value=await ownerSnapshot(auth,brandId,body.version),assets=selectSources(value,options),boundAssets=[];let total=0;
  for(const [i,asset] of assets.entries()){const bytes=await bytesFor(asset);total+=bytes.length;if(total>MAX_BYTES)throw fail('SHARE_TOO_LARGE','Select fewer assets for this share.',413);boundAssets.push({...asset,public_name:`asset-${String(i+1).padStart(3,'0')}.${asset.signals.ext.toLowerCase()}`,sha256:hash(bytes)});}
  const token=tokenBytes().toString('base64url'),expiresAt=new Date(now()+days*86400000).toISOString();
  const result=queryError(await db.from('brand_book_shares').insert({brand_id:brandId,bio_id:value.bio.id,bio_version:value.bio.version,created_by:auth.userId,token_hash:hash(token),locale:options.locale,items:options.items,scope:'guidelines_read',expires_at:expiresAt,snapshot:{brand:value.brand,bio:value.bio,assets:boundAssets}}).select('id,created_at').single());
  return {id:result.id,url:`/api/brand-book/shared/${token}`,expiresAt,version:value.bio.version,locale:options.locale};
 }
 async function shares(auth,brandId){await access(auth,brandId,true);const rows=queryError(await db.from('brand_book_shares').select('id,bio_version,locale,items,created_at,expires_at,revoked_at').eq('brand_id',brandId).order('created_at',{ascending:false}));return {shares:(rows||[]).map(row=>({id:row.id,version:row.bio_version,locale:row.locale,items:row.items,createdAt:row.created_at,expiresAt:row.expires_at,revokedAt:row.revoked_at}))};}
 async function revokeShare(auth,brandId,id){await access(auth,brandId,true);const row=queryError(await db.from('brand_book_shares').select('id,revoked_at').eq('id',id).eq('brand_id',brandId).maybeSingle());if(!row)throw fail('SHARE_NOT_FOUND','Share not found.',404);if(!row.revoked_at)queryError(await db.from('brand_book_shares').update({revoked_at:new Date(now()).toISOString()}).eq('id',id).eq('brand_id',brandId).is('revoked_at',null).select('id').maybeSingle());return {revoked:true};}
 async function readShare(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail('SHARE_NOT_FOUND','Share not found.',404);
  const row=queryError(await db.from('brand_book_shares').select('id,bio_version,locale,items,scope,snapshot,expires_at,revoked_at').eq('token_hash',hash(token)).maybeSingle());
  if(!row||row.scope!=='guidelines_read'||row.revoked_at||new Date(row.expires_at).getTime()<=now())throw fail('SHARE_NOT_FOUND','Share not found or expired.',404);
  return row;
 }
 async function sharedHTML(token){const row=await readShare(token),{brand,bio,assets}=row.snapshot,assetMap=Object.fromEntries(assets.map(asset=>[asset.id,`/api/brand-book/shared/${token}/assets/${asset.public_name}`]));return renderGuidelines({brand,bio,sources:assets.map(publicSource),locale:row.locale,assetMap,mode:'shared',items:row.items});}
 async function sharedAsset(token,name){const row=await readShare(token),asset=row.snapshot.assets.find(asset=>asset.public_name===name);if(!asset||publicSource(asset).previewOnly)throw fail('ASSET_NOT_FOUND','Asset not found.',404);const bytes=await bytesFor(asset);if(hash(bytes)!==asset.sha256)throw fail('ASSET_CHANGED','This approved asset is unavailable.',410);return {bytes,mime:MIME[asset.signals.ext.toLowerCase()]};}
 return {load,snapshot,packageExport,createShare,shares,revokeShare,readShare,sharedHTML,sharedAsset};
}

// A deliberately small ZIP writer (stored entries) with no external URLs or
// temporary files. Only generated safe names and already authorized bytes enter.
export function buildBookZip(files){
 const crc32=buffer=>{let crc=-1;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;};
 if(files.length>65535)throw fail('EXPORT_TOO_LARGE','Select fewer files for this package.',413);
 const local=[],central=[];let offset=0;
 for(const file of files){if(!/^(?:assets\/\d{3,6}\.(?:png|jpe?g|webp|woff2?|ttf|otf)|[a-zA-Z0-9-]+\.(?:json|css|html|txt))$/.test(file.name))throw fail('EXPORT_PATH_INVALID','Invalid package path.');const name=Buffer.from(file.name),data=Buffer.isBuffer(file.data)?file.data:Buffer.from(String(file.data)),crc=crc32(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);local.push(header,name,data);const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=header.length+name.length+data.length;}
 const centralBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,centralBytes,end]);
}
