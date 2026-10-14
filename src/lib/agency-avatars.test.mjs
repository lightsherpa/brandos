import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {agencyAvatarRole, agencyAvatarSource} from './agency-avatars.js';

test('review specialists get distinct identities before department fallback', () => {
  assert.equal(agencyAvatarRole({name:'Voice QA',dept:'Copy',room:'review'}),'voice-reviewer');
  assert.equal(agencyAvatarRole({name:'Brand Consistency QA',dept:'Visual',room:'review'}),'brand-reviewer');
});

test('identities follow roles and stay stable when peers are reordered', () => {
  const crew=[{room:'strategy'},{room:'concept'},{room:'copy'},{room:'visual'},{room:'web'}];
  assert.deepEqual(crew.map(agencyAvatarRole),['strategist','creative-lead','copywriter','designer','designer']);
  assert.deepEqual([...crew].reverse().map(agencyAvatarSource).reverse(),crew.map(agencyAvatarSource));
});

test('all mapped characters have shipped assets including Brandolph and fallback', () => {
  const crew=[{node:{id:'brandolph'}},{room:'strategy'},{room:'concept'},{room:'copy'},{room:'visual'},{name:'Voice QA'},{name:'Brand Consistency QA'},{}];
  assert.equal(agencyAvatarRole(crew[0]),'brandolph');
  for(const agent of crew) assert.ok(existsSync(new URL('../../public'+agencyAvatarSource(agent),import.meta.url)),agencyAvatarSource(agent));
});
