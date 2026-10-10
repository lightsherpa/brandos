import {Hono} from 'hono';
import {supabaseAdmin as db} from '../lib/supabase.js';
import {requireAuth,requirePermission} from '../middleware/auth.js';
import {writeAuthorizationAudit} from '../lib/audit.js';
const app=new Hono();app.use('*',requireAuth,requirePermission('opex.read'));
app.get('/',async c=>{const workspaceId=c.req.query('workspaceId');if(!workspaceId)return c.json({error:'Workspace required'},400);const {data,error}=await db.from('execution_spend_holds').select('*,run:runs(status)').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100);return error?c.json({error:'Spend evidence unavailable'},503):c.json({holds:data});});
app.post('/:id/reconcile',requirePermission('opex.override',{mfa:true}),async c=>{const body=await c.req.json().catch(()=>({}));if(typeof body.amountUsd!=='number'||!Number.isFinite(body.amountUsd)||body.amountUsd<0)return c.json({error:'A finite nonnegative verified amount is required'},400);const {data,error}=await db.rpc('reconcile_execution_spend',{p_run:c.req.param('id'),p_actor:c.get('auth').userId,p_amount:body.amountUsd,p_reference:body.reference,p_reason:body.reason});await writeAuthorizationAudit(c,{permission:'opex.override',action:'reconcile_execution_spend',targetType:'execution_spend',targetId:c.req.param('id'),outcome:error?'failure':'success',reason:body.reason,newState:data});return error?c.json({error:error.message},409):c.json(data);});
export default app;
