import test from 'node:test';
import assert from 'node:assert/strict';
import {groupDeliverables,combinedDeliveryStatus,canInspectDelivery,deliveryDocument,deliveryTypeForAgent} from '../../shared/grouped-deliverables.js';
const output=(id,part,text,extra={})=>({id,status:'qa_passed',body:{kind:'deliverables',type:part==='caption'||part==='image'?'social_post':'email',part,deliverables:[{body:text,status:'qa_passed',qa:{passed:true},...extra}]}});
const run=(id,outputs=[],extra={})=>({id:'run-'+id,specialist_id:id,status:'completed',credits:3,outputs,...extra});
const fixture=()=>[
 run('a16',[output('caption','caption','Hola Granada')]),run('a41',[output('image','image','',{asset_url:'https://assets.test/post.png'})]),
 run('a14',[output('subject','subject','Primera rebanada')]),run('a13',[output('email','body','Bienvenida Granada')]),run('a20',[{id:'hero',status:'qa_passed',body:{asset_url:'https://assets.test/hero.png'}}]),
];
test('Granada five contributors collapse into exactly Social Post, Email, Hero KV with fused content',()=>{
 const groups=groupDeliverables({runs:fixture(),finished:true});assert.deepEqual(groups.map(g=>g.type),['social_post','email','hero_kv']);assert.equal(groups[0].text,'Hola Granada');assert.equal(groups[0].assetUrl,'https://assets.test/post.png');assert.equal(groups[1].subject,'Primera rebanada');assert.equal(groups[1].text,'Bienvenida Granada');assert.ok(groups.every(g=>g.complete));assert.equal(groups.reduce((sum,g)=>sum+g.credits,0),15);
});
test('one combined status: errors and QA failure win; active work stays working; only human approval delivers',()=>{
 assert.equal(combinedDeliveryStatus({runs:[{status:'failed'}],complete:true}),'attention');
 assert.equal(combinedDeliveryStatus({parts:[{qa:{passed:false}}],complete:true}),'attention');
 assert.equal(combinedDeliveryStatus({runs:[{status:'running'}],complete:true}),'working');
 assert.equal(combinedDeliveryStatus({complete:false,finished:true}),'attention');
 assert.equal(combinedDeliveryStatus({complete:false}),'working');
 assert.equal(combinedDeliveryStatus({parts:[{status:'approved'}],complete:true}),'review');
 assert.equal(combinedDeliveryStatus({parts:[{approved:true},{approved:false}],complete:true}),'review');
 assert.equal(combinedDeliveryStatus({parts:[{approved:true}],complete:true}),'delivered');
});
test('QA is attached, never its own deliverable, and its credit total is counted only once',()=>{
 const groups=groupDeliverables({runs:[...fixture(),run('a18',[],{credits:2})],finished:true});assert.equal(groups.length,3);assert.equal(groups.reduce((s,g)=>s+g.credits,0),17);
});
test('retry replaces the same part without hiding charged retry credits; stale failure cannot override new success',()=>{
 const runs=fixture();runs.unshift(run('a16',[output('new','caption','Nueva')],{id:'retry',created_at:'2026-10-17',credits:5}));runs.at(1).created_at='2026-10-16';
 const social=groupDeliverables({runs,finished:true})[0];assert.equal(social.text,'Nueva');assert.equal(social.credits,11);
});
test('no false completion for missing image, missing subject, failed item checks or quarantined HTML',()=>{
 const runs=fixture();runs[1].outputs=[];assert.equal(groupDeliverables({runs,finished:true})[0].status,'attention');
 runs[2].outputs=[];assert.equal(groupDeliverables({runs,finished:true})[1].status,'attention');
 const result=groupDeliverables({runs:[run('a16',[{id:'blocked',body:{type:'social_post',items:[{index:0,html:'PRIVATE',copy:{caption:'SECRET'},status:'blocked',quality_gated:true}]}}])],finished:true});assert.equal(result[0].status,'attention');assert.equal(result[0].html,'');assert.equal(result[0].text,'');
});
test('multiple slots keep caption and design paired by item index and do not duplicate the subject card',()=>{
 const runs=fixture();runs[0].outputs[0].body.deliverables.push({body:'Second caption',qa:{passed:true}});runs[1].outputs[0].body.deliverables.push({asset_url:'https://assets.test/2.png',qa:{passed:true}});
 const groups=groupDeliverables({runs,finished:true});const posts=groups.filter(g=>g.type==='social_post');assert.equal(posts.length,2);assert.equal(posts[1].text,'Second caption');assert.equal(posts[1].assetUrl,'https://assets.test/2.png');assert.equal(groups.reduce((s,g)=>s+g.credits,0),15);
});
test('landing page and deck group production without changing the roster; expected missing Hero stays visible',()=>{
 assert.equal(deliveryTypeForAgent('a25'),'landing_page');assert.equal(deliveryTypeForAgent('a26'),'email');assert.equal(deliveryTypeForAgent('a27'),'deck');
 const groups=groupDeliverables({runs:[run('a37'),run('a12'),run('a25'),run('a36'),run('a44'),run('a27')],finished:true,expectedSpecialists:['a20']});assert.deepEqual(groups.map(g=>g.type),['hero_kv','landing_page','deck']);assert.ok(groups.every(g=>g.status==='attention'));
});
test('production details are server-authorized for CDs/admins only, never clients or unqualified internal designers',()=>{
 for(const actor of [null,{scope:'workspace',persona:'creative_director'},{scope:'workspace',persona:'user'},{scope:'platform',persona:'designer'}])assert.equal(canInspectDelivery(actor),false);
 for(const persona of ['creative_director','platform_admin','super_admin'])assert.equal(canInspectDelivery({scope:'platform',persona}),true);
 assert.ok(groupDeliverables({runs:fixture(),internal:false}).every(g=>!('production'in g)&&!('outputIds'in g)));
});
test('email document escapes content and has offline-safe execution policy and RTL',()=>{
 const html=deliveryDocument({subject:'<script>alert(1)</script>',text:'Hello <img src=x onerror=alert(1)>',assetUrl:'javascript:alert(1)'},{lang:'ar'});assert.match(html,/dir="rtl"/);assert.doesNotMatch(html,/<script>|src="javascript:/);assert.match(html,/&lt;img/);assert.match(html,/Content-Security-Policy/);
});

test('a subject alone is not a finished email and explicit planned assignments never grow phantom agent cards',()=>{
 const groups=groupDeliverables({runs:[run('a14',[output('subject-only','subject','Hola')])],finished:true});assert.equal(groups[0].complete,false);assert.equal(groups[0].status,'attention');
 const planned=groupDeliverables({runs:[run('a37',[],{status:'queued'})],plan:{deliverableGroups:[{type:'ad_creative',count:1,crew:{headline:'a37',body:'a38',image:'a42'}}]}});assert.deepEqual(planned.map(p=>p.type),['ad_creative']);
});
test('QA never claims delivery, but existing persisted human workflow approvals deliver the combined piece',()=>{
 const runs=fixture();for(const r of runs)for(const o of r.outputs){o.workflow_status='client_approved';o.client_reviewed_by='owner';o.client_reviewed_at='2026-10-17';}
 assert.ok(groupDeliverables({runs,finished:true}).every(g=>g.status==='delivered'));
});

test('queued card totals include the selected contributors only, never optional unrequested agents',()=>{
 const ids=['a16','a41','a14','a13','a20'];const groups=groupDeliverables({runs:ids.map(id=>({...run(id),credits:undefined,status:'queued'})),expectedSpecialists:ids,creditsByAgent:{a16:3,a41:8,a14:2,a13:12,a20:14,a26:10,a48:7}});assert.deepEqual(groups.map(g=>g.credits),[11,14,14]);assert.equal(groups.reduce((s,g)=>s+g.credits,0),39);
});

test('failed retries preserve successful complementary copy; internal approval alone is not client delivery',()=>{
 const runs=fixture();
 runs[1].outputs=[{id:'blocked-image',body:{type:'social_post',part:'image',items:[{quality_gated:true,status:'blocked',html:'PRIVATE'}]}}];
 const social=groupDeliverables({runs,finished:true})[0];
 assert.equal(social.status,'attention');assert.equal(social.text,'Hola Granada');assert.equal(social.html,'');
 const internal=fixture();for(const run of internal)for(const o of run.outputs){o.workflow_status='internally_approved';o.internal_reviewed_by='cd';o.internal_reviewed_at='2026-10-17';}
 assert.ok(groupDeliverables({runs:internal,finished:true}).every(piece=>piece.status==='review'));
});

test('QA failure is scoped to its deliverable and shared agents do not double-charge different types',()=>{
 const runs=fixture();runs.push(run('a18',[{id:'email-qa',body:{type:'email',part:'qa',items:[{qa:{passed:false}}]}}]));
 const groups=groupDeliverables({runs,finished:true});
 assert.equal(groups[0].status,'review');assert.equal(groups[1].status,'attention');assert.equal(groups[2].status,'review');
 assert.equal(groups.reduce((sum,piece)=>sum+piece.credits,0),18);
 const carousel=run('a16',[{id:'carousel-caption',body:{type:'carousel',part:'caption',items:[{text:'Carousel copy',qa:{passed:true}}]}}]);
 carousel.id='carousel-run';
 const shared=groupDeliverables({runs:[...fixture(),carousel],finished:true});
 assert.equal(shared.reduce((sum,piece)=>sum+piece.credits,0),18);
});

test('a selected HTML builder must finish before an email can be reviewed; missing checks are not success',()=>{
 const runs=fixture();runs.push(run('a26'));
 assert.equal(groupDeliverables({runs,finished:true}).find(piece=>piece.type==='email').status,'attention');
 runs.at(-1).outputs=[{id:'html',status:'qa_passed',body:{text:'<!doctype html><html><body>Rendered email</body></html>'}}];
 assert.equal(groupDeliverables({runs,finished:true}).find(piece=>piece.type==='email').status,'review');
 const unknown=fixture();unknown[0].outputs[0].body.deliverables[0].qa=null;unknown[0].outputs[0].status='needs_review';unknown[0].outputs[0].body.deliverables[0].status='needs_review';
 assert.equal(groupDeliverables({runs:unknown,finished:true})[0].status,'attention');
});

test('post exports contain the image and caption together without duplicating composed HTML copy',()=>{
 const plain=deliveryDocument({type:'social_post',text:'Primera rebanada',assetUrl:'https://assets.test/post.png'});
 assert.match(plain,/<img src="https:\/\/assets.test\/post.png"/);assert.match(plain,/Primera rebanada/);
 const composed=deliveryDocument({type:'social_post',text:'Primera rebanada',html:'<article><img src="https://assets.test/post.png"><p>Primera rebanada</p></article>'});
 assert.equal(composed.split('Primera rebanada').length-1,1);
});
