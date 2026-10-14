import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReferenceConfirmation, scopedReferences, assertReferenceResolution} from './reference-intake.js';
const id='10000000-0000-4000-8000-000000000001';
const body={expectedVersion:2,requestId:id,sourceIds:[id],rights:{authority:true,ownsOrLicensed:true,generationAllowed:true}};
test('rights require each deliberate statement and stable version/idempotency key',()=>{
 assert.equal(validateReferenceConfirmation(body),null);
 for(const key of Object.keys(body.rights))assert.equal(validateReferenceConfirmation({...body,rights:{...body.rights,[key]:false}}).code,'REFERENCE_RIGHTS_REQUIRED');
 for(const patch of [{expectedVersion:null},{sourceIds:[]},{sourceIds:[id,id]},{requestId:'x'},{sourceIds:['x']},{sourceIds:Array(13).fill(id)}])assert.ok(validateReferenceConfirmation({...body,...patch}));
});
test('references are pinned strictly to version, exclude superseded/avoid/unconfirmed and prefer canonical',()=>{
 const loaded=[{id:'new',url:'http://127.0.0.1/x',role:'canonical',signals:{rights_confirmed:true}},{id:'old',url:'https://x',role:'canonical',signals:{rights_confirmed:true}},{id:'other',url:'https://y',role:'canonical',signals:{rights_confirmed:true}}];
 const refs=[{sourceId:'new',role:'canonical'},{sourceId:'old',role:'canonical',status:'superseded'}];
 assert.deepEqual(scopedReferences(loaded,refs).map(r=>r.id),['new']);
 assert.deepEqual(scopedReferences(loaded,[]),[]);
 assert.deepEqual(scopedReferences(loaded,[{sourceId:'new',role:'avoid'}]),[]);
 assert.deepEqual(scopedReferences([{...loaded[0],signals:{rights_confirmed:false}}],refs),[]);
});
test('missing selected reference bytes fail closed; empty certified list is valid',()=>{
 assert.doesNotThrow(()=>assertReferenceResolution([],[]));
 assert.throws(()=>assertReferenceResolution([],[{sourceId:'missing',role:'canonical'}]),e=>e.code==='REFERENCE_UNAVAILABLE');
 assert.doesNotThrow(()=>assertReferenceResolution([],[{sourceId:'old',role:'canonical',status:'superseded'}]));
});
