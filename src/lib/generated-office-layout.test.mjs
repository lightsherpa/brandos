import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OFFICE_STATIONS, OFFICE_DECOR, OFFICE_ART, generatedOfficeRoute} from './generated-office-layout.js';
const assets=JSON.parse(readFileSync(new URL('./agency-office-assets.json',import.meta.url)));

test('the generated office uses the supplied shell and unchanged modular sources',()=>{
 assert.ok(assets['ENV-01-empty-studio']);
 for(const asset of Object.values(assets)) {
  const publicPath=new URL('../../public'+asset.src,import.meta.url);
  const hashes=JSON.parse(readFileSync(new URL('./agency-office-source-hashes.json',import.meta.url)));
  assert.ok(existsSync(publicPath));
  const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
  assert.equal(hash(publicPath),hashes[asset.src]);
  const [w,h]=asset.size,[l,t,r,b]=asset.bounds;
  assert.ok(l>=0&&t>=0&&r<=w&&b<=h&&r>l&&b>t);
 }
});

test('all placed furniture refers to known assets and fits inside the office',()=>{
 const ids=new Set();
 for(const [id,asset,x,y,width] of [...OFFICE_DECOR,...OFFICE_ART]) {
  assert.ok(!ids.has(id),id);ids.add(id);
  assert.ok(assets[asset],asset);
  assert.ok(x-width/2>0&&x+width/2<100&&y>0&&y<100,id);
 }
 assert.equal(OFFICE_STATIONS.length,4);
});

test('handoffs enter side rooms through their doorways and return to the destination',()=>{
 const destination=[87,53];
 const route=generatedOfficeRoute([80,29],destination);
 assert.deepEqual(route.slice(0,2),[[77,23],[72,23]]);
 assert.deepEqual(route.slice(-3),[[72,49],[77,49],destination]);
 const briefing=generatedOfficeRoute([34,39],[19,24]);
 assert.deepEqual(briefing.slice(-3),[[28,23],[23,23],[19,24]]);
});
