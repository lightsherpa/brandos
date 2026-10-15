import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let auth,output,writes,allowed;
mock.module(new URL('../middleware/auth.js',import.meta.url).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',auth);return next();}}});
mock.module(new URL('../lib/permissions.js',import.meta.url).href,{namedExports:{canAccessWorkspace:()=>true,hasPermission:()=>allowed}});
mock.module(new URL('../lib/audit.js',import.meta.url).href,{namedExports:{writeAuthorizationAudit:async()=>{}}});
mock.module(new URL('../lib/brandolph-memory.js',import.meta.url).href,{namedExports:{recordSignal:()=>{}}});
mock.module(new URL('../lib/supabase.js',import.meta.url).href,{namedExports:{supabaseAdmin:{from(){let patch;const q={select(){return q;},eq(){return q;},update(next){patch=next;return q;},async maybeSingle(){return {data:output};},async single(){writes.push(patch);return {data:{...output,...patch}};}};return q;}}}});
const {default:app}=await import('./outputs.js');
function reset(){process.env.REVIEW_DESK_UX='1';auth={userId:'reviewer',scope:'platform',actor:{type:'human'}};allowed=true;writes=[];output={id:'out',kind:'task',body:JSON.stringify({task_id:'task',items:[{copy:{caption:'Before'}}]}),workflow_status:'draft',brief:{brand:{workspace_id:'workspace'}}};}
const request=()=>app.request('/out',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({component:{path:['items',0,'copy','caption'],value:'After'}})});
test('component replacement is disabled by default and writes nothing',async()=>{reset();delete process.env.REVIEW_DESK_UX;assert.equal((await request()).status,404);assert.equal(writes.length,0);});
test('unauthorized replacement writes nothing',async()=>{reset();allowed=false;assert.equal((await request()).status,403);assert.equal(writes.length,0);});
test('submitted and approved outputs remain immutable',async()=>{for(const status of ['submitted_internal','internally_approved','client_review','client_approved']){reset();output.workflow_status=status;assert.equal((await request()).status,409);assert.equal(writes.length,0);}});
test('returned outputs require an internal actor',async()=>{reset();output.workflow_status='changes_requested_client';auth.scope='workspace';assert.equal((await request()).status,403);assert.equal(writes.length,0);});
test('authorized replacement persists structured component and human audit',async()=>{reset();assert.equal((await request()).status,200);assert.equal(writes[0].body.items[0].copy.caption,'After');assert.equal(writes[0].body.task_id,'task');assert.equal(writes[0].body.component_edits[0].by,'reviewer');});
