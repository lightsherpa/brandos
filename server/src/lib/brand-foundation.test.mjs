import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationStatus,foundationError} from './brand-foundation.js';
import {scoreBioBreakdown} from './score-bio.js';
import {SCORED_PATHS} from './bio-schema.js';
const rich=()=>{const p={confidence:{}};for(const [s,k] of SCORED_PATHS){p[s]||={};p[s][k]='recorded';p.confidence[`${s}.${k}`]={conf:100,source:`${s}.${k}`};}return p;};
const complete={logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Inter',provider:'google'}]};
test('legacy Cake Me shape cannot certify and displayed score caps at 79',()=>{
 const payload=rich();payload.visual={palette:[{hex:'#161616'},{hex:'#ffffff'},{hex:'#ffd115'}],type:[]};
 assert.deepEqual(foundationStatus(payload).missing,['visual.logo','visual.palette.primary','visual.type.display']);
 assert.equal(scoreBioBreakdown(payload).score,79);
 assert.equal(scoreBioBreakdown(payload).rawScore,100);
});
test('adding logo, primary and usable font releases the cap; every requirement is mandatory',()=>{
 const payload={...rich(),visual:complete},R={logoRights:['logo']};assert.equal(foundationStatus(payload,R).certifiable,true);assert.equal(scoreBioBreakdown(payload,R).score,100);
 for(const key of ['logo','palette','type']){const visual={...complete};delete visual[key];assert.equal(foundationStatus({visual},R).certifiable,false);assert.equal(foundationError({visual},R).credits,0);}
 assert.equal(foundationStatus({visual:{...complete,logo:{url:'https://brand.test/icon.png',conf:50}}}).logo,false);
});
