import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPalette} from './extract-visual-deterministic.js';
import {inferColourRoles,validateFoundationVisual} from './brand-foundation.js';
test('framework defaults never auto-pick even when most frequent',()=>{
  const palette=extractPalette('a{color:#000;background:#fff;border:#161616}'.repeat(30)+'b{color:#ffd115;background:#ccddcc;border:#f40041}');
  assert.equal(palette.length,3);
  assert.ok(palette.every(c=>!['#000000','#ffffff','#161616'].includes(c.hex)));
  assert.equal(palette.filter(c=>c.role==='primary').length,1);
});
test('role guesses retain hex values and designers can deliberately choose black',()=>{
  const roles=inferColourRoles([{hex:'#ffd115'},{hex:'#232323'},{hex:'#f7efda'}]);
  assert.deepEqual(roles.map(c=>c.role),['primary','ink','surface']);
  assert.equal(validateFoundationVisual({palette:[{hex:'#000000',role:'primary'}]}),null);
  assert.match(validateFoundationVisual({palette:[{hex:'#123456',role:'primary'},{hex:'#abcdef',role:'primary'}]}),/one primary/);
});
