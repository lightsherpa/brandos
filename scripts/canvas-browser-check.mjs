// Local-only interaction checks against docs/mockups/canvas-v2. All API calls are intercepted.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.CAASTOR_BROWSER_MODULE_ROOT ? `${process.env.CAASTOR_BROWSER_MODULE_ROOT}/package.json` : import.meta.url);
const engines=require('playwright');const engine=engines[process.env.CAASTOR_BROWSER_ENGINE || 'chromium'];
const url=process.env.CAASTOR_CANVAS_PREVIEW || 'http://127.0.0.1:5182/docs/mockups/canvas-v2/index.html';
const out=process.env.CAASTOR_CANVAS_SCREENSHOTS || '/tmp/caastoros-canvas-check';await mkdir(out,{recursive:true});
const browser=await engine.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let canvas,revision=0,runs=[],submitted=0,mediaSubmitted=0,quoteCounter=20;
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await page.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON();
   if(!canvas){const fixture=await page.evaluate(()=>window.__canvasFixture);canvas=structuredClone(fixture.canvas);}
   const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(path.endsWith('/estimates'))return json({estimates:{auto:8,premium:16,balanced:8,fast:6}});
   if(path.endsWith('/quotes'))return json({quotes:body.nodeIds.map(node_id=>({id:id(quoteCounter++),node_id,credits:8,execution:canvas.document.nodes.find(n=>n.id===node_id)?.outputType==='image'?'media':'text'})),total:8*body.nodeIds.length,expiresAt:new Date(Date.now()+300000).toISOString()});
   if(path==='/api/creative/jobs'){
     mediaSubmitted++;const node=canvas.document.nodes.find(n=>n.id===body.nodeId);
     runs.push({id:body.quoteId,canvas_node_id:node.id,specialist_id:node.specialistId,bio_version:3,spec_version:1,status:'completed',outputs:[{id:id(500+mediaSubmitted),kind:'image',status:'flagged',workflow_status:'draft',body:{text:'Synthetic media completion fixture; human review required.'}}]});
     return json({jobId:body.quoteId,runId:body.quoteId});
   }
   if(path.startsWith('/api/creative/jobs/'))return json({state:'completed',runId:path.split('/').at(-1)});
   if(path==='/api/runs/stream') {
     submitted++;
     const node=canvas.document.nodes.find(n=>n.id===body.nodeId),run={id:body.quoteId,canvas_node_id:node.id,specialist_id:node.specialistId,spec_version:1,bio_version:3,tier:node.settings.tier,credits:8,status:'completed',started_at:new Date().toISOString(),outputs:[{id:id(100+submitted),kind:'text',status:'approved',workflow_status:'draft',body:{text:`Output ${submitted}: Clinical proof translated into a clear daily ritual.`}}]};runs.push(run);
     return route.fulfill({status:200,contentType:'text/event-stream',body:`event: started\ndata: ${JSON.stringify({runId:run.id})}\n\nevent: token\ndata: {"text":"Clinical proof translated into a clear daily ritual."}\n\nevent: done\ndata: ${JSON.stringify({runId:run.id})}\n\n`});
   }
   if(path.endsWith('/runs'))return json({runs});
   if(req.method()==='PUT'){canvas={...canvas,document:body.document,revision:++revision};return json({canvas});}
   return json({canvas});
 });
 await page.goto(url);await page.locator('.cvs-node').first().waitFor();
 assert.equal(await page.locator('.cvs-node').count(),5);console.log('fixture loaded');
 await page.locator('.cvs-workspace').focus();await page.keyboard.press('n');
 await page.getByRole('dialog',{name:'Add a specialist'}).waitFor();await page.getByRole('searchbox').fill('Social');await page.locator('.cvs-picker button').click();
 assert.equal(await page.locator('.cvs-node').count(),6);
 const node=page.locator('.cvs-node[data-selected="true"]');await node.getByRole('button',{name:'Run',exact:true}).click();
 await page.getByRole('dialog',{name:'Approve generation'}).waitFor();await page.getByRole('button',{name:'Approve and run'}).click();
 await page.getByText('Social Captions is ready',{exact:true}).waitFor();
 assert.equal(submitted,1);
 await page.locator('.cvs-node[data-selected="true"]').getByRole('button',{name:'Review versions'}).click();
 await page.getByRole('dialog',{name:'Social Captions',exact:true}).waitFor();
 assert.match(await page.locator('.cvs-review-content').innerText(),/Clinical proof/);
 await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.cvs-workspace').focus();await page.keyboard.press('Control+d');assert.equal(await page.locator('.cvs-node').count(),7);
 await page.keyboard.press('Delete');assert.equal(await page.locator('.cvs-node').count(),6);
 await page.keyboard.press('Control+z');assert.equal(await page.locator('.cvs-node').count(),7);
 await page.keyboard.press('Control+Shift+z');assert.equal(await page.locator('.cvs-node').count(),6);
 // Native text editing shortcuts must not delete or duplicate nodes.
 await page.locator('.cvs-node').filter({has:page.getByRole('heading',{name:'Social Captions',exact:true})}).last().click();
 const name=page.getByRole('textbox',{name:'Name',exact:true});await name.fill('Night launch copy');await name.press('Control+a');await name.press('Backspace');await name.fill('Night launch copy');assert.equal(await page.locator('.cvs-node').count(),6);
 console.log('run, review, duplicate and undo checks passed');
 // Pointer dragging changes persisted graph coordinates, independently of selection.
 const movedNode=page.locator('.cvs-node[data-selected="true"]'),moveBox=await movedNode.boundingBox();
 const movingId=await movedNode.getAttribute('data-canvas-node');
 await page.mouse.move(moveBox.x+40,moveBox.y+38);await page.mouse.down();await page.mouse.move(moveBox.x+250,moveBox.y-130,{steps:8});await page.mouse.up();
 await page.waitForTimeout(900);assert.ok(canvas.document.nodes.find(n=>n.id===movingId).x>0);
 // Wire dragging creates an edge from the actual output port.
 const source=page.locator('.cvs-node').filter({has:page.getByRole('heading',{name:'Positioning Architect',exact:true})});await source.focus();
 const port=await source.getByRole('button',{name:'Connect from Positioning Architect',exact:true}).boundingBox();
 const moved=page.locator(`[data-canvas-node="${movingId}"]`);const destination=await moved.boundingBox(),edgesBefore=canvas.document.edges.length;
 await page.mouse.move(port.x+port.width/2,port.y+port.height/2);await page.mouse.down();await page.mouse.move(destination.x+35,destination.y+60,{steps:8});await page.mouse.up();
 await page.waitForTimeout(900);assert.equal(canvas.document.edges.length,edgesBefore+1);
 // Denying a quote does not submit generation.
 await moved.getByRole('button',{name:'Run',exact:true}).click();await page.getByRole('button',{name:'Deny',exact:true}).click();assert.equal(submitted,1);

 await page.getByRole('button',{name:'Overview',exact:false}).click();assert.match(await page.locator('.cvs-overview').innerText(),/unsupported medical claims/);
 // The keyboard alternative creates a real graph connection.
 const target=page.locator('.cvs-node').filter({has:page.getByRole('heading',{name:'Hero KV',exact:true})});await page.screenshot({path:`${out}/before-connect.png`});await target.focus();
 await page.getByLabel('Connect from',{exact:true}).waitFor();
 const choices=await page.getByLabel('Connect from',{exact:true}).locator('option').allTextContents();assert.ok(choices.includes('Night launch copy'));
 await page.getByLabel('Connect from',{exact:true}).selectOption({label:'Night launch copy'});
 assert.match(await page.locator('.cvs-panel-content').innerText(),/Night launch copy/);
 await page.waitForTimeout(1000);assert.ok(revision>0);assert.ok(canvas.document.edges.length>5);
 for(const width of [1280,1440,1920]){await page.setViewportSize({width,height:900});await page.screenshot({path:`${out}/canvas-${width}.png`});}
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.waitForTimeout(250);await page.screenshot({path:`${out}/canvas-dark.png`});
 await page.evaluate(()=>{document.documentElement.dir='rtl';document.documentElement.lang='ar';});await page.screenshot({path:`${out}/canvas-rtl.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/canvas-mobile.png`});

 await page.evaluate(()=>{document.documentElement.dir='ltr';document.documentElement.lang='en';});await page.setViewportSize({width:1440,height:900});
 const hero=page.locator('.cvs-node').filter({has:page.getByRole('heading',{name:'Hero KV',exact:true})});await hero.getByRole('button',{name:'Run',exact:true}).click();await page.getByRole('button',{name:'Approve and run'}).click();await page.getByText('Hero KV is ready',{exact:true}).waitFor();assert.equal(mediaSubmitted,1);assert.equal(submitted,1);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,submitted,mediaSubmitted,revisions:revision,nodes:canvas.document.nodes.length,screenshots:out}));
}finally{await browser.close();}
