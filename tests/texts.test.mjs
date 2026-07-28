import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStore } from '../src/data-store.mjs';
import { normalizeText, searchStandardTexts, makeSnippet } from '../src/search.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';

const store = loadStore();

test('원문 인덱스는 성취기준 620개 전부를 커버한다', () => {
  assert.equal(store.textsByCode.size, store.allStandards.length);
  for (const [, text] of store.textsByCode) assert.ok(text.trim().length >= 10);
});

test('makeSnippet은 매칭 주변만 자르고 생략 부호를 붙인다', () => {
  const text = 'a'.repeat(100) + '핵심어' + 'b'.repeat(100);
  const snippet = makeSnippet(text, '핵심어');
  assert.ok(snippet.startsWith('…') && snippet.endsWith('…'));
  assert.ok(snippet.includes('핵심어'));
  assert.ok(snippet.length < 100);
});

test('searchStandardTexts는 실제 원문 조각으로 해당 성취기준을 찾는다', () => {
  const sample = store.textsByCode.get('[2수01-01]');
  const probe = normalizeText(sample).slice(0, 8);
  const { total, results } = searchStandardTexts(store, { query: probe });
  assert.ok(total >= 1);
  assert.ok(results.some((r) => r.code === '[2수01-01]'));
  assert.ok(results[0].snippet.includes(probe.slice(0, 4)));
});

test('get_standard는 officialText를 포함하고 search_standard_text 도구가 동작한다', async () => {
  const server = createServer(store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(clientTransport);

  const detail = JSON.parse(
    (await client.callTool({ name: 'get_standard', arguments: { code: '2수01-01' } })).content[0].text
  );
  assert.ok(detail.officialText.length >= 10);

  const probe = normalizeText(store.textsByCode.get('[2수01-01]')).slice(0, 8);
  const search = JSON.parse(
    (await client.callTool({ name: 'search_standard_text', arguments: { query: probe } })).content[0].text
  );
  assert.ok(search.results.some((r) => r.code === '[2수01-01]'));
});
