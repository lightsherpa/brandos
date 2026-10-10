import test from 'node:test';
import assert from 'node:assert/strict';
import {collectDiscoveryVisuals} from './discovery-visuals.js';
test('current and aspiration visual evidence remain separate and failures explicit',async()=>{
 const result=await collectDiscoveryVisuals({url:'https://brand.test',references:[{url:'https://desired.test',purpose:'aspiration',note:'Lighting'},{url:'https://failed.test',purpose:'current'}],scrape:async url=>{if(url.includes('failed'))throw Error('Unavailable');return {rawHtml:url.includes('desired')?'<style>body{color:#ff8800}</style>':'<style>body{color:#123456}</style>',screenshot:'https://images.test/example.png'};},readImagery:async()=>({imagery:['Natural side lighting'],avoid:[]})});
 assert.equal(result.sources.length,3);assert.equal(result.sources[1].purpose,'aspiration');assert.notDeepEqual(result.sources[0].visual.palette,result.sources[1].visual.palette);assert.equal(result.sources[2].status,'unreadable');assert.deepEqual(result.sources[2].visual.palette,[]);assert.ok(result.sources[2].limitations.length);
});
