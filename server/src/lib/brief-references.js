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
 if(data?.length!==selected.length||data.some(row=>briefId?row.brief_id!==briefId:row.owner_id!==userId||row.brief_id))throw fail('Reference does not belong to this brief',403);
 return Promise.all(data.map(async row=>{const {data:signed,error}=await db.storage.from('brief-references').createSignedUrl(row.storage_path,3600);if(error||!signed?.signedUrl)throw fail('Brief reference is unavailable',503);return {id:row.id,name:row.name,role:'inspiration',url:signed.signedUrl,scope:'brief',source:'brief'};}));
}
export async function bindBriefReferences({ids,brandId,userId,briefId,db=supabaseAdmin}) {
 const selected=referenceIds(ids);if(!selected.length)return;
 const {data,error}=await db.from('brief_references').update({brief_id:briefId}).in('id',selected).eq('brand_id',brandId).eq('owner_id',userId).is('brief_id',null).select('id');
 if(error||data?.length!==selected.length)throw fail('Brief reference was already used; reload the brief');
}
