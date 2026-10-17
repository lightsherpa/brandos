import {isUuid} from '../../../shared/brief-draft-payload.js';
import {supabaseAdmin} from './supabase.js';
const fail=(message,status=409)=>Object.assign(Error(message),{status});
export function referenceIds(value) {
 if(value===undefined||value===null)return [];
 if(!Array.isArray(value)||value.length>3||value.some(id=>!isUuid(id)))throw fail('Choose up to three uploaded brief references',400);
 return [...new Set(value)];
}
// Resolve durable IDs within one brand, owner and brief. URLs from callers are never trusted.
export async function loadBriefReferences({ids,brandId,userId,briefId,db=supabaseAdmin}) {
 const selected=referenceIds(ids);if(!selected.length)return [];
 const {data,error}=await db.from('brief_references').select('*').in('id',selected).eq('brand_id',brandId);
 if(error)throw fail('Brief references are unavailable',503);
 if(data?.length!==selected.length||data.some(row=>row.cleanup_pending || (briefId?row.brief_id!==briefId:row.owner_id!==userId||row.brief_id)))throw fail('Reference does not belong to this brief',403);
 return Promise.all(data.map(async row=>{const {data:signed,error}=await db.storage.from('brief-references').createSignedUrl(row.storage_path,3600);if(error||!signed?.signedUrl)throw fail('Brief reference is unavailable',503);return {id:row.id,name:row.name,role:'inspiration',url:signed.signedUrl,scope:'brief',source:'brief'};}));
}
export async function bindBriefReferences({ids,brandId,userId,briefId,db=supabaseAdmin}) {
 const selected=referenceIds(ids);if(!selected.length)return;
 const {data,error}=await db.from('brief_references').update({brief_id:briefId}).in('id',selected).eq('brand_id',brandId).eq('owner_id',userId).is('brief_id',null).eq('cleanup_pending',false).select('id');
 if(error||data?.length!==selected.length)throw fail('Brief reference was already used; reload the brief');
}

// Claim unbound rows before deleting Storage so a concurrent run cannot bind a
// reference whose file is being removed. Keep failed claims for a safe retry.
export async function discardBriefReferences({db=supabaseAdmin,brandId,userId,draftId,id}) {
 let query=db.from('brief_references').update({cleanup_pending:true}).eq('brand_id',brandId).eq('owner_id',userId).is('brief_id',null);
 query=id?query.eq('id',id):query.eq('draft_id',draftId);
 const {data:rows,error}=await query.select('id,storage_path');
 if(error)throw fail('Could not discard brief photos',503);
 for(const row of rows||[]){
  const {error:storageError}=await db.storage.from('brief-references').remove([row.storage_path]);
  if(storageError)throw fail('Could not discard brief photos; retry',503);
  const {error:deleteError}=await db.from('brief_references').delete().eq('id',row.id).eq('owner_id',userId).is('brief_id',null).eq('cleanup_pending',true);
  if(deleteError)throw fail('Could not finish photo cleanup; retry',503);
 }
}
