import {Hono} from 'hono';
import {requireAuth,requirePermission} from '../middleware/auth.js';
import {supabaseAdmin as db} from '../lib/supabase.js';
import {writeAuthorizationAudit} from '../lib/audit.js';
const app=new Hono();app.use('*',requireAuth,requirePermission('opex.read'));
app.get('/',async c=>{
 const workspaceId=c.req.query('workspaceId');if(!workspaceId)return c.json({error:'Workspace required'},400);
 const {data,error}=await db.from('text_execution_evidence').select('run_id,workspace_id,phase,interrupted_phase,route,provider_possible,provider_receipt_id,generation_complete,error,heartbeat_at,created_at,resolution_action,resolved_at').eq('workspace_id',workspaceId).not('phase','in','(completed,failed)').order('created_at').limit(100);
 return error?c.json({error:'Text execution evidence unavailable'},503):c.json({executions:(data||[]).map(e=>({...e,stale:Date.parse(e.heartbeat_at)<Date.now()-300000}))});
});
app.post('/:id',requirePermission('opex.override',{mfa:true}),async c=>{
 const body=await c.req.json().catch(()=>({})),auth=c.get('auth');
 const {data:existing}=await db.from('text_execution_evidence').select('workspace_id').eq('run_id',c.req.param('id')).maybeSingle();if(!existing)return c.json({error:'Not found'},404);
 await db.rpc('quarantine_stale_text_runs');
 const {data,error}=await db.rpc('resolve_canvas_text_run',{p_workspace_id:existing.workspace_id,p_run_id:c.req.param('id'),p_actor_id:auth.userId,p_action:body.action,p_evidence:body.evidence||{},p_reason:body.reason});
 await writeAuthorizationAudit(c,{permission:'opex.override',action:body.action,targetType:'text_execution',targetId:c.req.param('id'),workspaceId:existing.workspace_id,outcome:error?'failure':'success',reason:body.reason,newState:data});
 return error?c.json({error:error.message},409):c.json(data);
});
export default app;
