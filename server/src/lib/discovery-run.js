import {supabaseAdmin} from './supabase.js';
export function publicDiscoveryError(error){
 const message=String(error?.message||'');
 if(/retrieval|scrape|readable/i.test(message))return 'SOURCE_UNREADABLE';
 if(/budget/i.test(message))return 'BUDGET_BLOCKED';
 if(/reader|synthesis|truncat|compiler|JSON/i.test(message))return 'INTERPRETATION_FAILED';
 return 'DISCOVERY_FAILED';
}
export async function recordDiscoveryStage({discoveryId,brandId,workspaceId,stage,status='running',bioId=null,errorCode=null}){
 if(!discoveryId)return;
 const {error}=await supabaseAdmin.from('discovery_runs').upsert({id:discoveryId,brand_id:brandId,workspace_id:workspaceId,stage,status,error_code:errorCode,bio_id:bioId,updated_at:new Date().toISOString()},{onConflict:'id'});
 if(error)throw new Error('Could not record discovery progress');
}
