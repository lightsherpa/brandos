import test from 'node:test';
import assert from 'node:assert/strict';
import { editBriefInput, replaceDraftAnalysis } from './brief-draft-review.js';

const analysis = (questions) => ({ questions: questions.map((q) => ({ q })), title: 'Saved analysis' });
const fixture = () => ({ input: 'Original brief', mode: 'flow', qStep: 1, sharpData: analysis(['Who is this for?', 'When is launch?']), answers: { 0: 'Existing customers', 1: 'September' }, answerHistory: [] });

test('editing the brief preserves entered answers and their original question context', () => {
  const original = fixture();
  const next = editBriefInput(original, 'Updated brief');
  assert.equal(next.input, 'Updated brief');
  assert.deepEqual(next.answers, original.answers);
  assert.deepEqual(next.sharpData, original.sharpData);
  assert.equal(next.mode, original.mode);
  assert.equal(original.input, 'Original brief');
});

test('successful analysis matches answers by question text when questions reorder', () => {
  const original = fixture();
  const replacement = analysis(['When is launch?', 'Who is this for?', 'Which channel?']);
  const next = replaceDraftAnalysis(original, replacement);
  assert.deepEqual(next.answers, { 0: 'September', 1: 'Existing customers', 2: '' });
  assert.deepEqual(next.sharpData, replacement);
  assert.deepEqual(next.answerHistory, []);
  assert.equal(next.input, original.input);
  assert.deepEqual(original.answers, { 0: 'Existing customers', 1: 'September' });
});

test('answers to removed questions remain recoverable alongside existing history', () => {
  const original = fixture();
  original.answerHistory = [{ question: 'What tone?', answer: 'Friendly' }];
  const next = replaceDraftAnalysis(original, analysis(['When is launch?']));
  assert.deepEqual(next.answers, { 0: 'September' });
  assert.deepEqual(next.answerHistory, [
    { question: 'What tone?', answer: 'Friendly' },
    { question: 'Who is this for?', answer: 'Existing customers' },
  ]);
  assert.deepEqual(original.answerHistory, [{ question: 'What tone?', answer: 'Friendly' }]);
});

test('repeated analysis does not duplicate a recovered question and answer', () => {
  const original = fixture();
  original.answerHistory = [{ question: 'Who is this for?', answer: 'Existing customers' }];
  const next = replaceDraftAnalysis(original, analysis(['When is launch?']));
  assert.deepEqual(next.answerHistory, original.answerHistory);
  const repeated = replaceDraftAnalysis(next, analysis(['When is launch?']));
  assert.deepEqual(repeated.answerHistory, original.answerHistory);
});

test('different answers to the same removed question remain separately recoverable', () => {
  const original = fixture();
  original.answerHistory = [{ question: 'Who is this for?', answer: 'New customers' }];
  const next = replaceDraftAnalysis(original, analysis(['When is launch?']));
  assert.deepEqual(next.answerHistory, [
    { question: 'Who is this for?', answer: 'New customers' },
    { question: 'Who is this for?', answer: 'Existing customers' },
  ]);
});

test('unanswered removed questions do not create empty recovery records', () => {
  const original = fixture();
  original.answers = { 0: '', 1: 'September' };
  const next = replaceDraftAnalysis(original, analysis(['When is launch?']));
  assert.deepEqual(next.answerHistory, []);
});

test('legacy drafts without answer history retain removed answers', () => {
  const original = fixture();
  delete original.answerHistory;
  const next = replaceDraftAnalysis(original, analysis([]));
  assert.deepEqual(next.answerHistory, [
    { question: 'Who is this for?', answer: 'Existing customers' },
    { question: 'When is launch?', answer: 'September' },
  ]);
});
