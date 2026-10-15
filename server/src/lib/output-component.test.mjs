import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replaceOutputComponent} from './output-component.js';
test('replacement preserves siblings and original value in human audit history',()=>{
 const original={task_id:'task',items:[{copy:{caption:'Before',subject:'Same'}}],provenance:{bioVersion:3}};
 const result=replaceOutputComponent(JSON.stringify(original),{path:['items',0,'copy','caption'],value:'After'},{userId:'human',now:'now'});
 assert.equal(result.items[0].copy.caption,'After');assert.equal(result.items[0].copy.subject,'Same');assert.deepEqual(result.provenance,original.provenance);
 assert.equal(original.items[0].copy.caption,'Before');assert.equal(result.component_edits[0].before,'Before');assert.equal(result.component_edits[0].by,'human');
});
test('arbitrary paths, metadata, JSON copy and unsafe image URLs cannot be replaced',()=>{
 for(const component of [{path:['__proto__','polluted'],value:'yes'},{path:['metrics','cost'],value:'free'},{path:['text'],value:'{"secret":true}'},{path:['text'],value:' '},{path:['asset_url'],value:'javascript:alert(1)'},{path:['asset_url'],value:'https://username:password@brand.test/a.png'}]){
  assert.throws(()=>replaceOutputComponent({text:'Copy',asset_url:'https://brand.test/a.png',metrics:{cost:'1'}},component));
 }
});
test('HTTP image replacements and sandboxed email HTML persist as their own components',()=>{
 const body={image:{asset_url:'https://brand.test/a.png'},html:'<p>Before</p>'};
 const image=replaceOutputComponent(body,{path:['image','asset_url'],value:'http://localhost/new.png'});
 assert.equal(image.image.asset_url,'http://localhost/new.png');
 const html=replaceOutputComponent(body,{path:['html'],value:'<p>After</p>'});assert.equal(html.html,'<p>After</p>');
});
