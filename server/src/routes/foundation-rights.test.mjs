import {test,mock} from 'node:test';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
let auth,source,updates=[],audits=[],uploadErr=null,rightsRows=[],bioRow=null,rpcs=0;
const db={from(table){const q={_t:table,select(){return q;},eq(){return q;},in(){return q;},order(){return q;},limit(){return q;},
  update(v){updates.push(v);return {eq:()=>({eq:async()=>({error:null})})};},
  insert(){return q;},async single(){return {data:{id:'row'},error:null};},
  async maybeSingle(){return {data:table==='brands'?{id:'brand',workspace_id:'ws'}:table==='bio_sources'?source:table==='bios'?bioRow:null,error:null};},
  then(res,rej){return Promise.resolve({data:table==='bio_sources'?rightsRows:[],error:null}).then(res,rej);}};return q;},
  storage:{from:()=>({upload:async()=>({data:null,error:uploadErr}),remove:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://local.test/s'}})})},async rpc(){rpcs++;return {data:{ok:true},error:null};}};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('middleware/auth.js',root).href,{namedExports:{requireAuth:async(c,next)=>{c.set('auth',auth);await next();}}});
mock.module(new URL('lib/assign-steward.js',root).href,{namedExports:{assignSteward:async()=>{}}});
mock.module(new URL('lib/audit.js',root).href,{namedExports:{writeAuthorizationAudit:async(_c,a)=>{audits.push(a);}}});
const {default:app}=await import('./bios.js');
const {loadLogoRights}=await import('../lib/foundation-assets.js');
const member=(perms=['bio.read','bio.propose'])=>({userId:'owner',workspaceId:null,persona:'designer',scope:'platform',permissions:new Set(perms),assignedWorkspaceIds:new Set(['ws'])});
const confirm=body=>app.request('/brand/sources/png1/confirm-rights',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const pending=()=>({id:'png1',kind:'file_upload',bucket:'visual',raw_ref:'ws/brand/x.png',signals:{asset_role:'logo',ext:'png',rights_confirmed:false,origin:'discovery_inline_svg'}});

test('confirm-rights flips rights on a pending PNG logo and audits it',async()=>{
 auth=member();source=pending();updates=[];audits=[];
 const res=await confirm({rightsConfirmed:true});assert.equal(res.status,200);
 assert.equal(updates[0].signals.rights_confirmed,true);assert.equal(updates[0].signals.rights_confirmed_by,'owner');assert.equal(updates[0].signals.origin,'discovery_inline_svg');
 assert.equal(audits[0].action,'brand.logo.confirm_rights');
});
test('confirm-rights rejects a non-human actor',async()=>{
 auth={...member(),actorType:'agent'};source=pending();updates=[];
 const res=await confirm({rightsConfirmed:true});assert.equal(res.status,403);assert.equal((await res.json()).code,'AGENT_CANNOT_CERTIFY');
 assert.equal(updates.length,0);
});
test('confirm-rights requires the explicit statement, permission, and a PNG logo',async()=>{
 auth=member();source=pending();updates=[];
 assert.equal((await confirm({})).status,400);
 auth=member(['bio.read']);assert.equal((await confirm({rightsConfirmed:true})).status,403);
 auth=member();source={...pending(),signals:{asset_role:'inspiration',ext:'png'}};assert.equal((await confirm({rightsConfirmed:true})).status,400);
 source=null;assert.equal((await confirm({rightsConfirmed:true})).status,404);
 assert.equal(updates.length,0);
});
test('loadLogoRights returns only confirmed PNG logo rows',async()=>{
 rightsRows=[{id:'a',signals:{rights_confirmed:true,asset_role:'logo',ext:'png'}},{id:'b',signals:{rights_confirmed:false,asset_role:'logo',ext:'png'}},{id:'c',signals:{rights_confirmed:true,asset_role:'logo',ext:'png',purpose:'aspiration'}}];
 assert.deepEqual(await loadLogoRights('brand',{visual:{logo:{sourceId:'a',variants:{dark:{sourceId:'b'},light:{sourceId:'c'}}}}}),['a']);
 assert.deepEqual(await loadLogoRights('brand',{visual:{}}),[]);
 rightsRows=[];
});
const upload=()=>{const form=new FormData();form.set('file',new File(['hello'],'notes.txt',{type:'text/plain'}));form.set('bucket','foundations');return app.request('/brand/sources/upload',{method:'POST',body:form});};
test('storage policy rejection → 400 STORAGE_REJECTED by status/code; other storage errors stay 500',async()=>{
 auth=member();
 uploadErr={message:'whatever',status:400,statusCode:'415'};let r=await upload();assert.equal(r.status,400);assert.equal((await r.json()).code,'STORAGE_REJECTED');
 uploadErr={message:'internal',status:500,statusCode:'500'};r=await upload();assert.equal(r.status,500);
 uploadErr={message:'mime type text/plain is not supported',status:500,statusCode:'500'};r=await upload();assert.equal(r.status,500,'message text alone must not map to 400');
 uploadErr=null;
});

const {validateFoundationAssets}=await import('../lib/foundation-assets.js');
const L={id:'L',raw_ref:'ws/brand/l.png',signals:{asset_role:'logo',ext:'png',rights_confirmed:false}};
const F={id:'F',raw_ref:'ws/brand/f.woff2',signals:{asset_kind:'font',asset_role:'canonical',font_family:'Brand Sans',rights_confirmed:false}};
const vis={logo:{sourceId:'L',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Brand Sans',sourceId:'F'}]};
test('BLOCKER: fonts always need confirmed rights, even when unconfirmed logos are allowed',async()=>{
 rightsRows=[L,F];
 assert.match(await validateFoundationAssets('brand',vis,vis,{allowUnconfirmedLogos:true}),/licensed font/);
 rightsRows=[L,{...F,signals:{...F.signals,rights_confirmed:true}}];
 assert.equal(await validateFoundationAssets('brand',vis,vis,{allowUnconfirmedLogos:true}),null);
 assert.match(await validateFoundationAssets('brand',vis,vis),/approved logo/);
 rightsRows=[];
});
const owner=()=>({userId:'owner',workspaceId:'ws',memberships:[{workspace_id:'ws',status:'active',is_owner:true}],permissions:new Set(['bio.read','bio.propose']),assignedWorkspaceIds:new Set(['ws'])});
const accept=()=>app.request('/brand/accept-changes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:3})});
test('accept-changes runs validateFoundationAssets (unlicensed font → 409, nothing recorded)',async()=>{
 auth=owner();rpcs=0;bioRow={id:'bio',version:3,payload:{visual:vis}};
 rightsRows=[{...L,signals:{...L.signals,rights_confirmed:true}},F];
 const res=await accept();assert.equal(res.status,409);const body=await res.json();assert.equal(body.code,'FOUNDATION_INCOMPLETE');assert.match(body.error,/licensed font/);assert.equal(rpcs,0);
 bioRow=null;rightsRows=[];
});
