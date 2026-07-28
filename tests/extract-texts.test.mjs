import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_PATTERN,
  normalizeWhitespace,
  sliceStandardText,
  extractTexts,
} from '../pipeline/extract-texts.mjs';

const FIXTURE = [
  '(1) 성취기준',
  '[2수01-01] 수의 필요성을 인식하면서 0과 100까지의 수 개념을 이해하고,',
  '수를 세고 읽고 쓸 수 있다.',
  '[2수01-02] 일, 십, 백의 자릿값과 위치적 기수법을 이해하고, 수를 읽고 쓸 수 있다.',
  '(나) 성취기준 해설',
  '이 항목은 절취되면 안 되는 해설 내용이다.',
].join('\n');

test('CODE_PATTERN은 성취기준 코드 형식을 찾는다', () => {
  const found = [...FIXTURE.matchAll(CODE_PATTERN)].map((m) => m[0]);
  assert.deepEqual(found, ['[2수01-01]', '[2수01-02]']);
});

test('extractTexts는 코드별 본문을 절취한다 (다음 코드 전까지, 개행 정규화)', () => {
  const { texts, failures } = extractTexts(FIXTURE, ['[2수01-01]', '[2수01-02]']);
  assert.equal(failures.length, 0);
  assert.equal(
    texts.get('[2수01-01]'),
    '수의 필요성을 인식하면서 0과 100까지의 수 개념을 이해하고, 수를 세고 읽고 쓸 수 있다.'
  );
});

test('마지막 코드의 본문은 절 제목(해설)에서 끊는다', () => {
  const { texts } = extractTexts(FIXTURE, ['[2수01-02]']);
  assert.ok(texts.get('[2수01-02]').includes('위치적 기수법'));
  assert.ok(!texts.get('[2수01-02]').includes('해설'));
});

test('PDF에 없는 코드는 실패 목록으로 보고한다', () => {
  const { failures } = extractTexts(FIXTURE, ['[2수99-99]']);
  assert.deepEqual(failures.map((f) => f.code), ['[2수99-99]']);
  assert.equal(failures[0].reason, 'code-not-found');
});
