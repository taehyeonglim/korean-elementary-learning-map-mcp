import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStore } from '../src/data-store.mjs';
import {
  normalizeText,
  suggestSimilar,
  searchStandards,
  searchTopics,
} from '../src/search.mjs';

const store = loadStore();

test('normalizeText는 NFC·소문자·공백을 정규화한다', () => {
  assert.equal(normalizeText('  네 자리   이하의 수 '), '네 자리 이하의 수');
  assert.equal(normalizeText('Mathematics'), 'mathematics');
});

test('코드 질의는 정확 일치가 최상위로 온다', () => {
  const { total, results } = searchStandards(store, { query: '2수01-01' });
  assert.ok(total >= 1);
  assert.equal(results[0].code, '[2수01-01]');
});

test('한국어 부분 일치 + subject 필터', () => {
  const { results } = searchStandards(store, { query: '분수', subject: '수학' });
  assert.ok(results.length >= 1);
  for (const r of results) assert.equal(r.subjectKorean, '수학');
});

test('gradeBand 필터는 정확 일치', () => {
  const { results } = searchStandards(store, { subject: '수학', gradeBand: '1-2' });
  assert.ok(results.length >= 1);
  for (const r of results) assert.equal(r.gradeBand, '1-2');
});

test('searchTopics: standardCode 필터는 연결된 주제만 반환한다', () => {
  const { results } = searchTopics(store, { standardCode: '2수01-01' });
  assert.ok(results.length >= 1);
  for (const r of results) {
    const topic = store.topicsById.get(r.id);
    assert.ok(topic.standards.includes('kr-2022-elem-math:[2수01-01]'));
  }
});

test('limit은 50으로 상한된다', () => {
  const { total, results } = searchTopics(store, { limit: 500 });
  assert.ok(total > 50);
  assert.equal(results.length, 50);
});

test('suggestSimilar는 오타에서 원 코드를 찾아낸다', () => {
  const suggestions = suggestSimilar('[2수01-1]', [...store.standardsByCode.keys()]);
  assert.ok(suggestions.includes('[2수01-01]'));
});

test('sequence가 없는 성취기준끼리의 tie-break는 코드 순으로 결정적이다', () => {
  const fakeStore = {
    allStandards: [
      { key: 'c:[9수03-02]', code: '[9수03-02]', subjectKorean: '수학', gradeBand: '1-2', domainKorean: '동일영역', summary: '공통 요약 텍스트' },
      { key: 'c:[9수03-01]', code: '[9수03-01]', subjectKorean: '수학', gradeBand: '1-2', domainKorean: '동일영역', summary: '공통 요약 텍스트' },
      { key: 'c:[9수01-01]', code: '[9수01-01]', subjectKorean: '수학', gradeBand: '1-2', domainKorean: '동일영역', summary: '공통 요약 텍스트' },
    ],
  };
  const { results } = searchStandards(fakeStore, { query: '공통 요약' });
  assert.deepEqual(
    results.map((r) => r.code),
    ['[9수01-01]', '[9수03-01]', '[9수03-02]']
  );
});

test('suggestSimilar는 동떨어진 입력에는 빈 배열을 반환한다', () => {
  const suggestions = suggestSimilar('zzzz-not-a-real-id-zzzz', [...store.standardsByCode.keys()]);
  assert.deepEqual(suggestions, []);
});
