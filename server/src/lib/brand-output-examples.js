import {hasPermission} from './permissions.js';
export const canAddBrandExample=(actor,workspaceId)=>hasPermission(actor,'brand.manage',workspaceId);
export function approvedExampleSnapshot(group) {
 if(!group?.complete||group.status!=='delivered'||!group.outputIds?.length)throw Object.assign(Error('Accept the finished deliverable before adding it to Brand Core'),{status:409});
 const {type,index,html,assetUrl}=group;
 let assetRef=null;
 if(assetUrl&&!html){try{const url=new URL(assetUrl),base=new URL(process.env.SUPABASE_URL||'http://127.0.0.1:54321');const match=url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/);if(url.origin!==base.origin||!match||match[1]!=='bio-sources')throw Error();assetRef={bucket:match[1],path:decodeURIComponent(match[2])};if(assetRef.path.split('/').some(part=>part==='..'||part==='.')||/[\\%\x00]/.test(assetRef.path))throw Error();}catch{throw Object.assign(Error('Save the generated output asset before adding it to Brand Core'),{status:409});}}
 // Keep only identity and a durable asset pointer. Canonical text/HTML stay in outputs once.
 return {type,index,assetRef};
}
export async function saveBrandOutputExample({db,actor,brief,group}) {
 if(!canAddBrandExample(actor,brief.brand.workspace_id))throw Object.assign(Error('Brand Core edit permission required'),{status:403});
 const snapshot=approvedExampleSnapshot(group);
 if(snapshot.assetRef&&!snapshot.assetRef.path.startsWith(`${brief.brand.workspace_id}/${brief.brand_id}/outputs/`))throw Object.assign(Error('Only the generated output can become a Brand Core example'),{status:409});
 const {data,error}=await db.rpc('propose_brand_output_example',{p_brand_id:brief.brand_id,p_brief_id:brief.id,p_delivery_key:group.id,p_output_ids:group.outputIds,p_snapshot:snapshot,p_user_id:actor.userId});
 if(error)throw Object.assign(Error('Could not save Brand Core example'),{status:error.message?.includes('APPROVED_OUTPUT_REQUIRED')?409:503});
 return Array.isArray(data)?data[0]:data;
}
