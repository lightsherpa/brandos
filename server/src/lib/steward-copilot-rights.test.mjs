import test from 'node:test';import assert from 'node:assert/strict';
import {buildStewardCaseFile} from './steward-copilot.js';
test('steward case file scores with logo rights',()=>{
 const bio={payload:{visual:{logo:{sourceId:'L',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Inter',provider:'google'}]}}};
 assert.equal(buildStewardCaseFile({bio}).scoreBreakdown?.logoStatus ?? buildStewardCaseFile({bio}).score?.logoStatus,'needs_rights');
 assert.equal((buildStewardCaseFile({bio,logoRights:['L']}).scoreBreakdown ?? buildStewardCaseFile({bio,logoRights:['L']}).score).logoStatus,'ok');
});
