import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {selectRoute} from '../server/src/lib/models/jev.js';
const cases=JSON.parse(await readFile(new URL('./fixtures/jev-labeled-cases.json',import.meta.url)));
const policy={jevMode:'active',jevEvidence:{labeledCases:120,measuredCases:120,agreement:1,hardConstraintViolations:0,artifact:'MOCK-TEST-ONLY',humanAccepted:true}};
for(const c of cases){
 const candidates=c.eligibleRoutes.map(route=>({route,features:c.requirements.features,evaluation:{qualified:true,quality:90}}));
 const result=await selectRoute({candidates,fallback:'fixture/quality',override:c.scenario==='explicit_override'?c.acceptedRoute:null,requirements:c.requirements,policy,classify:async()=>c.response});
 assert.equal(result.chosenRoute,c.acceptedRoute,c.id);
}
console.log(`${cases.length} offline labeled contract cases passed. Mock responses do not qualify live JEV.`);
