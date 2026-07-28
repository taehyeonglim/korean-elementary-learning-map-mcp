import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTexts } from '../pipeline/verify-texts.mjs';

const curriculaDoc = {
  curricula: [
    { standards: [{ code: '[2수01-01]' }, { code: '[2수01-02]' }] },
  ],
};

function validDoc() {
  return {
    texts: [
      { code: '[2수01-01]', text: '수 개념을 이해하고 수를 세고 읽고 쓸 수 있다.' },
      { code: '[2수01-02]', text: '자릿값과 위치적 기수법을 이해한다.' },
    ],
  };
}

test('정상 문서는 통과한다', () => {
  const result = verifyTexts(validDoc(), curriculaDoc);
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('누락·빈 원문·미지 코드를 각각 잡아낸다', () => {
  const missing = validDoc();
  missing.texts.pop();
  assert.equal(verifyTexts(missing, curriculaDoc).ok, false);

  const empty = validDoc();
  empty.texts[0].text = '   ';
  assert.equal(verifyTexts(empty, curriculaDoc).ok, false);

  const unknown = validDoc();
  unknown.texts[0].code = '[9수99-99]';
  assert.equal(verifyTexts(unknown, curriculaDoc).ok, false);
});

test('원문 안에 다른 성취기준 코드가 섞이면 절취 오류로 실패한다', () => {
  const embedded = validDoc();
  embedded.texts[0].text = '수 개념을 이해한다. [2수01-02] 자릿값도 이해한다.';
  const result = verifyTexts(embedded, curriculaDoc);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('절취')));
});
