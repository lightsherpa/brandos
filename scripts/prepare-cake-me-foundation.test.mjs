import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareCakeMeFoundation,prepareFromFiles} from './prepare-cake-me-foundation.mjs';
test('Cake Me preparation remains unapproved, non-executable and tied to exact source version',()=>{
 const snapshot={brand:{id:'brand',name:'Cake-me'},bios:[{id:'bio',version:1,score:96,payload:{visual:{palette:[{hex:'#ffd115'}],type:[]}}}],bio_sources:[{id:'ref',src:'53.png',kind:'file_upload',bucket:'visual',signals:{}}]};
 const packet=prepareCakeMeFoundation(snapshot);assert.equal(packet.approved,false);assert.equal(packet.executable,false);assert.equal(packet.constraints.productionWrites,false);assert.equal(packet.constraints.modelCalls,0);assert.equal(packet.target.payloadHash.length,64);assert.equal(packet.proposals.referenceSources.length,1);assert.equal(packet.current.certifiable,false);
 assert.throws(()=>prepareCakeMeFoundation({...snapshot,brand:{id:'other',name:'Other'}}),/Cake Me/);
});
test('preparation tool has no production/apply mode',async()=>{
 await assert.rejects(()=>prepareFromFiles(['--apply']),/Unsupported/);
});
